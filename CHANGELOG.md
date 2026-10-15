# Changelog

All notable changes to the **MangaBar** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.4] - 2026-10-15

### Changed
- **Dynamic Shields & Store Metadata Refresh**:
  - Upgraded store and registry badges to dynamic auto-updating live shields pulling directly from Open VSX and GitHub Releases.
  - Refreshed all package documentation and store manifests to accurately reflect the complete **1,440+** Keiyoushi source extension catalog.
  - Upgraded `.github/workflows/release.yml` with automated dual-store CI/CD publishing support for both VS Code Marketplace and Open VSX.

## [0.2.3] - 2026-10-15

### Added
- **Global Manga Search & Discovery**:
  - Injected Global Search action button directly into the Library AppBar (`/sources/all/search`) for fast 1-click catalog browsing across all installed sources.
  - Interactive Empty Library Discovery Card with high-visibility *"Search Manga"* and *"Browse Sources"* buttons to guide new users immediately upon first launch.
  - Dedicated IDE toolbar Search buttons in both the Sidebar header and Reader Panel toolbar with command bridge (`navSearch()` / `goSearch()`).
  - Fast keyboard shortcuts (`/` and `s`) in reader views to trigger global search instantly.
- **Configurable Auto-Sleep & Active-View Awareness**:
  - Introduced `mangabar.idleSleepTimeout` setting (default: `5` minutes, `0` to disable).
  - Background server engine automatically sleeps when inactive to reclaim ~350 MB RAM, but **strictly never sleeps** while the MangaBar Reader panel or Sidebar webview is actively open.
  - Added Command Palette action `MangaBar: Configure Auto-Sleep Timeout...` to adjust sleep duration on the fly.

### Fixed
- **Source Extension Icon Restoration**:
  - Fixed brand scrubber over-filtering to ensure all 1,440+ extension source icons (Keiyoushi, MangaDex, etc.) display their authentic logos instead of blank or generic placeholders.
- **Engine Startup & Memory Optimization**:
  - Reduced cold start latency and applied hotfix bytecode classes for smooth background lifecycle management without UI freezes.

## [0.2.2] - 2026-10-14

### Fixed
- Resolved UI freeze, missing command activation, log streaming, and startup timeouts.

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
