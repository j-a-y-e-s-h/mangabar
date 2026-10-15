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
      async (message) => {
        switch (message.command) {
          case 'close':
            this.dispose();
            break;
          case 'openExternal':
            vscode.env.openExternal(vscode.Uri.parse(this.serverManager.getServerUrl()));
            break;
          case 'startServer':
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: 'MangaBar: Starting Server...',
                cancellable: false,
              },
              async () => {
                await this.serverManager.startServer();
              }
            );
            break;
          case 'showLogs':
            this.serverManager.showOutputChannel();
            break;
          case 'refresh':
            const isHealthy = await this.serverManager.isServerHealthy(this.serverManager.getPort());
            if (!isHealthy) {
              this.serverManager.setOfflineState();
              this.update();
            } else {
              this.panel.webview.postMessage({ type: 'reload' });
            }
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

    this.serverManager.onDidChangeStartupProgress((progress) => {
      this.panel.webview.postMessage({ type: 'startupProgress', progress });
    }, null, this.disposables);

    const activeDisposable = this.serverManager.registerActiveViewChecker(() => {
      return Boolean(ReaderPanel.currentPanel && ReaderPanel.currentPanel.panel.visible);
    });
    this.disposables.push(activeDisposable);

    this.panel.onDidChangeViewState(
      (e) => {
        if (e.webviewPanel.visible) {
          this.serverManager.resetIdleTimer();
        }
      },
      null,
      this.disposables
    );
  }

  public isVisible(): boolean {
    return this.panel.visible;
  }

  public update() {
    const serverUrl = this.serverManager.getServerUrl();
    const state = this.serverManager.getState();
    const isRunning = state === 'RUNNING';
    const port = this.serverManager.getPort();

    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const bgColor = isDark ? '#141414' : '#fafafa';
    const cardBg = isDark ? '#1e1e24' : '#ffffff';
    const toolbarBg = isDark ? '#1e1e1e' : '#f3f3f3';
    const borderColor = isDark ? '#333338' : '#e0e0e0';
    const textColor = isDark ? '#cccccc' : '#333333';
    const urlBarBg = isDark ? '#2a2a2e' : '#ffffff';

    const progress = this.serverManager.getStartupProgress();
    const currentStep = progress?.step || 1;
    const percent = progress?.percent || (currentStep * 25);
    const title = progress?.title || 'Starting Server Engine...';
    const detail = progress?.detail || 'Initializing MangaBar environment...';
    const dl = progress?.downloadInfo;

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

    .zoom-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 7px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 9999px;
      background: ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'};
      border: 1px solid ${borderColor};
      min-width: 44px;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
      color: ${textColor};
    }
    .zoom-pill:hover {
      background: ${isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.09)'};
      border-color: #38bdf8;
      color: #38bdf8;
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
      background: ${isDark ? '#121212' : '#f5f5f5'} !important;
      color-scheme: ${isDark ? 'dark' : 'light'} !important;
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
    .start-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      background: var(--vscode-button-background, #007acc);
      color: var(--vscode-button-foreground, #ffffff);
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      outline: none;
      margin-top: 6px;
    }
    .start-btn:hover {
      background: var(--vscode-button-hoverBackground, #0062a3);
      transform: translateY(-1px);
    }
    .start-btn:active {
      transform: translateY(0);
    }
    .start-btn svg {
      width: 14px;
      height: 14px;
    }
    h2 {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }
    p {
      font-size: 12px;
      opacity: 0.75;
      max-width: 340px;
      line-height: 1.5;
    }

    /* ── 4-Step Startup Progress Card ── */
    .startup-card {
      padding: 32px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 16px;
      max-width: 360px;
      margin: 0 auto;
      user-select: none;
      animation: fadeIn 0.3s ease;
    }
    .startup-brand-cluster {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
    }
    .startup-brand-icon {
      width: 42px;
      height: 42px;
      color: var(--vscode-button-background, #007acc);
      animation: pulseGlow 2.2s infinite ease-in-out;
    }
    .startup-ring {
      position: absolute;
      inset: -4px;
      border: 2px dashed rgba(56, 189, 248, 0.45);
      border-radius: 50%;
      animation: spin 10s linear infinite;
    }
    @keyframes pulseGlow {
      0%, 100% { transform: scale(1); opacity: 0.85; }
      50% { transform: scale(1.08); opacity: 1; }
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
    .startup-title-stack {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .startup-title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }
    .startup-detail {
      font-size: 12px;
      opacity: 0.75;
      line-height: 1.4;
      min-height: 16px;
    }
    .startup-progress-track {
      width: 100%;
      height: 6px;
      background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};
      border-radius: 9999px;
      overflow: hidden;
      border: 1px solid ${borderColor};
      position: relative;
    }
    .startup-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #007acc, #38bdf8);
      border-radius: 9999px;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 8px rgba(56, 189, 248, 0.5);
    }
    .download-pill {
      font-size: 11px;
      font-weight: 600;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.28);
      padding: 3px 10px;
      border-radius: 12px;
      display: none;
      align-items: center;
      gap: 5px;
    }
    .startup-stepper {
      width: 100%;
      background: ${cardBg};
      border: 1px solid ${borderColor};
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: left;
    }
    .step-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11.5px;
      padding: 6px 8px;
      border-radius: 4px;
      transition: all 0.2s ease;
    }
    .step-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .step-indicator {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 10px;
      flex-shrink: 0;
    }
    .step-row.completed .step-indicator { color: #10b981; }
    .step-row.active .step-indicator { color: #38bdf8; }
    .step-row.pending .step-indicator { color: ${isDark ? '#6b7280' : '#9ca3af'}; opacity: 0.6; }
    .step-status-tag {
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .step-row.completed .step-status-tag {
      color: #10b981;
      background: rgba(16, 185, 129, 0.1);
    }
    .step-row.active .step-status-tag {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
    }
    .step-row.pending .step-status-tag {
      color: ${isDark ? '#6b7280' : '#9ca3af'};
      opacity: 0.6;
    }
    .step-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .startup-reassurance {
      font-size: 11px;
      opacity: 0.75;
      display: flex;
      align-items: center;
      gap: 6px;
      background: ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
      padding: 6px 10px;
      border-radius: 6px;
      line-height: 1.35;
      text-align: left;
      width: 100%;
      box-sizing: border-box;
    }
    .startup-reassurance svg {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
    }
    .icon-svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
      flex-shrink: 0;
      display: inline-block;
      vertical-align: middle;
    }
    .icon-svg.spin {
      animation: spin 1s linear infinite;
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground, #303036);
      color: var(--vscode-button-secondaryForeground, #ffffff);
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background 0.18s ease;
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground, #3f4048);
    }
  </style>
</head>
<body>

  ${isRunning ? `
  <!-- Navigation Toolbar -->
  <div class="toolbar">
    <button class="nav-btn" id="btnBack" title="Back to Manga (Backspace / B / Alt+Left)" onclick="goBack()">
      <svg viewBox="0 0 16 16"><path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L4.31 7.5h8.94a.75.75 0 0 1 0 1.5H4.31l3.47 3.47a.75.75 0 0 1 0 1.06z"/></svg>
    </button>
    <button class="nav-btn" id="btnForward" title="Forward (Alt+Right)" onclick="goForward()">
      <svg viewBox="0 0 16 16"><path d="M8.22 3.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.69 8.5H2.75a.75.75 0 0 1 0-1.5h8.94L8.22 3.53a.75.75 0 0 1 0-1.06z"/></svg>
    </button>
    <button class="nav-btn" id="btnHome" title="Library Home (H)" onclick="goHome()">
      <svg viewBox="0 0 16 16"><path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 2 7.5V14a1 1 0 0 0 1 1h2.5a.5.5 0 0 0 .5-.5V11h4v3.5a.5.5 0 0 0 .5.5H13a1 1 0 0 0 1-1V7.5a.5.5 0 0 0 .354-.854l-6-6z"/></svg>
    </button>
    <button class="nav-btn" id="btnSearch" title="Search Manga Across All Sources (/ or S)" onclick="goSearch()">
      <svg viewBox="0 0 24 24"><path d="M19.3 16.9c.4-.7.7-1.5.7-2.4 0-2.5-2-4.5-4.5-4.5S11 12 11 14.5s2 4.5 4.5 4.5c.9 0 1.7-.3 2.4-.7l3.2 3.2 1.4-1.4zm-3.8.1c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5M12 20v2C6.48 22 2 17.52 2 12S6.48 2 12 2c4.84 0 8.87 3.44 9.8 8h-2.07c-.64-2.46-2.4-4.47-4.73-5.41V5c0 1.1-.9 2-2 2h-2v2c0 .55-.45 1-1 1H8v2h2v3H9l-4.79-4.79C4.08 10.79 4 11.38 4 12c0 4.41 3.59 8 8 8"/></svg>
    </button>
    <button class="nav-btn" id="btnRefresh" title="Refresh View" onclick="refreshPage()">
      <svg viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
    </button>

    <div class="separator"></div>

    <!-- Zoom & Scroll Controls -->
    <button class="nav-btn" title="Zoom Out (-)" onclick="zoomOut()">
      <svg viewBox="0 0 16 16"><path fill-rule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8z"/></svg>
    </button>
    <div class="zoom-pill" id="zoomLevelDisplay" title="Click to Reset Zoom (0)" onclick="zoomReset()">100%</div>
    <button class="nav-btn" title="Zoom In (+)" onclick="zoomIn()">
      <svg viewBox="0 0 16 16"><path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/></svg>
    </button>
    <button class="nav-btn" title="Scroll Down (Space / ▼)" onclick="scrollDown()">
      <svg viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1.646 6.646a.5.5 0 0 1 .708 0L8 12.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/><path fill-rule="evenodd" d="M1.646 2.646a.5.5 0 0 1 .708 0L8 8.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>
    </button>

    <div class="separator"></div>

    <div class="url-bar">
      <span class="lock-icon">
        <svg viewBox="0 0 16 16"><path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H3.75A1.75 1.75 0 0 0 2 7.75v5.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0 0 14 13.25v-5.5A1.75 1.75 0 0 0 12.25 6H11V4.5A3 3 0 0 0 8 1zm2 5V4.5a2 2 0 1 0-4 0V6h4z"/></svg>
      </span>
      <span class="url-text" id="urlDisplay">${serverUrl}</span>
    </div>

    <div class="separator"></div>

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
      : state === 'STARTING'
      ? `
        <div class="startup-card">
          <div class="startup-brand-cluster">
            <svg class="startup-brand-icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.492-3.287.81V2.828zm7.5 9.605c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v-9.92c-.917-.318-2.107-.69-3.287-.81-1.094-.11-2.278-.037-3.213.493v9.746zM0 2.25A1.25 1.25 0 0 1 1.25 1c1.55 0 3.05.45 4.75 1.05C7.25 2.5 8 3 8 3s.75-.5 2-.95c1.7-.6 3.2-1.05 4.75-1.05A1.25 1.25 0 0 1 16 2.25v10.5A1.25 1.25 0 0 1 14.75 14c-1.4 0-2.8-.4-4.25-.9-1-.35-1.5-.6-2.5-.6s-1.5.25-2.5.6c-1.45.5-2.85.9-4.25.9A1.25 1.25 0 0 1 0 12.75V2.25z"/>
            </svg>
            <div class="startup-ring"></div>
          </div>

          <div class="startup-title-stack">
            <div class="startup-title" id="startupTitle">${title}</div>
            <div class="startup-detail" id="startupDetail">${detail}</div>
          </div>

          <div class="startup-progress-track">
            <div class="startup-progress-fill" id="startupBarFill" style="width: ${percent}%;"></div>
          </div>

          <div class="download-pill" id="startupDownloadBadge" style="${dl ? 'display:inline-flex;' : ''}">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M.5 9.9a.75.75 0 0 1 .75.75v2.85c0 .414.336.75.75.75h12a.75.75 0 0 0 .75-.75V10.65a.75.75 0 0 1 1.5 0v2.85A2.25 2.25 0 0 1 14 15.75H2A2.25 2.25 0 0 1-.25 13.5V10.65A.75.75 0 0 1 .5 9.9z"/><path d="M7.47 10.53a.75.75 0 0 0 1.06 0l3-3a.75.75 0 0 0-1.06-1.06L8.75 8.19V1.75a.75.75 0 0 0-1.5 0v6.44L5.53 6.47a.75.75 0 0 0-1.06 1.06l3 3z"/></svg>
            <span id="startupDownloadText">${dl ? `${dl.downloadedMB} MB / ${dl.totalMB} MB (${dl.percent}%)` : ''}</span>
          </div>

          <div class="startup-stepper">
            <div class="step-row ${currentStep > 1 ? 'completed' : currentStep === 1 ? 'active' : 'pending'}" id="stepRow1">
              <div class="step-left">
                <span class="step-indicator" id="stepIcon1">
                  ${currentStep > 1 ? '<svg class="icon-svg" viewBox="0 0 16 16"><path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>' : currentStep === 1 ? '<svg class="icon-svg spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="14" fill="none"/></svg>' : '<span class="step-dot"></span>'}
                </span>
                <span>Java 21 Runtime</span>
              </div>
              <span class="step-status-tag" id="stepStatus1">${currentStep > 1 ? 'Ready' : currentStep === 1 ? 'Active' : 'Pending'}</span>
            </div>

            <div class="step-row ${currentStep > 2 ? 'completed' : currentStep === 2 ? 'active' : 'pending'}" id="stepRow2">
              <div class="step-left">
                <span class="step-indicator" id="stepIcon2">
                  ${currentStep > 2 ? '<svg class="icon-svg" viewBox="0 0 16 16"><path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>' : currentStep === 2 ? '<svg class="icon-svg spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="14" fill="none"/></svg>' : '<span class="step-dot"></span>'}
                </span>
                <span>Server Engine Binary</span>
              </div>
              <span class="step-status-tag" id="stepStatus2">${currentStep > 2 ? 'Ready' : currentStep === 2 ? 'Active' : 'Pending'}</span>
            </div>

            <div class="step-row ${currentStep > 3 ? 'completed' : currentStep === 3 ? 'active' : 'pending'}" id="stepRow3">
              <div class="step-left">
                <span class="step-indicator" id="stepIcon3">
                  ${currentStep > 3 ? '<svg class="icon-svg" viewBox="0 0 16 16"><path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>' : currentStep === 3 ? '<svg class="icon-svg spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="14" fill="none"/></svg>' : '<span class="step-dot"></span>'}
                </span>
                <span>Database & Cache</span>
              </div>
              <span class="step-status-tag" id="stepStatus3">${currentStep > 3 ? 'Ready' : currentStep === 3 ? 'Active' : 'Pending'}</span>
            </div>

            <div class="step-row ${currentStep >= 4 ? (percent >= 100 ? 'completed' : 'active') : 'pending'}" id="stepRow4">
              <div class="step-left">
                <span class="step-indicator" id="stepIcon4">
                  ${currentStep >= 4 && percent >= 100 ? '<svg class="icon-svg" viewBox="0 0 16 16"><path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>' : currentStep === 4 ? '<svg class="icon-svg spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="14" fill="none"/></svg>' : '<span class="step-dot"></span>'}
                </span>
                <span>Web Reader UI</span>
              </div>
              <span class="step-status-tag" id="stepStatus4">${currentStep >= 4 && percent >= 100 ? 'Ready' : currentStep === 4 ? 'Active' : 'Pending'}</span>
            </div>
          </div>

          <div class="startup-reassurance">
            <svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm9-3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-.25 3.75a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5z"/></svg>
            <span>First-time setup only. Future starts will be instant.</span>
          </div>

          <button class="secondary" onclick="showLogs()">
            <svg class="icon-svg" viewBox="0 0 16 16"><path d="M14.5 3H1.5A1.5 1.5 0 0 0 0 4.5v7A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 3zm.5 8.5a.5.5 0 0 1-.5.5H1.5a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v7zM3 6h2v1H3V6zm0 2h5v1H3V8zm0 2h3v1H3v-1zm7-4h3v1h-3V6zm0 2h3v1h-3V8z"/></svg>
            <span>View Server Logs</span>
          </button>
        </div>`
      : state === 'ERROR'
      ? (() => {
          const errDetail = this.serverManager.getLastErrorDetail();
          const errTitle = errDetail && errDetail.includes('Internet connection required')
            ? 'Initial Setup Requires Internet'
            : 'Failed to Start Server';
          const errSubtitle = errDetail || 'Could not launch MangaBar server. Check the output channel or click below to retry.';
          return `<div class="offline">
          <svg class="offline-icon" style="color: var(--vscode-errorForeground, #f48771);" viewBox="0 0 16 16" fill="currentColor">
            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
          </svg>
          <h2>${errTitle}</h2>
          <p style="max-width: 420px; line-height: 1.4;">${errSubtitle}</p>
          <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:8px;">
            <button class="start-btn" onclick="startServer()">
              <svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
              Retry Launch
            </button>
            <button class="secondary" onclick="showLogs()" style="padding: 8px 16px;">
              <svg class="icon-svg" viewBox="0 0 16 16"><path d="M14.5 3H1.5A1.5 1.5 0 0 0 0 4.5v7A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 3zm.5 8.5a.5.5 0 0 1-.5.5H1.5a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v7zM3 6h2v1H3V6zm0 2h5v1H3V8zm0 2h3v1H3v-1zm7-4h3v1h-3V6zm0 2h3v1h-3V8z"/></svg>
              <span>View Server Logs</span>
            </button>
          </div>
        </div>`;
        })()
      : `<div class="offline">
          <svg class="offline-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.492-3.287.81V2.828zm7.5 9.605c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v-9.92c-.917-.318-2.107-.69-3.287-.81-1.094-.11-2.278-.037-3.213.493v9.746zM0 2.25A1.25 1.25 0 0 1 1.25 1c1.55 0 3.05.45 4.75 1.05C7.25 2.5 8 3 8 3s.75-.5 2-.95c1.7-.6 3.2-1.05 4.75-1.05A1.25 1.25 0 0 1 16 2.25v10.5A1.25 1.25 0 0 1 14.75 14c-1.4 0-2.8-.4-4.25-.9-1-.35-1.5-.6-2.5-.6s-1.5.25-2.5.6c-1.45.5-2.85.9-4.25.9A1.25 1.25 0 0 1 0 12.75V2.25z"/></svg>
          <h2>MangaBar Server is Stopped</h2>
          <p>To keep your system running fast and smooth, the server runs only when needed. Click below to start.</p>
          <button class="start-btn" onclick="startServer()">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2v12l10-6L4 2z"/></svg>
            Start Server
          </button>
        </div>`
    }
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const homeUrl = '${serverUrl}';

    let frameMountFallbackTimer = null;
    function onFrameLoaded() {
      if (frameMountFallbackTimer) clearTimeout(frameMountFallbackTimer);
      frameMountFallbackTimer = setTimeout(() => {
        dismissOverlay();
      }, 4000);
    }

    function dismissOverlay() {
      if (frameMountFallbackTimer) {
        clearTimeout(frameMountFallbackTimer);
        frameMountFallbackTimer = null;
      }
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) {
        overlay.classList.add('hidden');
      }
    }

    function sendCmd(action) {
      const frame = document.getElementById('readerFrame');
      if (frame && frame.contentWindow) {
        try { frame.contentWindow.postMessage({ type: 'mangabar_cmd', action }, '*'); } catch(_) {}
      }
    }

    function goBack() {
      sendCmd('back');
      const frame = document.getElementById('readerFrame');
      if (frame && frame.contentWindow) {
        try { frame.contentWindow.history.back(); } catch(e) {}
      }
    }

    function goForward() {
      sendCmd('forward');
      const frame = document.getElementById('readerFrame');
      if (frame && frame.contentWindow) {
        try { frame.contentWindow.history.forward(); } catch(e) {}
      }
    }

    function goHome() {
      sendCmd('home');
    }

    function goSearch() {
      sendCmd('search');
    }

    let refreshFallbackTimer = null;
    function refreshPage() {
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) {
        overlay.classList.remove('hidden');
      }
      sendCmd('reload');
      vscode.postMessage({ command: 'refresh' });
      if (refreshFallbackTimer) clearTimeout(refreshFallbackTimer);
      refreshFallbackTimer = setTimeout(() => {
        const frame = document.getElementById('readerFrame');
        if (frame) {
          try { frame.src = frame.src; } catch(e) {}
        }
      }, 1200);
    }

    function zoomIn() { sendCmd('zoomIn'); }
    function zoomOut() { sendCmd('zoomOut'); }
    function zoomReset() { sendCmd('zoomReset'); }
    function scrollDown() { sendCmd('scrollDown'); }
    function scrollUp() { sendCmd('scrollUp'); }
    function prevPage() { sendCmd('prevPage'); }
    function nextPage() { sendCmd('nextPage'); }

    function openExternal() {
      vscode.postMessage({ command: 'openExternal' });
    }

    function startServer() {
      vscode.postMessage({ command: 'startServer' });
    }

    function showLogs() {
      vscode.postMessage({ command: 'showLogs' });
    }

    // Handle host and frame messages
    window.addEventListener('message', (event) => {
      if (!event.data) return;
      if (event.data.type === 'startupProgress' && event.data.progress) {
        const p = event.data.progress;
        const titleEl = document.getElementById('startupTitle');
        const detailEl = document.getElementById('startupDetail');
        const fillEl = document.getElementById('startupBarFill');
        const dlBadge = document.getElementById('startupDownloadBadge');
        const dlText = document.getElementById('startupDownloadText');

        if (titleEl) titleEl.innerText = p.title;
        if (detailEl) detailEl.innerText = p.detail;
        if (fillEl) fillEl.style.width = (p.percent || (p.step * 25)) + '%';

        if (p.downloadInfo) {
          if (dlBadge) dlBadge.style.display = 'inline-flex';
          if (dlText) dlText.innerText = p.downloadInfo.downloadedMB + ' MB / ' + p.downloadInfo.totalMB + ' MB (' + p.downloadInfo.percent + '%)';
        } else if (dlBadge) {
          dlBadge.style.display = 'none';
        }

        for (let i = 1; i <= 4; i++) {
          const row = document.getElementById('stepRow' + i);
          const icon = document.getElementById('stepIcon' + i);
          const status = document.getElementById('stepStatus' + i);
          if (!row || !icon || !status) continue;

          row.className = 'step-row ' + (i < p.step ? 'completed' : i === p.step ? 'active' : 'pending');
          if (i < p.step) {
            icon.innerHTML = '<svg class="icon-svg" viewBox="0 0 16 16"><path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>';
            status.innerText = 'Ready';
          } else if (i === p.step) {
            icon.innerHTML = '<svg class="icon-svg spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="14" fill="none"/></svg>';
            status.innerText = 'Active';
          } else {
            icon.innerHTML = '<span class="step-dot"></span>';
            status.innerText = 'Pending';
          }
        }
      } else if (event.data.type === 'reload') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('hidden');
        sendCmd('reload');
      } else if (event.data.type === 'mangabar_state') {
        if (event.data.mounted !== false) {
          dismissOverlay();
        }
        if (refreshFallbackTimer) {
          clearTimeout(refreshFallbackTimer);
          refreshFallbackTimer = null;
        }
        const badge = document.getElementById('zoomLevelDisplay');
        if (badge && typeof event.data.zoom === 'number') {
          const pct = Math.round(event.data.zoom * 100);
          badge.textContent = pct + '%';
          if (pct !== 100) {
            badge.style.color = '#38bdf8';
            badge.style.borderColor = '#38bdf8';
            badge.style.fontWeight = '700';
          } else {
            badge.style.color = '';
            badge.style.borderColor = '';
            badge.style.fontWeight = '600';
          }
        }
        if (event.data.pathname) {
          const display = document.getElementById('urlDisplay');
          if (display) {
            display.textContent = homeUrl + (event.data.pathname === '/' ? '' : event.data.pathname);
          }
        }
      }
    });

    // Keyboard navigation when Reader tab webview has focus
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'm' || e.key === 'M'))) {
        vscode.postMessage({ command: 'close' });
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          zoomIn();
          return;
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          zoomOut();
          return;
        } else if (e.key === '0') {
          e.preventDefault();
          zoomReset();
          return;
        }
      }
      if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        zoomOut();
      } else if (e.key === '0') {
        zoomReset();
      } else if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft') || e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        goBack();
      } else if (e.key === 'h' || e.key === 'H') {
        goHome();
      } else if (e.key === 's' || e.key === 'S' || e.key === '/') {
        goSearch();
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        scrollDown();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        scrollUp();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        prevPage();
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
