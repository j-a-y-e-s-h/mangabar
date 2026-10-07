# MangaBar (Manga Bar) — #1 Manga, Manhwa & Comic Reader for Any IDE (VS Code, Cursor & More)

<p align="center">
  <a href="https://raw.githubusercontent.com/j-a-y-e-s-h/mangabar/main/media/hero-banner.jpg" target="_blank">
    <img src="https://raw.githubusercontent.com/j-a-y-e-s-h/mangabar/main/media/hero-banner.jpg" alt="MangaBar (Manga Bar) — Manga, Manhwa & Comic Reader for Any IDE (VS Code, Cursor, Windsurf & VSCodium)" width="100%" decoding="async">
  </a>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=j-a-y-e-s-h.mangabar"><img src="https://img.shields.io/visual-studio-marketplace/v/j-a-y-e-s-h.mangabar?style=for-the-badge&logo=visualstudiocode&logoColor=white&label=Marketplace" alt="VS Code Marketplace"></a>
  <a href="https://open-vsx.org/extension/j-a-y-e-s-h/mangabar"><img src="https://img.shields.io/badge/Open%20VSX-v0.2.0-7c3aed?style=for-the-badge&logo=eclipseide&logoColor=white" alt="Open VSX Registry"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=j-a-y-e-s-h.mangabar"><img src="https://img.shields.io/visual-studio-marketplace/i/j-a-y-e-s-h.mangabar?style=for-the-badge&color=00bcd4" alt="Installs"></a>
  <a href="https://github.com/j-a-y-e-s-h/mangabar/stargazers"><img src="https://img.shields.io/github/stars/j-a-y-e-s-h/mangabar?style=for-the-badge&color=f1c40f&logo=github" alt="GitHub Stars"></a>
  <a href="https://skills.sh/"><img src="https://img.shields.io/badge/Agent_Skill-npx_skills_add_j--a--y--e--s--h%2Fmangabar-00e5ff?style=for-the-badge&logo=anthropic&logoColor=white" alt="Agent Skill"></a>
  <a href="llms.txt"><img src="https://img.shields.io/badge/LLMs.txt-Supported-blueviolet?style=for-the-badge" alt="LLMs.txt Supported"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-4caf50?style=for-the-badge" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-6c5ce7?style=for-the-badge" alt="Cross Platform">
  <img src="https://img.shields.io/badge/Sources-350%2B%20Extensions-ff7675?style=for-the-badge" alt="350+ Sources">
</p>

> 🌟 **Enjoying MangaBar?** Please consider giving us a **[Star on GitHub](https://github.com/j-a-y-e-s-h/mangabar)** to support development and help more developers discover it!

---

## 📑 Table of Contents
- [Why MangaBar?](#-why-mangabar)
- [Visual Showcase](#-visual-showcase)
- [Quick Start in 60 Seconds](#-quick-start-in-60-seconds)
- [Keyboard Shortcuts & Controls](#️-keyboard-shortcuts--controls)
- [Commands Reference](#️-commands-reference)
- [Extension Settings](#️-extension-settings)
- [Frequently Asked Questions (FAQ)](#-frequently-asked-questions-faq)
- [AI Agents & LLM Integration](#-ai-agents--llm-integration)
- [Contributing & Community](#-contributing--community)
- [Compatibility](#-compatibility)
- [License & Attribution](#-license--attribution)

---

## ⚡ Read Manga Directly Inside Your Development Workspace

**MangaBar** (also commonly searched as **Manga Bar**) is a lightweight, high-performance manga, manhwa, webtoon, and comic reader crafted specifically for code editors and IDEs. Whether you're waiting for a build to finish, tests to pass, or taking a quick micro-break between coding sprints, MangaBar lets you read seamlessly without switching windows, losing focus, or breaking your development flow.

### 🌟 Why MangaBar?
- 📖 **Embedded Dual-Docking**: Keep your File Explorer open on the left and dock MangaBar in the secondary right sidebar (`auxiliarybar`)—or vice versa with a single click.
- 🚀 **350+ Sources Pre-Configured**: Instant access to the official Keiyoushi Extension Network including MangaDex, MangaKakalot, ComicK, Asura Scans, and more.
- 🔍 **Smooth Clamped Zoom & Pan (50% – 400%)**: Smooth `Ctrl + Wheel` or `Ctrl +/-` zoom with strict event isolation—never accidentally zoom your IDE editor fonts.
- 💾 **Offline Downloads**: Download full chapters to your local drive for uninterrupted offline reading during commutes and flights.
- ⌨️ **Global Hotkey (`Ctrl+Alt+M`)**: Instantly toggle your manga panel or full editor tab from anywhere in your IDE.
- 🔒 **Completely Private & Isolated**: Operates offline-first with zero tracking, storing data locally at `~/.mangabar`.

---

## 📸 Visual Showcase

### 1. Split-Screen Coding & Reading
Dock MangaBar side-by-side with your active code files. Read continuously or single-page while monitoring logs and terminals.

<p align="center">
  <a href="https://raw.githubusercontent.com/j-a-y-e-s-h/mangabar/main/media/feature-reader.jpg" target="_blank">
    <img src="https://raw.githubusercontent.com/j-a-y-e-s-h/mangabar/main/media/feature-reader.jpg" alt="MangaBar Split Screen Coding and Reading" width="100%" loading="lazy" decoding="async">
  </a>
</p>

### 2. Rich 350+ Source Extension Catalog
One-click install from hundreds of community-maintained manga, manhwa, and comic extensions with automatic repository synchronization.

<p align="center">
  <a href="https://raw.githubusercontent.com/j-a-y-e-s-h/mangabar/main/media/feature-extensions.jpg" target="_blank">
    <img src="https://raw.githubusercontent.com/j-a-y-e-s-h/mangabar/main/media/feature-extensions.jpg" alt="MangaBar Extension Catalog" width="100%" loading="lazy" decoding="async">
  </a>
</p>

### 3. Personal Library & Offline Chapter Downloads
Track your reading progress, organize titles by status (Reading, Completed, Plan to Read), and download chapters for offline use.

<p align="center">
  <a href="https://raw.githubusercontent.com/j-a-y-e-s-h/mangabar/main/media/feature-library.jpg" target="_blank">
    <img src="https://raw.githubusercontent.com/j-a-y-e-s-h/mangabar/main/media/feature-library.jpg" alt="MangaBar Personal Library and Offline Downloads" width="100%" loading="lazy" decoding="async">
  </a>
</p>

---

## 🚀 Quick Start in 60 Seconds

### 1. From VS Code Marketplace (Recommended)

Search for **"MangaBar"** directly in your IDE Extensions tab (`Ctrl+Shift+X` or `Cmd+Shift+X`) and click **Install**.

Or install instantly via your terminal:
```bash
code --install-extension j-a-y-e-s-h.mangabar
```

### 2. Manual VSIX Install (Cursor, Windsurf, VSCodium & Offline)

Download `mangabar-0.2.0.vsix` from [GitHub Releases](https://github.com/j-a-y-e-s-h/mangabar/releases/latest), then run:
```bash
# For Cursor:
cursor --install-extension mangabar-0.2.0.vsix

# For VS Code / VSCodium:
code --install-extension mangabar-0.2.0.vsix
```

*Or via IDE UI:*
1. Open the Extensions View (`Ctrl+Shift+X` or `Cmd+Shift+X`).
2. Click the **`...`** (Views and More Actions) menu in the top-right corner.
3. Select **Install from VSIX...** and choose `mangabar-0.2.0.vsix`.

---

### Step-by-Step Setup

1. **Open MangaBar**:
   - Click the **MangaBar Book Icon** in the Activity Bar (left), or press `Ctrl+Alt+M` (`Cmd+Alt+M` on macOS).
2. **First-Time Launch**:
   - MangaBar automatically prepares its local offline engine into `~/.mangabar`.
3. **Install Your First Source**:
   - Navigate to **Browse > Extensions**, find your favorite source (e.g. *MangaDex*, *ComicK*, or *MangaKakalot*), and click **Install**.
4. **Start Reading**:
   - Search for titles, add them to your personal Library, and enjoy distraction-free reading!

---

## ⌨️ Keyboard Shortcuts & Controls

| Shortcut (Win / Linux) | Shortcut (macOS) | Command | Action |
|---|---|---|---|
| `Ctrl+Alt+M` | `Cmd+Alt+M` | `mangabar.toggleReader` | Toggle full reader editor tab (Open / Close) |
| `Ctrl+Alt+S` | `Cmd+Alt+S` | `mangabar.toggleSidebar` | Focus MangaBar sidebar companion in Activity Bar |
| `Ctrl + Scroll` | `Cmd + Scroll` | Reader Zoom | Zoom image smoothly between **0.5x** and **4.0x** |
| `Click + Drag` | `Click + Drag` | Reader Pan | Pan around zoomed page smoothly |
| `Escape` | `Escape` | Dismiss Menu | Dismiss reader overlay or exit back to manga details |

---

## 🛠️ Commands Reference

Access these commands anytime from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Command Identifier | Description |
|---|---|---|
| **MangaBar: Toggle Side Bar Location** | `mangabar.toggleSideBarLocation` | Instantly switches MangaBar between Left and Right sidebars |
| **MangaBar: Toggle Full Reader** | `mangabar.toggleReader` | Toggles the reading panel (`Ctrl+Alt+M`) |
| **MangaBar: Open Full Reader** | `mangabar.openReader` | Opens the full-scale reader in a main editor tab |
| **MangaBar: Toggle MangaBar Sidebar** | `mangabar.toggleSidebar` | Opens the MangaBar companion in the sidebar |
| **MangaBar: Start Server** | `mangabar.startServer` | Manually starts the local MangaBar background engine |
| **MangaBar: Stop Server** | `mangabar.stopServer` | Gracefully shuts down the background server |
| **MangaBar: Restart Server** | `mangabar.restartServer` | Cleans process locks and restarts the background engine |
| **MangaBar: Reload View** | `mangabar.reloadView` | Refreshes the active MangaBar webview frame |
| **MangaBar: Change Storage Location** | `mangabar.configureStorage` | Relocates manga library and download data folder |
| **MangaBar: Open in External Browser** | `mangabar.openWebBrowser` | Launches current manga page in your default browser |

---

## ⚙️ Extension Settings

Customize MangaBar behavior in Settings (`Ctrl+,` or `Cmd+,` > search for `MangaBar`):

| Setting | Default | Description |
|---|---|---|
| `mangabar.sideBarLocation` | `"left"` | Preferred dock: `"left"` (Primary Activity Bar) or `"right"` (Secondary Side Bar). |
| `mangabar.customServerUrl` | `""` | Connect to an existing or remote server instance (e.g., `http://localhost:4567` or `http://192.168.1.100:4567`). |
| `mangabar.serverPort` | `4567` | Default HTTP port for the engine (auto-selects next available port if busy). |
| `mangabar.dataDirectory` | `./data` | Directory where MangaBar stores your library, database, and settings (`~/.mangabar`). |
| `mangabar.downloadDirectory` | `./data/downloads` | Storage path for downloaded offline manga chapters. |
| `mangabar.autoStartServer` | `false` | Automatically boot the local engine when opening MangaBar (disabled by default for smooth IDE startup). |
| `mangabar.extensionRepo` | *Keiyoushi URL* | Extension repository URL for community manga sources. |
| `mangabar.serverDownloadUrl` | `""` | Custom URL or mirror to download the engine binary. |

---

## ❓ Frequently Asked Questions (FAQ)

### 1. Can I read manga offline with MangaBar?
**Yes.** MangaBar fully supports offline chapter downloads. Open any title from your favorite source, choose the chapters you want to download, and save them directly to your local drive. Chapters are stored locally in `~/.mangabar/data/downloads` so you can read anytime without internet access.

### 2. Which manga, manhwa & comic sources are supported?
MangaBar comes pre-configured with the official **Keiyoushi Extension Repository**, giving you one-click access to over **350+ community-maintained sources**. Popular supported sources include **MangaDex**, **ComicK**, **MangaKakalot**, **Asura Scans**, **Flame Comics**, and numerous language-specific catalogs in English, Spanish, French, Portuguese, Indonesian, and more.

### 3. Does zooming manga affect my VS Code editor zoom?
**No.** MangaBar implements clamped zoom event isolation (`0.5x` to `4.0x`). Zooming in and out using `Ctrl + Mouse Wheel` or `Ctrl +/-` strictly modifies the manga page canvas without zooming your IDE workspace or editor text font.

### 4. Why is autoStartServer disabled by default?
To keep your IDE launch blazing fast and conserve system CPU and RAM during heavy coding sessions, MangaBar only starts when you actively trigger it (e.g. clicking **MangaBar: Start Server** or opening the reader). If you prefer background engine auto-boot, simply set `"mangabar.autoStartServer": true` in VS Code Settings.

### 5. Does MangaBar work in Cursor, Windsurf, and VSCodium?
**Yes.** MangaBar is built on standard VS Code Extension APIs (compatible with VS Code `1.85.0+`) and works seamlessly in **Cursor**, **Windsurf**, and **VSCodium**. Download the latest `.vsix` from [GitHub Releases](https://github.com/j-a-y-e-s-h/mangabar/releases/latest) and install via CLI or editor UI.

### 6. Where is my personal data and reading history stored?
All manga library records, reading status, settings, and downloaded chapters are stored entirely locally on your computer at `~/.mangabar`. No account creation, telemetry, or external cloud syncing is required.

---

## 🤖 AI Agents & LLM Integration

MangaBar natively supports the open agent skills ecosystem and AI documentation standards so agents (Claude Code, Cursor, Copilot, ChatGPT, Gemini, Codex) can discover, install, and automate it:

- **Install Open Agent Skill**:
  ```bash
  npx skills add j-a-y-e-s-h/mangabar
  ```
- **Context for LLMs & AI Search (`llms.txt`)**:
  - Concise specification: [`llms.txt`](llms.txt) (served at `https://j-a-y-e-s-h.github.io/mangabar/llms.txt`)
  - Full technical spec: [`llms-full.txt`](llms-full.txt) (served at `https://j-a-y-e-s-h.github.io/mangabar/llms-full.txt`)
  - Free & Open-source license: [`pricing.md`](pricing.md)

---

## 🤝 Contributing & Community

We welcome contributions, issues, and feature suggestions from the community!
- 🐛 **Report a Bug**: Open a ticket on our [GitHub Issue Tracker](https://github.com/j-a-y-e-s-h/mangabar/issues).
- 💡 **Request a Feature or Source**: Join our [GitHub Discussions](https://github.com/j-a-y-e-s-h/mangabar/discussions).
- ⭐ **Support the Project**: Give us a star on [GitHub](https://github.com/j-a-y-e-s-h/mangabar)—it helps more developers find MangaBar!

---

## 💻 Compatibility

MangaBar runs natively across all major desktop operating systems and modern code editors:
- **IDEs**: VS Code (`1.85.0+`), Cursor, Windsurf, VSCodium.
- **Operating Systems**: Windows 10/11 (x64, arm64), macOS (Intel & Apple Silicon), Linux (Ubuntu, Debian, Fedora, Arch).
- **Architecture**: Zero cloud dependency; 100% self-hosted and private.

---

## 📄 License & Attribution

- Distributed under the [MIT License](LICENSE).
- Powered by open source community extensions and reader engines. All manga and comic content belongs to their respective creators and publishers.
- Maintained by [Jayesh](https://github.com/j-a-y-e-s-h) on GitHub.
