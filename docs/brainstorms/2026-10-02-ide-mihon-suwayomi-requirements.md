---
date: 2026-10-02
topic: ide-mihon-suwayomi
---

# Antigravity IDE Mihon (Suwayomi) Integration Requirements

## Summary
A dedicated Antigravity IDE extension that integrates Suwayomi-Server (Mihon desktop/server port) into a left Activity Bar sidebar view with on-demand background server lifecycle management and a 1-click full-scale editor reading tab. It pre-configures the official Keiyoushi extension repository for immediate manga source installation and gives users full control over custom storage and download paths.

## Problem Frame
Developers and avid manga readers currently have to manage Suwayomi/Mihon separately as an external application or standalone browser tab. Switching contexts between Antigravity IDE and a separate browser window causes friction, requires manually launching and stopping background server processes, and consumes unnecessary CPU and RAM when left running unnoticed after closing the IDE.

## Key Decisions
- **Left Activity Bar primary view with full-scale editor popout**: Enables quick glance and library browsing in the sidebar while providing a dedicated, full-width editor tab for immersive reading sessions without distraction.
- **On-demand server lifecycle with IDE auto-shutdown**: The server process only spins up when the user starts it or opens the Mihon view, and automatically terminates when Antigravity closes, ensuring zero zombie background processes.
- **User-configurable storage with project defaults**: Default library, downloads, and extensions live inside the project folder (`data/`), but user settings allow pointing to any external drive or directory.
- **Pre-configured Keiyoushi repository**: Automatically includes the Keiyoushi extension repo so users can immediately install and browse manga sources (MangaDex, Asura, Flame, etc.) without manual URL entry.
- **System Java 17 runtime utilization**: Executes the lightweight Suwayomi-Server standalone `.jar` using the verified system OpenJDK 17, avoiding duplicate 300+ MB JRE distributions.

## Requirements

### Extension & IDE Integration
R1. The extension shall register a custom Activity Bar icon on the left panel that opens the primary Mihon view.
R2. The primary sidebar view shall render server status (running, stopped, starting, error), quick controls (Start, Stop, Restart), and an embedded WebUI preview.
R3. The extension shall provide a command (`Mihon: Open Full Reader`) that opens the full Suwayomi WebUI in a main editor tab with complete Webview controls (zoom, scroll, hotkeys).
R4. The extension shall register a Status Bar item (`📖 Mihon`) reflecting server state and offering one-click access to launch the reader.

### Server Lifecycle & Process Control
R5. The extension shall manage Suwayomi-Server as a child background process bound to `127.0.0.1:4567` by default.
R6. If port 4567 is already occupied, the extension shall automatically detect the conflict and bind to an available fallback port or prompt the user.
R7. When Antigravity IDE closes (`deactivate()`), the extension shall cleanly send a termination signal (SIGTERM/SIGINT) to the server process and ensure it has exited.
R8. The extension shall support automatic downloading or verifying of `Suwayomi-Server-v2.4.2366.jar` in `bin/` with a one-click setup trigger if missing.

### Storage & Data Management
R9. The extension shall support a configuration setting (`mihon.dataDirectory`) defaulting to `./data` in the workspace.
R10. The extension shall support a configuration setting (`mihon.downloadDirectory`) allowing users to store downloaded chapters on any custom drive or folder.
R11. The extension shall provide a "Change Storage Location" action in the sidebar to easily select custom directories via the native OS folder picker.

### Manga Sources & Repository Integration
R12. The extension shall provide an interactive 'Extension Repos' quick-action header button in the sidebar that toggles an animated drop-down drawer without cluttering the manga browsing viewport.
R13. The Extension Repos drawer shall provide a 1-click preset chip for the official Keiyoushi repository (`https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json`), an input field for custom repository URLs, and a one-click 'Fetch All Extensions' action.
R14. The extension shall provide smart URL normalization: if the user supplies GitHub web URLs (such as `github.com/keiyoushi/extensions` or `github.com/keiyoushi/extensions-source`), the system shall automatically map them to the corresponding raw `index.min.json` endpoint expected by Suwayomi's GraphQL backend.
R15. Strict icon and aesthetic standards: all user-facing interfaces (sidebar header, drawer, reader panel, and placeholder cards) shall strictly use crisp vector SVG/Codicon icons with smooth micro-animations (hover transitions, active clicks, and rotating loaders). Emojis are strictly prohibited.

### Keyboard Shortcuts & Navigation
R16. The extension shall register default keyboard shortcuts:
  - `Ctrl+Alt+M` (`Cmd+Alt+M` on macOS) to toggle the Full Reader editor panel (opens if closed; closes if active).
  - `Ctrl+Alt+S` (`Cmd+Alt+S` on macOS) to toggle/focus the Mihon Activity Bar sidebar view.
  - When inside the Full Reader webview, pressing `Escape` or `Ctrl+Alt+M` shall cleanly close the reader tab.

### User Consent & Custom Server Settings
R17. On first run, if the local Suwayomi server binary or Java runtime is missing, the extension shall prompt the user with explicit consent before downloading, offering choices: `[Download & Setup]`, `[Use Custom Server URL]`, or `[Cancel]`.
R18. The extension shall provide a configuration setting (`mihon.customServerUrl`) allowing users to point to an external or remote Suwayomi server instance (e.g. `http://localhost:4567` or LAN host) with zero local download requirements.

### Extension Store Publishing & Packaging
R19. The extension shall provide complete Marketplace and Open VSX packaging assets:
  - High-resolution 128x128/256x256 PNG icon (`media/icon.png`) with modern dark cyber/manga aesthetic.
  - Hero banner (`media/hero-banner.png`) and feature visual previews.
  - Optimized `.vscodeignore` excluding binary blobs and development files to maintain a fast, compliant (< 2MB) VSIX distribution.
  - Comprehensive store `readme.md` and `CHANGELOG.md`.

## Key Flows

### F1. On-Demand Server Start & Sidebar View
**Trigger:** User clicks the Mihon Activity Bar icon or executes `Mihon: Start Server`.
1. Extension checks if Suwayomi-Server is already responsive on the configured port.
2. If not running, extension spawns `java -jar bin/Suwayomi-Server-v2.4.2366.jar` with specified data directory arguments.
3. Status bar updates to `$(sync~spin) Mihon: Starting...` and logs output to the `Mihon Server` output channel.
4. Once port healthcheck passes, sidebar Webview loads `http://127.0.0.1:<port>` and Status Bar changes to `$(book) Mihon :<port>`.

### F2. Full-Screen Reading Session
**Trigger:** User clicks "Open in Editor Tab" in the sidebar or presses the reader shortcut.
1. Extension creates a new Webview Panel in `ViewColumn.One` (or active editor group).
2. Sets Webview options to allow scripts, local resource access, and state retention (`retainContextWhenHidden: true`).
3. Loads the Suwayomi reader interface full-width inside Antigravity.

### F3. Clean IDE Exit
**Trigger:** Antigravity IDE window closes.
1. Extension's `deactivate()` hook is invoked.
2. Extension sends kill command to the child process PID tree.
3. Ensures port is freed and no orphan Java process remains in Windows Task Manager.

### F4. 1-Click Extension Store Registration & Fetch
**Trigger:** User opens the Extension Repos drawer in the sidebar and clicks the 'Keiyoushi (Official)' preset chip or adds a custom repo.
1. Webview sends `addExtensionStore` message with repository URL.
2. Extension normalizes the URL (converting GitHub landing page URLs to raw index endpoints if needed).
3. Extension issues GraphQL mutation `addExtensionStore` to Suwayomi (`http://127.0.0.1:<port>/api/graphql`).
4. Upon successful registration, extension automatically triggers `fetchExtensions` mutation to pull all extension packages.
5. The drawer displays an animated sync state and updates the total extension count (e.g., "1,400+ extensions available"), and reloads the Suwayomi Webview catalog.

## Acceptance Examples
AE1. **When server is stopped:** Clicking `Mihon: Open Full Reader` prompts to start the server, starts it in the background, waits for readiness, and opens the editor tab seamlessly.
AE2. **When port 4567 is in use by another program:** The extension detects the port collision, selects port 4568, passes `--server.port=4568` to the jar, and connects the Webview to port 4568 without crashing.
AE3. **When user clicks Keiyoushi preset chip:** Extension immediately registers the store via GraphQL, triggers extension fetch, and Suwayomi's Browse/Extensions tab displays 1,400+ manga sources.
AE4. **When user inputs a GitHub web URL:** Entering `https://github.com/keiyoushi/extensions` is auto-normalized to `https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json` and successfully registered.
AE5. **Visual aesthetic:** Header toolbar buttons and drawer controls use SVG icons matching VS Code Codicons; zero emojis exist in the UI.

## Scope Boundaries
- **Deferred for later:** Cloud synchronization across multiple PCs, custom keyboard macro overlays beyond what Suwayomi's WebUI provides.
- **Outside this product's identity:** Native Android APK emulation or building a custom Electron-based renderer (we integrate Suwayomi's official WebUI directly inside Antigravity).

## Dependencies / Assumptions
- Local system has Java 17+ installed (verified: OpenJDK 17.0.19 Temurin is present on system PATH).
- Antigravity IDE supports VS Code Extension API 1.85+.
- Network access to GitHub is available for downloading the Suwayomi jar and Keiyoushi extensions.

