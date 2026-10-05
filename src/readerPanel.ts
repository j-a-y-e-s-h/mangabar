import * as vscode from 'vscode';
import { ServerManager } from './serverManager';

export class ReaderPanel {
  public static currentPanel: ReaderPanel | undefined;
  public static readonly viewType = 'mangabar.fullReader';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly serverManager: ServerManager;
  private disposables: vscode.Disposable[] = [];

  public static async createOrShow(extensionUri: vscode.Uri, serverManager: ServerManager) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Ensure server is started
    if (serverManager.getState() !== 'RUNNING') {
      const started = await serverManager.startServer();
      if (!started) {
        return;
      }
    }

    if (ReaderPanel.currentPanel) {
      ReaderPanel.currentPanel.panel.reveal(column);
      ReaderPanel.currentPanel.update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      ReaderPanel.viewType,
      'MangaBar Reader',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'mangabar.svg');

    ReaderPanel.currentPanel = new ReaderPanel(panel, extensionUri, serverManager);
  }

  public static async toggle(extensionUri: vscode.Uri, serverManager: ServerManager) {
    if (ReaderPanel.currentPanel) {
      ReaderPanel.currentPanel.dispose();
      return;
    }
    await ReaderPanel.createOrShow(extensionUri, serverManager);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    serverManager: ServerManager
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.serverManager = serverManager;

    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'close':
            this.dispose();
            break;
          case 'openExternal':
            vscode.env.openExternal(vscode.Uri.parse(this.serverManager.getServerUrl()));
            break;
        }
      },
      null,
      this.disposables
    );

    this.update();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.serverManager.onDidChangeState(() => {
      this.update();
    }, null, this.disposables);
  }

  public update() {
    const serverUrl = this.serverManager.getServerUrl();
    const isRunning = this.serverManager.getState() === 'RUNNING';
    const port = this.serverManager.getPort();

    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const bgColor = isDark ? '#141414' : '#fafafa';
    const toolbarBg = isDark ? '#1e1e1e' : '#f3f3f3';
    const borderColor = isDark ? '#333338' : '#e0e0e0';
    const textColor = isDark ? '#cccccc' : '#333333';
    const urlBarBg = isDark ? '#2a2a2e' : '#ffffff';

    this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MangaBar Reader</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: ${bgColor};
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      color: ${textColor};
      display: flex;
      flex-direction: column;
    }

    /* ── Navigation Toolbar ── */
    .toolbar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px 8px;
      background: ${toolbarBg};
      border-bottom: 1px solid ${borderColor};
      flex-shrink: 0;
      user-select: none;
      z-index: 10;
    }
    .toolbar .nav-btn {
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: ${textColor};
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.14s ease, transform 0.1s ease;
      flex-shrink: 0;
    }
    .toolbar .nav-btn:hover {
      background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
    }
    .toolbar .nav-btn:active {
      transform: scale(0.92);
    }
    .toolbar .nav-btn:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .toolbar .nav-btn:disabled:hover {
      background: transparent;
    }
    .toolbar .nav-btn svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .url-bar {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      background: ${urlBarBg};
      border: 1px solid ${borderColor};
      border-radius: 5px;
      padding: 4px 10px;
      margin: 0 4px;
      font-size: 11.5px;
      color: ${textColor};
      overflow: hidden;
      min-width: 0;
    }
    .url-bar .lock-icon {
      flex-shrink: 0;
      opacity: 0.5;
    }
    .url-bar .lock-icon svg {
      width: 11px;
      height: 11px;
      fill: currentColor;
    }
    .url-bar .url-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0.75;
      font-family: "Cascadia Code", "Fira Code", "SF Mono", monospace;
      font-size: 11px;
      letter-spacing: 0.2px;
    }

    .toolbar .separator {
      width: 1px;
      height: 18px;
      background: ${borderColor};
      margin: 0 3px;
      flex-shrink: 0;
    }

    /* ── Content ── */
    .content {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      position: absolute;
      top: 0;
      left: 0;
    }

    /* Loading skeleton */
    .loading-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: ${bgColor};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      z-index: 5;
      transition: opacity 0.4s ease;
    }
    .loading-overlay.hidden {
      opacity: 0;
      pointer-events: none;
    }
    .loading-spinner {
      width: 36px;
      height: 36px;
      color: var(--vscode-button-background, #007acc);
      animation: spin 1s linear infinite;
    }
    .loading-text {
      font-size: 12px;
      opacity: 0.65;
      letter-spacing: 0.3px;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Offline placeholder */
    .offline {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 14px;
      text-align: center;
      padding: 24px;
      animation: fadeIn 0.3s ease;
    }
    .offline-icon {
      width: 48px;
      height: 48px;
      color: var(--vscode-button-background, #007acc);
      opacity: 0.85;
    }
    h2 {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }
    p {
      font-size: 12px;
      opacity: 0.75;
      max-width: 320px;
      line-height: 1.5;
    }
  </style>
</head>
<body>

  ${isRunning ? `
  <!-- Navigation Toolbar -->
  <div class="toolbar">
    <button class="nav-btn" id="btnBack" title="Back" onclick="goBack()">
      <svg viewBox="0 0 16 16"><path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L4.31 7.5h8.94a.75.75 0 0 1 0 1.5H4.31l3.47 3.47a.75.75 0 0 1 0 1.06z"/></svg>
    </button>
    <button class="nav-btn" id="btnForward" title="Forward" onclick="goForward()">
      <svg viewBox="0 0 16 16"><path d="M8.22 3.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.69 8.5H2.75a.75.75 0 0 1 0-1.5h8.94L8.22 3.53a.75.75 0 0 1 0-1.06z"/></svg>
    </button>
    <button class="nav-btn" id="btnRefresh" title="Refresh" onclick="refreshPage()">
      <svg viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
    </button>

    <div class="separator"></div>

    <div class="url-bar">
      <span class="lock-icon">
        <svg viewBox="0 0 16 16"><path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H3.75A1.75 1.75 0 0 0 2 7.75v5.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0 0 14 13.25v-5.5A1.75 1.75 0 0 0 12.25 6H11V4.5A3 3 0 0 0 8 1zm2 5V4.5a2 2 0 1 0-4 0V6h4z"/></svg>
      </span>
      <span class="url-text" id="urlDisplay">${serverUrl}</span>
    </div>

    <div class="separator"></div>

    <button class="nav-btn" title="Home" onclick="goHome()">
      <svg viewBox="0 0 16 16"><path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 2 7.5V14a1 1 0 0 0 1 1h2.5a.5.5 0 0 0 .5-.5V11h4v3.5a.5.5 0 0 0 .5.5H13a1 1 0 0 0 1-1V7.5a.5.5 0 0 0 .354-.854l-6-6z"/></svg>
    </button>
    <button class="nav-btn" title="Open in External Browser" onclick="openExternal()">
      <svg viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm6.9 7.5h-2.52a12.8 12.8 0 0 0-1.07-4.63A6.97 6.97 0 0 1 14.9 7.5zM8 1.07c.8 1.15 1.5 3.32 1.63 6.43H6.37C6.5 4.39 7.2 2.22 8 1.07zM4.69 2.87A12.8 12.8 0 0 0 3.62 7.5H1.1a6.97 6.97 0 0 1 3.59-4.63zM1.1 8.5h2.52c.2 1.68.58 3.3 1.07 4.63A6.97 6.97 0 0 1 1.1 8.5zm5.27 6.43C7.2 13.78 6.5 11.61 6.37 8.5h3.26c-.13 3.11-.83 5.28-1.63 6.43zm2.94-1.8c.49-1.33.87-2.95 1.07-4.63h2.52a6.97 6.97 0 0 1-3.59 4.63z"/></svg>
    </button>
  </div>
  ` : ''}

  <!-- Content Area -->
  <div class="content">
    ${isRunning
      ? `
      <div class="loading-overlay" id="loadingOverlay">
        <svg class="loading-spinner" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="14" fill="none"/></svg>
        <div class="loading-text">Loading MangaBar on port ${port}...</div>
      </div>
      <iframe id="readerFrame" src="${serverUrl}" allow="clipboard-read; clipboard-write; fullscreen" onload="onFrameLoaded()"></iframe>
    `
      : `<div class="offline">
          <svg class="offline-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.492-3.287.81V2.828zm7.5 9.605c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v-9.92c-.917-.318-2.107-.69-3.287-.81-1.094-.11-2.278-.037-3.213.493v9.746zM0 2.25A1.25 1.25 0 0 1 1.25 1c1.55 0 3.05.45 4.75 1.05C7.25 2.5 8 3 8 3s.75-.5 2-.95c1.7-.6 3.2-1.05 4.75-1.05A1.25 1.25 0 0 1 16 2.25v10.5A1.25 1.25 0 0 1 14.75 14c-1.4 0-2.8-.4-4.25-.9-1-.35-1.5-.6-2.5-.6s-1.5.25-2.5.6c-1.45.5-2.85.9-4.25.9A1.25 1.25 0 0 1 0 12.75V2.25z"/></svg>
          <h2>MangaBar Server is Stopped</h2>
          <p>Please launch the MangaBar server from the Activity Bar sidebar view to view your manga library and extensions.</p>
        </div>`
    }
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const homeUrl = '${serverUrl}';

    function onFrameLoaded() {
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => overlay.remove(), 500);
      }
    }

    function goBack() {
      const frame = document.getElementById('readerFrame');
      if (frame) {
        try { frame.contentWindow.history.back(); } catch(e) {}
      }
    }

    function goForward() {
      const frame = document.getElementById('readerFrame');
      if (frame) {
        try { frame.contentWindow.history.forward(); } catch(e) {}
      }
    }

    function refreshPage() {
      const frame = document.getElementById('readerFrame');
      if (frame) {
        try { frame.contentWindow.location.reload(); } catch(e) { frame.src = frame.src; }
      }
    }

    function goHome() {
      const frame = document.getElementById('readerFrame');
      if (frame) {
        frame.src = homeUrl;
      }
    }

    function openExternal() {
      vscode.postMessage({ command: 'openExternal' });
    }

    // Handle host messages (e.g. reload)
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'reload') {
        refreshPage();
      }
    });

    // Close on Escape or Ctrl+Alt+M
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'm' || e.key === 'M'))) {
        vscode.postMessage({ command: 'close' });
      }
    });
  </script>
</body>
</html>`;
  }

  public reload() {
    this.panel.webview.postMessage({ type: 'reload' });
  }

  public dispose() {
    ReaderPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
