# Changelog

All notable changes to the **MangaBar** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-10-03
 
### Added
- **Complete MangaBar Rebranding**:
  - Full top-to-bottom rebrand to **MangaBar - Manga & Comic Reader** across all UI surfaces, command palette, activity bar, and configuration namespace.
  - Custom ASCII launch banner and real-time log stream sanitizer in the "MangaBar Server" Output Channel.
  - Transparent reverse-proxy HTML interceptor and DOM Brand Sanitizer dynamically scrubbing upstream names in the embedded WebUI.
  - Storage directory migrated to `~/.mangabar` with automatic non-destructive migration of existing libraries and settings.
  - Server binary renamed to `mangabar-server.jar`.
  - All command IDs transitioned to `mangabar.*`.
- **Dual Sidebar Placement (Left vs Right)**:
  - Added 1-click header toolbar button to switch MangaBar between Primary Activity Bar (left) and Secondary Side Bar (`auxiliarybar` on the right).
  - Introduced configuration setting `mangabar.sideBarLocation`: `"left"` | `"right"`.
  - Enables developers to keep File Explorer open on the left and read manga on the right simultaneously.
- **Reader Navigation Flow**:
  - Intercepted top-left backward arrow (`←`) in reader controls to dismiss the controls menu and return to the active manga page (instead of abruptly closing the reader).
  - Added a subtle floating translucent exit button (`#mangabar-floating-exit-btn`) in the top-left corner of the manga reading screen (35% idle opacity, 100% on hover) to smoothly return to Manga Details (`/manga/:mangaId`) or Library (`/`).
- **Safe Clamped Ctrl-Zoom (50% to 400%)**:
  - Added smooth `Ctrl + Mouse Wheel` and `Ctrl +/-/0` zoom clamped between 0.5x and 4.0x.
  - Intercepts and blocks outer IDE font/window zoom leakage (`preventDefault`).
  - Added click-and-drag panning when zoomed in (`> 1.0x`); preserves standard click-to-turn touch zones at 1.0x.
  - Automatically resets zoom factor to 1.0x on page turns and chapter changes.
  - Added discreet transient HUD indicator pill showing current zoom percentage.
- **Dedicated Reload & Safe Restart Actions**:
  - Added dedicated header button to restart the server with database lock and socket clearance.
  - Added reload view button to refresh all active webview frames.

## [0.1.0] - 2026-10-02

### Added
- **Embedded Manga Reader**: Integrated full-window reading panel with custom zoom, continuous reading, and reading modes.
- **Global Keyboard Shortcuts**:
  - `Ctrl+Alt+M` (`Cmd+Alt+M` on macOS) to instantly toggle open/close the Reader panel.
  - `Ctrl+Alt+S` (`Cmd+Alt+S` on macOS) to focus the MangaBar Activity Bar sidebar.
  - `Escape` within reader panels to close reader overlay.
- **Sidebar Companion Webview**: Activity bar view providing one-click server control, status indicators, and quick links.
- **Automated Server Lifecycle Management**:
  - Auto-start on sidebar view activation.
  - Background process management with fast-fail exit detection and automatic port fallback (`4567` -> dynamic free port).
  - Pre-flight active server detection to avoid redundant process spawning.
  - Clean PID cleanup on IDE shutdown (`deactivate`).
- **Flexible Server Options**:
  - Support for `mangabar.customServerUrl` to connect directly to an existing local or remote server without launching local Java binaries.
  - Explicit user setup prompt for downloading server dependencies or specifying a remote server endpoint.
- **Extension Repository Integration**:
  - Direct 1-click addition of the official manga extension repository (`index.min.json`).
  - Extensions view shortcuts and quick-copy repository URLs.
- **Customizable Storage Path**:
  - Configure custom library and download directories via VS Code settings or sidebar folder picker.
- **Visual Assets & Store Identity**:
  - Official high-resolution cyber manga app icon (`media/icon.png`).
  - Wide 16:9 marketplace hero banner and feature graphics.
