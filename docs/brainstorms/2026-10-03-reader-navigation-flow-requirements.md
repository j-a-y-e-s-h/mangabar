---
date: 2026-10-03
topic: reader-navigation-flow
---

# Reader Navigation Flow Requirements (IDE Mihon)

## Summary
Enhance the reading navigation UX across both the Antigravity IDE sidebar webview and the full-scale reader tab. Resolves the jarring behavior where clicking the top-left backward arrow in the reader menu closes the reader entirely, replacing it with an intuitive two-tier navigation model:
1. In the reader menu, the backward arrow returns to the active manga page.
2. While reading the manga, a subtle translucent floating button in the top-left corner allows the user to exit back to Manga Details or Library.

---

## Problem Frame
In the Suwayomi WebUI reader:
- When a user opens the reader menu / chapter controls (Screenshot 1), clicking the top-left `←` arrow triggers an exit navigation out of the reader (to `/manga/:id` or `/`), rather than dismissing the controls overlay and returning to the page.
- When reading manga pages (Screenshot 2), there is no visible back or exit control without first tapping the middle touch zone to open the menu.
- Users need a seamless, predictable way to toggle between the menu and the manga, and an always-accessible yet unobtrusive way to exit the reader back to the manga chapter list.

---

## Key Decisions
- **Reader Menu Back Arrow (`←`) Action**: Repurposed from "Exit Reader" to "Return to Manga" — dismisses the reader menu/settings drawer and resumes reading the active chapter page.
- **Floating Exit Button on Manga Screen**: A modern, translucent circular pill button positioned in the top-left corner over the manga reading canvas.
  - **Aesthetics**: Follows modern subtle UI conventions. Semi-transparent (`opacity: 0.35`) during active reading to never obstruct art; transitions smoothly to full opacity (`1.0`) with subtle backdrop blur on hover or touch.
  - **Navigation Destination**: Directly returns to the Manga Details page (`/manga/:mangaId` showing all chapters), falling back to the Library (`/`) if history is unavailable.
- **Cross-Surface Consistency**: Identical navigation logic and visual fidelity across both the **Sidebar Webview** (`src/sidebarProvider.ts`) and the **Full Reader Tab** (`src/readerPanel.ts`).
- **Zero-Friction Script Injection**: Injected cleanly into the WebUI context so it directly hooks into Suwayomi's router and DOM events without cross-origin friction.

---

## Requirements

### R20: Reader Menu Dismissal via Back Arrow
- In the chapter reader menu/settings overlay (Screenshot 1), clicking the top-left backward arrow (`←`) shall dismiss the reader controls and return the view to the active manga page.
- It shall not navigate out of the reader or trigger a full page reload.

### R21: Floating Exit Button on Manga Reading Screen
- While actively viewing manga pages (Screenshot 2), a floating exit button shall be visible in the top-left corner.
- The button shall display a clean Codicon/SVG backward arrow icon (`←`).
- The button shall have a circular or rounded pill container with backdrop blur and subtle border.
- The button's idle opacity shall be `0.35`, smoothly animating to `1.0` on mouse hover or touch tap.

### R22: Exit Navigation Target
- Clicking the floating exit button on the manga reading screen shall navigate to the Manga Details page for the active manga (`/manga/:mangaId`).
- If no previous manga page is in session history, it shall safely fall back to the Library page (`/`).

### R23: Multi-View Support
- Requirements R20, R21, and R22 shall be active and functional in:
  1. The Left Activity Bar Sidebar Webview (`sidebarProvider.ts`).
  2. The Full-Scale Reader Editor Panel (`readerPanel.ts`).

### R24: Visual Polish & Accessibility
- The floating exit button shall have an accessible `aria-label="Exit Reader to Manga Details"`.
- It shall not intercept or break reader touch zones (Previous / Menu / Next) outside its small 36x36px boundary.
### R28: Dedicated 'Reload View' vs 'Restart Server' Controls
- The sidebar header toolbar and view title header shall provide distinct, unambiguous actions for Reloading the UI vs. Restarting the backend server:
  1. **Reload View (`mihon.reloadView`)**: Bound to `$(refresh)`. Reloads the active webview/iframe in `<100ms` without killing, restarting, or touching the background Java server.
  2. **Restart Server (`mihon.restartServer`)**: Bound to `$(sync)` (or `$(debug-restart)`). Explicitly restarts the Suwayomi backend process.
- Both actions shall be accessible in:
  - The view title header (`view/title` menu in `package.json`).
  - The MangaBar sidebar inner header toolbar.

### R29: Safe Server Restart & Lock Release Clearance
- When `Restart Server` is triggered:
  - The active process shall be terminated cleanly.
  - The extension shall poll and wait for the PID to completely exit and the TCP port (`4567`) to be 100% free before attempting to re-spawn.
  - A mandatory 1.5s - 2.5s safety backoff shall be observed to allow the operating system and filesystem to release H2 database locks (`server.mv.db`), preventing Java startup crash with `exit code 1: Process exited prematurely`.
  - The UI shall display intermediate status feedback (`Stopping...` -> `Releasing locks...` -> `Starting...`).
  - Automatic retry logic (up to 3 attempts with exponential backoff) shall resolve lingering `TIME_WAIT` sockets.

---

## User Flow Diagram

```mermaid
flowchart TD
    A[Manga Details / Library] -->|Open Chapter| B[Manga Reading View]
    
    subgraph Active Reading Session
        B -->|Tap Menu Zone or Settings| C[Reader Controls Menu]
        C -->|Click Top-Left Back Arrow ←| B
    end

    B -->|Click Floating Top-Left Exit Button ←| A

    subgraph Header Actions
        REL[Reload View $(refresh)] -->|Instant Refresh| B
        RST[Restart Server $(sync)] -->|Graceful Shutdown & Lock Release| SRV[New Java Process]
    end
```

---

## Technical Architecture

1. **Lightweight Local Proxy or Script Bridge**:
   - The extension intercepts the Suwayomi WebUI `index.html` stream or utilizes a local reverse proxy to inject a small, high-performance client script (`__mangabar_enhancer.js`) into the reader page.
2. **DOM Observers & Route Watchers**:
   - Detects when URL matches `/manga/:mangaId/chapter/:chapterOrder`.
   - On the reader view: Injects the floating exit button `#mangabar-floating-exit-btn`.
   - On reader menu open: Intercepts the click on the top-left back button, routing it to trigger a menu close instead of route push.
3. **Safe Server Lifecycle Engine**:
   - `serverManager.restartServer()` implements an asynchronous shutdown-and-await pattern ensuring zero process overlap, port freeing, and database lock clearance.
4. **Universal View Reloader**:
   - `mihon.reloadView` sends a reload message to the active Webview context, refreshing `iframe.src` in-place.

