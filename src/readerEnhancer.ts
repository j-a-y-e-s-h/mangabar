/**
 * MangaBar Client-Side Reader Enhancer Script.
 * Injected into the MangaBar WebUI context via local reverse-proxy.
 * Provides:
 * 1. Deep brand scrubbing and clean navigation back to Manga details.
 * 2. Safe clamped Ctrl-zoom (0.5x - 4.0x) with drag-to-pan, auto-reset, and zero IDE zoom leakage.
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

  // Reader route matcher: /manga/:id/chapter/:order
  const READER_ROUTE_REGEX = /\\/manga\\/([^\\/]+)\\/chapter\\/([^\\/]+)/;

  function isReaderView() {
    return READER_ROUTE_REGEX.test(window.location.pathname);
  }

  function getMangaId() {
    const match = window.location.pathname.match(READER_ROUTE_REGEX);
    return match ? match[1] : null;
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

  // Intercept document.title property setter directly to ensure SPA routers cannot set Suwayomi title
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

  function scrubImagesAndLogos() {
    try {
      const imgs = document.querySelectorAll('img, svg');
      imgs.forEach((img) => {
        const src = img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || '';
        if (
          /favicon|logo|suwayomi|mihon|tachiyomi/i.test(src) ||
          /favicon|logo|suwayomi|mihon|tachiyomi/i.test(alt)
        ) {
          if (img.tagName.toLowerCase() === 'img') {
            img.src = '/__mangabar_icon.svg';
          }
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
          /Tachidesk/i.test(node.nodeValue) ||
          /Tachiyomi/i.test(node.nodeValue) ||
          /Mihon/i.test(node.nodeValue))
      ) {
        node.nodeValue = scrubBrandText(node.nodeValue);
      }
      return;
    }
    if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
      const el = node;
      ['title', 'alt', 'aria-label', 'placeholder'].forEach((attr) => {
        const val = el.getAttribute && el.getAttribute(attr);
        if (
          val &&
          (/Suwayomi/i.test(val) || /Tachidesk/i.test(val) || /Tachiyomi/i.test(val) || /Mihon/i.test(val))
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
    if (document.body) {
      scrubNode(document.body);
    }
  }

  /* ──────────────────────────────────────────────────────────
   * 1. READER MENU CLOSE & CLEANUP
   * Ensure any lingering floating exit button is removed.
   * Provide closeReaderMenu() so clicking the 'X' button or hotkey
   * closes the menu drawer and returns to reading the current chapter.
   * ────────────────────────────────────────────────────────── */
  function cleanupLingeringFloatingButtons() {
    const lingering = document.getElementById('mangabar-floating-exit-btn');
    if (lingering) {
      lingering.remove();
    }
  }
  cleanupLingeringFloatingButtons();

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
      // Find the Pin / Static navigation button in the reader drawer if it's currently pinned, and click it to unpin
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

  // Close reader menu on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isReaderView()) {
      closeReaderMenu();
    }
  });

  /* ──────────────────────────────────────────────────────────
   * 2. SAFE CLAMPED CTRL-ZOOM (50% - 400%) & PAN
   * ────────────────────────────────────────────────────────── */
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4.0;
  const ZOOM_STEP = 0.15;

  function findReaderContainer() {
    // Reader image container
    return (
      document.querySelector('[class*="reader"], [class*="Reader"], [class*="pager"], main, #root > div') ||
      document.body
    );
  }

  function getReaderTarget() {
    // Target the canvas or reader container that holds manga page images
    const img = document.querySelector('img[src*="/api/v1/manga/"], img[src*="/chapter/"], [class*="reader"] img, canvas');
    if (img) {
      // Find the page/scroll container
      const container = img.closest('[class*="page"], [class*="Page"], [class*="readerContainer"], [class*="viewer"]') || img.parentElement;
      return container || img;
    }
    return document.querySelector('[class*="reader"], main') || document.body;
  }

  function applyZoom(newScale, centerPointerX, centerPointerY) {
    const prevScale = currentZoom;
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
        target.style.transformOrigin = 'center center';
        target.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${currentZoom})\`;
        target.style.transition = isDragging ? 'none' : 'transform 0.12s ease-out';
        target.style.cursor = currentZoom > 1.0 ? (isDragging ? 'grabbing' : 'grab') : '';
      }
    }

    showZoomHud();
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
  }

  // Ctrl + Wheel Zoom
  window.addEventListener('wheel', (e) => {
    if (!isReaderView()) return;

    if (e.ctrlKey || e.metaKey) {
      // CRITICAL: Stop Chromium / VS Code outer window from zooming!
      e.preventDefault();
      e.stopImmediatePropagation();

      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      applyZoom(currentZoom + delta);
    }
  }, { passive: false, capture: true });

  // Ctrl Keyboard Shortcuts: Ctrl+/-, Ctrl+0
  window.addEventListener('keydown', (e) => {
    if (!isReaderView()) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        e.stopImmediatePropagation();
        applyZoom(currentZoom + 0.25);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        e.stopImmediatePropagation();
        applyZoom(currentZoom - 0.25);
      } else if (e.key === '0') {
        e.preventDefault();
        e.stopImmediatePropagation();
        resetZoom();
      }
    }
  }, true);

  // Drag-to-pan when zoomed in (> 1.0x)
  window.addEventListener('mousedown', (e) => {
    if (!isReaderView() || currentZoom <= 1.0) return;
    if (e.button !== 0) return; // Only primary mouse button

    // Do not drag if clicking buttons or controls
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

    // Keep panning within bounds
    const maxPan = window.innerWidth * (currentZoom - 1.0);
    panX = Math.max(-maxPan, Math.min(maxPan, panX));
    panY = Math.max(-window.innerHeight * currentZoom, Math.min(window.innerHeight * currentZoom, panY));

    const target = getReaderTarget();
    if (target && target !== document.body) {
      target.style.transition = 'none';
      target.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${currentZoom})\`;
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
   * 4. TRANSIENT ZOOM HUD
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
        backgroundColor: 'rgba(20, 20, 24, 0.78)',
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
    hudEl.innerHTML = \`
      <span>\${pct}%</span>
      \${currentZoom !== 1.0 ? '<span id="mangabar-hud-reset" style="cursor:pointer; opacity:0.75; text-decoration:underline; font-size:10px;">Reset</span>' : ''}
    \`;

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

  /* ──────────────────────────────────────────────────────────
   * 5. ROUTE CHANGE & MUTATION OBSERVER
   * Auto-resets zoom on page changes and synchronizes floating button.
   * ────────────────────────────────────────────────────────── */
  function checkState() {
    scrubDOMBranding();
    if (window.location.pathname !== lastPathname) {
      lastPathname = window.location.pathname;
      resetZoom();
    }
    cleanupLingeringFloatingButtons();
  }

  // Hook into browser history state transitions
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

  // Periodic and DOM Mutation check
  const observer = new MutationObserver(() => {
    scrubDOMBranding();
    checkState();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(checkState, 600);
  checkState();
})();
`;
}
