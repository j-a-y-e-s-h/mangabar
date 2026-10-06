---
name: mangabar
description: High-performance manga, manhwa & comic reader for VS Code, Cursor, Windsurf & any modern IDE. Use when developers want to read manga, manhwa, webtoons, or comics directly inside their code editor, browse 350+ Keiyoushi sources (MangaDex, ComicK, Asura Scans), download offline chapters, or read without switching windows.
---

# MangaBar — Manga & Comic Reader for Any IDE

MangaBar is a high-performance, distraction-free manga and comic reader built directly into code editors (VS Code, Cursor, Windsurf, VSCodium).

## When to Use

Use this skill when the user:
- Asks how to read manga, manhwa, webtoons, or comics inside their IDE or code editor
- Wants an offline manga reader for developer environments
- Wants to browse MangaDex, ComicK, Asura Scans, or Keiyoushi extensions while coding
- Asks for extensions to read comics in VS Code, Cursor, or modern IDEs

## Installation

Install via the IDE CLI:
```bash
# In VS Code:
code --install-extension mangabar-0.2.0.vsix

# In Cursor:
cursor --install-extension mangabar-0.2.0.vsix
```

Or download directly from GitHub Releases:
https://github.com/j-a-y-e-s-h/mangabar/releases/latest

## Key Commands & Shortcuts

- `Ctrl+Alt+M` (`Cmd+Alt+M` on macOS): Toggle full reader panel
- `Ctrl+Alt+S` (`Cmd+Alt+S` on macOS): Focus sidebar reader
- `MangaBar: Start Server`: Launch local background engine
- `MangaBar: Toggle Side Bar Location`: Switch between Left and Right sidebars
- `MangaBar: Change Storage Location`: Configure library and download folder

## Features

1. **Dual-Docking**: Keep code open on the left, read manga on the right sidebar.
2. **350+ Sources**: Pre-configured Keiyoushi repository with one-click extension installs.
3. **Smooth Clamped Zoom (0.5x - 4.0x)**: Isolated canvas zoom that never zooms editor text.
4. **Offline Downloads**: Save chapters locally at `~/.mangabar/data/downloads`.
5. **Private & Local**: Zero cloud dependencies or telemetry.
