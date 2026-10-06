# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers, software engineers, and students who read manga, manhwa, webtoons, and comics during coding sessions, breaks, or compilation times and want zero context-switching away from their code editor (VS Code, Cursor, Windsurf, VSCodium).

## Product Purpose

MangaBar (also searched as Manga Bar) is an open-source, high-performance manga and comic reader extension built natively inside the code editor. It eliminates context switching, prevents browser tab clutter, and allows developers to browse, read, and download manga directly in split-view or full-tab layouts inside their IDE.

## Positioning

Unlike web browsers that introduce ad popups, battery drain, and distracting context switches, MangaBar runs natively inside VS Code & Cursor with:
- Dual-docking (split-screen beside code or full-tab view).
- 350+ community extension sources via Keiyoushi.
- Full chapter downloads stored locally on disk (`~/.mangabar`) for offline reading.
- Clamped zoom isolation (0.5x - 4.0x) that never affects code editor font size.
- 100% free, MIT licensed, zero ads, zero telemetry, and zero tracking.

## Operating Context

- IDEs: VS Code (v1.85.0+), Cursor, Windsurf, VSCodium, Positron.
- Operating Systems: Windows, macOS, Linux.
- Distribution: VS Code Marketplace (`j-a-y-e-s-h.mangabar`), GitHub Releases (.vsix), and Open VSX Registry.
- Web Landing Page: GitHub Pages (`https://j-a-y-e-s-h.github.io/mangabar/`).

## Capabilities and Constraints

- Capabilities: Split-view reading, extension management (Keiyoushi API), chapter caching, local offline reading, keyboard navigation, history and progress tracking.
- Constraints: Local filesystem access via extension host; webview sandbox limitations; adheres strictly to VS Code Webview guidelines.

## Brand Commitments

- Name: MangaBar (alternately referenced as Manga Bar for search and discoverability).
- Color Palette: Deep space obsidian (`#07090e`, `#0e121b`), Electric Cyan (`#00e5ff`), Neon Violet (`#a855f7`).
- Tone: High-performance, developer-first, clean, modern, privacy-focused.

## Evidence on Hand

- VS Code Marketplace Extension: `j-a-y-e-s-h.mangabar` (v0.2.0 active).
- GitHub Repository: `https://github.com/j-a-y-e-s-h/mangabar`.
- High-res media assets: `media/feature-reader.jpg`, `media/feature-extensions.jpg`, `media/feature-library.jpg`, `media/hero-banner.jpg`.

## Product Principles

1. **Zero Context Switching:** Reading should integrate directly into the developer's existing IDE workflow.
2. **Offline-First & Privacy-Respecting:** All user data, progress, and downloaded chapters remain exclusively on local disk.
3. **No Window Chrome Redundancy:** Clean, minimal interfaces that respect IDE chrome and avoid duplicate OS frames.
4. **Accessible & Keyboard-Driven:** Full keyboard navigation for uninterrupted reading while keeping hands on the keyboard.
