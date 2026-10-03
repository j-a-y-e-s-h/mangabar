---
date: 2026-10-03
origin: docs/brainstorms/2026-10-03-full-mangabar-rebranding-requirements.md
status: completed
---

# Full MangaBar Rebranding Implementation Plan

## Summary
Complete the total transition of the extension and runtime stack to **MangaBar** (`MangaBar - Manga & Comic Reader`, `antigravity-mangabar`). Completely removes all user-visible and codebase references to "Suwayomi", "Mihon", and "Tachidesk", replacing them with custom MangaBar server launch ASCII art, real-time log stream rewriting, reverse proxy WebUI title and brand scrubbing, VS Code command/view/configuration namespace migration (`mangabar.*` with seamless legacy aliases), and automatic user data migration from `~/.suwayomi` to `~/.mangabar`.

---

## Problem Frame
The current build contains remnants of upstream names ("Suwayomi", "Mihon", and "Tachidesk") across:
1. Server launch output (raw Suwayomi ASCII banner, log lines, and output channel name `Mihon Server`).
2. The embedded WebUI (`<title>Suwayomi-WebUI</title>`, drawer labels, and top navbar).
3. VS Code IDs and commands (`mihon.*` commands, `mihon-sidebar` view container, `mihon.sidebarView`, `mihon` settings).
4. Local filesystem paths (`server/suwayomi-server-*.jar`, default `~/.suwayomi` data directory).
5. Source files (`src/suwayomiClient.ts`, `media/mihon.svg`).

To deliver a truly bespoke, independent product, the user requested a full, top-to-bottom rebrand so the project operates, appears, and logs as our own dedicated build.

---

## Requirements Traceability
- **R30 (Server Launch Branding & ASCII Banner)**: Implement custom MangaBar ASCII banner, suppress upstream ASCII art, and sanitize `stdout`/`stderr` logs in real-time. *(Mapped to Unit U1)*
- **R31 (WebUI & Proxy Content Scrubbing)**: Reverse proxy intercepts HTML `<title>` and brand strings; injected DOM enhancer dynamically scrubs headers/drawers. *(Mapped to Unit U2)*
- **R32 (VS Code Namespace Migration)**: Migrate commands, views, and settings to `mangabar.*`, preserving legacy aliases for backward compatibility. *(Mapped to Unit U3)*
- **R33 (Storage Directory & Engine Binary Transition)**: Default to `~/.mangabar`, auto-migrate legacy `~/.suwayomi` data, and name server binary `mangabar-server.jar`. *(Mapped to Unit U4)*
- **R34 (Source Code & Asset Cleanup)**: Rename `suwayomiClient.ts` -> `mangabarClient.ts`, rename `mihon.svg` -> `mangabar.svg`, update documentation and manifests. *(Mapped to Unit U5)*

---

## Key Technical Decisions (KTDs)
- **KTD-1: Real-Time Stream Sanitizer over Static Jar Modification**:
  - *Decision*: Transform raw Java `stdout`/`stderr` chunks in Node.js before forwarding to the Output Channel, rather than attempting to decompile and repackage the upstream JAR binary.
  - *Rationale*: Decompiling/recompiling the upstream JAR creates fragile build chains and prevents cleanly updating the underlying server engine. Stream sanitization provides 100% clean output in the Output Channel with zero JAR corruption risk.
- **KTD-2: In-Flight WebUI Reverse Proxy & DOM Mutation Scrubbing**:
  - *Decision*: Use the existing local HTTP reverse proxy (`serverManager.ts`) to rewrite HTML response headers/body and the injected script (`readerEnhancer.ts`) with a `MutationObserver` to patch single-page app DOM text.
  - *Rationale*: Suwayomi-WebUI is a single-page React/Vue application where the initial HTML contains the title, but components later re-render brand text in client JavaScript. Combining proxy-level HTML rewriting with client-side DOM mutation observing ensures branding persists across route changes.
- **KTD-3: Clean `mangabar.*` Namespace with Forwarding Aliases**:
  - *Decision*: Make `mangabar.*` the primary declared namespace in `package.json` while registering hidden `mihon.*` forwarding handlers in `extension.ts`.
  - *Rationale*: Prevents breaking user keybindings or third-party command executions while cleanly presenting `MangaBar` in the Command Palette and menus.
- **KTD-4: Non-Destructive Storage Migration (`~/.suwayomi` -> `~/.mangabar`)**:
  - *Decision*: When `~/.mangabar` is uninitialized and `~/.suwayomi` exists, copy the database file (`server.mv.db`) and downloads folder.
  - *Rationale*: Guarantees users do not lose their manga libraries, bookmarks, or chapter reading history when upgrading to the rebranded version.

---

## High-Level Technical Design

```
+--------------------------------------------------------------------------------+
| VS Code Host (MangaBar Extension)                                              |
|                                                                                |
|  [mangabar.sidebarView]  [mangabar.openReader]                                 |
|          |                        |                                            |
|          v                        v                                            |
|  Webview Container        Webview Container                                    |
|          |                        |                                            |
|          +------------+-----------+                                            |
|                       | (Local HTTP Proxy :0)                                  |
|                       v                                                        |
|      +-----------------------------------------+                               |
|      | Reverse Proxy (serverManager.ts)        |                               |
|      | - Rewrites <title> -> MangaBar          |                               |
|      | - Injects readerEnhancer.js             |                               |
|      | - DOM MutationObserver scrubs navbar   |                               |
|      +--------------------+--------------------+                               |
|                           | (127.0.0.1:targetPort)                             |
|                           v                                                    |
|      +-----------------------------------------+                               |
|      | MangaBar Engine (Child Process: Java)   |                               |
|      | Binary: server/mangabar-server.jar      |                               |
|      | Storage: ~/.mangabar/                   |                               |
|      +--------------------+--------------------+                               |
|                           | (stdout / stderr stream)                           |
|                           v                                                    |
|      +-----------------------------------------+                               |
|      | Stream Sanitizer (serverManager.ts)     |                               |
|      | - Suppresses upstream ASCII banner      |                               |
|      | - Prepends MangaBar ASCII Banner        |                               |
|      | - Replaces Suwayomi/Tachidesk -> MangaBar|                              |
|      +--------------------+--------------------+                               |
|                           |                                                    |
|                           v                                                    |
|          Output Channel: "MangaBar Server"                                     |
+--------------------------------------------------------------------------------+
```

---

## Scope Boundaries
- **In Scope**:
  - All VS Code UI surfaces (Command palette, Activity bar, menus, status bar, notifications, output channel).
  - Terminal/log output emitted when starting, running, or stopping the server.
  - WebUI titles, headers, and brand text rendered inside the embedded webviews.
  - Data directory migration from legacy paths.
  - Local binary renaming and download experience.
  - Codebase file and class renaming.
- **Out of Scope**:
  - Decompiling or modifying internal bytecode of the server JAR (handled cleanly via stream sanitization and runtime proxying).
  - Modifying external Suwayomi GitHub API endpoints used for downloads (URL points to the release asset, but user-facing UI labels it MangaBar).

---

## Implementation Units

### Unit U1: Output Channel & Server Launch Stream Sanitizer
- **Goal**: Deliver a pristine MangaBar launch banner and real-time sanitized log output.
- **Files**:
  - `src/serverManager.ts`
- **Details**:
  - Rename Output Channel from `Mihon Server` to `MangaBar Server`.
  - Add `printMangaBarBanner()` emitting:
    ```
     __  __                         ____             
    |  \/  | __ _ _ __   __ _  __ _| __ )  __ _ _ __ 
    | |\/| |/ _` | '_ \ / _` |/ _` |  _ \ / _` | '__|
    | |  | | (_| | | | | (_| | (_| | |_) | (_| | |   
    |_|  |_|\__,_|_| |_|\__, |\__,_|____/ \__,_|_|   
                        |___/                        
    MangaBar Server Engine v0.2.0 • High-Performance Manga Server
    ```
  - Implement `sanitizeLogOutput(text: string): string` to filter incoming `stdout` and `stderr`:
    - Suppress upstream ASCII banner lines.
    - Replace `Suwayomi-Server` / `Suwayomi Server` -> `MangaBar Engine`.
    - Replace `Suwayomi` -> `MangaBar`.
    - Replace `Tachidesk` -> `MangaBar Core`.
    - Replace `Mihon` -> `MangaBar`.
- **Verification**:
  - Trigger server start; verify Output Channel displays the MangaBar ASCII banner and zero mentions of Suwayomi or Mihon in the log stream.

---

### Unit U2: WebUI Proxy & DOM Brand Sanitizer
- **Goal**: Rebrand the embedded library and reader WebUI so all browser titles and UI elements display MangaBar.
- **Files**:
  - `src/serverManager.ts`
  - `src/readerEnhancer.ts`
- **Details**:
  - In `src/serverManager.ts`:
    - Extend proxy HTML interception to replace `<title>.*?</title>` with `<title>MangaBar</title>`.
    - Replace raw HTML strings of `Suwayomi-WebUI` and `Suwayomi` with `MangaBar`.
  - In `src/readerEnhancer.ts`:
    - Add a DOM observer targeting top-bar brand elements, drawer headers, and tab title:
      - Intercept and rewrite `document.title` whenever it changes to include `MangaBar`.
      - Check headers containing `Suwayomi` or `Mihon` and replace inner text/HTML with `MangaBar`.
- **Verification**:
  - Open Sidebar Webview and Full Reader panel; verify tab header, top bar, and browser title display `MangaBar`.

---

### Unit U3: VS Code Commands, Views & Settings Namespace Migration
- **Goal**: Transition all command IDs, view IDs, and configuration options to `mangabar.*` with full backward compatibility.
- **Files**:
  - `package.json`
  - `src/configManager.ts`
  - `src/extension.ts`
  - `src/sidebarProvider.ts`
  - `src/readerPanel.ts`
- **Details**:
  - `package.json`:
    - Rename commands: `mangabar.toggleReader`, `mangabar.toggleSidebar`, `mangabar.toggleSideBarLocation`, `mangabar.openReader`, `mangabar.startServer`, `mangabar.reloadView`, `mangabar.restartServer`, `mangabar.stopServer`, `mangabar.configureStorage`, `mangabar.openWebBrowser`.
    - Rename views: view container `mangabar-sidebar`, view ID `mangabar.sidebarView`.
    - Rename configuration section: `mangabar`.
    - Update menus and keybindings to match `mangabar.*`.
  - `src/configManager.ts`:
    - Update config namespace to `mangabar`.
    - If `mangabar.<key>` is not set, check legacy `mihon.<key>` before defaulting.
  - `src/extension.ts`:
    - Register all `mangabar.*` commands.
    - Register forwarding aliases for `mihon.*` commands so existing scripts/shortcuts continue working.
  - `src/sidebarProvider.ts` & `src/readerPanel.ts`:
    - Update `viewType` and command executions to `mangabar.sidebarView` and `mangabar.*`.
- **Verification**:
  - Test executing `mangabar.openReader`, `mangabar.restartServer`, and `mangabar.reloadView`.
  - Verify keybindings `Ctrl+Alt+M` and `Ctrl+Alt+S` execute the rebranded commands.

---

### Unit U4: Storage Directory & Server Binary Rebranding
- **Goal**: Rebrand the local data storage home to `~/.mangabar` with auto-migration, and name the server JAR `mangabar-server.jar`.
- **Files**:
  - `src/configManager.ts`
  - `src/installer.ts`
  - `src/serverManager.ts`
- **Details**:
  - `src/configManager.ts`:
    - Set default data directory to `path.join(os.homedir(), '.mangabar')`.
    - In `prepareDataDirectory()`, check if `~/.mangabar` does not exist but `~/.suwayomi` does. If so, copy database (`server.mv.db`) and manga folder to `~/.mangabar` non-destructively.
  - `src/installer.ts`:
    - Update `getServerJarPath()` to use `mangabar-server.jar`.
    - Update download progress titles: `"Downloading MangaBar Server Engine..."`.
- **Verification**:
  - Verify server boots with data directory pointing to `~/.mangabar`.
  - Verify legacy database files migrate cleanly if present.

---

### Unit U5: Source Code, Assets & Documentation Scrubbing
- **Goal**: Clean up all internal file names, classes, asset files, and documentation.
- **Files**:
  - `src/suwayomiClient.ts` -> rename to `src/mangabarClient.ts`
  - `media/mihon.svg` -> rename to `media/mangabar.svg`
  - `README.md`
  - `CHANGELOG.md`
  - `package.json`
- **Details**:
  - Rename `src/suwayomiClient.ts` to `src/mangabarClient.ts`, updating class `SuwayomiClient` to `MangaBarClient` and all import references.
  - Rename `media/mihon.svg` to `media/mangabar.svg` and update `package.json` icon references.
  - Update `README.md` and `CHANGELOG.md` to present MangaBar as the official, standalone reader extension.
  - Run `node esbuild.js` and package `antigravity-mangabar-0.2.0.vsix`.
- **Verification**:
  - Ensure zero TypeScript compiler errors.
  - Ensure `node esbuild.js` passes with exit code 0.
  - Package VSIX and verify manifest contents.
