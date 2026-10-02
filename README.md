# Mihon Reader for Antigravity IDE

A native integration of **Suwayomi-Server** (the desktop/server engine for Tachiyomi/Mihon) inside **Antigravity IDE**. Read manga, manhwa, and comics directly in your editor or sidebar with zero context switching.

![Mihon](media/mihon.svg)

---

## ✨ Features

- **📖 Dedicated Activity Bar View**: A custom Mihon icon in the left Activity Bar to quickly browse your library, check server status, and start/stop the server.
- **⛶ Full-Screen Editor Tab**: Pop out any chapter or library view into a full-scale editor tab (`Mihon: Open Full Reader`) for comfortable, distraction-free reading with hotkeys and zoom.
- **⚡ Automated Lifecycle**: Starts on demand with one click and automatically stops when Antigravity closes, ensuring zero zombie background processes.
- **🔄 Dynamic Port Conflict Detection**: Automatically falls back to an open port if port 4567 is already occupied.
- **📦 Pre-configured Keiyoushi Extension Repository**: Ready out of the box with the official Keiyoushi source repository for immediate access to hundreds of manga sources (MangaDex, Asura, Flame, etc.).
- **📁 Custom Storage & Download Path**: Keep your library inside `./data` or configure an external drive in Settings.

---

## 🚀 Quick Start

1. Click the **Mihon** icon on the left Activity Bar.
2. Click **Start Server** (or open the reader directly).
3. Browse to **Browse > Extensions** to install your favorite manga sources in one click.
4. Enjoy reading in the sidebar or click **⛶ Full** to read in an editor tab!

---

## ⌨️ Commands

| Command | Title | Description |
|---|---|---|
| `mihon.openReader` | **Mihon: Open Full Reader** | Opens the Suwayomi WebUI in a main editor tab |
| `mihon.startServer` | **Mihon: Start Server** | Starts the local Suwayomi background process |
| `mihon.stopServer` | **Mihon: Stop Server** | Cleanly terminates the background server |
| `mihon.restartServer` | **Mihon: Restart Server** | Restarts the local background server |
| `mihon.configureStorage` | **Mihon: Change Storage Location** | Native folder picker to relocate data folder |
| `mihon.openWebBrowser` | **Mihon: Open in External Browser** | Opens `http://127.0.0.1:<port>` in Chrome/Edge |

---

## ⚙️ Configuration Settings

| Setting | Default | Description |
|---|---|---|
| `mihon.serverPort` | `4567` | Default HTTP port (auto-increments if in use) |
| `mihon.dataDirectory` | `./data` | Directory where Suwayomi stores library and settings |
| `mihon.downloadDirectory` | `./data/downloads` | Directory for downloaded manga chapters |
| `mihon.autoStartServer` | `true` | Auto-start the server when opening the Mihon view |
| `mihon.keiyoushiRepo` | Keiyoushi URL | Official extension repository URL |

---

## 📄 License

MIT
