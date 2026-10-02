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
R12. On initial server initialization, the extension shall automatically pre-configure the Keiyoushi repository URL (`https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json`) so extensions are immediately visible in the Browse tab.

## Key Flows

### F1. On-Demand Server Start & Sidebar View
**Trigger:** User clicks the Mihon Activity Bar icon or executes `Mihon: Start Server`.
1. Extension checks if Suwayomi-Server is already responsive on the configured port.
2. If not running, extension spawns `java -jar bin/Suwayomi-Server-v2.4.2366.jar` with specified data directory arguments.
3. Status bar updates to `📖 Mihon: Starting...` and logs output to the `Mihon Server` output channel.
4. Once port healthcheck passes, sidebar Webview loads `http://127.0.0.1:<port>` and Status Bar changes to `📖 Mihon: Running`.

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

## Acceptance Examples
AE1. **When server is stopped:** Clicking `Mihon: Open Full Reader` prompts to start the server, starts it in the background, waits for readiness, and opens the editor tab seamlessly.
AE2. **When port 4567 is in use by another program:** The extension detects the port collision, selects port 4568, passes `--server.port=4568` to the jar, and connects the Webview to port 4568 without crashing.
AE3. **When user changes data directory setting:** Next server start respects the updated directory and loads the library from the new path.

## Scope Boundaries
- **Deferred for later:** Cloud synchronization across multiple PCs, custom keyboard macro overlays beyond what Suwayomi's WebUI provides.
- **Outside this product's identity:** Native Android APK emulation or building a custom Electron-based renderer (we integrate Suwayomi's official WebUI directly inside Antigravity).

## Dependencies / Assumptions
- Local system has Java 17+ installed (verified: OpenJDK 17.0.19 Temurin is present on system PATH).
- Antigravity IDE supports VS Code Extension API 1.85+.
- Network access to GitHub is available for downloading the Suwayomi jar and Keiyoushi extensions.
