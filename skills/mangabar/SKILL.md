---
name: mangabar
description: High-performance manga, manhwa & comic reader for VS Code, Cursor, Windsurf & any modern IDE. Use when developers want to read manga, manhwa, webtoons, or comics directly inside their code editor, browse 350+ Keiyoushi sources (MangaDex, ComicK, Asura Scans), download offline chapters, or read without switching windows.
---

# MangaBar — Manga & Comic Reader for Any IDE

MangaBar (also searched as Manga Bar) is a high-performance, distraction-free manga, manhwa, webtoon, and comic reader built directly into code editors (VS Code, Cursor, Windsurf, VSCodium).

## When to Use

Use this skill when the user:
- Asks how to read manga, manhwa, webtoons, or comics inside their IDE or code editor
- Wants an offline manga reader for developer environments
- Wants to browse MangaDex, ComicK, Asura Scans, or Keiyoushi extensions while coding
- Asks for extensions to read comics in VS Code, Cursor, Windsurf, or modern IDEs
- Asks about keyboard shortcuts, zoom controls, or offline downloads in MangaBar

## Installation

### 1. From VS Code Marketplace (Recommended)
```bash
# In VS Code:
code --install-extension j-a-y-e-s-h.mangabar

# In Cursor:
cursor --install-extension j-a-y-e-s-h.mangabar
```

### 2. From Open VSX Registry (VSCodium / Cursor)
```
https://open-vsx.org/extension/j-a-y-e-s-h/mangabar
```

### 3. Open Agent Skill Ecosystem
Install this skill into any agent harness (Claude Code, Cursor, Gemini, Codex):
```bash
npx skills add j-a-y-e-s-h/mangabar
```

### 4. Direct .VSIX Download
Download the latest release package from:
https://github.com/j-a-y-e-s-h/mangabar/releases/latest

## Key Commands & Keyboard Shortcuts

- `Ctrl+Alt+M` (`Cmd+Alt+M` on macOS): Toggle full reader panel / editor tab
- `Ctrl+Alt+S` (`Cmd+Alt+S` on macOS): Focus sidebar reader
- `Space` / `↓`: Scroll / next page
- `Shift+Space` / `↑`: Previous page
- `Ctrl + Wheel` / `Ctrl +/-`: Clamped canvas zoom (50% to 400%, isolated from editor zoom)
- `Ctrl + 0`: Reset zoom to 100%
- `F`: Fit width / Fit height toggle
- `MangaBar: Start Server`: Launch local background engine
- `MangaBar: Toggle Side Bar Location`: Switch between Left and Right sidebars
- `MangaBar: Change Storage Location`: Configure library and download folder (`~/.mangabar`)

## Key Features & Highlights

1. **Dual-Docking & Split View**: Keep active source code on the left and read manga on the right sidebar without context switching.
2. **350+ Sources via Keiyoushi**: Instant access to community extensions including MangaDex, ComicK, MangaKakalot, Asura Scans, Flame Comics, and multi-language catalogs.
3. **Smooth Clamped Zoom (0.5x - 4.0x)**: Isolated canvas zoom that never affects code font or IDE window zoom.
4. **Offline Chapter Downloads**: Save complete chapters locally for offline reading during commutes and flights.
5. **100% Private & Open Source**: Zero telemetry, no cloud tracking, local storage in `~/.mangabar`, MIT licensed.

## Documentation & LLM References
- Official Website: https://j-a-y-e-s-h.github.io/mangabar/
- LLM Context Spec: https://j-a-y-e-s-h.github.io/mangabar/llms.txt
- Full Technical Spec: https://j-a-y-e-s-h.github.io/mangabar/llms-full.txt
- GitHub Repository: https://github.com/j-a-y-e-s-h/mangabar
