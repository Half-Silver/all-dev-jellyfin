# Required inputs & outputs of Jellyfin

## Snap Details

- **Snap name**: `all-dev-jellyfin`
- **Version**: `1.0.0`
- **Base**: `core24`
- **Description**: Media server for streaming and transcoding audio and video content
- **Confinement**: `strict`

---

## Overview

Jellyfin is a free, open-source media server that supports transcoding, live TV, and device-specific profiles. It provides a web-based UI for managing media libraries, user accounts, and device settings.

Features:
- **Media Streaming**: Stream movies, TV shows, music, and photos
- **Transcoding**: Real-time transcoding for device compatibility
- **Live TV & DVR**: Watch and record live TV
- **Multi-User**: Support for multiple users with individual libraries
- **Mobile Apps**: iOS and Android apps available
- **Device Profiles**: Optimized for various devices (Tizen, WebOS, Android, etc.)
- **Plugins**: Extensible with plugins
- **No Subscription**: Completely free, no premium features

---

## Inputs

### From User

Configuration via web interface and environment variables:

1. **Media Library Paths** (configured via web UI)
2. **Port** (default: 19080)
3. **Device Profile** (optional)
4. **Streaming Settings** (bitrate, quality)

### Auto-assigned from Control Tower

1. `ct-callback-url` - URL for Control Tower callbacks
2. `ct-deployment-id` - Unique deployment identifier
3. `ct-node-id` - Node identifier in the cluster
4. `ct-snap-name` - Snap name identifier

### Default Configuration

- **Port**: 19080
- **Data Directory**: `$SNAP_DATA/data`
- **Config Directory**: `$SNAP_DATA/config`
- **Cache Directory**: `$SNAP_DATA/cache`
- **Web Directory**: `$SNAP_DATA/web`
- **Log Directory**: `$SNAP_DATA/logs`

---

## Outputs

| Message Type | Description | Example |
|--------------|-------------|---------|
| `message_initial` | Initial status on installation | "Jellyfin started on port 19080" |
| `message` | Periodic status updates | "Server running, 3 active streams" |
| `deployment_stop` | Shutdown notification | "Jellyfin stopped" |

**Output Mode**: `logs`  
**Interval**: 60 seconds

---

## Configuration Template (CT Deployment Payload)

```json
{
  "snaps": [
    {
      "name": "all-dev-jellyfin",
      "refresh": true
    }
  ],
  "snap_config": [
    {
      "snap": "all-dev-jellyfin",
      "settings": {
        "port": 19080,
        "JELLYFIN_DATA_DIR": "/var/lib/jellyfin",
        "JELLYFIN_CONFIG_DIR": "/etc/jellyfin",
        "JELLYFIN_CACHE_DIR": "/var/cache/jellyfin",
        "JELLYFIN_WEB_DIR": "/var/www/jellyfin",
        "JELLYFIN_LOG_DIR": "/var/log/jellyfin",
        "MAX_STREAMING_BITRATE": 120000000,
        "MAX_STATIC_BITRATE": 100000000,
        "LANGUAGE": "en",
        "ct-node-id": "<ALL_APP_NODE_ID>",
        "ct-callback-url": "<ALL_APP_CALLBACK_URL>",
        "ct-deployment-id": "<ALL_APP_DEPLOYMENT_ID>",
        "ct-snap-name": "all-dev-jellyfin"
      }
    }
  ],
  "ignore_failures": false,
  "pre_service_actions": [],
  "post_service_actions": [
    {
      "names": [
        "all-dev-jellyfin"
      ],
      "action": "restart"
    }
  ],
  "interface_connections": [
    {
      "plug": "all-dev-jellyfin:network",
      "slot": ":network",
      "action": "connect"
    },
    {
      "plug": "all-dev-jellyfin:network-bind",
      "slot": ":network-bind",
      "action": "connect"
    },
    {
      "plug": "all-dev-jellyfin:home",
      "slot": ":home",
      "action": "connect"
    }
  ]
}
```

---

## Usage Examples

### Basic Deployment

```json
{
  "snaps": [{"name": "all-dev-jellyfin"}],
  "snap_config": [{
    "snap": "all-dev-jellyfin",
    "settings": {
      "port": 19080
    }
  }]
}
```

### Custom Port and Directories

```json
{
  "snaps": [{"name": "all-dev-jellyfin"}],
  "snap_config": [{
    "snap": "all-dev-jellyfin",
    "settings": {
      "port": 8096,
      "JELLYFIN_DATA_DIR": "/mnt/media/jellyfin/data",
      "JELLYFIN_CACHE_DIR": "/mnt/cache/jellyfin"
    }
  }]
}
```

### With Device Profile

```json
{
  "snaps": [{"name": "all-dev-jellyfin"}],
  "snap_config": [{
    "snap": "all-dev-jellyfin",
    "settings": {
      "port": 19080,
      "JELLYFIN_DEVICE_PROFILE": "Tizen",
      "LANGUAGE": "sk"
    }
  }]
}
```

---

## Configuration Parameters Reference

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `port` | number | Yes | `19080` | HTTP port for web interface |
| `JELLYFIN_DATA_DIR` | string | No | `/var/lib/jellyfin` | Data storage directory |
| `JELLYFIN_CONFIG_DIR` | string | No | `/etc/jellyfin` | Configuration directory |
| `JELLYFIN_CACHE_DIR` | string | No | `/var/cache/jellyfin` | Cache directory |
| `JELLYFIN_WEB_DIR` | string | No | `/var/www/jellyfin` | Web UI resources directory |
| `JELLYFIN_LOG_DIR` | string | No | `/var/log/jellyfin` | Log directory |
| `JELLYFIN_DEVICE_PROFILE` | string | No | `default` | Device profile (Tizen, WebOS, Android, etc.) |
| `LANGUAGE` | string | No | `en` | UI language code |
| `MAX_STREAMING_BITRATE` | number | No | `120000000` | Max streaming bitrate (bps) |
| `MAX_STATIC_BITRATE` | number | No | `100000000` | Max static bitrate (bps) |
| `HTTP_PROXY` | string | No | - | Proxy URL for live TV |
| `DEVICE_ID` | string | No | - | Device ID for authentication |
| `DEVICE_AUTH` | string | No | - | Device authentication token |
| `ct-callback-url` | string | No | - | Control Tower callback URL |
| `ct-deployment-id` | string | No | - | Deployment identifier |
| `ct-node-id` | string | No | - | Node identifier |
| `ct-snap-name` | string | No | - | Snap name identifier |

---

## Post-Installation Setup

### 1. Access Web Interface

Navigate to: `http://<device-ip>:19080`

### 2. Initial Setup Wizard

On first access, complete the setup wizard:
1. **Select Language**: Choose your preferred language
2. **Create Admin Account**: Set username and password
3. **Add Media Libraries**: Configure paths to your media
4. **Configure Remote Access**: Set up external access (optional)
5. **Finish Setup**: Complete the wizard

### 3. Add Media Libraries

In the web interface:
1. Go to **Dashboard** → **Libraries**
2. Click **Add Media Library**
3. Select library type (Movies, TV Shows, Music, Photos)
4. Add folder paths
5. Configure metadata providers
6. Save and scan library

### 4. Configure Users

1. Go to **Dashboard** → **Users**
2. Add new users
3. Set permissions and library access
4. Configure parental controls (optional)

### 5. Install Client Apps

Download Jellyfin clients:
- **Web**: Use the web interface
- **Desktop**: Windows, macOS, Linux
- **Mobile**: iOS (App Store), Android (Google Play)
- **TV**: Android TV, Fire TV, Roku, Apple TV
- **Smart TV**: Samsung Tizen, LG webOS

Connect clients to: `http://<device-ip>:19080`

---

## Media Library Setup

### Supported Media Types

- **Movies**: MP4, MKV, AVI, MOV, etc.
- **TV Shows**: Organized by season/episode
- **Music**: MP3, FLAC, AAC, OGG, etc.
- **Photos**: JPG, PNG, GIF, etc.
- **Books**: EPUB, PDF, CBZ, CBR

### Recommended Folder Structure

```
/media/
├── Movies/
│   ├── Movie Name (Year)/
│   │   └── Movie Name (Year).mkv
│   └── Another Movie (Year)/
│       └── Another Movie (Year).mp4
├── TV Shows/
│   └── Show Name/
│       ├── Season 01/
│       │   ├── Show Name - S01E01.mkv
│       │   └── Show Name - S01E02.mkv
│       └── Season 02/
│           └── Show Name - S02E01.mkv
├── Music/
│   └── Artist Name/
│       └── Album Name/
│           ├── 01 - Track Name.mp3
│           └── 02 - Track Name.mp3
└── Photos/
    └── 2024/
        └── Vacation/
            └── photo001.jpg
```

---

## Transcoding

### Hardware Acceleration

Jellyfin supports hardware-accelerated transcoding:
- **Intel QuickSync**: Intel integrated graphics
- **NVIDIA NVENC**: NVIDIA GPUs
- **AMD AMF**: AMD GPUs
- **VAAPI**: Linux video acceleration

### Configure Transcoding

1. Go to **Dashboard** → **Playback**
2. Select hardware acceleration method
3. Configure transcoding settings
4. Set quality presets
5. Save settings

### Transcoding Settings

- **Video Codec**: H.264, H.265 (HEVC), VP9, AV1
- **Audio Codec**: AAC, MP3, Opus
- **Quality**: Auto, High, Medium, Low
- **Bitrate**: Configurable per quality level

---

## Device Profiles

Jellyfin includes profiles for various devices:

- **Tizen**: Samsung Smart TVs
- **WebOS**: LG Smart TVs
- **Android**: Android devices and Android TV
- **iOS**: iPhone, iPad, Apple TV
- **Roku**: Roku streaming devices
- **Fire TV**: Amazon Fire TV devices
- **Chromecast**: Google Chromecast
- **Web**: Modern web browsers

Configure via `JELLYFIN_DEVICE_PROFILE` setting.

---

## Live TV & DVR

### Setup Live TV

1. **Add TV Tuner**: Connect USB TV tuner or network tuner
2. **Configure EPG**: Set up electronic program guide
3. **Scan Channels**: Detect available channels
4. **Set Up DVR**: Configure recording settings

### Supported Tuners

- **HDHomeRun**: Network TV tuners
- **USB Tuners**: Various USB TV tuners
- **IPTV**: M3U playlists

---

## Plugins

### Install Plugins

1. Go to **Dashboard** → **Plugins**
2. Browse catalog
3. Install desired plugins
4. Restart Jellyfin

### Popular Plugins

- **Trakt**: Scrobbling and recommendations
- **Kodi Sync Queue**: Sync with Kodi
- **Anime**: Enhanced anime metadata
- **Fanart**: Additional artwork sources
- **Reports**: Usage statistics

---

## Interface Connections Reference

### Required Plugs

| Plug | Purpose |
|------|---------|
| `network` | Network access |
| `network-bind` | Bind to port 19080 |
| `home` | Access to home directory for media |

---

## Backup and Restore

### Backup Configuration

```bash
# Stop service
sudo snap stop all-dev-jellyfin

# Backup config and data
sudo tar -czf jellyfin_backup.tar.gz \
  $SNAP_DATA/config \
  $SNAP_DATA/data

# Start service
sudo snap start all-dev-jellyfin
```

### Restore

```bash
# Stop service
sudo snap stop all-dev-jellyfin

# Restore backup
sudo tar -xzf jellyfin_backup.tar.gz -C /

# Start service
sudo snap start all-dev-jellyfin
```

---

## Remote Access

### Option 1: Port Forwarding

1. Forward port 19080 on your router
2. Access via: `http://<public-ip>:19080`
3. **Security**: Use strong passwords

### Option 2: Reverse Proxy (Recommended)

**Nginx Example**:
```nginx
server {
    listen 443 ssl http2;
    server_name jellyfin.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:19080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Option 3: Cloudflare Tunnel

Use Cloudflare Tunnel for automatic HTTPS without port forwarding.

---

## Troubleshooting

### Check Service Status

```bash
sudo snap services all-dev-jellyfin
```

### View Logs

```bash
sudo snap logs all-dev-jellyfin
```

### Web Interface Not Loading

1. Check if service is running:
```bash
sudo snap start all-dev-jellyfin
```

2. Check port:
```bash
sudo ss -tlnp | grep 19080
```

### Transcoding Issues

1. Check FFmpeg installation
2. Verify hardware acceleration support
3. Check transcoding logs in web interface
4. Try software transcoding

### Media Not Scanning

1. Check folder permissions
2. Verify folder paths in library settings
3. Manually trigger library scan
4. Check logs for errors

---

## Performance Optimization

### Database Optimization

Jellyfin uses SQLite. For better performance:
1. Store database on SSD
2. Regular vacuum operations
3. Optimize library scan settings

### Transcoding Optimization

1. Enable hardware acceleration
2. Pre-transcode media for common devices
3. Adjust quality settings
4. Use appropriate codecs

### Network Optimization

1. Use wired connection for server
2. Enable direct play when possible
3. Adjust streaming bitrates
4. Use local network for best performance

---

## Security Best Practices

1. **Strong Passwords**: Use strong admin password
2. **HTTPS**: Use reverse proxy with SSL
3. **Firewall**: Restrict access to trusted networks
4. **User Permissions**: Limit user access appropriately
5. **Regular Updates**: Keep Jellyfin updated via snap refresh
6. **Secure API Keys**: Protect API keys and tokens

---

## Notes

- Jellyfin is completely free and open source
- No premium features or subscriptions
- Compatible with all major platforms
- Supports hardware-accelerated transcoding
- Extensive plugin ecosystem
- Active community and development
- Regular updates via snap refresh
- Strict confinement for security
- Runs as background service
- Restart condition: always (auto-restart on failure)