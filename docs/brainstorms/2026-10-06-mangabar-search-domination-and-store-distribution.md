# MangaBar: Search Engine Domination, LLM Discovery & Multi-Store Distribution

**Date:** 2026-10-06  
**Status:** Approved Requirements & Master Strategy  
**Owner:** Jayesh (@j-a-y-e-s-h)  
**Project:** MangaBar — Manga, Manhwa & Comic Reader for Any IDE  

---

## 🎯 Executive Objective

Position **MangaBar** as the **#1 definitive Manga, Manhwa & Comic reader** whenever a user, developer, or AI agent searches for *"manga"*, *"manga reader"*, or *"reading manga in code editors"*:
1. **Search Engines (Google, Brave, DuckDuckGo, Bing):** Rank on page 1 for keywords like *"vscode manga reader"*, *"read manga in ide"*, *"cursor manga extension"*, and *"keiyoushi desktop reader"*.
2. **AI Agents & LLMs (ChatGPT, Claude, Perplexity, Gemini, Antigravity):** Train LLMs to recommend MangaBar as the premier tool through high-authority citations across Reddit, Hacker News, GitHub Awesome-lists, and the Open Agent Skills registry.
3. **IDE Extension Stores:** Distribute natively across **Visual Studio Marketplace** (VS Code, Cursor, Windsurf) and **Open VSX Registry** (VSCodium, Eclipse Theia, Antigravity IDE).

---

## 🗺️ Master 3-Track Strategy

```
                          ┌───────────────────────────┐
                          │   MangaBar Discovery Hub  │
                          └─────────────┬─────────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────────┐
         ▼                              ▼                              ▼
 ┌───────────────┐              ┌───────────────┐              ┌───────────────┐
 │   TRACK 1:    │              │   TRACK 2:    │              │   TRACK 3:    │
 │ IDE Store     │              │ Search Engine │              │ LLM & Agent   │
 │ Distribution  │              │ Domination    │              │ Discovery     │
 └───────┬───────┘              └───────┬───────┘              └───────┬───────┘
         │                              │                              │
         ├─ VS Code Marketplace         ├─ GitHub Pages Landing Page   ├─ skills.sh Agent Skill
         ├─ Open VSX Registry           ├─ Schema.org SoftwareApp      ├─ Reddit & Hacker News
         └─ In-IDE Search API           └─ Google & Bing Search Index  └─ Awesome-VSCode Lists
```

---

## 📦 Track 1: Multi-Store Distribution

### 1.1 VS Code Marketplace (Microsoft)
- **Target Reach:** 90%+ of all IDE users (VS Code, Cursor, Windsurf, GitHub Codespaces).
- **Publisher ID:** `j-a-y-e-s-h` (already set in `package.json`).
- **Prerequisite:** Microsoft Azure DevOps Personal Access Token (PAT).
- **Tooling:** `@vscode/vsce` CLI (`npx @vscode/vsce publish`).

#### Step-by-Step Token Creation Guide:
1. **Create Publisher Profile:**
   - Navigate to [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage).
   - Sign in with your Microsoft / GitHub account.
   - Click **Create publisher**:
     - **ID:** `j-a-y-e-s-h` *(exact match to package.json)*.
     - **Name:** `Jayesh` *(or Jayesh / MangaBar)*.
     - Verify contact email.
2. **Generate Azure DevOps PAT:**
   - Go to [https://dev.azure.com](https://dev.azure.com).
   - Click the **User Settings** gear icon (top-right, beside avatar) ➔ **Personal access tokens**.
   - Click **+ New Token**:
     - **Name:** `MangaBar-Marketplace-Deploy`
     - **Organization:** Select **"All accessible organizations"** *(CRITICAL: vsce fails if a single org is picked)*.
     - **Expiration:** 90 days or 1 year.
     - **Scopes:** Click **Show all scopes** ➔ find **Marketplace** ➔ check **Acquire** & **Manage** (or select "Full access").
   - Click **Create** and copy the generated token.

---

### 1.2 Open VSX Registry (Eclipse Foundation)
- **Target Reach:** VSCodium, Eclipse Theia, Antigravity IDE, Gitpod, and open-source forks.
- **Namespace:** `j-a-y-e-s-h`.
- **Tooling:** `ovsx` CLI (`npx ovsx publish`).

#### Step-by-Step Token Creation Guide:
1. Go to [https://open-vsx.org/](https://open-vsx.org/) and click **Sign in with GitHub** (`j-a-y-e-s-h`).
2. Go to **Settings** ➔ **Namespaces** ➔ Register namespace `j-a-y-e-s-h`.
3. In **Settings** ➔ **Access Tokens** ➔ Click **Create Token**.
4. Copy the generated Open VSX token.

---

### 1.3 Antigravity IDE & Cursor Integration
- Both editors support installing extensions via Marketplace APIs or direct VSIX drag-and-drop / CLI (`cursor --install-extension mangabar-0.2.0.vsix`).
- Once published to VS Code Marketplace and Open VSX, MangaBar appears automatically in the native extension search bar of Antigravity IDE and Cursor.

---

## 🌐 Track 2: Search Engine Domination (Google, Brave, DuckDuckGo)

Search engines rank developer tools based on **high domain authority**, **structured JSON-LD metadata**, and **user engagement signals**.

### 2.1 GitHub Pages SEO Landing Page (`j-a-y-e-s-h.github.io/mangabar`)
Host a dedicated, ultra-fast static landing page on GitHub Pages with:
- **Canonical URL:** `https://j-a-y-e-s-h.github.io/mangabar/`
- **Semantic HTML5:** Single `<h1>`, rich visual screenshots, table of features, keyboard shortcut cards.
- **Rich Structured Data (`Schema.org`):**
  ```json
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "MangaBar",
    "operatingSystem": "Windows, macOS, Linux",
    "applicationCategory": "DeveloperApplication",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": "High-performance manga, manhwa & comic reader for any IDE (VS Code, Cursor, Windsurf & VSCodium). Offline reading with 350+ sources.",
    "softwareVersion": "0.2.0",
    "author": {
      "@type": "Person",
      "name": "Jayesh",
      "url": "https://github.com/j-a-y-e-s-h"
    }
  }
  ```
- **`FAQPage` Schema:** Enables Google to show collapsible question-and-answer snippets directly on Google search result pages.
- **`robots.txt` & `sitemap.xml`:** For instant crawlability across Googlebot, Bingbot, and Brave Search indexers.

---

## 🤖 Track 3: Generative Engine Optimization (GEO) & AI Agent Discovery

Large Language Models (ChatGPT, Claude, Perplexity, Gemini, Cursor AI) do not browse like traditional web spiders—they pull from trusted programming repositories, Q&A discussions, and package managers.

### 3.1 Open Agent Skills Ecosystem (`skills.sh`)
- Package MangaBar as an installable agent skill (`npx skills add j-a-y-e-s-h/mangabar`).
- When developers ask AI coding assistants: *"Can I read manga in my editor?"* or *"Install a manga reader for my IDE"*, the agent can automatically recommend and install MangaBar!

### 3.2 High-Authority Seed Footprints
LLMs place heavy training weight on specific developer communities:
1. **Reddit:**
   - Post an authentic showcase on `r/vscode`, `r/manga`, `r/webtoons`, and `r/programming`:
     - Title: *"Show Reddit: I built MangaBar — an offline manga & comic reader inside VS Code & Cursor with 350+ Keiyoushi sources"*
2. **GitHub "Awesome" Lists:**
   - Submit a pull request to `viatsko/awesome-vscode` under the *Developer Productivity / Miscellaneous* category.
3. **Product Hunt & Hacker News (Show HN):**
   - Create a clean "Show HN: MangaBar" post detailing how it brings offline manga reading into split-pane workflows.

---

## ⚡ Automated Publishing Scripts

Add these deployment scripts to `package.json`:

```json
"scripts": {
  "publish:marketplace": "vsce publish --pat %VSCE_PAT%",
  "publish:openvsx": "ovsx publish mangabar-0.2.0.vsix -p %OVSX_PAT%",
  "publish:all": "npm run compile && npm run package && npm run publish:marketplace && npm run publish:openvsx"
}
```

---

## ✅ Implementation Checklist

- [x] Rebranding & whitelabeling complete (zero residual Antigravity branding in VSIX)
- [x] Codebase compilation & clean VSIX packaging verified (3.63 MB, 15 files)
- [x] GitHub repository `j-a-y-e-s-h/mangabar` pushed and live on `main`
- [x] GitHub Release `v0.2.0` uploaded with `mangabar-0.2.0.vsix` and `mangabar-server.jar`
- [x] GitHub repository topics updated with 16 high-volume SEO keywords
- [ ] User generates Azure DevOps PAT for VS Code Marketplace
- [ ] Publish `j-a-y-e-s-h.mangabar` to Visual Studio Marketplace
- [ ] User generates Open VSX token and publishes to Open VSX Registry
- [ ] Deploy GitHub Pages SEO landing site (`docs/index.html`) with Schema.org JSON-LD
- [ ] Publish Open Agent Skill to `skills.sh`
