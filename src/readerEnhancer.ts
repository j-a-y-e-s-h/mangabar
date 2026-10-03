/**
 * MangaBar Client-Side Reader Enhancer Script.
 * Injected into the MangaBar WebUI context via local reverse-proxy.
 * Provides:
 * 1. Two-tier reader navigation flow (menu back arrow dismisses menu; canvas floating button exits).
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
   * 1. FLOATING EXIT BUTTON (Canvas -> Manga Details)
   * ────────────────────────────────────────────────────────── */
  let floatingExitBtn = null;

  function areReaderControlsOpen() {
    // Check for visible drawer paper, topBar, or appBar
    const drawer = document.querySelector(
      '[class*="MuiDrawer-root"]:not([style*="visibility: hidden"]):not([style*="display: none"]), [class*="MuiDrawer-paper"]:not([style*="visibility: hidden"]):not([style*="display: none"]), [class*="drawer"]:not([style*="display: none"]), [class*="Drawer"]:not([style*="display: none"]), [role="presentation"] > [class*="MuiPaper-root"]'
    );
    if (drawer && drawer.offsetParent !== null && drawer.getBoundingClientRect().width > 0) {
      return true;
    }
    const topBar = document.querySelector('header, [class*="topBar"], [class*="appBar"], [class*="MuiAppBar-root"]');
    if (topBar && topBar.offsetParent !== null && topBar.getBoundingClientRect().height > 0) {
      return true;
    }
    const backdrop = document.querySelector('[class*="MuiBackdrop-root"]');
    if (backdrop && backdrop.offsetParent !== null) {
      return true;
    }
    return false;
  }

  function updateFloatingExitButtonVisibility() {
    if (!floatingExitBtn) return;
    if (!isReaderView() || areReaderControlsOpen()) {
      floatingExitBtn.style.display = 'none';
    } else {
      floatingExitBtn.style.display = 'flex';
    }
  }

  function ensureFloatingExitButton() {
    if (!isReaderView()) {
      if (floatingExitBtn) {
        floatingExitBtn.remove();
        floatingExitBtn = null;
      }
      return;
    }

    if (document.getElementById('mangabar-floating-exit-btn')) {
      floatingExitBtn = document.getElementById('mangabar-floating-exit-btn');
      updateFloatingExitButtonVisibility();
      return;
    }

    floatingExitBtn = document.createElement('button');
    floatingExitBtn.id = 'mangabar-floating-exit-btn';
    floatingExitBtn.setAttribute('aria-label', 'Exit Reader to Manga Details');
    floatingExitBtn.title = 'Exit to Manga Details';

    // SVG Codicon Arrow Left
    floatingExitBtn.innerHTML = \`
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
        <path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L4.31 7.5h8.94a.75.75 0 0 1 0 1.5H4.31l3.47 3.47a.75.75 0 0 1 0 1.06z"/>
      </svg>
    \`;

    // Modern floating styles: 35% idle opacity, rounded pill, backdrop blur
    Object.assign(floatingExitBtn.style, {
      position: 'fixed',
      top: '16px',
      left: '16px',
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      backgroundColor: 'rgba(20, 20, 24, 0.72)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      color: '#ffffff',
      display: areReaderControlsOpen() ? 'none' : 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      zIndex: '99999',
      opacity: '0.35',
      transition: 'opacity 0.22s ease, transform 0.18s ease, background-color 0.2s ease',
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
      userSelect: 'none',
      padding: '0',
    });

    floatingExitBtn.addEventListener('mouseenter', () => {
      floatingExitBtn.style.opacity = '1.0';
      floatingExitBtn.style.transform = 'scale(1.06)';
      floatingExitBtn.style.backgroundColor = 'rgba(28, 28, 34, 0.92)';
    });

    floatingExitBtn.addEventListener('mouseleave', () => {
      floatingExitBtn.style.opacity = '0.35';
      floatingExitBtn.style.transform = 'scale(1.0)';
      floatingExitBtn.style.backgroundColor = 'rgba(20, 20, 24, 0.72)';
      resetIdleTimer();
    });

    let idleTimeout = null;
    function resetIdleTimer() {
      if (!floatingExitBtn || areReaderControlsOpen() || !isReaderView()) return;
      if (!floatingExitBtn.matches(':hover')) {
        floatingExitBtn.style.opacity = '0.35';
      }
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        if (floatingExitBtn && !floatingExitBtn.matches(':hover') && !areReaderControlsOpen()) {
          floatingExitBtn.style.opacity = '0.08';
        }
      }, 3500);
    }

    window.addEventListener('mousemove', resetIdleTimer, { passive: true });
    window.addEventListener('touchstart', resetIdleTimer, { passive: true });
    resetIdleTimer();

    floatingExitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mangaId = getMangaId();
      if (mangaId) {
        // Navigate to Manga Details page
        navigateTo(\`/manga/\${mangaId}\`);
      } else {
        navigateTo('/');
      }
    });

    document.body.appendChild(floatingExitBtn);
  }

  function navigateTo(targetPath) {
    // Reset zoom before leaving
    resetZoom();
    if (window.history && window.history.pushState) {
      window.history.pushState(null, '', targetPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      window.location.href = targetPath;
    }
  }

  /* ──────────────────────────────────────────────────────────
   * 2. TOP-LEFT MENU BACK ARROW DISMISSAL
   * When reader controls menu is open, clicking the top-left
   * back button dismisses controls and returns to active manga.
   * ────────────────────────────────────────────────────────── */
  function isReaderBackArrowButton(target) {
    if (!isReaderView() || !target) return false;
    const btn = target.closest('button, [role="button"], a');
    if (!btn) return false;

    // Check if it's the floating button we injected
    if (btn.id === 'mangabar-floating-exit-btn') return false;

    // Check if it's inside drawer or top bar
    const inControls = btn.closest('[class*="drawer"], [class*="Drawer"], [class*="MuiDrawer"], header, [class*="MuiAppBar"], [class*="topBar"]');
    if (!inControls) return false;

    // Check if button has ArrowBack icon or aria-label
    const hasBackSvg = btn.querySelector('svg path[d*="M20 11H7.83"], svg path[d*="M19 12"], svg[data-testid="ArrowBackIcon"], svg');
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    const isBackLabel = ariaLabel.includes('back') || ariaLabel.includes('close') || ariaLabel.includes('navigate_before');

    const rect = btn.getBoundingClientRect();
    const isTopLeft = rect.top < 120 && rect.left < 120;

    return !!(isBackLabel || (isTopLeft && hasBackSvg));
  }

  // Intercept click on reader menu back arrow
  document.addEventListener('click', (e) => {
    if (!isReaderView()) return;

    if (isReaderBackArrowButton(e.target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log('[MangaBar] Reader menu back arrow clicked -> Dismissing controls to manga page');
      dismissReaderControls();
    }
  }, true); // Capture phase to intercept before React router

  function dismissReaderControls() {
    // 1. Dispatch Escape key to dismiss overlay
    const escEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(escEvent);

    // 2. Click backdrop if present
    const backdrop = document.querySelector('[class*="MuiBackdrop-root"], [class*="backdrop"]');
    if (backdrop) {
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    // 3. Simulate clicking center touch zone if Escape did not close it
    setTimeout(() => {
      const centerX = Math.floor(window.innerWidth / 2);
      const centerY = Math.floor(window.innerHeight / 2);
      const centerEl = document.elementFromPoint(centerX, centerY);
      if (centerEl && !centerEl.closest('button, input, select, textarea, [class*="MuiAppBar"], [class*="drawer"], [class*="Drawer"]')) {
        centerEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY }));
      }
      updateFloatingExitButtonVisibility();
    }, 60);
  }

  /* ──────────────────────────────────────────────────────────
   * 3. SAFE CLAMPED CTRL-ZOOM (50% - 400%) & PAN
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
    ensureFloatingExitButton();
    updateFloatingExitButtonVisibility();
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
