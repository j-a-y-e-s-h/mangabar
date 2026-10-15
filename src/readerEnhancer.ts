/**
 * MangaBar Client-Side Reader Enhancer Script.
 * Injected into the MangaBar WebUI context via local reverse-proxy.
 * Provides:
 * 1. Deep brand scrubbing and clean navigation back to Manga details.
 * 2. Safe clamped Ctrl-zoom (0.5x - 4.0x) with drag-to-pan, auto-reset, and zero IDE zoom leakage.
 * 3. Floating "Back to Manga" button with idle fade.
 * 4. Comprehensive keyboard shortcuts (Arrow keys, Space, Backspace, b, +, -, 0, h).
 * 5. Full host postMessage bridge for toolbar Back, Forward, Zoom, and Scroll controls.
 */

export function getReaderEnhancerScript(): string {
  return `(function () {
  if (window.__MANGABAR_ENHANCER_LOADED__) return;
  window.__MANGABAR_ENHANCER_LOADED__ = true;

  console.log('[MangaBar] Injected reader enhancer initialized.');

  // State
  let currentZoom = 1.0;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startDragX = 0;
  let startDragY = 0;
  let hudTimeout = null;
  let lastPathname = window.location.pathname;
  let floatingExitBtn = null;
  let idleTimer = null;

  function getPathAndHash() {
    return window.location.pathname + (window.location.hash || '');
  }

  function isReaderView() {
    return new RegExp('/manga/[^/]+/chapter/[^/]+', 'i').test(getPathAndHash());
  }

  function getMangaId() {
    const match = getPathAndHash().match(new RegExp('/manga/([^/]+)/chapter/([^/]+)', 'i'));
    return match ? match[1] : null;
  }

  function navigateTo(targetPath) {
    resetZoom();
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      window.location.hash = '#' + targetPath;
      return;
    }
    if (window.history && window.history.pushState) {
      window.history.pushState(null, '', targetPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      window.location.href = targetPath;
    }
  }

  /* ──────────────────────────────────────────────────────────
   * 0. DEEP DOM BRAND SCRUBBER (Suwayomi/Tachidesk/Mihon -> MangaBar)
   * ────────────────────────────────────────────────────────── */
  function scrubBrandText(str) {
    if (!str || typeof str !== 'string') return str;
    return str
      .replace(/Suwayomi-WebUI/gi, 'MangaBar')
      .replace(/Suwayomi-Server/gi, 'MangaBar Engine')
      .replace(/Suwayomi Server/gi, 'MangaBar Server')
      .replace(/Suwayomi/gi, 'MangaBar')
      .replace(/Tachidesk/gi, 'MangaBar Core')
      .replace(/Tachiyomi/gi, 'MangaBar')
      .replace(/Mihon/gi, 'MangaBar');
  }

  // Intercept document.title property setter directly
  try {
    const titleDescriptor =
      Object.getOwnPropertyDescriptor(Document.prototype, 'title') ||
      Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'title');
    if (titleDescriptor && titleDescriptor.set) {
      Object.defineProperty(document, 'title', {
        get: function () {
          return titleDescriptor.get ? titleDescriptor.get.call(this) : '';
        },
        set: function (newTitle) {
          const scrubbed = scrubBrandText(newTitle);
          return titleDescriptor.set.call(this, scrubbed);
        },
        configurable: true,
        enumerable: true,
      });
    }
  } catch (err) {
    console.warn('[MangaBar] Title interceptor notice:', err);
  }

  function ensureMangaBarFavicon() {
    try {
      const links = document.querySelectorAll('link[rel*="icon"], link[rel*="apple-touch"]');
      links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        if (!href.includes('/__mangabar_icon.svg')) {
          link.setAttribute('href', '/__mangabar_icon.svg');
          link.setAttribute('type', 'image/svg+xml');
        }
      });
      if (!document.querySelector('link[href*="/__mangabar_icon.svg"]')) {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = '/__mangabar_icon.svg';
        document.head.appendChild(link);
      }
    } catch {}
  }

  function isExcludedFromScrubbing(el) {
    if (!el) return false;
    if (el.closest) {
      if (
        el.closest(
          '.MuiAvatar-root, [class*="Avatar"], .MuiListItemAvatar-root, [class*="Cover"], [class*="cover"], [class*="extension"], [class*="Extension"], [class*="source"], [class*="Source"], [class*="manga"], [class*="Manga"]'
        )
      ) {
        return true;
      }
    }
    return false;
  }

  function scrubImagesAndLogos() {
    try {
      const imgs = document.querySelectorAll('img');
      imgs.forEach((img) => {
        const src = img.getAttribute('src') || '';
        // 1. Strict guard: NEVER touch extension icons, source icons, manga covers, chapters, or avatars
        if (
          !src ||
          src.includes('/api/v1/') ||
          src.includes('/extension/') ||
          src.includes('/source/') ||
          src.includes('/manga/') ||
          src.includes('/cover') ||
          src.includes('/icon/') ||
          isExcludedFromScrubbing(img)
        ) {
          return;
        }

        // 2. Only scrub actual standalone app brand logos (e.g. suwayomi-logo.svg, tachidesk-logo.png)
        const alt = img.getAttribute('alt') || '';
        if (
          (/\b(suwayomi|tachidesk)\b/i.test(src) && !src.includes('extension')) ||
          (/\b(suwayomi|tachidesk)\b/i.test(alt) && !alt.includes('extension'))
        ) {
          img.src = '/__mangabar_icon.svg';
          img.setAttribute('alt', 'MangaBar');
        }
      });
    } catch {}
  }

  function scrubNode(node) {
    if (!node) return;
    if (node.nodeType === 3 /* Node.TEXT_NODE */) {
      if (
        node.nodeValue &&
        (/Suwayomi/i.test(node.nodeValue) ||
          /Tachidesk/i.test(node.nodeValue))
      ) {
        node.nodeValue = scrubBrandText(node.nodeValue);
      }
      return;
    }
    if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
      const el = node;
      // Skip extensions, sources, manga lists and cards from recursive DOM walking
      if (isExcludedFromScrubbing(el)) {
        return;
      }
      ['title', 'alt', 'aria-label', 'placeholder'].forEach((attr) => {
        const val = el.getAttribute && el.getAttribute(attr);
        if (
          val &&
          (/Suwayomi/i.test(val) || /Tachidesk/i.test(val))
        ) {
          el.setAttribute(attr, scrubBrandText(val));
        }
      });
      const children = el.childNodes;
      if (children && children.length) {
        for (let i = 0; i < children.length; i++) {
          scrubNode(children[i]);
        }
      }
    }
  }

  function scrubDOMBranding() {
    if (
      document.title &&
      (/Suwayomi/i.test(document.title) ||
        /Tachidesk/i.test(document.title) ||
        /Tachiyomi/i.test(document.title) ||
        /Mihon/i.test(document.title))
    ) {
      document.title = scrubBrandText(document.title);
    }
    ensureMangaBarFavicon();
    scrubImagesAndLogos();

    // High-performance shell selector targeting: bypasses walking the 1440+ extension item cards
    const shellContainers = document.querySelectorAll(
      'header, nav, .MuiAppBar-root, .MuiDrawer-root, [role="dialog"], .MuiDialog-root'
    );
    if (shellContainers && shellContainers.length > 0) {
      shellContainers.forEach((container) => scrubNode(container));
    } else if (document.body) {
      scrubNode(document.body);
    }
  }

  /* ──────────────────────────────────────────────────────────
   * 1. FLOATING "BACK TO MANGA" QUICK NAVIGATION BUTTON
   * ────────────────────────────────────────────────────────── */
  function ensureFloatingExitButton() {
    if (!isReaderView()) {
      if (floatingExitBtn) {
        floatingExitBtn.remove();
        floatingExitBtn = null;
      }
      return;
    }

    if (!floatingExitBtn || !document.body.contains(floatingExitBtn)) {
      floatingExitBtn = document.createElement('button');
      floatingExitBtn.id = 'mangabar-floating-exit-btn';
      floatingExitBtn.innerHTML =
        '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">' +
        '<path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L4.31 7.5h8.94a.75.75 0 0 1 0 1.5H4.31l3.47 3.47a.75.75 0 0 1 0 1.06z"/>' +
        '</svg>' +
        '<span>Back to Manga</span>';
      Object.assign(floatingExitBtn.style, {
        position: 'fixed',
        top: '12px',
        left: '12px',
        padding: '5px 12px',
        borderRadius: '20px',
        backgroundColor: 'rgba(20, 20, 25, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.22)',
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: '600',
        cursor: 'pointer',
        zIndex: '99998',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
        transition: 'opacity 0.25s ease, transform 0.2s ease, background-color 0.2s ease',
        userSelect: 'none',
        opacity: '0.85',
      });

      floatingExitBtn.addEventListener('mouseenter', () => {
        floatingExitBtn.style.opacity = '1';
        floatingExitBtn.style.transform = 'scale(1.04)';
        floatingExitBtn.style.backgroundColor = 'rgba(0, 122, 204, 0.9)';
      });
      floatingExitBtn.addEventListener('mouseleave', () => {
        floatingExitBtn.style.transform = 'scale(1)';
        floatingExitBtn.style.backgroundColor = 'rgba(20, 20, 25, 0.82)';
        resetIdleTimer();
      });

      floatingExitBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mangaId = getMangaId();
        if (mangaId) {
          navigateTo('/manga/' + mangaId);
        } else {
          window.history.back();
        }
      };

      document.body.appendChild(floatingExitBtn);
      resetIdleTimer();
    }
  }

  function resetIdleTimer() {
    if (!floatingExitBtn) return;
    floatingExitBtn.style.opacity = '0.85';
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (floatingExitBtn && !floatingExitBtn.matches(':hover')) {
        floatingExitBtn.style.opacity = '0.15';
      }
    }, 3000);
  }

  window.addEventListener('mousemove', resetIdleTimer, { passive: true });
  window.addEventListener('touchstart', resetIdleTimer, { passive: true });

  function closeReaderMenu() {
    try {
      if (typeof window.__MANGABAR_CLOSE_MENU__ === 'function') {
        window.__MANGABAR_CLOSE_MENU__();
      }
    } catch (_) {}
    try {
      if (window.__MANGABAR_READER_SERVICE__ && typeof window.__MANGABAR_READER_SERVICE__.updateSetting === 'function') {
        window.__MANGABAR_READER_SERVICE__.updateSetting('isStaticNav', false);
      }
    } catch (_) {}
    try {
      if (window.__MANGABAR_READER_STORE__ && typeof window.__MANGABAR_READER_STORE__.getState === 'function') {
        const store = window.__MANGABAR_READER_STORE__.getState();
        if (store && store.overlay && typeof store.overlay.setIsVisible === 'function') {
          store.overlay.setIsVisible(false);
        }
      }
    } catch (_) {}
    try {
      const drawer = document.querySelector('[class*="MuiDrawer-root"], [role="presentation"]');
      if (drawer) {
        const pinButtons = drawer.querySelectorAll('button');
        pinButtons.forEach((btn) => {
          const title = (btn.getAttribute('title') || btn.getAttribute('aria-label') || '').toLowerCase();
          if (title.includes('static') || title.includes('pin') || title.includes('navigation')) {
            const isPinned = btn.getAttribute('color') === 'primary' ||
              btn.classList.contains('MuiIconButton-colorPrimary') ||
              btn.querySelector('.muiltr-primary') !== null;
            if (isPinned) {
              btn.click();
            }
          }
        });
      }
    } catch (_) {}
  }

  // Intercept click on top-left 'X' / 'Close Menu' button in reader controls
  document.addEventListener(
    'click',
    (e) => {
      if (!isReaderView() || !e.target) return;
      const btn = e.target.closest('button, [role="button"]');
      if (!btn) return;

      const hasCloseSvg = btn.querySelector('svg path[d*="M19 6.41"]');
      const label = (
        (btn.getAttribute('title') || '') +
        ' ' +
        (btn.getAttribute('aria-label') || '')
      ).toLowerCase();

      if (hasCloseSvg || label.includes('close menu')) {
        closeReaderMenu();
      }
    },
    false
  );

  /* ──────────────────────────────────────────────────────────
   * 1B. GLOBAL MANGA SEARCH & EMPTY LIBRARY DISCOVERY
   * ────────────────────────────────────────────────────────── */
  const GLOBAL_SEARCH_PATH =
    'M19.3 16.9c.4-.7.7-1.5.7-2.4 0-2.5-2-4.5-4.5-4.5S11 12 11 14.5s2 4.5 4.5 4.5c.9 0 1.7-.3 2.4-.7l3.2 3.2 1.4-1.4zm-3.8.1c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5M12 20v2C6.48 22 2 17.52 2 12S6.48 2 12 2c4.84 0 8.87 3.44 9.8 8h-2.07c-.64-2.46-2.4-4.47-4.73-5.41V5c0 1.1-.9 2-2 2h-2v2c0 .55-.45 1-1 1H8v2h2v3H9l-4.79-4.79C4.08 10.79 4 11.38 4 12c0 4.41 3.59 8 8 8';

  const GLOBAL_SEARCH_SVG =
    '<svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium" focusable="false" aria-hidden="true" viewBox="0 0 24 24"><path d="' +
    GLOBAL_SEARCH_PATH +
    '"></path></svg>';

  function ensureSearchEnhancerStyles() {
    if (document.getElementById('mangabar-search-enhancer-styles')) return;
    const style = document.createElement('style');
    style.id = 'mangabar-search-enhancer-styles';
    style.textContent = \`
      .mangabar-library-search-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 50% !important;
        padding: 8px !important;
        color: inherit !important;
        background: transparent !important;
        border: none !important;
        cursor: pointer !important;
        transition: background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms ease, color 150ms ease !important;
        user-select: none !important;
        -webkit-tap-highlight-color: transparent !important;
        flex-shrink: 0 !important;
        margin-left: auto !important;
      }
      .mangabar-library-search-btn:hover {
        background-color: rgba(255, 255, 255, 0.08) !important;
        transform: scale(1.08) !important;
        color: #38bdf8 !important;
      }
      .mangabar-library-search-btn:active {
        transform: scale(0.92) !important;
      }
      .mangabar-library-search-btn svg {
        fill: currentColor !important;
        width: 24px !important;
        height: 24px !important;
      }

      .mangabar-empty-card {
        margin-top: 22px !important;
        padding: 18px 22px !important;
        background: linear-gradient(145deg, rgba(30, 30, 38, 0.85), rgba(18, 18, 24, 0.94)) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        border-radius: 16px !important;
        max-width: 360px !important;
        margin-left: auto !important;
        margin-right: auto !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 12px !important;
        pointer-events: auto !important;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45), 0 0 1px rgba(255, 255, 255, 0.15) inset !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        animation: mangabarFadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      @keyframes mangabarFadeUp {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .mangabar-empty-subtitle {
        font-size: 12px !important;
        color: rgba(255, 255, 255, 0.75) !important;
        line-height: 1.45 !important;
        text-align: center !important;
        max-width: 300px !important;
        margin: 0 !important;
        pointer-events: auto !important;
      }
      .mangabar-empty-actions {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
        width: 100% !important;
        flex-wrap: wrap !important;
        pointer-events: auto !important;
      }
      .mangabar-empty-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        padding: 8px 16px !important;
        border-radius: 8px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        border: none !important;
        outline: none !important;
        letter-spacing: 0.2px !important;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        user-select: none !important;
        text-decoration: none !important;
        pointer-events: auto !important;
      }
      .mangabar-empty-btn svg {
        width: 17px !important;
        height: 17px !important;
        fill: currentColor !important;
      }
      .mangabar-empty-btn-primary {
        background: linear-gradient(135deg, #007acc, #0284c7) !important;
        color: #ffffff !important;
        box-shadow: 0 2px 10px rgba(0, 122, 204, 0.45) !important;
      }
      .mangabar-empty-btn-primary:hover {
        background: linear-gradient(135deg, #0088e0, #0396e6) !important;
        box-shadow: 0 4px 18px rgba(56, 189, 248, 0.55) !important;
        transform: translateY(-2px) scale(1.02) !important;
      }
      .mangabar-empty-btn-primary:active {
        transform: translateY(0) scale(0.97) !important;
      }
      .mangabar-empty-btn-secondary {
        background: rgba(255, 255, 255, 0.06) !important;
        color: rgba(255, 255, 255, 0.88) !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
      }
      .mangabar-empty-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.12) !important;
        border-color: rgba(56, 189, 248, 0.6) !important;
        color: #38bdf8 !important;
        transform: translateY(-2px) scale(1.02) !important;
      }
      .mangabar-empty-btn-secondary:active {
        transform: translateY(0) scale(0.97) !important;
      }
    \`;
    document.head.appendChild(style);
  }

  function ensureLibrarySearchButton() {
    ensureSearchEnhancerStyles();

    const p = getPathAndHash();
    const isLibraryRoute = (p === '/' || p === '/#' || p === '#/' || p === '' || p.startsWith('/?') || p.startsWith('/#?'));
    const appBar = document.querySelector('header.MuiAppBar-root, [class*="MuiAppBar-root"]');
    if (!appBar) return;

    const titleEl = appBar.querySelector('h1, h2, [class*="Typography-h5"], [class*="Typography-h6"]');
    const titleText = (titleEl && titleEl.textContent ? titleEl.textContent.trim().toLowerCase() : '');
    const isLibraryTitle = titleText === 'library';

    // If on Browse, Browse already has its own native button, so remove our injected one
    if (titleText === 'browse' || p.includes('/sources')) {
      const existing = appBar.querySelector('.mangabar-library-search-btn');
      if (existing) existing.remove();
      return;
    }

    if (!isLibraryRoute && !isLibraryTitle) {
      const existing = appBar.querySelector('.mangabar-library-search-btn');
      if (existing) existing.remove();
      return;
    }

    if (appBar.querySelector('.mangabar-library-search-btn')) return;

    const toolbar = appBar.querySelector('.MuiToolbar-root, [class*="MuiToolbar-root"]') || appBar;

    const btn = document.createElement('button');
    btn.className = 'MuiButtonBase-root MuiIconButton-root MuiIconButton-colorInherit MuiIconButton-sizeMedium mangabar-library-search-btn';
    btn.setAttribute('type', 'button');
    btn.setAttribute('title', 'Global Search (Search all sources)');
    btn.setAttribute('aria-label', 'Global Search');
    btn.innerHTML = GLOBAL_SEARCH_SVG;

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigateTo('/sources/all/search');
    };

    if (titleEl && titleEl.parentElement && titleEl.parentElement !== toolbar) {
      titleEl.parentElement.appendChild(btn);
    } else {
      toolbar.appendChild(btn);
    }
  }

  function ensureEmptyLibraryActionCard() {
    ensureSearchEnhancerStyles();

    const headings = Array.from(document.querySelectorAll('h5, h6, p, div, [class*="Typography-h5"], [class*="Typography-h6"]'));
    const emptyMsgEl = headings.find((el) => {
      if (el.classList.contains('mangabar-empty-subtitle')) return false;
      const text = (el.textContent || '').trim().toLowerCase();
      return text.includes('your library is empty') || text.includes('library is empty');
    });

    if (!emptyMsgEl) {
      const existing = document.querySelector('.mangabar-empty-card');
      if (existing) existing.remove();
      return;
    }

    const container = emptyMsgEl.parentElement;
    if (!container) return;

    if (container.querySelector('.mangabar-empty-card')) return;

    const card = document.createElement('div');
    card.className = 'mangabar-empty-card';
    card.innerHTML =
      '<p class="mangabar-empty-subtitle">Discover and read manga across all your installed sources & extensions</p>' +
      '<div class="mangabar-empty-actions">' +
        '<button class="mangabar-empty-btn mangabar-empty-btn-primary" id="btnEmptySearch">' +
          GLOBAL_SEARCH_SVG +
          '<span>Search Manga</span>' +
        '</button>' +
        '<button class="mangabar-empty-btn mangabar-empty-btn-secondary" id="btnEmptySources">' +
          '<svg class="MuiSvgIcon-root" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>' +
          '<span>Browse Sources</span>' +
        '</button>' +
      '</div>';

    const searchBtn = card.querySelector('#btnEmptySearch');
    if (searchBtn) {
      searchBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigateTo('/sources/all/search');
      };
    }

    const sourcesBtn = card.querySelector('#btnEmptySources');
    if (sourcesBtn) {
      sourcesBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigateTo('/sources');
      };
    }

    if (emptyMsgEl.nextSibling) {
      container.insertBefore(card, emptyMsgEl.nextSibling);
    } else {
      container.appendChild(card);
    }
  }

  /* ──────────────────────────────────────────────────────────
   * 2. SAFE CLAMPED CTRL-ZOOM (50% - 400%) & PAN
   * ────────────────────────────────────────────────────────── */
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4.0;
  const ZOOM_STEP = 0.15;

  function getReaderTarget() {
    const canvas = document.querySelector('canvas, img[src*="/api/v1/manga/"], img[src*="/chapter/"]');
    if (canvas) {
      const viewer = canvas.closest('[class*="viewer"], [class*="Viewer"], [class*="reader"], [class*="Reader"], [tabindex="0"]') ||
                     canvas.parentElement?.parentElement ||
                     canvas.parentElement;
      if (viewer && viewer !== document.body && viewer !== document.documentElement) {
        return viewer;
      }
      return canvas;
    }
    const main = document.querySelector('main, [role="main"], [class*="reader"]');
    if (main && main !== document.body) return main;
    return document.body;
  }

  function applyZoom(newScale) {
    currentZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(newScale * 100) / 100));

    if (currentZoom === 1.0) {
      panX = 0;
      panY = 0;
    }

    const target = getReaderTarget();
    if (target && target !== document.body) {
      if (currentZoom === 1.0 && panX === 0 && panY === 0) {
        target.style.transform = '';
        target.style.transformOrigin = '';
        target.style.cursor = '';
      } else {
        target.style.transformOrigin = 'center 15%';
        target.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + currentZoom + ')';
        target.style.transition = isDragging ? 'none' : 'transform 0.12s ease-out';
        target.style.cursor = currentZoom > 1.0 ? (isDragging ? 'grabbing' : 'grab') : '';
      }
    }

    showZoomHud();
    broadcastState();
  }

  function resetZoom() {
    currentZoom = 1.0;
    panX = 0;
    panY = 0;
    isDragging = false;
    const target = getReaderTarget();
    if (target && target !== document.body) {
      target.style.transform = '';
      target.style.cursor = '';
    }
    hideZoomHud();
    broadcastState();
  }

  // Ctrl + Wheel Zoom
  window.addEventListener('wheel', (e) => {
    if (!isReaderView()) return;

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopImmediatePropagation();

      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      applyZoom(currentZoom + delta);
    }
  }, { passive: false, capture: true });

  // Drag-to-pan when zoomed in (> 1.0x)
  window.addEventListener('mousedown', (e) => {
    if (!isReaderView() || currentZoom <= 1.0) return;
    if (e.button !== 0) return;

    if (e.target.closest('button, [role="button"], input, a, header, [class*="MuiAppBar"]')) return;

    isDragging = true;
    startDragX = e.clientX - panX;
    startDragY = e.clientY - panY;

    const target = getReaderTarget();
    if (target) target.style.cursor = 'grabbing';
  }, true);

  window.addEventListener('mousemove', (e) => {
    if (!isDragging || currentZoom <= 1.0) return;
    e.preventDefault();

    panX = e.clientX - startDragX;
    panY = e.clientY - startDragY;

    const maxPan = window.innerWidth * (currentZoom - 1.0);
    panX = Math.max(-maxPan, Math.min(maxPan, panX));
    panY = Math.max(-window.innerHeight * currentZoom, Math.min(window.innerHeight * currentZoom, panY));

    const target = getReaderTarget();
    if (target && target !== document.body) {
      target.style.transition = 'none';
      target.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + currentZoom + ')';
    }
  }, true);

  function stopDragging() {
    if (isDragging) {
      isDragging = false;
      const target = getReaderTarget();
      if (target && target !== document.body) {
        target.style.cursor = currentZoom > 1.0 ? 'grab' : '';
      }
    }
  }

  window.addEventListener('mouseup', stopDragging, true);
  window.addEventListener('mouseleave', stopDragging, true);

  /* ──────────────────────────────────────────────────────────
   * 3. TRANSIENT ZOOM HUD
   * ────────────────────────────────────────────────────────── */
  let hudEl = null;

  function showZoomHud() {
    if (!hudEl) {
      hudEl = document.createElement('div');
      hudEl.id = 'mangabar-zoom-hud';
      Object.assign(hudEl.style, {
        position: 'fixed',
        top: '14px',
        right: '14px',
        padding: '5px 12px',
        borderRadius: '20px',
        backgroundColor: 'rgba(20, 20, 24, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: '600',
        zIndex: '99999',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        userSelect: 'none',
      });
      document.body.appendChild(hudEl);
    }

    const pct = Math.round(currentZoom * 100);
    hudEl.innerHTML =
      '<span>' + pct + '%</span>' +
      (currentZoom !== 1.0 ? '<span id="mangabar-hud-reset" style="cursor:pointer; opacity:0.8; text-decoration:underline; font-size:10px;">Reset</span>' : '');

    const resetBtn = document.getElementById('mangabar-hud-reset');
    if (resetBtn) {
      resetBtn.onclick = (e) => {
        e.stopPropagation();
        resetZoom();
      };
    }

    hudEl.style.opacity = '1';
    hudEl.style.transform = 'translateY(0)';

    clearTimeout(hudTimeout);
    hudTimeout = setTimeout(() => {
      if (hudEl) {
        hudEl.style.opacity = '0';
        hudEl.style.transform = 'translateY(-6px)';
      }
    }, 1600);
  }

  function hideZoomHud() {
    if (hudEl) {
      hudEl.style.opacity = '0';
      clearTimeout(hudTimeout);
    }
  }

  function doScroll(amount) {
    const scroller = document.querySelector('[class*="scroll"], main, [class*="reader"], [role="main"]') || window;
    try {
      if (scroller && typeof scroller.scrollBy === 'function') {
        scroller.scrollBy({ top: amount, behavior: 'smooth' });
      } else {
        window.scrollBy({ top: amount, behavior: 'smooth' });
      }
    } catch (_) {
      window.scrollBy(0, amount);
    }
  }

  function doNextPage() {
    try {
      const store = window.__MANGABAR_READER_STORE__ && window.__MANGABAR_READER_STORE__.getState && window.__MANGABAR_READER_STORE__.getState();
      if (store && store.pages) {
        const curr = store.pages.currentPageIndex;
        const total = store.pages.totalPages;
        if (typeof curr === 'number' && typeof total === 'number' && curr < total - 1) {
          if (typeof store.pages.setCurrentPageIndex === 'function') store.pages.setCurrentPageIndex(curr + 1);
          if (typeof store.pages.setPageToScrollToIndex === 'function') store.pages.setPageToScrollToIndex(curr + 1);
          return;
        }
      }
    } catch (_) {}
    doScroll(window.innerHeight * 0.82);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }));
  }

  function doPrevPage() {
    try {
      const store = window.__MANGABAR_READER_STORE__ && window.__MANGABAR_READER_STORE__.getState && window.__MANGABAR_READER_STORE__.getState();
      if (store && store.pages) {
        const curr = store.pages.currentPageIndex;
        if (typeof curr === 'number' && curr > 0) {
          if (typeof store.pages.setCurrentPageIndex === 'function') store.pages.setCurrentPageIndex(curr - 1);
          if (typeof store.pages.setPageToScrollToIndex === 'function') store.pages.setPageToScrollToIndex(curr - 1);
          return;
        }
      }
    } catch (_) {}
    doScroll(-window.innerHeight * 0.82);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true }));
  }

  /* ──────────────────────────────────────────────────────────
   * 4. KEYBOARD SHORTCUTS IN READER
   * ────────────────────────────────────────────────────────── */
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        e.stopImmediatePropagation();
        applyZoom(currentZoom + 0.25);
        return;
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        e.stopImmediatePropagation();
        applyZoom(currentZoom - 0.25);
        return;
      } else if (e.key === '0') {
        e.preventDefault();
        e.stopImmediatePropagation();
        resetZoom();
        return;
      }
    }

    if (e.key === '+' || e.key === '=') {
      applyZoom(currentZoom + 0.25);
    } else if (e.key === '-' || e.key === '_') {
      applyZoom(currentZoom - 0.25);
    } else if (e.key === '0') {
      resetZoom();
    } else if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft') || e.key === 'b' || e.key === 'B') {
      if (isReaderView()) {
        e.preventDefault();
        const mangaId = getMangaId();
        if (mangaId) {
          navigateTo('/manga/' + mangaId);
        } else {
          window.history.back();
        }
      }
    } else if (e.key === 'h' || e.key === 'H') {
      navigateTo('/');
    } else if (e.key === '/' || e.key === 's' || e.key === 'S') {
      if (!isReaderView()) {
        navigateTo('/sources/all/search');
      }
    } else if (e.key === 'Escape') {
      if (isReaderView()) {
        closeReaderMenu();
        if (currentZoom !== 1.0) resetZoom();
      }
    } else if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      doScroll(380);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      doScroll(-380);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      if (isReaderView()) doNextPage();
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      if (isReaderView()) doPrevPage();
    }
  }, true);

  /* ──────────────────────────────────────────────────────────
   * 5. POSTMESSAGE BRIDGE WITH HOST TOOLBAR
   * ────────────────────────────────────────────────────────── */
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'mangabar_cmd') return;
    switch (e.data.action) {
      case 'reload':
        try {
          window.location.reload();
        } catch (_) {}
        break;
      case 'back':
        const mangaId = getMangaId();
        if (isReaderView() && mangaId) {
          navigateTo('/manga/' + mangaId);
        } else {
          window.history.back();
        }
        break;
      case 'forward':
        window.history.forward();
        break;
      case 'home':
        navigateTo('/');
        break;
      case 'search':
        navigateTo('/sources/all/search');
        break;
      case 'zoomIn':
        applyZoom(currentZoom + 0.25);
        break;
      case 'zoomOut':
        applyZoom(currentZoom - 0.25);
        break;
      case 'zoomReset':
        resetZoom();
        break;
      case 'scrollUp':
        doScroll(-380);
        break;
      case 'scrollDown':
        doScroll(380);
        break;
      case 'prevPage':
        doPrevPage();
        break;
      case 'nextPage':
        doNextPage();
        break;
    }
  });

  function isMounted() {
    const root = document.getElementById('root');
    return !!(root && root.children && root.children.length > 0);
  }

  function broadcastState() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'mangabar_state',
          zoom: currentZoom,
          isReader: isReaderView(),
          pathname: window.location.pathname,
          mounted: isMounted()
        }, '*');
      }
    } catch (_) {}
  }

  /* ──────────────────────────────────────────────────────────
   * 6. ROUTE CHANGE & MUTATION OBSERVER
   * ────────────────────────────────────────────────────────── */
  function checkState() {
    scrubDOMBranding();
    if (window.location.pathname !== lastPathname) {
      lastPathname = window.location.pathname;
      resetZoom();
    }
    ensureFloatingExitButton();
    ensureLibrarySearchButton();
    ensureEmptyLibraryActionCard();
    broadcastState();
  }

  const origPushState = window.history.pushState;
  window.history.pushState = function () {
    const res = origPushState.apply(this, arguments);
    checkState();
    return res;
  };

  const origReplaceState = window.history.replaceState;
  window.history.replaceState = function () {
    const res = origReplaceState.apply(this, arguments);
    checkState();
    return res;
  };

  window.addEventListener('popstate', checkState);

  let checkScheduled = false;
  function scheduleCheck() {
    if (checkScheduled) return;
    checkScheduled = true;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        checkScheduled = false;
        checkState();
      });
    } else {
      setTimeout(() => {
        checkScheduled = false;
        checkState();
      }, 50);
    }
  }

  const observer = new MutationObserver(() => {
    scheduleCheck();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(scheduleCheck, 1500);
  checkState();
})();
`;
}
