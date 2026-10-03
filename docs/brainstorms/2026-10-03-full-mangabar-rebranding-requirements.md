---
date: 2026-10-03
topic: full-mangabar-rebranding
status: approved
---

# Full MangaBar Rebranding Requirements

## Summary
Completely eliminate all user-facing and code-level references to "Suwayomi", "Mihon", and "Tachidesk", establishing the project as a fully independent, premium, first-class build named **MangaBar** (`MangaBar - Manga & Comic Reader`, `antigravity-mangabar`).

This includes:
1. Rebranding the server launch experience (custom ASCII banner, Output Channel, and runtime stream log filter).
2. Deep WebUI and embedded reader rebranding (HTML proxy title rewrite, navbar brand scrubbing, and DOM mutation patching).
3. VS Code ecosystem migration (`mangabar.*` commands, views, configuration keys, with seamless backward-compatible fallbacks).
4. Storage and binary lifecycle rebranding (`~/.mangabar` data home with automatic migration from legacy paths, `mangabar-server.jar`).
5. Complete source code cleanup (renaming `suwayomiClient.ts` to `mangabarClient.ts`, updating class names, asset files, and documentation).

---

## Decisions Resolved (via /grill-me)
- **Server Launch & Log Scrubbing**:
  - Custom MangaBar ASCII banner printed in the Output Channel upon launch.
  - Upstream ASCII banner suppressed.
  - Real-time `stdout`/`stderr` stream filter replacing `Suwayomi-Server` -> `MangaBar Engine`, `Tachidesk` -> `MangaBar Core`, and `Mihon` -> `MangaBar`.
- **WebUI & Embedded Reader Interception**:
  - Transparent reverse proxy rewrites `<title>` to `MangaBar`.
  - Upstream HTML responses scrubbed of legacy brand names.
  - Injected client enhancer (`src/readerEnhancer.ts`) uses a DOM `MutationObserver` to patch header logos, drawer branding, and window titles in real-time.
- **Commands & Configuration**:
  - Primary namespace: `mangabar.*` for all commands, views, and settings.
  - Legacy `mihon.*` command aliases and configuration reading maintained as fallbacks to prevent broken keybindings or lost custom ports.
- **Storage Directory & Binary Naming**:
  - Primary data home: `~/.mangabar`.
  - Automatic migration from `~/.suwayomi` if found and `~/.mangabar` is clean, preserving user libraries, downloaded chapters, and reading progress.
  - Server binary stored as `server/mangabar-server.jar`.
  - Progress notifications: *"Downloading MangaBar Server Engine..."*.

---

## Detailed Requirements

### R30: Server Launch Branding & ASCII Banner
- The VS Code Output Channel shall be named `"MangaBar Server"`.
- Upon starting the server process, the output channel shall display a clean MangaBar ASCII banner:
  ```
   __  __                         ____             
  |  \/  | __ _ _ __   __ _  __ _| __ )  __ _ _ __ 
  | |\/| |/ _` | '_ \ / _` |/ _` |  _ \ / _` | '__|
  | |  | | (_| | | | | (_| | (_| | |_) | (_| | |   
  |_|  |_|\__,_|_| |_|\__, |\__,_|____/ \__,_|_|   
                      |___/                        
  MangaBar Server Engine • High-Performance Reader Stack
  ```
- Any initial raw ASCII banner emitted by the underlying Java engine shall be intercepted and suppressed from the output channel.
- All subsequent log output from `stdout` and `stderr` shall pass through a sanitizer that replaces:
  - `Suwayomi-Server` / `Suwayomi` -> `MangaBar Engine` / `MangaBar`
  - `Tachidesk` -> `MangaBar Core`
  - `Mihon` -> `MangaBar`

### R31: WebUI & Proxy Content Scrubbing
- The local reverse proxy in `src/serverManager.ts` shall intercept all `text/html` responses and:
  - Replace `<title>.*?</title>` with `<title>MangaBar</title>`.
  - Replace brand strings (`Suwayomi-WebUI`, `Suwayomi`) with `MangaBar`.
- The injected client script (`src/readerEnhancer.ts`) shall continuously enforce DOM branding:
  - Update `document.title` to `"MangaBar"` or `"MangaBar - [Chapter]"`.
  - Target navigation bars, app headers, and drawer titles to display `"MangaBar"`.

### R32: VS Code Extension Namespace Migration
- All commands in `package.json` shall be renamed to `mangabar.*`:
  - `mangabar.toggleReader`
  - `mangabar.toggleSidebar`
  - `mangabar.toggleSideBarLocation`
  - `mangabar.openReader`
  - `mangabar.startServer`
  - `mangabar.reloadView`
  - `mangabar.restartServer`
  - `mangabar.stopServer`
  - `mangabar.configureStorage`
  - `mangabar.openWebBrowser`
- Register `mihon.*` commands as internal aliases forwarding to `mangabar.*` so user muscle memory, custom keybindings, or third-party palettes continue functioning.
- Views & View Containers:
  - View Container ID: `mangabar-sidebar`
  - View ID: `mangabar.sidebarView`
  - Display Title: `MangaBar`
- Configuration Section:
  - Configuration section updated to `mangabar`.
  - Configuration reader falls back to `mihon.*` if `mangabar.*` is unset.

### R33: Storage Directory & Engine Binary Transition
- Default storage directory changed to `path.join(os.homedir(), '.mangabar')`.
- Migration: If `~/.mangabar` does not exist but `~/.suwayomi` exists, copy/link database files (`server.mv.db`) and downloaded manga files to `~/.mangabar` with an informational log in the Output Channel.
- Binary path: `server/mangabar-server.jar`.
- Installer notifications: *"Downloading MangaBar Server Engine..."*.

### R34: Source Code & Asset Cleanup
- Rename `src/suwayomiClient.ts` to `src/mangabarClient.ts`.
- Rename class `SuwayomiClient` to `MangaBarClient`.
- Rename `media/mihon.svg` to `media/mangabar.svg`.
- Clean up all code comments, log prefixes (`[MangaBar]`), error messages, and documentation (`README.md`, `CHANGELOG.md`).
