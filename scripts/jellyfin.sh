#!/bin/sh -ex

REQUIRED_INTERFACES="network network-bind"
# `home` intentionally dropped: media lives in $SNAP_COMMON/media and USB drives
# are reached via removable-media, so Jellyfin never needs the host home (and not
# exposing it narrows what the library picker can browse).
OPTIONAL_INTERFACES="removable-media mount-observe opengl firewall-control"

for intf in ${REQUIRED_INTERFACES}; do
        if ! snapctl is-connected "${intf}"; then
                echo "Required interface is not connected: ${intf}"
                echo ""
                echo "Please connect this interface using the following command:"
                echo "snap connect ${SNAP_NAME}:${intf}"
                exit 1
        fi
done

for intf in ${OPTIONAL_INTERFACES}; do
        if ! snapctl is-connected "${intf}"; then
                echo "Optional interface is not connected: ${intf}"
                echo "This is recommended to ensure best usage of this program."
                echo ""
                echo "Please connect this interface using the following command:"
                echo "snap connect ${SNAP_NAME}:${intf}"
        fi
done

# Ensure the demo media library folders exist before the server starts. These
# live in the snap's writable area (no host mount needed); the configure hook
# creates them at install, this is a belt-and-suspenders guarantee. The 15GiB
# demo cap is monitored by the ct-engine sidecar (see ct-engine/plugin.yaml).
mkdir -p "${SNAP_COMMON}/media/movies" "${SNAP_COMMON}/media/tvshows" || true

exec "${SNAP}"/usr/lib/jellyfin/bin/jellyfin --service \
        --ffmpeg "${SNAP}"/usr/lib/jellyfin-ffmpeg/ffmpeg
