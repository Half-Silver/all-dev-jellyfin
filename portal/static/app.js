/* ============================================================
   JellyMan — media-portal frontend (vanilla JS).
   Faithful recreation of the JellyMan design, wired to the real
   media-portal /api endpoints. No framework/CDN: ships in an
   offline snap. Markup/classes mirror the design's CSS exactly.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- icons (ported 1:1 from the design) ---------- */
  var DEF = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var ICN = {
    jelly: { a: 'fill="none"', i: '<path d="M4 11a8 8 0 0 1 16 0v1H4v-1Z" fill="white"/><path d="M6 12c0 2 .5 4 1 6m4-6v7m4-7c0 2-.5 4-1 6" stroke="white" stroke-width="1.6" stroke-linecap="round"/>' },
    upload: { i: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>' },
    server: { i: '<rect x="2" y="3" width="20" height="7" rx="2"/><rect x="2" y="14" width="20" height="7" rx="2"/><line x1="6" y1="6.5" x2="6.01" y2="6.5"/><line x1="6" y1="17.5" x2="6.01" y2="17.5"/>' },
    key: { i: '<path d="M21 2l-2 2m-7.6 7.6a5 5 0 1 0-1 1l3.5 3.5L16 15l1.5 1.5L20 14l-3.5-3.5L18 9l-2.5-2.5"/>' },
    folderOpen: { i: '<path d="M6 14l1.5-2.5A2 2 0 0 1 9.2 10.5H22M2 5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v2"/><path d="M2 5v14a2 2 0 0 0 2 2h14.5a2 2 0 0 0 1.7-1l2.3-7.5"/>' },
    drive: { i: '<rect x="2" y="4" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="6" rx="2"/><circle cx="17.5" cy="8" r="1" fill="currentColor"/><circle cx="17.5" cy="17" r="1" fill="currentColor"/>' },
    usb: { i: '<circle cx="12" cy="20" r="1.6"/><path d="M12 18.4V5"/><path d="M9 8l3-3 3 3"/><path d="M12 12l3.5-2 .3-2.5"/><circle cx="16" cy="6.5" r="1.3"/><path d="M12 13.6 8.5 11.6V9"/><rect x="7" y="6.4" width="3" height="2.4" rx=".4"/>' },
    check: { a: 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"', i: '<polyline points="20 6 9 17 4 12"/>' },
    x: { i: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' },
    alert: { i: '<path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
    info: { i: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>' },
    loader: { a: 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"', i: '<path d="M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9"/>' },
    chevR: { i: '<polyline points="9 18 15 12 9 6"/>' },
    plus: { i: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' },
    eject: { i: '<path d="M5 17h14"/><path d="M12 4 5 13h14L12 4Z"/>' },
    plug: { i: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v5"/>' },
    refresh: { i: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>' },
    eye: { i: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>' },
    eyeOff: { i: '<path d="M17.9 17.9A10.4 10.4 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.1-6M9.9 4.2A10.1 10.1 0 0 1 12 4c7 0 11 8 11 8a18.7 18.7 0 0 1-2.2 3.2M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2"/>' },
    shield: { i: '<path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z"/>' },
    film: { i: '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5"/>' },
    music: { i: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
    tv: { i: '<rect x="2" y="7" width="20" height="14" rx="2"/><polyline points="17 2 12 7 7 2"/>' },
    scan: { i: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/>' },
    hd: { i: '<circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20"/>' },
    link: { i: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>' },
    lock: { i: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
    file: { i: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' }
  };
  function ic(name, cls, size) {
    var o = ICN[name]; if (!o) return "";
    var s = size || 16;
    return '<svg class="' + (cls || "") + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' + (o.a || DEF) + '>' + o.i + "</svg>";
  }

  /* ---------- helpers ---------- */
  function fmtBytes(b) {
    if (!b) return "0 B";
    var k = 1024, u = ["B", "KB", "MB", "GB", "TB"];
    var i = Math.min(Math.floor(Math.log(b) / Math.log(k)), u.length - 1);
    var v = b / Math.pow(k, i);
    return v.toFixed(i === 0 ? 0 : (v >= 100 ? 0 : 1)) + " " + u[i];
  }
  function cx() { return [].slice.call(arguments).filter(Boolean).join(" "); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fileKind(name) {
    var ext = (name.split(".").pop() || "").toLowerCase();
    if (["mkv", "mp4", "avi", "mov", "m4v", "webm", "ts"].indexOf(ext) >= 0) return "film";
    if (["mp3", "flac", "aac", "wav", "m4a", "ogg"].indexOf(ext) >= 0) return "music";
    return "file";
  }
  function avatarColor(name) {
    var hues = [248, 305, 156, 24, 78, 200], h = 0;
    for (var i = 0; i < name.length; i++) h += name.charCodeAt(i);
    var hue = hues[h % hues.length];
    return "linear-gradient(135deg, oklch(0.62 0.16 " + hue + "), oklch(0.58 0.17 " + ((hue + 40) % 360) + "))";
  }
  function initials(name) { return name.split(/[\s_-]+/).map(function (s) { return s[0]; }).join("").slice(0, 2).toUpperCase(); }
  function uid() { return Math.random().toString(36).slice(2); }

  function api(method, path, body) {
    return fetch(path, {
      method: method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; }).catch(function () { return { ok: r.ok, status: r.status, body: {} }; }); })
      .catch(function (e) { return { ok: false, status: 0, body: { error: String(e) } }; });
  }

  /* ---------- toasts ---------- */
  var toastWrap;
  function toast(kind, title, msg, duration) {
    if (!toastWrap) { toastWrap = document.createElement("div"); toastWrap.className = "toasts"; document.body.appendChild(toastWrap); }
    var icon = { ok: "check", err: "alert", info: "info" }[kind] || "info";
    var node = document.createElement("div");
    node.className = "toast " + kind;
    node.innerHTML = ic(icon, "ti", 20) + '<div class="body"><b>' + esc(title) + "</b>" + (msg ? "<span>" + esc(msg) + "</span>" : "") + '</div><div class="x">' + ic("x", "", 15) + "</div>";
    node.querySelector(".x").onclick = function () { node.remove(); };
    toastWrap.appendChild(node);
    setTimeout(function () { node.remove(); }, duration || 4600);
  }

  function statusBadge(status) {
    var map = { mounted: { c: "ok", l: "Mounted" }, error: { c: "err", l: "Error" }, mounting: { c: "busy", l: "Mounting…" }, unmounting: { c: "busy", l: "Unmounting…" } };
    var s = map[status] || { c: "idle", l: status };
    var inner = (status === "mounting" || status === "unmounting") ? ic("loader", "spin", 12) : '<span class="dot" style="background:currentColor"></span>';
    return '<span class="badge ' + s.c + '">' + inner + s.l + "</span>";
  }

  /* ---------- global state ---------- */
  var S = { tab: "upload", status: null, drives: [], mounts: [], users: [], me: { name: "admin", role: "Administrator" } };

  /* ---------- shell ---------- */
  function renderShell() {
    var tabs = [
      { id: "upload", label: "Upload", icon: "upload" },
      { id: "nas", label: "Network Storage", icon: "server", count: S.mounts.length },
      { id: "password", label: "Password", icon: "key" }
    ];
    var ver = S.status && S.status.jellyfin_url ? "snap" : "snap";
    document.getElementById("root").innerHTML =
      '<div class="app">' +
      '<header class="topbar">' +
        '<div class="brand"><div class="brand-mark">' + ic("jelly", "", 18) + '</div><div class="brand-name">Jelly<span class="sub">Man</span></div></div>' +
        '<div class="topbar-spacer"></div>' +
        '<div class="host-pill hide-sm"><span class="dot"></span><span>Jellyfin</span><span class="mono">10.x · ' + ver + '</span></div>' +
        '<div class="admin-chip"><div class="avatar" style="background:' + avatarColor(S.me.name) + '">' + initials(S.me.name) + '</div>' +
          '<div class="meta hide-sm"><b>' + esc(S.me.name) + '</b><span>' + esc(S.me.role) + '</span></div></div>' +
      '</header>' +
      '<div class="tabs-wrap"><nav class="tabs">' +
        tabs.map(function (t) {
          return '<button class="' + cx("tab", S.tab === t.id && "active") + '" data-tab="' + t.id + '">' + ic(t.icon, "", 17) + "<span>" + t.label + "</span>" +
            (t.count != null ? '<span class="count">' + t.count + "</span>" : "") + "</button>";
        }).join("") +
      '</nav></div>' +
      '<main class="main" id="main"></main>' +
      "</div>";
    [].forEach.call(document.querySelectorAll(".tab"), function (b) {
      b.onclick = function () { S.tab = b.getAttribute("data-tab"); renderShell(); renderTab(); };
    });
    renderTab();
  }
  function renderTab() {
    if (S.tab === "upload") return renderUpload();
    if (S.tab === "nas") return renderNas();
    if (S.tab === "password") return renderPassword();
  }

  /* ============================================================
     UPLOAD TAB
     ============================================================ */
  var up = { dest: null, queue: [], autoScan: true };
  function destinations() {
    var st = S.status || { media_root: "/media", libraries: [] };
    var libs = (st.libraries || []).map(function (l) {
      return { kind: "lib", id: l.id, label: l.name, path: l.path, icon: l.id === "tvshows" ? "tv" : "film", size: l.size };
    });
    var usb = (S.drives || []).map(function (d) {
      return { kind: "usb", id: d.id, label: d.name, path: d.path, free: d.free, total: d.total };
    });
    return { root: { kind: "root", id: "root", label: (st.media_root || "").split("/").pop() || "media", path: st.media_root }, libs: libs, usb: usb };
  }
  function renderUpload() {
    var d = destinations();
    if (!up.dest) up.dest = d.libs[0] || d.root;
    var st = S.status || {};
    var sel = up.dest;
    var free = sel.kind === "usb" ? sel.free : st.free_bytes;
    var total = sel.kind === "usb" ? sel.total : st.total_bytes;
    var usedPct = total ? (1 - free / total) * 100 : 0;
    var rootName = (st.media_root || "").split("/").pop() || "media";

    var sidebar =
      '<div class="card"><div class="loc-group">' +
        '<div class="loc-group-label">' + ic("folderOpen", "", 13) + " Media library</div>" +
        '<div class="' + cx("loc", sel.kind === "root" && "active") + '" data-d="root">' + ic("hd", "loc-ic", 17) +
          '<span class="nm">' + esc(rootName) + ' <span class="muted">(root)</span></span></div>' +
        d.libs.map(function (l) {
          return '<div class="' + cx("loc", "sub", sel.kind === "lib" && sel.id === l.id && "active") + '" data-d="lib:' + esc(l.id) + '">' +
            ic(l.icon, "loc-ic", 17) + '<span class="nm">' + esc(l.label) + "</span>" +
            (l.size != null ? '<span class="sz">' + fmtBytes(l.size) + "</span>" : "") + "</div>";
        }).join("") +
      '</div><div class="sep" style="margin:4px 0"></div>' +
      '<div class="loc-group"><div class="loc-group-label">' + ic("usb", "", 13) + " USB drives</div>" +
        (d.usb.length ? d.usb.map(function (u) {
          return '<div class="' + cx("loc", sel.kind === "usb" && sel.id === u.id && "active") + '" data-d="usb:' + esc(u.id) + '">' +
            ic("drive", "loc-ic", 17) + '<span class="nm">' + esc(u.label) +
            '<div class="usb-meta">' + fmtBytes(u.free) + " free of " + fmtBytes(u.total) + "</div></span></div>";
        }).join("") : '<div class="empty" style="padding:16px 8px"><span class="muted">No USB drives detected</span></div>') +
      "</div></div>";

    var crumbs = (sel.path || "").replace(st.media_root || "", "…").split("/").filter(Boolean);
    var destBar =
      '<div class="dest-bar"><div class="crumbs">' +
        crumbs.map(function (seg, i) { return '<span class="' + (i === crumbs.length - 1 ? "seg-c" : "muted") + '">' + esc(seg) + "</span>" + (i < crumbs.length - 1 ? '<span class="slash">/</span>' : ""); }).join("") +
      '</div><div class="disk"><div class="lab"><b>' + fmtBytes(free) + " free</b><span>of " + fmtBytes(total) + "</span></div>" +
      '<div class="bar thin"><i style="width:' + usedPct + '%"></i></div></div>' +
      '<button class="btn sm" id="newFolderBtn">' + ic("plus") + " New folder</button></div>";

    var dropzone =
      '<div class="dropzone" id="dropzone">' + ic("upload", "dz-ic", 46) +
      "<h3>Drop files or folders here</h3><p>Uploading to <b class=\"dim\">" + esc(sel.label) + "</b> · or <span style=\"color:var(--accent)\">browse your computer</span></p>" +
      '<input id="fileInput" type="file" multiple hidden></div>';

    document.getElementById("main").innerHTML =
      '<div class="fade"><div class="page-head"><h1>Upload media</h1>' +
      "<p>Drop files straight into your Jellyfin library folders or a connected USB drive. Large files stream directly to the server.</p></div>" +
      '<div class="upload-grid">' + sidebar +
      '<div class="col" style="gap:16px">' + destBar +
      '<div id="newFolderRow"></div>' + dropzone +
      '<div id="sampleRow"></div><div id="queueCard"></div></div></div></div>';

    [].forEach.call(document.querySelectorAll(".loc[data-d]"), function (n) {
      n.onclick = function () {
        var v = n.getAttribute("data-d");
        if (v === "root") up.dest = d.root;
        else if (v.indexOf("lib:") === 0) up.dest = d.libs.filter(function (l) { return l.id === v.slice(4); })[0];
        else if (v.indexOf("usb:") === 0) up.dest = d.usb.filter(function (u) { return u.id === v.slice(4); })[0];
        renderUpload();
      };
    });
    var dz = document.getElementById("dropzone"), fi = document.getElementById("fileInput");
    dz.onclick = function () { fi.click(); };
    dz.ondragover = function (e) { e.preventDefault(); dz.classList.add("drag"); };
    dz.ondragleave = function () { dz.classList.remove("drag"); };
    dz.ondrop = function (e) { e.preventDefault(); dz.classList.remove("drag"); addFiles(e.dataTransfer.files); };
    fi.onchange = function (e) { addFiles(e.target.files); };
    document.getElementById("newFolderBtn").onclick = toggleNewFolder;
    paintQueue();
  }

  function toggleNewFolder() {
    var row = document.getElementById("newFolderRow");
    if (row.innerHTML) { row.innerHTML = ""; return; }
    row.innerHTML = '<div class="card card-pad fade" style="display:flex;gap:10px;align-items:center">' +
      '<input class="input mono" id="nfName" autofocus placeholder="e.g. 2024"><button class="btn primary" id="nfCreate">Create</button>' +
      '<button class="btn ghost" id="nfCancel">Cancel</button></div>';
    document.getElementById("nfCancel").onclick = function () { row.innerHTML = ""; };
    document.getElementById("nfCreate").onclick = function () {
      var nm = document.getElementById("nfName").value.trim().replace(/[^A-Za-z0-9 _\-]/g, "");
      if (!nm) return;
      up.dest = { kind: up.dest.kind, id: up.dest.id, label: nm, path: up.dest.path + "/" + nm, icon: up.dest.icon };
      toast("ok", "Folder selected", "New files will go to …/" + nm + " (created on first upload)");
      renderUpload();
    };
  }

  function addFiles(fileList) {
    var arr = [].slice.call(fileList); if (!arr.length) return;
    var destPath = up.dest.path, inMedia = up.dest.kind !== "usb";
    arr.forEach(function (file) {
      var item = { id: uid(), file: file, name: file.name, size: file.size, uploaded: 0, status: "uploading", error: null };
      up.queue.push(item);
      startUpload(item, destPath, inMedia);
    });
    paintQueue();
  }

  function startUpload(item, destPath, inMedia) {
    var xhr = new XMLHttpRequest();
    item.xhr = xhr;
    xhr.open("POST", "/api/upload?dest=" + encodeURIComponent(destPath) + "&name=" + encodeURIComponent(item.file.name));
    xhr.upload.onprogress = function (e) { if (e.lengthComputable) { item.uploaded = e.loaded; item.size = e.total; throttledPaint(); } };
    xhr.onload = function () {
      var j = {}; try { j = JSON.parse(xhr.responseText); } catch (e) {}
      if (xhr.status >= 200 && xhr.status < 300) { item.status = "done"; item.uploaded = item.size; }
      else { item.status = "error"; item.error = (j && j.error) ? j.error : "Upload failed (" + xhr.status + ")"; }
      paintQueue(); afterQueueChange();
    };
    xhr.onerror = function () { item.status = "error"; item.error = "Connection lost during upload"; paintQueue(); };
    xhr.send(item.file);
  }

  var paintT = 0;
  function throttledPaint() { if (paintT) return; paintT = setTimeout(function () { paintT = 0; paintQueue(); }, 200); }

  var scannedRef = false;
  function afterQueueChange() {
    var active = up.queue.some(function (f) { return f.status === "uploading"; });
    var done = up.queue.filter(function (f) { return f.status === "done"; });
    if (active) { scannedRef = false; return; }
    if (up.queue.length && done.length && !scannedRef) {
      scannedRef = true;
      var total = done.reduce(function (s, f) { return s + f.size; }, 0);
      toast("ok", done.length + " file" + (done.length > 1 ? "s" : "") + " uploaded", fmtBytes(total) + " → " + up.dest.label);
      refreshStatus();
      if (up.autoScan) setTimeout(triggerScan, 600);
    }
  }
  function triggerScan() {
    toast("info", "Library scan started", "Jellyfin is indexing new media…");
    api("POST", "/api/scan", {}).then(function (r) {
      if (r.body && r.body.scan_started) toast("ok", "Scan requested", "Jellyfin is re-indexing your library");
    });
  }

  function paintQueue() {
    var host = document.getElementById("queueCard"); if (!host) return;
    var sampleRow = document.getElementById("sampleRow");
    if (sampleRow) sampleRow.innerHTML = "";
    if (!up.queue.length) { host.innerHTML = ""; return; }
    var active = up.queue.filter(function (f) { return f.status === "uploading"; }).length;
    var doneCount = up.queue.filter(function (f) { return f.status === "done"; }).length;
    var overall = up.queue.reduce(function (s, f) { return s + (f.status === "done" ? f.size : f.uploaded); }, 0) /
      Math.max(1, up.queue.reduce(function (s, f) { return s + f.size; }, 0)) * 100;

    host.innerHTML =
      '<div class="card fade"><div class="card-head"><h2>Transfer queue</h2>' +
      (active > 0 ? '<span class="badge busy">' + ic("loader", "spin", 12) + " " + active + " active</span>"
        : '<span class="badge ok"><span class="dot" style="background:currentColor"></span> Complete</span>') +
      '<div class="spacer"></div>' + (doneCount > 0 ? '<button class="btn ghost sm" id="clearDone">Clear completed</button>' : "") + "</div>" +
      '<div class="card-pad" style="padding-bottom:8px"><div class="row" style="justify-content:space-between;margin-bottom:7px">' +
      '<span class="muted" style="font-size:12.5px">Overall · ' + doneCount + "/" + up.queue.length + ' files</span><span class="mono" style="font-size:12.5px">' + Math.round(overall) + "%</span></div>" +
      '<div class="bar"><i style="width:' + overall + '%"></i></div></div>' +
      '<div style="padding:4px 16px 8px">' +
      up.queue.map(function (f) {
        var pct = Math.min(100, Math.round(f.uploaded / Math.max(1, f.size) * 100));
        var sub = "<span>" + fmtBytes(f.size) + "</span>";
        if (f.status === "uploading") sub += '<span>·</span><span>' + fmtBytes(f.size - f.uploaded) + " left</span>";
        if (f.status === "done") sub += '<span>·</span><span style="color:var(--success)">Uploaded</span>';
        if (f.status === "error") sub += '<span>·</span><span style="color:var(--danger)">' + esc(f.error) + "</span>";
        var bar = (f.status === "uploading") ? '<div class="bar thin"><i style="width:' + pct + '%"></i></div>'
          : (f.status === "error") ? '<div class="bar thin err"><i style="width:' + pct + '%"></i></div>' : "";
        var right = (f.status === "uploading") ? '<span class="qpct mono">' + pct + "%</span>"
          : (f.status === "done") ? '<span class="badge ok"><span class="dot" style="background:currentColor"></span></span>'
          : '<button class="btn sm" data-retry="' + f.id + '">' + ic("refresh", "", 14) + " Retry</button>";
        return '<div class="qitem"><div class="qft">' + ic(fileKind(f.name), "", 18) + '</div><div class="qmeta">' +
          '<div class="nm">' + esc(f.name) + '</div><div class="sub">' + sub + "</div>" + bar + "</div>" +
          '<div class="qright">' + right + '<button class="btn icon sm ghost" data-rm="' + f.id + '" title="Remove">' + ic("x", "", 15) + "</button></div></div>";
      }).join("") + "</div>" +
      '<div class="card-head" style="border-bottom:0;border-top:1px solid var(--border)"><label class="toggle">' +
      '<input type="checkbox" id="autoScan"' + (up.autoScan ? " checked" : "") + '><span class="track"></span>' +
      '<span class="tg-label">Scan library when finished<small>Jellyfin re-indexes new media automatically</small></span></label>' +
      '<div class="spacer"></div><button class="btn" id="scanNow"' + (active > 0 || !doneCount ? " disabled" : "") + ">" + ic("scan") + " Scan now</button></div></div>";

    var cd = document.getElementById("clearDone"); if (cd) cd.onclick = function () { up.queue = up.queue.filter(function (f) { return f.status !== "done"; }); paintQueue(); };
    document.getElementById("autoScan").onchange = function (e) { up.autoScan = e.target.checked; };
    document.getElementById("scanNow").onclick = triggerScan;
    [].forEach.call(host.querySelectorAll("[data-rm]"), function (b) { b.onclick = function () { var id = b.getAttribute("data-rm"); var it = up.queue.filter(function (f) { return f.id === id; })[0]; if (it && it.xhr && it.status === "uploading") it.xhr.abort(); up.queue = up.queue.filter(function (f) { return f.id !== id; }); paintQueue(); }; });
    [].forEach.call(host.querySelectorAll("[data-retry]"), function (b) {
      b.onclick = function () { var id = b.getAttribute("data-retry"); var it = up.queue.filter(function (f) { return f.id === id; })[0]; if (!it) return; it.status = "uploading"; it.uploaded = 0; it.error = null; startUpload(it, up.dest.path, up.dest.kind !== "usb"); toast("info", "Retrying upload", it.name); paintQueue(); };
    });
  }

  /* ============================================================
     NETWORK STORAGE TAB
     ============================================================ */
  var PROTO = {
    smb: { label: "SMB / CIFS", hint: "Windows shares, most consumer NAS", creds: true, remote: function (f) { return "//" + (f.host || "host") + "/" + (f.share || "share"); } },
    nfs: { label: "NFS", hint: "Linux/Unix exports — must be host-mounted first on Core", creds: false, remote: function (f) { return (f.host || "host") + ":/" + (f.share || "export"); } },
    webdav: { label: "WebDAV", hint: "Nextcloud, ownCloud, http(s) shares", creds: true, remote: function (f) { return "https://" + (f.host || "host") + "/" + (f.share || "path"); } }
  };
  var nas = { form: blankForm(), test: null, submitting: false, errors: {}, showPass: false };
  function blankForm() { return { name: "", proto: "smb", host: "", share: "", mountname: "", user: "", pass: "", persist: true, mapLibrary: "" }; }

  function renderNas() {
    var f = nas.form, meta = PROTO[f.proto];
    var mountpoint = ((S.status && S.status.media_root) || "/media") + "/nas/" + (f.mountname || "share");
    var libs = (S.status && S.status.libraries) || [];

    var mountsHtml = !S.mounts.length
      ? '<div class="empty">' + ic("server", "", 34) + "<b>No network shares mounted</b>Add one with the form to start streaming from your NAS.</div>"
      : S.mounts.map(function (m) {
        var tags = "";
        if (m.persist) tags += '<span class="mtag">' + ic("refresh", "", 11) + " Auto-mount on boot</span>";
        if (m.library) tags += '<span class="mtag">' + ic("link", "", 11) + " " + esc(m.library) + "</span>";
        var rp = (m.mountpoint || "").replace((S.status && S.status.media_root) || "", "…");
        var action = m.status === "error"
          ? '<button class="btn sm" data-remount="' + esc(m.id) + '">' + ic("refresh", "", 14) + " Retry</button>"
          : '<button class="btn sm danger" data-unmount="' + esc(m.id) + '"' + (m.status !== "mounted" ? " disabled" : "") + ">" + ic("eject", "", 14) + " Unmount</button>";
        return '<div class="mount"><div class="mount-ic">' + ic("server", "", 20) + '</div><div class="mount-main">' +
          '<div class="top"><b>' + esc(m.name) + '</b><span class="badge idle" style="text-transform:uppercase">' + esc(m.proto) + "</span>" + statusBadge(m.status) + "</div>" +
          '<div class="path">' + esc(m.remote) + ' <span class="muted">→</span> ' + esc(rp) + "</div>" +
          (m.status === "error" ? '<div class="test-result err" style="margin-top:9px">' + ic("alert") + esc(m.error || "Mount offline") + "</div>" : "") +
          '<div class="tags">' + tags + '</div></div><div class="mount-actions">' + action + "</div></div>";
      }).join("");

    var creds = meta.creds ? '<div class="field-row two"><div class="field"><label>Username <span class="req">*</span></label>' +
      '<input class="' + cx("input", nas.errors.user && "err") + '" id="f_user" placeholder="jellyfin" value="' + esc(f.user) + '" autocomplete="off"></div>' +
      '<div class="field"><label>Password</label><div class="input-group">' +
      '<input class="input" id="f_pass" type="' + (nas.showPass ? "text" : "password") + '" placeholder="••••••••" value="' + esc(f.pass) + '" autocomplete="off">' +
      '<div class="addon" id="togglePass" style="cursor:pointer">' + ic(nas.showPass ? "eyeOff" : "eye", "", 15) + "</div></div></div></div>" : "";

    var testHtml = nas.test === "busy" ? '<div class="test-result busy">' + ic("loader", "spin") + " Testing connection to " + esc(f.host || "host") + "…</div>"
      : (nas.test && nas.test !== "busy") ? '<div class="test-result ' + (nas.test.ok ? "ok" : "err") + '">' + ic(nas.test.ok ? "check" : "alert") + esc(nas.test.msg) + "</div>" : "";

    document.getElementById("main").innerHTML =
      '<div class="fade"><div class="page-head"><h1>Network storage</h1>' +
      "<p>Mount a NAS or network share into your media folder so Jellyfin can stream from it. SMB &amp; WebDAV mount directly; NFS is linked from a host mount.</p></div>" +
      '<div class="nas-grid"><div class="card"><div class="card-head"><h2>Current mounts</h2><span class="ch-sub">' + S.mounts.length + " configured</span></div>" + mountsHtml + "</div>" +
      '<div class="card"><div class="card-head"><h2>Add a share</h2></div><div class="card-pad col" style="gap:15px">' +
      '<div class="field"><label>Protocol</label><div class="seg" style="width:100%">' +
      Object.keys(PROTO).map(function (k) { return '<button class="' + (f.proto === k ? "on" : "") + '" style="flex:1" data-proto="' + k + '">' + PROTO[k].label + "</button>"; }).join("") +
      '</div><span class="hint">' + esc(meta.hint) + "</span></div>" +
      '<div class="field"><label>Display name <span class="req">*</span></label><input class="' + cx("input", nas.errors.name && "err") + '" id="f_name" placeholder="living-room-nas" value="' + esc(f.name) + '"></div>' +
      '<div class="field-row two"><div class="field"><label>' + (f.proto === "webdav" ? "Server URL host" : "Host / IP") + ' <span class="req">*</span></label>' +
      '<input class="' + cx("input", "mono", nas.errors.host && "err") + '" id="f_host" placeholder="192.168.1.20" value="' + esc(f.host) + '"></div>' +
      '<div class="field"><label>' + (f.proto === "nfs" ? "Export path" : "Share") + ' <span class="req">*</span></label>' +
      '<input class="' + cx("input", "mono", nas.errors.share && "err") + '" id="f_share" placeholder="' + (f.proto === "nfs" ? "volume1/films" : "media") + '" value="' + esc(f.share) + '"></div></div>' +
      creds +
      '<div class="field"><label>Mount as <span class="req">*</span></label><div class="input-group">' +
      '<div class="addon" style="border-radius:var(--r-sm) 0 0 var(--r-sm);border-right:0">…/nas/</div>' +
      '<input class="input mono" id="f_mount" style="border-radius:0" placeholder="livingroom" value="' + esc(f.mountname) + '"></div>' +
      '<span class="hint">Mounts at <span class="mono">' + esc(mountpoint) + "</span></span></div>" +
      '<div class="sep" style="margin:2px 0"></div>' +
      '<label class="toggle" style="align-items:flex-start"><input type="checkbox" id="f_persist"' + (f.persist ? " checked" : "") + '><span class="track"></span>' +
      '<span class="tg-label">Mount automatically on boot<small>The portal re-establishes it after a reboot</small></span></label>' +
      '<div class="field"><label>Map into a Jellyfin library</label><select class="select" id="f_map"><option value="">Don\'t map — just mount</option>' +
      libs.map(function (l) { return '<option value="' + esc(l.name) + '"' + (f.mapLibrary === l.name ? " selected" : "") + ">" + esc(l.name) + "</option>"; }).join("") + "</select></div>" +
      testHtml +
      '<div class="row" style="gap:10px;margin-top:2px"><button class="btn" id="testBtn"' + (nas.test === "busy" || nas.submitting ? " disabled" : "") + ">" + ic("plug") + " Test connection</button>" +
      '<button class="btn primary grow" id="mountBtn"' + (nas.submitting || nas.test === "busy" ? " disabled" : "") + ">" +
      (nas.submitting ? ic("loader", "spin") + " Mounting…" : ic("plus") + " Mount share") + "</button></div>" +
      "</div></div></div></div>";

    function bind(id, key, transform) { var n = document.getElementById(id); if (!n) return; n.oninput = function () { f[key] = transform ? transform(n.value) : n.value; nas.test = null; nas.errors[key] = false; }; }
    bind("f_name", "name"); bind("f_host", "host"); bind("f_share", "share"); bind("f_user", "user"); bind("f_pass", "pass");
    bind("f_mount", "mountname", function (v) { return v.replace(/[^a-z0-9_-]/gi, ""); });
    [].forEach.call(document.querySelectorAll("[data-proto]"), function (b) { b.onclick = function () { f.proto = b.getAttribute("data-proto"); nas.test = null; renderNas(); }; });
    var tp = document.getElementById("togglePass"); if (tp) tp.onclick = function () { nas.showPass = !nas.showPass; renderNas(); };
    document.getElementById("f_persist").onchange = function (e) { f.persist = e.target.checked; };
    document.getElementById("f_map").onchange = function (e) { f.mapLibrary = e.target.value; };
    document.getElementById("testBtn").onclick = nasTest;
    document.getElementById("mountBtn").onclick = nasSubmit;
    [].forEach.call(document.querySelectorAll("[data-unmount]"), function (b) { b.onclick = function () { nasUnmount(b.getAttribute("data-unmount")); }; });
    [].forEach.call(document.querySelectorAll("[data-remount]"), function (b) { b.onclick = function () { nasRemount(b.getAttribute("data-remount")); }; });
  }

  function nasValidate() {
    var f = nas.form, meta = PROTO[f.proto], e = {};
    if (!f.name.trim()) e.name = true;
    if (!f.host.trim()) e.host = true;
    if (!f.share.trim()) e.share = true;
    if (!f.mountname.trim()) e.mountname = true;
    if (meta.creds && !f.user.trim()) e.user = true;
    nas.errors = e;
    return !Object.keys(e).length;
  }
  function nasBody() {
    var f = nas.form, meta = PROTO[f.proto];
    var body = { type: f.proto, name: f.name.trim(), mountpoint: f.mountname.trim(), source: meta.remote(f), username: f.user, password: f.pass, persist: f.persist, library: f.mapLibrary };
    if (f.proto === "nfs") body.host_path = f.share.indexOf("/") === 0 ? f.share : ("/mnt/" + f.mountname.trim());
    return body;
  }
  function nasTest() {
    if (!nasValidate()) { toast("err", "Fill required fields", "Host, share, mount name" + (PROTO[nas.form.proto].creds ? " and username" : "") + " are required."); renderNas(); return; }
    nas.test = "busy"; renderNas();
    api("POST", "/api/test-nas", nasBody()).then(function (r) {
      nas.test = { ok: !!(r.body && r.body.ok), msg: (r.body && r.body.msg) || "No response from test." };
      renderNas();
    });
  }
  function nasSubmit() {
    if (!nasValidate()) { toast("err", "Fill required fields", "Some required fields are missing."); renderNas(); return; }
    nas.submitting = true; renderNas();
    api("POST", "/api/mount-nas", nasBody()).then(function (r) {
      nas.submitting = false;
      if (r.ok && r.body && r.body.mount) {
        toast("ok", "Mounted " + r.body.mount.name, r.body.mount.mountpoint + (nas.form.persist ? " · persists across reboots" : ""));
        if (nas.form.mapLibrary) toast("info", "Mapped to library", "Added to “" + nas.form.mapLibrary + "”");
        nas.form = blankForm(); nas.test = null;
        refreshMounts();
      } else {
        toast("err", "Mount failed", (r.body && (r.body.detail || r.body.error)) || ("status " + r.status));
        renderNas();
      }
    });
  }
  function nasUnmount(id) {
    var m = S.mounts.filter(function (x) { return x.id === id; })[0];
    if (m) m.status = "unmounting"; renderNas();
    api("POST", "/api/unmount", { id: id }).then(function () { toast("info", "Unmounted " + (m ? m.name : ""), "Share detached"); refreshMounts(); });
  }
  function nasRemount(id) {
    var m = S.mounts.filter(function (x) { return x.id === id; })[0];
    if (m) m.status = "mounting"; renderNas();
    api("POST", "/api/remount", { id: id }).then(function (r) {
      if (r.body && r.body.ok) toast("ok", "Reconnected", "Mount is back online");
      else toast("err", "Still offline", (r.body && r.body.detail) || "Could not reconnect");
      refreshMounts();
    });
  }

  /* ============================================================
     PASSWORD TAB
     ============================================================ */
  var pwS = { sel: null, pw: "", confirm: "", show: false, busy: false, doneFor: null, touched: false, manual: "" };
  function renderPassword() {
    var users = S.users;
    if (!pwS.sel && users.length) pwS.sel = users[0];
    var sel = pwS.sel;
    var checks = { len: pwS.pw.length >= 8, upper: /[A-Z]/.test(pwS.pw), num: /[0-9]/.test(pwS.pw), sym: /[^A-Za-z0-9]/.test(pwS.pw) };
    var score = Object.keys(checks).filter(function (k) { return checks[k]; }).length;
    var strengthLabel = ["Too weak", "Weak", "Fair", "Good", "Strong"][pwS.pw ? score : 0];
    var match = pwS.pw && pwS.confirm && pwS.pw === pwS.confirm;
    var mismatch = pwS.confirm.length > 0 && pwS.pw !== pwS.confirm;
    var canSubmit = checks.len && match && !pwS.busy && (sel || pwS.manual.trim());
    var isSelf = sel && sel.role === "Administrator";
    var targetName = sel ? sel.name : (pwS.manual.trim() || "(enter a username)");

    var list = users.length
      ? users.map(function (u) {
        return '<div class="' + cx("user-row", sel && sel.id === u.id && "active") + '" data-u="' + esc(u.id) + '">' +
          '<div class="avatar" style="background:' + avatarColor(u.name) + '">' + initials(u.name) + "</div>" +
          '<div class="meta"><b>' + esc(u.name) + (u.role === "Administrator" ? ' <span class="badge busy" style="margin-left:4px">Admin</span>' : "") + "</b>" +
          "<span>" + esc(u.role) + (u.hasPassword === false ? " · no password" : "") + "</span></div>" + ic("chevR", "chev", 16) + "</div>";
      }).join("")
      : '<div class="card-pad col" style="gap:8px"><span class="muted" style="font-size:12.5px">No accounts listed (Jellyfin may still be in first-time setup). Enter a username:</span>' +
        '<input class="input" id="pwManual" placeholder="admin" value="' + esc(pwS.manual) + '"></div>';

    var body;
    if (pwS.doneFor) {
      body = '<div class="success-panel fade"><div class="ring">' + ic("check", "", 32) + "</div><h3>Password updated</h3>" +
        "<p>" + esc(pwS.doneFor) + "'s password has been changed. They'll need the new password to sign in.</p>" +
        '<button class="btn" id="pwAgain">' + ic("key") + " Set another password</button></div>";
    } else {
      body = '<div class="card-head"><div class="avatar" style="background:' + avatarColor(targetName) + ';width:34px;height:34px">' + initials(targetName) + "</div>" +
        '<div><h2 style="margin-bottom:1px">' + (isSelf ? "Your password" : "Reset " + esc(targetName) + "'s password") + '</h2>' +
        '<span class="ch-sub">' + esc(sel ? sel.role : "User") + "</span></div></div>" +
        '<div class="card-pad col" style="gap:16px">' +
        (!isSelf ? '<div class="test-result" style="background:var(--warning-soft);color:oklch(0.86 0.12 78)">' + ic("shield") +
          "You're changing an account's password. They won't be notified — share the new password directly.</div>" : "") +
        '<div class="field"><label>New password <span class="req">*</span></label><div class="input-group">' +
        '<input class="' + cx("input", pwS.touched && !checks.len && "err") + '" id="pwNew" type="' + (pwS.show ? "text" : "password") + '" placeholder="Enter a new password" value="' + esc(pwS.pw) + '" autocomplete="new-password">' +
        '<div class="addon" id="pwToggle" style="cursor:pointer">' + ic(pwS.show ? "eyeOff" : "eye", "", 15) + "</div></div>" +
        (pwS.pw ? '<div class="strength s' + score + '"><i></i><i></i><i></i><i></i></div><span class="hint" style="color:' + (score >= 3 ? "var(--success)" : score === 2 ? "var(--warning)" : "var(--danger)") + '">' + strengthLabel + "</span>" : "") +
        "</div>" +
        '<div class="field"><label>Confirm password <span class="req">*</span></label>' +
        '<input class="' + cx("input", mismatch && "err") + '" id="pwConfirm" type="' + (pwS.show ? "text" : "password") + '" placeholder="Re-enter the password" value="' + esc(pwS.confirm) + '" autocomplete="new-password">' +
        (mismatch ? '<span class="hint" style="color:var(--danger)">Passwords don\'t match</span>' : "") +
        (match ? '<span class="hint" style="color:var(--success)">Passwords match</span>' : "") + "</div>" +
        '<ul class="req-list">' +
        '<li class="' + (checks.len ? "met" : "") + '">' + ic(checks.len ? "check" : "x", "", 14) + " At least 8 characters</li>" +
        '<li class="' + (checks.upper ? "met" : "") + '">' + ic(checks.upper ? "check" : "x", "", 14) + ' An uppercase letter <span class="muted">(recommended)</span></li>' +
        '<li class="' + (checks.num ? "met" : "") + '">' + ic(checks.num ? "check" : "x", "", 14) + ' A number <span class="muted">(recommended)</span></li>' +
        '<li class="' + (checks.sym ? "met" : "") + '">' + ic(checks.sym ? "check" : "x", "", 14) + ' A symbol <span class="muted">(recommended)</span></li></ul>' +
        '<div class="row" style="gap:10px;margin-top:2px"><button class="btn ghost" id="pwClear"' + (pwS.busy || (!pwS.pw && !pwS.confirm) ? " disabled" : "") + ">Clear</button><div class=\"grow\"></div>" +
        '<button class="btn primary" id="pwSubmit"' + (!canSubmit ? " disabled" : "") + ">" +
        (pwS.busy ? ic("loader", "spin") + " Updating…" : ic("lock") + " " + (isSelf ? "Update password" : "Reset password")) + "</button></div></div>";
    }

    document.getElementById("main").innerHTML =
      '<div class="fade"><div class="page-head"><h1>Reset password</h1>' +
      "<p>As an administrator you can set a new password for your own account or for any user on this Jellyfin server.</p></div>" +
      '<div class="pw-grid"><div class="card"><div class="card-head"><h2>Accounts</h2><span class="ch-sub">' + users.length + "</span></div>" +
      '<div style="padding:7px">' + (users.length ? list : "") + "</div>" + (users.length ? "" : list) + "</div>" +
      '<div class="card">' + body + "</div></div></div>";

    [].forEach.call(document.querySelectorAll("[data-u]"), function (n) { n.onclick = function () { pwS.sel = users.filter(function (u) { return u.id === n.getAttribute("data-u"); })[0]; pwReset(); pwS.doneFor = null; renderPassword(); }; });
    var pm = document.getElementById("pwManual"); if (pm) pm.oninput = function () { pwS.manual = pm.value; };
    var nw = document.getElementById("pwNew"); if (nw) nw.oninput = function () { pwS.pw = nw.value; renderPassword(); placeCaretEnd("pwNew"); };
    var cf = document.getElementById("pwConfirm"); if (cf) cf.oninput = function () { pwS.confirm = cf.value; renderPassword(); placeCaretEnd("pwConfirm"); };
    var tg = document.getElementById("pwToggle"); if (tg) tg.onclick = function () { pwS.show = !pwS.show; renderPassword(); };
    var cl = document.getElementById("pwClear"); if (cl) cl.onclick = function () { pwReset(); renderPassword(); };
    var sb = document.getElementById("pwSubmit"); if (sb) sb.onclick = pwSubmit;
    var ag = document.getElementById("pwAgain"); if (ag) ag.onclick = function () { pwS.doneFor = null; pwReset(); renderPassword(); };
  }
  function pwReset() { pwS.pw = ""; pwS.confirm = ""; pwS.show = false; pwS.touched = false; }
  function placeCaretEnd(id) { var n = document.getElementById(id); if (n) { n.focus(); var v = n.value; n.value = ""; n.value = v; } }
  function pwSubmit() {
    var checks = { len: pwS.pw.length >= 8 };
    if (!(checks.len && pwS.pw === pwS.confirm)) { pwS.touched = true; renderPassword(); return; }
    var username = pwS.sel ? pwS.sel.name : pwS.manual.trim();
    if (!username) { toast("err", "No account", "Choose a user or enter a username."); return; }
    pwS.busy = true; renderPassword();
    api("POST", "/api/reset-password", { username: username, new_password: pwS.pw }).then(function (r) {
      pwS.busy = false;
      if (r.ok && r.body && (r.body.new_password_set || r.body.reset)) {
        pwS.doneFor = username; toast("ok", "Password updated", "New password set for " + username); renderPassword();
      } else {
        toast("err", "Couldn't reset password", (r.body && (r.body.detail || r.body.error)) || ("status " + r.status)); renderPassword();
      }
    });
  }

  /* ---------- data loading ---------- */
  function refreshStatus() { return api("GET", "/api/status").then(function (r) { if (r.ok) S.status = r.body; }); }
  function refreshDrives() { return api("GET", "/api/drives").then(function (r) { if (r.ok) S.drives = r.body.drives || []; }); }
  function refreshMounts() { return api("GET", "/api/mounts").then(function (r) { if (r.ok) S.mounts = r.body.mounts || []; renderShell(); }); }
  function refreshUsers() {
    return api("GET", "/api/users").then(function (r) {
      if (r.ok) { S.users = r.body.users || []; var admin = S.users.filter(function (u) { return u.role === "Administrator"; })[0]; if (admin) S.me = admin; }
    });
  }

  function boot() {
    Promise.all([refreshStatus(), refreshDrives(), refreshMounts(), refreshUsers()]).then(function () { renderShell(); });
    renderShell(); // paint immediately with defaults, then refresh
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
