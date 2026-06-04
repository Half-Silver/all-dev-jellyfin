#!/usr/bin/env python3
"""media-portal — companion web service shipped inside the all-dev-jellyfin snap.

This is the "plugin that lives with Jellyfin": a small, dependency-free HTTP
service (Python standard library only) that serves a web UI and a backend API
so an operator can, without touching Jellyfin's own admin UI:

  - upload media files directly into the snap's media library
    ($SNAP_COMMON/media/<category>);
  - mount a NAS share into the media area;
  - reset the Jellyfin admin password.

Design notes
------------
* Runs as its own snapd-managed daemon (the `media-portal` app in
  snapcraft.yaml), alongside the `jellyfin` daemon and the `ct-engine` sidecar.
  It shares $SNAP_COMMON with Jellyfin, so it can write the media dir and read
  Jellyfin's data dir directly.
* Frontend is intentionally a placeholder right now — the real UI design files
  will be dropped into portal/static/ later and wired to the /api endpoints
  below. Keep the API stable so the frontend can be swapped in independently.
* Two endpoints (NAS mount, password reset) are deliberately stubbed: their
  exact mechanism still needs verification (snapd mount-control capabilities on
  Core, and Jellyfin's password-reset mechanism). They return 501 with a clear
  message until implemented. See the TODOs.
"""

from __future__ import annotations

import glob
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


# ---------------------------------------------------------------------------
# Configuration (all from environment; see the media-portal app in snapcraft.yaml)
# ---------------------------------------------------------------------------

PORT = int(os.environ.get("PORTAL_PORT", "8097"))
STATIC_DIR = Path(os.environ.get("PORTAL_STATIC", os.path.join(os.environ.get("SNAP", ""), "portal-static")))
SNAP_COMMON = os.environ.get("SNAP_COMMON", "/tmp")
MEDIA_DIR = Path(os.environ.get("MEDIA_DIR", os.path.join(SNAP_COMMON, "media")))
JELLYFIN_URL = os.environ.get("JELLYFIN_URL", "http://127.0.0.1:8096").rstrip("/")
# Jellyfin's ProgramDataPath (where it writes passwordreset*.json). Matches the
# JELLYFIN_DATA_DIR set on the jellyfin app in snapcraft.yaml.
JELLYFIN_DATA_DIR = Path(os.environ.get("JELLYFIN_DATA_DIR", os.path.join(SNAP_COMMON, "data")))
# Soft demo cap shared with the ct-engine sidecar (15 GiB by default).
MEDIA_CAP_BYTES = int(os.environ.get("MEDIA_CAP_BYTES", str(15 * 1024 * 1024 * 1024)))
# Optional shared-secret auth. If PORTAL_TOKEN is set (e.g. via `snap set`), the
# API requires `Authorization: Bearer <token>`. Empty = open (demo default).
PORTAL_TOKEN = os.environ.get("PORTAL_TOKEN", "")

# rclone binary (staged into the snap) for the self-contained SMB mount path.
RCLONE_BIN = os.environ.get("RCLONE_BIN", os.path.join(os.environ.get("SNAP", ""), "usr/bin/rclone"))
RCLONE_CONFIG = Path(os.environ.get("RCLONE_CONFIG", os.path.join(SNAP_COMMON, "rclone.conf")))

# Relocating the media store: the whole library can be moved off the snap's
# (capped) writable area onto a host directory under one of these roots — the
# exact paths the removable-media interface makes writable. The snap can write
# only *subdirectories* of these, never the bare root (writing /media itself is
# denied). MEDIA_DIR then becomes a symlink to the chosen dir, so Jellyfin's
# library paths and uploads transparently follow it onto the external disk.
EXTERNAL_MEDIA_ROOTS = ("/media", "/mnt", "/run/media")
# Persisted choice (survives daemon restarts / reboots; reapplied on startup).
MEDIA_LOC_STATE = Path(os.environ.get("MEDIA_LOC_STATE", os.path.join(SNAP_COMMON, "media-location.json")))

# Categories the operator may upload into / that map to the seeded libraries.
# Maps category -> (Jellyfin library display name, collectionType).
CATEGORY_LIBRARIES = {
    "movies": ("Movies", "movies"),
    "tvshows": ("Shows", "tvshows"),
}
ALLOWED_CATEGORIES = tuple(CATEGORY_LIBRARIES.keys())


def log(msg: str) -> None:
    print(f"[media-portal] {msg}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def dir_size_bytes(path: Path) -> int:
    total = 0
    for root, _dirs, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


_SAFE_NAME = re.compile(r"[^A-Za-z0-9._ ()\-\[\]]+")


def safe_filename(name: str) -> str:
    """Reduce an arbitrary client-supplied name to a single safe path segment."""
    name = os.path.basename(name or "").strip()
    name = _SAFE_NAME.sub("_", name)
    name = name.lstrip(".") or "upload.bin"
    return name[:255]


def category_dir(category: str) -> Path:
    if category not in ALLOWED_CATEGORIES:
        raise ValueError(f"category must be one of {ALLOWED_CATEGORIES}")
    d = MEDIA_DIR / category
    d.mkdir(parents=True, exist_ok=True)
    return d


# ---------------------------------------------------------------------------
# Jellyfin server interaction
# ---------------------------------------------------------------------------

def jellyfin_request(method: str, path: str, body: dict | None = None,
                     token: str | None = None, timeout: int = 15) -> tuple[int, dict | None]:
    """Call the Jellyfin REST API. Returns (status_code, parsed_json_or_None)."""
    url = f"{JELLYFIN_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        # Jellyfin accepts the token via the MediaBrowser auth header.
        headers["Authorization"] = (
            f'MediaBrowser Client="media-portal", Device="snap", '
            f'DeviceId="media-portal", Version="0.1", Token="{token}"'
        )
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            parsed = json.loads(raw) if raw else None
            return resp.status, parsed
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            parsed = json.loads(raw) if raw else None
        except ValueError:
            parsed = {"raw": raw.decode("utf-8", "replace")}
        return exc.code, parsed
    except (urllib.error.URLError, OSError) as exc:
        return 0, {"error": str(exc)}


def find_passwordreset_pin() -> str | None:
    """Read the PIN Jellyfin wrote to passwordreset*.json in its data dir.

    Jellyfin's DefaultPasswordResetProvider writes the file under ProgramDataPath
    (= JELLYFIN_DATA_DIR). We glob a few likely roots to be robust across layouts
    and pick the most recently modified file.
    """
    roots = [JELLYFIN_DATA_DIR, JELLYFIN_DATA_DIR.parent, Path(SNAP_COMMON)]
    candidates: list[str] = []
    for root in roots:
        candidates += glob.glob(str(root / "passwordreset*.json"))
        candidates += glob.glob(str(root / "**" / "passwordreset*.json"), recursive=True)
    if not candidates:
        return None
    newest = max(set(candidates), key=lambda p: os.path.getmtime(p))
    try:
        with open(newest, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return None
    # Field name has historically been "Pin".
    pin = data.get("Pin") or data.get("pin")
    return {"pin": pin, "file": newest} if pin else None


# ---------------------------------------------------------------------------
# NAS mount registry + disk helpers
# ---------------------------------------------------------------------------

MOUNTS_STATE = Path(os.environ.get("MOUNTS_STATE", os.path.join(SNAP_COMMON, "mounts.json")))
_mounts_lock = threading.Lock()


def load_mounts() -> list[dict]:
    try:
        with open(MOUNTS_STATE, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return []


def save_mounts(mounts: list[dict]) -> None:
    with _mounts_lock:
        try:
            with open(MOUNTS_STATE, "w", encoding="utf-8") as fh:
                json.dump(mounts, fh)
        except OSError as exc:
            log(f"could not persist mounts: {exc}")


def register_mount(entry: dict) -> None:
    mounts = [m for m in load_mounts() if m.get("id") != entry.get("id")]
    mounts.insert(0, entry)
    save_mounts(mounts)


def mount_is_live(entry: dict) -> bool:
    """A mount is live if its mountpoint exists and (for a symlink) resolves."""
    mp = entry.get("mountpoint", "")
    if not mp:
        return False
    p = Path(mp)
    if p.is_symlink():
        return p.exists()
    return os.path.ismount(mp) or (p.is_dir() and any(p.iterdir()) if p.is_dir() else False)


def disk_usage(path: Path) -> tuple[int, int]:
    """(free_bytes, total_bytes) for the filesystem holding `path`."""
    try:
        st = os.statvfs(path)
        return st.f_bavail * st.f_frsize, st.f_blocks * st.f_frsize
    except OSError:
        return 0, 0


# ---------------------------------------------------------------------------
# Media store location (move the whole library onto an external /media dir)
# ---------------------------------------------------------------------------

def validate_external_target(path: str) -> Path:
    """Resolve a requested media dir; require a writable subdir of a removable
    root (never the bare root, which the snap can't write — see the upload bug)."""
    p = Path(path).resolve()
    for r in EXTERNAL_MEDIA_ROOTS:
        if str(p).startswith(r + os.sep) and str(p) != r:
            return p
    raise ValueError(f"path must be a subdirectory of {', '.join(EXTERNAL_MEDIA_ROOTS)}")


def media_location_state() -> dict:
    try:
        with open(MEDIA_LOC_STATE, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def save_media_location(state: dict) -> None:
    try:
        with open(MEDIA_LOC_STATE, "w", encoding="utf-8") as fh:
            json.dump(state, fh)
    except OSError as exc:
        log(f"could not persist media location: {exc}")


def media_is_external() -> bool:
    """The store is external when MEDIA_DIR is a symlink into a removable root."""
    try:
        if not MEDIA_DIR.is_symlink():
            return False
        target = str(MEDIA_DIR.resolve())
        return any(target.startswith(r + os.sep) for r in EXTERNAL_MEDIA_ROOTS)
    except OSError:
        return False


def media_target() -> Path:
    """Where the store physically lives (follows the symlink when external)."""
    try:
        return MEDIA_DIR.resolve()
    except OSError:
        return MEDIA_DIR


def _iter_files(base: Path):
    """Yield (absolute_path, path_relative_to_base) for every file under base."""
    for root, _dirs, files in os.walk(base):
        for f in files:
            full = Path(root) / f
            yield full, full.relative_to(base)


def relocate_media(target: Path) -> dict:
    """Move the whole media store onto `target` (a dir under a removable root).

    MEDIA_DIR ($SNAP_COMMON/media) becomes a symlink to `target`, so Jellyfin's
    existing library paths and the portal's uploads transparently follow it onto
    the external disk — escaping the demo cap. Existing internal media is merged
    in at file granularity; we never overwrite, and a pre-flight check aborts
    (before moving anything) if a file already exists at the destination.
    """
    target.mkdir(parents=True, exist_ok=True)

    moved = 0
    if MEDIA_DIR.is_symlink():
        MEDIA_DIR.unlink()                              # repoint an already-external store
    elif MEDIA_DIR.is_dir():
        files = list(_iter_files(MEDIA_DIR))            # snapshot before moving
        clashes = [str(rel) for _full, rel in files if (target / rel).exists()]
        if clashes:
            raise OSError(
                f"{len(clashes)} file(s) already exist under {target} "
                f"({', '.join(clashes[:3])}…); move or remove them on the host, then retry")
        for full, rel in files:                         # merge internal -> external
            dst = target / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(full), str(dst))
            moved += 1
        shutil.rmtree(MEDIA_DIR)                         # only empty dirs remain

    for cat in ALLOWED_CATEGORIES:                       # seed library folders at dest
        (target / cat).mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.parent.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.symlink_to(target)
    save_media_location({"target": str(target)})
    log(f"media store relocated to {target} (migrated {moved} file(s))")
    return {"target": str(target), "migrated": moved, "external": True}


def revert_media() -> dict:
    """Stop using the external store: restore $SNAP_COMMON/media as a real dir.

    The external content is left untouched on disk (not deleted); libraries will
    be empty until media is re-added internally."""
    if MEDIA_DIR.is_symlink():
        MEDIA_DIR.unlink()
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    for cat in ALLOWED_CATEGORIES:
        (MEDIA_DIR / cat).mkdir(parents=True, exist_ok=True)
    save_media_location({})
    log("media store reverted to internal $SNAP_COMMON/media")
    return {"target": str(MEDIA_DIR), "external": False}


def apply_media_location() -> None:
    """On startup, re-establish the external symlink if one was configured."""
    target = media_location_state().get("target")
    if not target:
        return
    try:
        tp = validate_external_target(target)
        if media_is_external() and media_target() == tp:
            return                                # already linked correctly
        relocate_media(tp)
    except (OSError, ValueError) as exc:
        log(f"could not re-establish external media at {target}: {exc}")


def set_rclone_section(section: str, lines: list[str]) -> None:
    """Upsert one [section] in the rclone config (one section per mount id)."""
    sections: dict[str, list[str]] = {}
    if RCLONE_CONFIG.exists():
        cur = None
        for line in RCLONE_CONFIG.read_text(encoding="utf-8").splitlines():
            if line.startswith("[") and line.endswith("]"):
                cur = line[1:-1]
                sections[cur] = []
            elif cur is not None and line.strip():
                sections[cur].append(line)
    sections[section] = lines
    out: list[str] = []
    for name, body in sections.items():
        out.append(f"[{name}]")
        out.extend(body)
        out.append("")
    RCLONE_CONFIG.write_text("\n".join(out), encoding="utf-8")


def start_rclone_mount(section: str, remote_path: str, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    subprocess.Popen(
        [RCLONE_BIN, "mount", f"{section}:{remote_path}", str(target),
         "--config", str(RCLONE_CONFIG), "--vfs-cache-mode", "full",
         "--read-only", "--daemon"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def remount_persisted() -> None:
    """On startup, re-establish mounts flagged persist=true (reboot survival)."""
    for entry in load_mounts():
        if not entry.get("persist") or mount_is_live(entry):
            continue
        try:
            if entry.get("proto") == "nfs":
                src = entry.get("remote", "")
                mp = Path(entry["mountpoint"])
                if os.path.isdir(src) and not mp.exists():
                    mp.parent.mkdir(parents=True, exist_ok=True)
                    mp.symlink_to(src)
            elif os.path.exists(RCLONE_BIN):
                start_rclone_mount(entry["id"], entry.get("remote_path", ""),
                                   Path(entry["mountpoint"]))
            log(f"remounted persisted share {entry.get('id')}")
        except (OSError, subprocess.SubprocessError) as exc:
            log(f"could not remount {entry.get('id')}: {exc}")


def existing_library_paths(token: str | None = None) -> set[str]:
    """Return the set of paths already covered by existing virtual folders."""
    status, vfs = jellyfin_request("GET", "/Library/VirtualFolders", token=token)
    paths: set[str] = set()
    if status == 200 and isinstance(vfs, list):
        for vf in vfs:
            for p in vf.get("Locations", []) or []:
                paths.add(p)
    return paths


def seed_libraries(token: str | None = None) -> list[dict]:
    """Create the Movies/Shows libraries pointing at MEDIA_DIR subdirs.

    Idempotent — skips any library whose path already exists. Returns a list of
    per-category outcomes.
    """
    have = existing_library_paths(token)
    out: list[dict] = []
    for category, (name, collection_type) in CATEGORY_LIBRARIES.items():
        path = str((MEDIA_DIR / category))
        Path(path).mkdir(parents=True, exist_ok=True)
        if path in have:
            out.append({"library": name, "path": path, "status": "exists"})
            continue
        from urllib.parse import quote
        qp = f"?name={quote(name)}&collectionType={collection_type}&paths={quote(path)}&refreshLibrary=false"
        status, result = jellyfin_request("POST", "/Library/VirtualFolders" + qp,
                                          {"LibraryOptions": {}}, token=token)
        out.append({"library": name, "path": path,
                    "status": "created" if status in (200, 204) else f"failed:{status}",
                    "detail": result})
    return out


def seed_libraries_when_ready() -> None:
    """Background best-effort: once Jellyfin answers, seed libraries.

    Works without a token only during Jellyfin's first-time setup window; if the
    server is already set up this will get 401/403 and the operator can later
    POST /api/seed-libraries with an admin token. We retry for a few minutes to
    cover the jellyfin daemon still starting.
    """
    deadline = time.time() + 300
    while time.time() < deadline:
        status, _ = jellyfin_request("GET", "/System/Info/Public", timeout=5)
        if status == 200:
            try:
                results = seed_libraries()
                log(f"startup library seed: {results}")
            except Exception as exc:  # never crash the daemon over seeding
                log(f"startup library seed error: {exc}")
            return
        time.sleep(5)
    log("startup library seed: Jellyfin did not become ready within 5min")


# ---------------------------------------------------------------------------
# Request handler
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "media-portal/0.1"

    # -- low-level response helpers ----------------------------------------

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        if not PORTAL_TOKEN:
            return True
        auth = self.headers.get("Authorization", "")
        return auth == f"Bearer {PORTAL_TOKEN}"

    def log_message(self, fmt: str, *args) -> None:  # route through our logger
        log(fmt % args)

    # -- routing -----------------------------------------------------------

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/api/status":
            return self._handle_status()
        if path == "/api/drives":
            return self._handle_drives()
        if path == "/api/users":
            return self._handle_users()
        if path == "/api/mounts":
            return self._handle_mounts()
        # static file serving
        return self._serve_static(path)

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if not self._authorized():
            return self._send_json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
        if path == "/api/upload":
            return self._handle_upload()
        if path == "/api/mount-nas":
            return self._handle_mount_nas()
        if path == "/api/reset-password":
            return self._handle_reset_password()
        if path == "/api/seed-libraries":
            return self._handle_seed_libraries()
        if path == "/api/media-location":
            return self._handle_media_location()
        if path == "/api/unmount":
            return self._handle_unmount()
        if path == "/api/scan":
            return self._handle_scan()
        if path == "/api/test-nas":
            return self._handle_test_nas()
        if path == "/api/remount":
            return self._handle_remount()
        if path == "/api/list-shares":
            return self._handle_list_shares()
        return self._send_json(HTTPStatus.NOT_FOUND, {"error": "no such endpoint"})

    def _validated_dest(self, dest_param: str) -> Path:
        """Resolve an upload destination and confirm it's inside an allowed root."""
        allowed_roots = [MEDIA_DIR.resolve(), Path("/media"), Path("/mnt"), Path("/run/media")]
        d = Path(dest_param).resolve()
        if not any(str(d) == str(r) or str(d).startswith(str(r) + os.sep) for r in allowed_roots):
            raise ValueError("destination outside allowed roots")
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _read_json_body(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw) if raw else {}
        except ValueError:
            return {}

    # -- endpoints ---------------------------------------------------------

    def _handle_status(self) -> None:
        used = dir_size_bytes(MEDIA_DIR) if MEDIA_DIR.exists() else 0
        disk_free, disk_total = disk_usage(MEDIA_DIR)
        external = media_is_external()
        # When the store lives on an external disk the demo cap doesn't apply:
        # report the REAL disk free/total. Otherwise the "free of total" must be
        # honest — the smaller of the demo cap remaining and actual disk free
        # (the snap's writable area can be much smaller than the 15 GiB cap, so
        # reporting cap-only made uploads appear to vanish when the disk filled).
        if external:
            cap = disk_total or MEDIA_CAP_BYTES
            free = disk_free
            over = False
        else:
            cap = MEDIA_CAP_BYTES
            cap_free = max(0, MEDIA_CAP_BYTES - used)
            free = min(cap_free, disk_free) if disk_free else cap_free
            over = used >= MEDIA_CAP_BYTES
        libraries = [{"id": cat, "name": name, "path": str(MEDIA_DIR / cat),
                      "size": dir_size_bytes(MEDIA_DIR / cat) if (MEDIA_DIR / cat).is_dir() else 0}
                     for cat, (name, _ct) in CATEGORY_LIBRARIES.items()]
        self._send_json(HTTPStatus.OK, {
            "jellyfin_url": JELLYFIN_URL,
            "media_dir": str(MEDIA_DIR),
            "media_root": str(MEDIA_DIR),
            "media_external": external,
            "media_target": str(media_target()),
            "media_roots": list(EXTERNAL_MEDIA_ROOTS),
            "categories": list(ALLOWED_CATEGORIES),
            "libraries": libraries,
            "usage_bytes": used,
            "cap_bytes": cap,
            "free_bytes": free,
            "total_bytes": cap,
            "disk_free_bytes": disk_free,
            "disk_total_bytes": disk_total,
            "usage_percent": round(used * 100 / cap, 1) if cap else 0,
            "over_cap": over,
        })

    def _handle_drives(self) -> None:
        """List mounted removable drives (reached via the removable-media plug).

        Returns the candidate roots the operator may want to import from / mount
        NAS next to: /media/*, /mnt/* (and their immediate children)."""
        roots = []
        for base in ("/media", "/mnt", "/run/media"):
            b = Path(base)
            if not b.is_dir():
                continue
            try:
                for child in sorted(b.iterdir()):
                    if child.is_dir():
                        free, total = disk_usage(child)
                        roots.append({"id": child.name, "name": child.name,
                                      "path": str(child), "dev": str(child),
                                      "free": free, "total": total})
            except OSError:
                pass
        self._send_json(HTTPStatus.OK, {"drives": roots})

    def _handle_upload(self) -> None:
        """Streaming upload into the chosen destination.

        Protocol (frontend uses fetch()/XHR with the file as the request body):
            POST /api/upload?category=movies&name=Movie.mkv      (named library)
            POST /api/upload?dest=<abs path>&name=Movie.mkv      (any allowed dir)
            <raw file bytes as the body>
        `dest` (if given) must resolve inside the media dir or a removable-media
        root (/media,/mnt,/run/media); otherwise `category` selects a library.
        The demo cap is enforced only for destinations inside the media dir.
        """
        from urllib.parse import parse_qs, urlparse
        qs = parse_qs(urlparse(self.path).query)
        name = qs.get("name", [self.headers.get("X-Filename", "")])[0]
        dest_param = qs.get("dest", [""])[0]

        in_media = True
        if dest_param:
            try:
                dest_dir = self._validated_dest(dest_param)
                in_media = str(dest_dir.resolve()).startswith(str(MEDIA_DIR.resolve()))
            except ValueError as exc:
                return self._send_json(HTTPStatus.FORBIDDEN, {"error": str(exc)})
        else:
            category = (qs.get("category", ["movies"])[0]).lower()
            try:
                dest_dir = category_dir(category)
            except ValueError as exc:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            return self._send_json(HTTPStatus.LENGTH_REQUIRED, {"error": "Content-Length required"})

        # Refuse if it won't fit: enforce BOTH the demo cap (internal media area
        # only — an external store is uncapped) and the real free space on the
        # target partition. Checking real space stops uploads silently failing
        # mid-write when the disk fills.
        disk_free, _ = disk_usage(dest_dir)
        capped = in_media and not media_is_external()
        cap_room = (MEDIA_CAP_BYTES - dir_size_bytes(MEDIA_DIR)) if capped else disk_free
        room = min(cap_room, disk_free) if disk_free else cap_room
        if length > room:
            return self._send_json(HTTPStatus.INSUFFICIENT_STORAGE, {
                "error": "not enough space for this file",
                "incoming_bytes": length,
                "available_bytes": max(0, room),
                "cap_room_bytes": max(0, cap_room),
                "disk_free_bytes": disk_free,
            })

        dest = dest_dir / safe_filename(name)
        tmp = dest.with_suffix(dest.suffix + ".part")
        remaining = length
        try:
            with open(tmp, "wb") as fh:
                while remaining > 0:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        break
                    fh.write(chunk)
                    remaining -= len(chunk)
            tmp.rename(dest)
        except OSError as exc:
            tmp.unlink(missing_ok=True)
            return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})

        log(f"uploaded {dest} ({length} bytes)")
        self._send_json(HTTPStatus.CREATED, {"saved": str(dest), "bytes": length})

    def _handle_mount_nas(self) -> None:
        """Mount a NAS share into the media area.

        snapd's mount-control interface does NOT allow cifs/nfs, so we use two
        strategies depending on protocol:
          - SMB/CIFS: self-contained via `rclone mount` over the fuse-support
            interface, mounting into $SNAP_COMMON/media/<mountpoint>.
          - NFS: cannot be mounted from inside strict confinement; instead the
            operator/gadget mounts it on the host under /mnt or /media (visible
            via removable-media) and we register/symlink that existing path.

        Request body (JSON):
            {"type":"smb"|"nfs", "source":"//host/share"|"host:/export",
             "mountpoint":"nas", "username":"...", "password":"...",
             "host_path":"/mnt/nas"  # nfs only: the already-host-mounted path
            }
        """
        body = self._read_json_body()
        nas_type = (body.get("type") or "").lower()
        name = body.get("name") or body.get("mountpoint") or "nas"
        mountname = safe_filename(body.get("mountpoint") or name)
        target = MEDIA_DIR / "nas" / mountname
        target.mkdir(parents=True, exist_ok=True)

        if nas_type in ("smb", "cifs"):
            return self._mount_rclone("smb", body, target, name)
        if nas_type == "webdav":
            return self._mount_rclone("webdav", body, target, name)
        if nas_type in ("nfs", "nfs4"):
            return self._register_nfs(body, target, name)
        return self._send_json(HTTPStatus.BAD_REQUEST,
                               {"error": "type must be 'smb', 'webdav' or 'nfs'"})

    def _mount_rclone(self, rtype: str, body: dict, target: Path, name: str) -> None:
        """Mount an SMB or WebDAV share via rclone over FUSE."""
        if not os.path.exists(RCLONE_BIN):
            return self._send_json(HTTPStatus.NOT_IMPLEMENTED, {
                "error": "rclone not available in this build",
                "detail": "stage rclone + connect fuse-support; see task #3",
            })
        section = safe_filename(name).replace(" ", "_") or "nas"
        try:
            section_lines, remote_path = self._rclone_section(rtype, body)
        except ValueError as exc:
            return self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
        try:
            set_rclone_section(section, section_lines)
            start_rclone_mount(section, remote_path, target)
        except (OSError, subprocess.SubprocessError) as exc:
            return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})
        entry = {"id": section, "name": name, "proto": rtype,
                 "remote": body.get("source", ""), "remote_path": remote_path,
                 "mountpoint": str(target), "persist": bool(body.get("persist")),
                 "library": body.get("library") or None, "status": "mounted"}
        register_mount(entry)
        log(f"{rtype} mount started: {body.get('source','')} -> {target}")
        self._send_json(HTTPStatus.ACCEPTED, {"mount": entry})

    def _rclone_section(self, rtype: str, body: dict) -> tuple[list[str], str]:
        """Build the rclone config section lines + remote path for a share."""
        source = body.get("source", "")
        user = body.get("username", "")
        obscured = ""
        if body.get("password"):
            obscured = subprocess.run([RCLONE_BIN, "obscure", body["password"]],
                                      capture_output=True, text=True, timeout=10).stdout.strip()
        if rtype == "smb":
            m = re.match(r"^/*([^/]+)/(.+)$", source.replace("\\", "/"))
            if not m:
                raise ValueError("source must be //host/share")
            host, remote_path = m.group(1), m.group(2)
            return ([f"type = smb", f"host = {host}", f"user = {user}", f"pass = {obscured}"],
                    remote_path)
        # webdav
        return ([f"type = webdav", f"url = {source}", "vendor = other",
                 f"user = {user}", f"pass = {obscured}"], "")

    def _register_nfs(self, body: dict, target: Path, name: str) -> None:
        host_path = body.get("host_path") or body.get("source", "")
        if not host_path or not os.path.isdir(host_path):
            return self._send_json(HTTPStatus.BAD_REQUEST, {
                "error": "NFS must be host-mounted first",
                "detail": ("Mount it on the host under /mnt or /media (e.g. "
                           "`mount -t nfs4 host:/export /mnt/nas`), then add it here "
                           "with the host path."),
            })
        link = target
        try:
            if link.is_symlink() or link.exists():
                if link.is_symlink() or link.is_file():
                    link.unlink()
                else:
                    link.rmdir()
            link.symlink_to(host_path)
        except OSError as exc:
            return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})
        entry = {"id": safe_filename(name), "name": name, "proto": "nfs",
                 "remote": host_path, "mountpoint": str(link),
                 "persist": bool(body.get("persist")), "library": body.get("library") or None,
                 "status": "mounted"}
        register_mount(entry)
        log(f"nfs registered: {host_path} -> {link}")
        self._send_json(HTTPStatus.OK, {"mount": entry})

    def _handle_unmount(self) -> None:
        body = self._read_json_body()
        mount_id = body.get("id", "")
        mounts = load_mounts()
        entry = next((m for m in mounts if m.get("id") == mount_id), None)
        if not entry:
            return self._send_json(HTTPStatus.NOT_FOUND, {"error": "no such mount"})
        mp = entry.get("mountpoint", "")
        try:
            if Path(mp).is_symlink():
                Path(mp).unlink()
            else:
                for tool in ("fusermount3", "fusermount"):
                    if shutil.which(tool):
                        subprocess.run([tool, "-u", mp], capture_output=True, timeout=15)
                        break
        except (OSError, subprocess.SubprocessError) as exc:
            return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})
        save_mounts([m for m in mounts if m.get("id") != mount_id])
        log(f"unmounted {mount_id}")
        self._send_json(HTTPStatus.OK, {"unmounted": mount_id})

    def _handle_remount(self) -> None:
        """Retry a failed mount, reusing its persisted rclone section / nfs path."""
        body = self._read_json_body()
        entry = next((m for m in load_mounts() if m.get("id") == body.get("id")), None)
        if not entry:
            return self._send_json(HTTPStatus.NOT_FOUND, {"error": "no such mount"})
        try:
            if entry.get("proto") == "nfs":
                src = entry.get("remote", "")
                mp = Path(entry["mountpoint"])
                if not os.path.isdir(src):
                    return self._send_json(HTTPStatus.OK, {"ok": False,
                        "detail": "NFS share is not host-mounted; mount it under /mnt or /media first."})
                if not mp.exists():
                    mp.parent.mkdir(parents=True, exist_ok=True)
                    mp.symlink_to(src)
            elif os.path.exists(RCLONE_BIN):
                start_rclone_mount(entry["id"], entry.get("remote_path", ""), Path(entry["mountpoint"]))
            else:
                return self._send_json(HTTPStatus.OK, {"ok": False, "detail": "rclone unavailable"})
        except (OSError, subprocess.SubprocessError) as exc:
            return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})
        self._send_json(HTTPStatus.OK, {"ok": True})

    def _handle_mounts(self) -> None:
        mounts = load_mounts()
        for m in mounts:
            m["status"] = "mounted" if mount_is_live(m) else "error"
            if m["status"] == "error" and "error" not in m:
                m["error"] = "Mount is not responding (share offline or unmounted)"
        self._send_json(HTTPStatus.OK, {"mounts": mounts})

    def _handle_users(self) -> None:
        """List Jellyfin accounts via the anonymous public-users endpoint."""
        status, users = jellyfin_request("GET", "/Users/Public")
        if status != 200 or not isinstance(users, list):
            return self._send_json(HTTPStatus.OK, {"users": []})
        out = [{"id": u.get("Id"), "name": u.get("Name"),
                "role": "Administrator" if (u.get("Policy") or {}).get("IsAdministrator") else "User",
                "hasPassword": u.get("HasPassword", True)} for u in users]
        self._send_json(HTTPStatus.OK, {"users": out})

    def _handle_scan(self) -> None:
        """Trigger a Jellyfin library refresh (best-effort)."""
        body = self._read_json_body()
        token = body.get("token")
        status, _ = jellyfin_request("POST", "/Library/Refresh", token=token)
        ok = status in (200, 204)
        self._send_json(HTTPStatus.OK if ok else HTTPStatus.ACCEPTED,
                        {"scan_started": ok, "jellyfin_status": status})

    def _handle_test_nas(self) -> None:
        """Test reachability of a share before mounting.

        SMB/WebDAV: `rclone lsd` against a temp section. NFS: confirm the share
        was host-mounted (the path exists and is a directory).
        """
        body = self._read_json_body()
        nas_type = (body.get("type") or "").lower()
        if nas_type in ("nfs", "nfs4"):
            hp = body.get("host_path") or body.get("source", "")
            if hp and os.path.isdir(hp):
                return self._send_json(HTTPStatus.OK, {"ok": True, "msg": f"{hp} is mounted and readable."})
            return self._send_json(HTTPStatus.OK, {"ok": False,
                "msg": "NFS share is not host-mounted yet. Mount it under /mnt or /media first."})
        if not os.path.exists(RCLONE_BIN):
            return self._send_json(HTTPStatus.OK, {"ok": False, "msg": "rclone not available in this build."})
        rtype = "smb" if nas_type in ("smb", "cifs") else "webdav"
        try:
            lines, remote_path = self._rclone_section(rtype, body)
        except ValueError as exc:
            return self._send_json(HTTPStatus.OK, {"ok": False, "msg": str(exc)})
        try:
            set_rclone_section("_test", lines)
            res = subprocess.run([RCLONE_BIN, "lsd", f"_test:{remote_path}",
                                  "--config", str(RCLONE_CONFIG), "--low-level-retries", "1",
                                  "--timeout", "8s", "--contimeout", "8s"],
                                 capture_output=True, text=True, timeout=20)
        except (OSError, subprocess.SubprocessError) as exc:
            return self._send_json(HTTPStatus.OK, {"ok": False, "msg": str(exc)})
        if res.returncode == 0:
            return self._send_json(HTTPStatus.OK, {"ok": True, "msg": "Share is reachable and readable."})
        err = (res.stderr or "").strip().splitlines()
        return self._send_json(HTTPStatus.OK, {"ok": False,
            "msg": err[-1] if err else "Could not reach the share. Check host, share and credentials."})

    def _handle_list_shares(self) -> None:
        """List SMB shares on a host (replaces `smbclient -L`), via `rclone lsd`.

        Body: {"host":"192.168.1.6","username":"...","password":"..."}
        """
        body = self._read_json_body()
        if not os.path.exists(RCLONE_BIN):
            return self._send_json(HTTPStatus.OK, {"ok": False, "shares": [], "msg": "rclone not available"})
        host = body.get("host", "")
        if not host:
            return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "host required"})
        obscured = ""
        if body.get("password"):
            try:
                obscured = subprocess.run([RCLONE_BIN, "obscure", body["password"]],
                                          capture_output=True, text=True, timeout=10).stdout.strip()
            except (OSError, subprocess.SubprocessError):
                pass
        set_rclone_section("_disc", ["type = smb", f"host = {host}",
                                     f"user = {body.get('username','')}", f"pass = {obscured}"])
        try:
            res = subprocess.run([RCLONE_BIN, "lsd", "_disc:", "--config", str(RCLONE_CONFIG),
                                  "--low-level-retries", "1", "--timeout", "8s", "--contimeout", "8s"],
                                 capture_output=True, text=True, timeout=20)
        except (OSError, subprocess.SubprocessError) as exc:
            return self._send_json(HTTPStatus.OK, {"ok": False, "shares": [], "msg": str(exc)})
        if res.returncode != 0:
            err = (res.stderr or "").strip().splitlines()
            return self._send_json(HTTPStatus.OK, {"ok": False, "shares": [],
                "msg": err[-1] if err else "Could not list shares (check host / credentials)."})
        # `rclone lsd` lines look like: "          -1 2024-... -1 ShareName"
        shares = []
        for line in res.stdout.splitlines():
            parts = line.split(None, 4)
            if len(parts) >= 5:
                shares.append(parts[4])
        return self._send_json(HTTPStatus.OK, {"ok": True, "shares": shares})

    def _handle_reset_password(self) -> None:
        """Reset a Jellyfin user's password via the anonymous in-network PIN flow.

        1. POST /Users/ForgotPassword {EnteredUsername} -> Jellyfin writes
           passwordreset*.json (the PIN) into its data dir.
        2. Read the PIN locally (we share the data dir) and ALWAYS return it so
           the operator can finish in Jellyfin's own Forgot-Password dialog if
           our automation can't (it 500s on some versions — issue #16579).
        3. If a new password was supplied, try to redeem the PIN and set it,
           reporting each step truthfully (no false "success").

        Body: {"username": "<user>", "new_password": "<optional>"}
        """
        body = self._read_json_body()
        username = body.get("username", "")
        new_password = body.get("new_password")
        if not username:
            return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "username required"})

        status, _ = jellyfin_request("POST", "/Users/ForgotPassword",
                                     {"EnteredUsername": username})
        if status == 0:
            return self._send_json(HTTPStatus.BAD_GATEWAY,
                                   {"error": "could not reach Jellyfin"})

        # Give the server a moment to write the PIN file, then read it.
        found = None
        for _ in range(12):
            found = find_passwordreset_pin()
            if found:
                break
            time.sleep(0.3)
        if not found:
            return self._send_json(HTTPStatus.OK, {
                "ok": False,
                "detail": ("Jellyfin did not create a reset PIN — the username may "
                           "be wrong, or in-network password reset is disabled. "
                           f"Checked {JELLYFIN_DATA_DIR}."),
            })

        pin, pin_file = found["pin"], found["file"]
        resp = {"ok": True, "pin": pin, "pin_file": pin_file, "username": username,
                "pin_redeemed": False, "new_password_set": False, "password_blank": False}

        if not new_password:
            # "Show the PIN" mode — operator finishes in Jellyfin.
            resp["detail"] = "Enter this PIN in Jellyfin (login → Forgot Password) to finish."
            return self._send_json(HTTPStatus.OK, resp)

        # Try to finish automatically: redeem the PIN (blanks the password)…
        rstatus, rresult = jellyfin_request("POST", "/Users/ForgotPassword/Pin", {"Pin": pin})
        if rstatus in (200, 204):
            resp["pin_redeemed"] = True
            resp["password_blank"] = True
            # …then set the requested password.
            ok, detail = self._set_password(username, new_password)
            resp["new_password_set"] = ok
            if not ok:
                resp["detail"] = ("Password was reset to BLANK but setting the new one "
                                  "failed (" + detail + "). Log in with an empty password "
                                  "and set it, or use the PIN above in Jellyfin.")
        else:
            resp["detail"] = ("Automatic PIN redeem failed (Jellyfin status "
                              + str(rstatus) + "). Use the PIN above in Jellyfin's "
                              "Forgot-Password dialog to finish.")
            resp["jellyfin_result"] = rresult
        self._send_json(HTTPStatus.OK, resp)

    def _set_password(self, username: str, new_password: str) -> tuple[bool, str]:
        """After a blank-reset, authenticate (empty pw) and set a new password."""
        status, auth = jellyfin_request("POST", "/Users/AuthenticateByName",
                                        {"Username": username, "Pw": ""})
        if status >= 400 or not auth:
            return False, f"auth after reset failed (status {status})"
        token = auth.get("AccessToken")
        user_id = (auth.get("User") or {}).get("Id")
        if not token or not user_id:
            return False, "auth response missing token/user id"
        status, _ = jellyfin_request("POST", f"/Users/{user_id}/Password",
                                     {"CurrentPw": "", "NewPw": new_password}, token=token)
        if status >= 400:
            return False, f"set password failed (status {status})"
        return True, "ok"

    def _handle_seed_libraries(self) -> None:
        """Create the Movies/Shows libraries pointing at the media dir.

        Idempotent: skips libraries that already exist. Uses POST
        /Library/VirtualFolders, which is anonymous during Jellyfin first-time
        setup; after setup completes it needs an admin token (pass {"token": ...}).
        """
        body = self._read_json_body()
        token = body.get("token")
        results = seed_libraries(token)
        self._send_json(HTTPStatus.OK, {"results": results})

    def _handle_media_location(self) -> None:
        """Move the whole media store onto an external dir, or revert to internal.

            POST /api/media-location  {"path": "/media/jellyfin"}   # relocate
            POST /api/media-location  {"reset": true}               # back to internal

        `path` must be a subdirectory of /media, /mnt or /run/media (the
        removable-media-writable area). On success the store is symlinked there
        and the Movies/Shows libraries are (re)registered against it.
        """
        body = self._read_json_body()
        if body.get("reset"):
            return self._send_json(HTTPStatus.OK, revert_media())
        path = (body.get("path") or "").strip()
        if not path:
            return self._send_json(HTTPStatus.BAD_REQUEST, {
                "error": "provide `path` (a dir under /media, /mnt or /run/media) "
                         "or `reset: true`"})
        try:
            target = validate_external_target(path)
        except ValueError as exc:
            return self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
        try:
            result = relocate_media(target)
        except OSError as exc:
            # name clash during migration, or the snap can't write the target
            # (e.g. removable-media not connected) — surface it cleanly.
            return self._send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
        # Re-point Jellyfin at the (possibly fresh) external library folders.
        result["libraries"] = seed_libraries(body.get("token"))
        self._send_json(HTTPStatus.OK, result)

    # -- static files ------------------------------------------------------

    def _serve_static(self, path: str) -> None:
        rel = path.lstrip("/") or "index.html"
        target = (STATIC_DIR / rel).resolve()
        # Prevent path traversal outside STATIC_DIR.
        try:
            target.relative_to(STATIC_DIR.resolve())
        except ValueError:
            return self._send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            return self._send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})

        ctype = {
            ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
            ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
            ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2",
        }.get(target.suffix, "application/octet-stream")
        data = target.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> int:
    # Re-establish an external media store (symlink) before creating dirs/seeding,
    # so everything below operates on the relocated location.
    apply_media_location()
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    for cat in ALLOWED_CATEGORIES:
        (MEDIA_DIR / cat).mkdir(parents=True, exist_ok=True)
    log(f"serving on 0.0.0.0:{PORT}  media_dir={MEDIA_DIR}  "
        f"external={media_is_external()}  static={STATIC_DIR}")
    if not PORTAL_TOKEN:
        log("WARNING: PORTAL_TOKEN unset — API is open (set it via `snap set` for auth)")
    # Best-effort: seed the Movies/Shows libraries once Jellyfin is reachable.
    threading.Thread(target=seed_libraries_when_ready, daemon=True).start()
    # Re-establish any persist=true NAS mounts after a reboot.
    remount_persisted()
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
