---
date: 2026-10-03
topic: reader-navigation-flow-and-mangabar-core
status: active
---

# MangaBar Comprehensive Requirements & Architecture

## Summary
Define the complete product requirements, navigation flows, and system architecture for **MangaBar** (`antigravity-mangabar`), a native, high-performance Manga & Comic reader embedded directly inside Antigravity IDE. MangaBar operates seamlessly in both a docked sidebar webview (supporting left and right screen docking) and a dedicated full-scale editor tab.

This document establishes the user experience standards:
1. **Two-Tier Navigation Model**:
   - In the reader menu/drawer, the top-left backward arrow (`←`) dismisses the controls overlay and returns focus directly to reading the active manga page (instead of jarringly exiting).
   - On the reading canvas, an unobtrusive floating exit button in the top-left corner allows immediate navigation back to Manga Details or Library.
2. **Distraction-Free Visual Harmony**:
   - **Zero Drawer Overlap**: The floating exit button automatically hides (`display: none`) whenever the reader drawer or app bar is open, completely preventing icon collisions.
   - **Idle Auto-Dimming**: During uninterrupted reading, the floating button automatically dims to `0.08` opacity after 3.5 seconds of inactivity, instantly reviving upon mouse movement or touch.
3. **100% Silent Background Server Engine**:
   - Background server launches fully headless (`-Djava.awt.headless=true`, `-Dserver. initialOpenInBrowserEnabled=false`, `-Dserver.systemTrayEnabled=false`), entirely eliminating external browser popups on IDE launch or server start.
4. **Synchronous Brand & Identity Scrubbing**:
   - Continuous DOM and property interception ensures `<title>` always reflects `MangaBar` without flickering or upstream branding leaks.
   - Favicons and logos are dynamically routed to the official MangaBar SVG monogram (`media/mangabar.svg`).
5. **Distinct View Reload vs. Server Restart Controls**:
   - **Reload View (`mangabar.reloadView`)**: Bound to `$(refresh)` for instant `<100ms` webview refreshes.
   - **Restart Server (`mangabar.restartServer`)**: Bound to `$(sync)` for graceful background process shutdown, port release, and lock-cleared restarts.
6. **Dual Sidebar Placement (Left / Right Screen Freedom)**:
   - Users can effortlessly dock MangaBar in either the primary Activity Bar (left) or the Secondary Side Bar (`auxiliarybar` on the right) with a single click or setting toggle.
7. **Strict Aesthetic Standards**:
   - Strictly zero emojis in user-facing UI, notifications, and toolbars (utilizing official VS Code Codicons and vector SVGs exclusively).
   - Purged legacy 0.1.0 extensions and book icons; exclusively featuring the clean `M` monogram brand.

---

## Problem Frame
In the previous prototype iterations:
- **Navigation Disruption**: Clicking the top-left arrow inside the reader controls menu navigated out of the reader entirely, interrupting reading sessions instead of closing the menu.
- **Missing In-Canvas Exit**: Reading canvas lacked an always-accessible exit point without opening the drawer.
- **Drawer Collision**: When a floating exit button was injected, it directly collided with the drawer header's native back button.
- **Unwanted Browser Popups**: Starting the background Java engine triggered Java AWT desktop integration, which automatically launched Google Chrome externally on port 4567.
- **Brand Inconsistency**: Route transitions in the SPA intermittently set document titles to upstream names, and an old `0.1.0` book icon remained in the IDE activity bar until completely reloaded.
- **Fixed Docking**: Users wishing to view code on the left could not move the reader to the right side of the screen.

---

## Key Decisions

### 1. Two-Tier Navigation Architecture
- **Reader Menu Back Arrow (`←`) Action**: Repurposed from "Exit Reader" to "Return to Manga" — dismisses the reader menu/settings drawer and resumes reading the active chapter page.
- **Floating Exit Button on Manga Screen**: A modern, translucent circular pill button positioned at `top: 16px; left: 16px;` over the manga reading canvas.
  - **Aesthetics**: Follows modern subtle UI conventions. Semi-transparent (`opacity: 0.35`) during active reading; transitions smoothly to full opacity (`1.0`) with subtle backdrop blur on hover or touch.
  - **Distraction-Free Idle Auto-Dimming**: After 3.5 seconds of reading inactivity, the button auto-dims to `0.08` opacity so it never distracts from manga art, and brightens instantly back to `0.35` / `1.0` on mouse movement or hover.
  - **Zero Drawer Overlap**: Automatically detects when the reader drawer or header controls are open via `areReaderControlsOpen()`, setting `display: none` on the floating button to eliminate any button collision.
  - **Navigation Destination**: Directly returns to the Manga Details page (`/manga/:mangaId` showing all chapters), falling back to the Library (`/`) if history is unavailable.

### 2. Silent Server Launch & Complete Brand Cleanliness
- **100% Silent Background Server Engine**:
  - The Java process is executed with `-Djava.awt.headless=true`, `-Dserver.initialOpenInBrowserEnabled=false`, and `-Dserver.systemTrayEnabled=false`.
  - Disables Java AWT desktop integration at the JVM level so an external Chrome browser window never pops up unexpectedly on startup.
- **Synchronous Title & Favicon Scrubbing**:
  - `src/readerEnhancer.ts` attaches an active property setter on `document.title` to rewrite any SPA routing title changes containing upstream brand names into `MangaBar` synchronously.
  - The local proxy intercepts all `/favicon.*` and logo requests, returning the official MangaBar SVG monogram (`media/mangabar.svg`).

### 3. Dedicated Reload View vs. Restart Server Controls
- **Reload View (`mangabar.reloadView`)**: Bound to `$(refresh)`. Reloads the active webview/iframe in `<100ms` without killing or touching the background Java server.
- **Restart Server (`mangabar.restartServer`)**: Bound to `$(sync)`. Explicitly stops the background server, waits for port release, and respawns cleanly.

### 4. Dual Sidebar Placement (Left vs. Right)
- **Primary Side Bar (Left)**: Uses `activitybar` viewsContainer `mangabar-sidebar`.
- **Secondary Side Bar (Right)**: Accessible via native Secondary Side Bar (`auxiliarybar`) / `workbench.action.moveFocusedView`.
- **1-Click Header Toggle**: Provides a toolbar action `$(split-horizontal)` (`mangabar.toggleSideBarLocation`) allowing users to instantly shift the reader to their preferred screen edge.

---

## Detailed Requirements

### R01: Brand Identity & Zero Emojis
- Extension name: `antigravity-mangabar`.
- Display name: `MangaBar - Manga & Comic Reader`.
- Activity Bar and Views Container icon: `media/mangabar.svg` (M monogram).
- All notifications, buttons, menus, and status items shall strictly use vector SVGs or Codicons (`$(sync)`, `$(refresh)`, `$(split-horizontal)`, `$(screen-full)`, `$(debug-stop)`). No emojis permitted.

### R02: Silent Background Server Engine
- The server manager shall spawn Java using `-Djava.awt.headless=true` and `-Dserver.initialOpenInBrowserEnabled=false`.
- Under no circumstances shall starting MangaBar cause an external web browser window or tab to open.

### R03: Title & Favicon Interception
- The local server proxy and client enhancer script shall intercept all page title updates.
- Any title change in the SPA containing "Suwayomi" or "Mihon" shall be synchronously scrubbed to `"MangaBar"`.
- Requests for `/favicon.ico`, `/favicon.svg`, `/logo.png`, or web app manifests shall resolve to MangaBar brand assets.

### R04: Two-Tier Reader Navigation
- When the reader settings drawer is open, clicking the top-left backward arrow (`←`) shall dismiss the drawer and return to the active manga page without navigating away.
- When reading manga on canvas, a floating exit button (`#mangabar-floating-exit-btn`) at `top: 16px; left: 16px;` shall navigate directly back to the Manga Details page (`/manga/:mangaId`).

### R05: Idle Auto-Dimming for Distraction-Free Reading
- After 3.5 seconds of no cursor or touch movement on the manga reading canvas, the floating exit button shall smoothly transition to `0.08` opacity.
- Any mouse movement, touch, or scroll shall immediately restore normal visibility (`0.35` idle, `1.0` hover).

### R06: Reader Drawer Collision & Overlap Prevention
- The client enhancer script shall track reader drawer/appbar visibility using `MutationObserver`.
- Whenever reader controls are open (`areReaderControlsOpen() === true`), `#mangabar-floating-exit-btn` shall have `display: none !important;` to ensure zero visual overlap with the drawer back button.
- As soon as the drawer is closed, the button shall smoothly restore display.

### R07: Dual Sidebar Placement (Left / Right Screen)
- The extension shall register the command `mangabar.toggleSideBarLocation`.
- Users shall be able to dock the MangaBar reader on either the left or right side of their IDE workspace to accommodate their preferred coding and reading layout.

### R08: Distinct View Reload vs. Server Restart Actions
- The sidebar header toolbar and view title menu shall provide two separate buttons:
  1. **Reload View (`mangabar.reloadView`)**: Refreshes the webview iframe in `<100ms` without restarting the backend.
  2. **Restart Server (`mangabar.restartServer`)**: Fully terminates the Java process, ensures port 4567 release, observes a 1.5s lock-clearing backoff, and restarts cleanly.

### R09: Safe Ctrl-Zoom with Clamped Scale
- Inside the manga reader canvas, pressing `Ctrl + Mouse Wheel` or `Ctrl + +/-/0` shall zoom the manga image between `50%` (`0.5x`) and `400%` (`4.0x`).
- It shall call `preventDefault()` to prevent zooming the outer IDE window.
- When zoomed in (`scale > 1.0x`), click-and-drag panning shall be enabled.
- Scale shall automatically reset to `1.0x` upon advancing to the next page or chapter.

---

## User Flow Diagram

```mermaid
flowchart TD
    A[Manga Details / Library] -->|Open Chapter| B[Manga Reading Canvas]
    
    subgraph Active Reading Session
        B -->|Tap Canvas Center| C[Reader Controls Drawer]
        C -->|Click Top-Left Back Arrow ←| B
        B -.->|Idle > 3.5s| D[Auto-Dimmed Exit Button 0.08 Opacity]
        D -.->|Mouse Move / Touch| B
    end

    B -->|Click Floating Exit Button ←| A

    subgraph Header Actions
        REL[Reload View $(refresh)] -->|Instant Refresh <100ms| B
        RST[Restart Server $(sync)] -->|Graceful Shutdown & Lock Clearance| SRV[New MangaBar Engine]
        LOC[Toggle Side $(split-horizontal)] -->|Dock Left / Right| B
    end
```

---

## Technical Architecture

1. **Lightweight Local Proxy & Script Bridge**:
   - Injects `__mangabar_enhancer.js` into the MangaBar WebUI context.
   - Intercepts icon and manifest requests to deliver MangaBar SVG assets.
2. **DOM Observers & Route Watchers**:
   - Detects route `/manga/:mangaId/chapter/:chapterOrder`.
   - Injects `#mangabar-floating-exit-btn` with auto-dimming and drawer collision avoidance.
   - Intercepts clicks on the top-left drawer back button, routing it to trigger a menu close instead of route push.
3. **Safe Server Lifecycle Engine**:
   - `serverManager.restartServer()` implements an asynchronous shutdown-and-await pattern ensuring zero process overlap, port freeing, and database lock clearance.
   - Headless JVM flags guarantee 100% silent startup without browser redirects.
4. **Universal View Reloader**:
   - `mangabar.reloadView` sends a reload message to the active Webview context, refreshing `iframe.src` in-place.
