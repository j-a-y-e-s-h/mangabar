import * as vscode from 'vscode';
import { ServerManager, ServerState } from './serverManager';
import { ConfigManager } from './configManager';
import { MangaBarClient } from './mangabarClient';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'mangabar.sidebarView';
  private webviewView?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly serverManager: ServerManager,
    private readonly configManager: ConfigManager
  ) {
    this.serverManager.onDidChangeState(() => {
      this.updateWebviewContent();
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'start':
          await this.serverManager.startServer();
          break;
        case 'stop':
          await this.serverManager.stopServer();
          break;
        case 'restart':
          await this.serverManager.restartServer();
          break;
        case 'reload':
          this.reloadView();
          break;
        case 'showLogs':
          this.serverManager.showOutputChannel();
          break;
        case 'openFullReader':
          vscode.commands.executeCommand('mangabar.openReader');
          break;
        case 'toggleSideBarLocation':
          vscode.commands.executeCommand('mangabar.toggleSideBarLocation');
          break;
        case 'openBrowser':
          vscode.env.openExternal(vscode.Uri.parse(this.serverManager.getServerUrl()));
          break;
        case 'configureStorage':
          vscode.commands.executeCommand('mangabar.configureStorage');
          break;
        case 'getStoreSummary':
          await this.handleGetStoreSummary();
          break;
        case 'addExtensionStore':
          await this.handleAddExtensionStore(message.url);
          break;
        case 'fetchAllExtensions':
          await this.handleFetchAllExtensions();
          break;
      }
    });

    this.updateWebviewContent();

    // Auto-start server if enabled in settings
    if (this.configManager.shouldAutoStart() && this.serverManager.getState() === 'STOPPED') {
      this.serverManager.startServer();
    }
  }

  private async handleGetStoreSummary() {
    if (this.serverManager.getState() !== 'RUNNING') {
      return;
    }
    const port = this.serverManager.getPort();
    const summary = await MangaBarClient.getSummary(port);
    this.webviewView?.webview.postMessage({
      type: 'storeSummary',
      summary,
    });
  }

  private async handleAddExtensionStore(rawUrl: string) {
    if (this.serverManager.getState() !== 'RUNNING') {
      vscode.window.showWarningMessage('Please start the MangaBar server before adding an extension store.');
      return;
    }

    const port = this.serverManager.getPort();
    this.webviewView?.webview.postMessage({
      type: 'storeOpStatus',
      status: 'loading',
      message: 'Registering repository & fetching extension index...',
    });

    try {
      const result = await MangaBarClient.addStore(port, rawUrl);
      this.webviewView?.webview.postMessage({
        type: 'storeOpStatus',
        status: 'success',
        message: `Successfully connected! ${result.totalCount} extensions available.`,
        totalCount: result.totalCount,
        repoUrl: result.indexUrl,
      });
      vscode.window.showInformationMessage(
        `Extension store registered! ${result.totalCount} extensions loaded.`
      );
    } catch (err: any) {
      this.webviewView?.webview.postMessage({
        type: 'storeOpStatus',
        status: 'error',
        message: `Failed to add store: ${err.message}`,
      });
      vscode.window.showErrorMessage(`Failed to add extension store: ${err.message}`);
    }
  }

  private async handleFetchAllExtensions() {
    if (this.serverManager.getState() !== 'RUNNING') {
      return;
    }
    const port = this.serverManager.getPort();
    this.webviewView?.webview.postMessage({
      type: 'storeOpStatus',
      status: 'loading',
      message: 'Updating all extensions from configured stores...',
    });

    try {
      const totalCount = await MangaBarClient.fetchExtensions(port);
      this.webviewView?.webview.postMessage({
        type: 'storeOpStatus',
        status: 'success',
        message: `Extensions updated! ${totalCount} extensions available.`,
        totalCount,
      });
    } catch (err: any) {
      this.webviewView?.webview.postMessage({
        type: 'storeOpStatus',
        status: 'error',
        message: `Update failed: ${err.message}`,
      });
    }
  }

  public updateWebviewContent() {
    if (!this.webviewView) {
      return;
    }

    const state = this.serverManager.getState();
    const serverUrl = this.serverManager.getServerUrl();
    const port = this.serverManager.getPort();
    const dataDir = this.configManager.getDataDirectory();
    const sideLocation = this.configManager.getSideBarLocation();

    this.webviewView.webview.html = this.getHtmlForState(state, serverUrl, port, dataDir, sideLocation);
  }

  public reloadView(): void {
    if (!this.webviewView) {
      return;
    }
    if (this.serverManager.getState() === 'RUNNING') {
      this.webviewView.webview.postMessage({ type: 'reload' });
    } else {
      this.updateWebviewContent();
    }
  }

  private getHtmlForState(
    state: ServerState,
    serverUrl: string,
    port: number,
    dataDir: string,
    sideLocation: 'left' | 'right'
  ): string {
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const bgColor = isDark ? '#181818' : '#f5f5f5';
    const textColor = isDark ? '#d4d4d4' : '#2d2d2d';
    const cardBg = isDark ? '#222225' : '#ffffff';
    const borderColor = isDark ? '#333338' : '#e5e5e5';
    const accentColor = 'var(--vscode-button-background, #0078d4)';
    const inputBg = isDark ? '#1b1b1e' : '#f0f0f0';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MangaBar Sidebar</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      background-color: ${bgColor};
      color: ${textColor};
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
    }
    
    /* Top Toolbar Header */
    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: ${cardBg};
      border-bottom: 1px solid ${borderColor};
      font-size: 11px;
      flex-shrink: 0;
      gap: 6px;
      z-index: 10;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      letter-spacing: 0.2px;
    }
    .indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
      transition: all 0.3s ease;
    }
    .indicator.running {
      background-color: #4caf50;
      box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.6);
      animation: pulseGlow 2.5s infinite;
    }
    .indicator.starting {
      background-color: #f59e0b;
      animation: pulseBlink 1s infinite alternate;
    }
    .indicator.stopped { background-color: #71717a; }
    .indicator.error { background-color: #ef4444; }

    @keyframes pulseGlow {
      0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.6); }
      70% { box-shadow: 0 0 0 6px rgba(76, 175, 80, 0); }
      100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
    }
    @keyframes pulseBlink {
      0% { opacity: 0.4; }
      100% { opacity: 1; }
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    
    button {
      background: var(--vscode-button-background, #007acc);
      color: var(--vscode-button-foreground, #ffffff);
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      line-height: 1;
      height: 26px;
      transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
    }
    button:hover {
      background: var(--vscode-button-hoverBackground, #0062a3);
      transform: translateY(-1px);
    }
    button:active {
      transform: scale(0.96);
    }
    button.icon-btn {
      width: 26px;
      height: 26px;
      padding: 0;
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground, #303036);
      color: var(--vscode-button-secondaryForeground, #ffffff);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground, #3f4048);
    }
    button.active-toggle {
      background: var(--vscode-button-background, #007acc);
      color: #ffffff;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    /* Vector SVG Icons */
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

    /* Extension Stores Dropdown Drawer */
    .drawer {
      background: ${cardBg};
      border-bottom: 1px solid ${borderColor};
      overflow: hidden;
      max-height: 0;
      opacity: 0;
      padding: 0 12px;
      pointer-events: none;
      transition: max-height 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                  opacity 0.2s ease,
                  padding 0.28s ease;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9;
    }
    .drawer.open {
      max-height: 400px;
      opacity: 1;
      padding: 12px 12px;
      pointer-events: auto;
    }
    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      opacity: 0.85;
    }
    .count-pill {
      background: rgba(0, 122, 204, 0.18);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.25);
      padding: 1px 7px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 600;
    }
    
    .preset-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .preset-label {
      font-size: 10px;
      opacity: 0.6;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    /* 1-Click Keiyoushi Chip */
    .preset-chip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(0, 122, 204, 0.12);
      border: 1px solid rgba(0, 122, 204, 0.28);
      border-radius: 6px;
      padding: 7px 10px;
      cursor: pointer;
      transition: all 0.18s ease;
    }
    .preset-chip:hover {
      background: rgba(0, 122, 204, 0.22);
      border-color: rgba(56, 189, 248, 0.6);
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    }
    .preset-chip:active {
      transform: scale(0.98);
    }
    .chip-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .chip-title {
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .verified-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #10b981;
      color: #ffffff;
    }
    .chip-subtitle {
      font-size: 10px;
      opacity: 0.65;
    }
    .chip-action {
      background: var(--vscode-button-background, #007acc);
      color: #fff;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    /* Custom URL Input Section */
    .custom-input-group {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .custom-input {
      flex: 1;
      background: ${inputBg};
      border: 1px solid ${borderColor};
      color: ${textColor};
      padding: 5px 8px;
      font-size: 11px;
      border-radius: 4px;
      outline: none;
      transition: border-color 0.16s ease;
    }
    .custom-input:focus {
      border-color: var(--vscode-focusBorder, #007acc);
    }

    /* Drawer Footer / Status */
    .drawer-status {
      font-size: 10.5px;
      padding: 4px 6px;
      border-radius: 4px;
      display: none;
      align-items: center;
      gap: 6px;
      animation: fadeIn 0.2s ease;
    }
    .drawer-status.loading {
      display: flex;
      background: rgba(245, 158, 11, 0.12);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.25);
    }
    .drawer-status.success {
      display: flex;
      background: rgba(16, 185, 129, 0.12);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    .drawer-status.error {
      display: flex;
      background: rgba(239, 68, 68, 0.12);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.25);
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-3px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Content Area */
    .content-area {
      flex: 1;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      flex: 1;
      background: #ffffff;
    }

    /* Iframe Loading Overlay */
    .iframe-loader {
      position: absolute;
      inset: 0;
      background: ${bgColor};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 18px;
      z-index: 5;
      transition: opacity 0.4s ease, visibility 0.4s ease;
    }
    .iframe-loader.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .loader-brand {
      width: 36px;
      height: 36px;
      color: var(--vscode-button-background, #007acc);
      opacity: 0.85;
    }
    .skeleton-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 85%;
      max-width: 280px;
    }
    .skeleton-line {
      height: 10px;
      border-radius: 5px;
      background: linear-gradient(90deg, ${borderColor} 25%, ${cardBg} 50%, ${borderColor} 75%);
      background-size: 200% 100%;
      animation: shimmer 1.6s infinite ease-in-out;
    }
    .skeleton-line:nth-child(1) { width: 100%; }
    .skeleton-line:nth-child(2) { width: 80%; animation-delay: 0.1s; }
    .skeleton-line:nth-child(3) { width: 60%; animation-delay: 0.2s; }
    .skeleton-line:nth-child(4) { width: 90%; animation-delay: 0.3s; }
    .skeleton-line:nth-child(5) { width: 45%; animation-delay: 0.4s; }
    .loader-label {
      font-size: 11px;
      opacity: 0.55;
      letter-spacing: 0.3px;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .placeholder-card {
      padding: 30px 16px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 14px;
    }
    .brand-icon {
      width: 44px;
      height: 44px;
      color: var(--vscode-button-background, #007acc);
      opacity: 0.9;
    }
    .title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }
    .subtitle {
      font-size: 12px;
      opacity: 0.75;
      max-width: 260px;
      line-height: 1.45;
    }
    .info-list {
      text-align: left;
      font-size: 11px;
      background: ${cardBg};
      border: 1px solid ${borderColor};
      padding: 12px 14px;
      border-radius: 6px;
      width: 100%;
      max-width: 280px;
      line-height: 1.7;
    }
  </style>
</head>
<body>

  <!-- Top Controls Bar -->
  <div class="header-bar">
    <div class="status-badge">
      <span class="indicator ${state.toLowerCase()}"></span>
      <span>${state === 'RUNNING' ? 'Running' : state === 'STARTING' ? 'Starting...' : state === 'ERROR' ? 'Error' : 'Stopped'}</span>
      ${state === 'RUNNING' ? `<span style="opacity:0.55;">:${port}</span>` : ''}
    </div>
    
    <div class="actions">
      ${
        state === 'RUNNING'
          ? `
          <button id="toggleDrawerBtn" class="secondary" title="Extension Stores & Repositories" onclick="toggleDrawer()">
            <svg class="icon-svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8.5 1.25a.75.75 0 0 0-1 0L1.75 5.5v5a.75.75 0 0 0 .37.65l5.5 3.25a.75.75 0 0 0 .76 0l5.5-3.25a.75.75 0 0 0 .37-.65v-5L8.5 1.25zM2.5 6.06l5 2.95 5-2.95L8 3.4 2.5 6.06zm5.75 3.82v4.83l4.5-2.66V7.22l-4.5 2.66zm-1.5 0L2.25 7.22v4.83l4.5 2.66V9.88z"/></svg>
            <span>Stores</span>
          </button>
          
          <button class="secondary icon-btn" title="Open Full Scale Editor Tab" onclick="send('openFullReader')">
            <svg class="icon-svg" viewBox="0 0 16 16"><path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 1 0V2h3.5a.5.5 0 0 0 0-1h-4zm13 0h-4a.5.5 0 0 0 0 1H14v3.5a.5.5 0 0 0 1 0v-4a.5.5 0 0 0-.5-.5zM1 14.5a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 0-1H2v-3.5a.5.5 0 0 0-1 0v4zm14 0v-4a.5.5 0 0 0-1 0V14h-3.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 .5-.5z"/></svg>
          </button>

          <button class="secondary icon-btn" title="${sideLocation === 'left' ? 'Move MangaBar to Right Secondary Side Bar' : 'Move MangaBar to Left Primary Activity Bar'}" onclick="send('toggleSideBarLocation')">
            <svg class="icon-svg" viewBox="0 0 16 16">
              ${
                sideLocation === 'left'
                  ? '<path fill-rule="evenodd" d="M14 2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zm-4 11H2V3h8v10zm4 0h-3V3h3v10z"/>'
                  : '<path fill-rule="evenodd" d="M14 2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM5 13H2V3h3v10zm9 0H6V3h8v10z"/>'
              }
            </svg>
          </button>
          
          <button class="secondary icon-btn" title="Open in External Browser" onclick="send('openBrowser')">
            <svg class="icon-svg" viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm6.9 7.5h-2.52a12.8 12.8 0 0 0-1.07-4.63A6.97 6.97 0 0 1 14.9 7.5zM8 1.07c.8 1.15 1.5 3.32 1.63 6.43H6.37C6.5 4.39 7.2 2.22 8 1.07zM4.69 2.87A12.8 12.8 0 0 0 3.62 7.5H1.1a6.97 6.97 0 0 1 3.59-4.63zM1.1 8.5h2.52c.2 1.68.58 3.3 1.07 4.63A6.97 6.97 0 0 1 1.1 8.5zm5.27 6.43C7.2 13.78 6.5 11.61 6.37 8.5h3.26c-.13 3.11-.83 5.28-1.63 6.43zm2.94-1.8c.49-1.33.87-2.95 1.07-4.63h2.52a6.97 6.97 0 0 1-3.59 4.63z"/></svg>
          </button>
          
          <button class="secondary icon-btn" title="Reload View" onclick="reloadFrame()">
            <svg class="icon-svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
          </button>

          <button class="secondary icon-btn" title="Restart Server" onclick="send('restart')">
            <svg class="icon-svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a7 7 0 1 1 12.07 4.95l-.71-.71A6 6 0 1 0 2 8h2l-2.5 3L-1 8h2zm14 0a7 7 0 1 1-12.07-4.95l.71.71A6 6 0 1 0 14 8h-2l2.5-3L17 8h-2z"/></svg>
          </button>
          
          <button class="secondary icon-btn" title="Stop Server" onclick="send('stop')">
            <svg class="icon-svg" viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" rx="1.5"/></svg>
          </button>
        `
          : state === 'STARTING'
          ? `
          <button class="secondary icon-btn" disabled>
            <svg class="icon-svg spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="14" fill="none"/></svg>
          </button>
        `
          : `
          <button onclick="send('start')">
            <svg class="icon-svg" viewBox="0 0 16 16"><path d="M4.5 2.8c-.5-.3-1.1.1-1.1.7v9c0 .6.6 1 1.1.7l7.5-4.5c.5-.3.5-1 0-1.4l-7.5-4.5z"/></svg>
            <span>Start</span>
          </button>
        `
      }
    </div>
  </div>

  <!-- Animated Extension Stores Drawer -->
  <div id="storesDrawer" class="drawer">
    <div class="drawer-header">
      <span>Extension Repositories</span>
      <span id="extensionCountBadge" class="count-pill">Checking...</span>
    </div>

    <!-- 1-Click Suggestion Preset -->
    <div class="preset-section">
      <div class="preset-label">Suggested Store</div>
      <div class="preset-chip" onclick="addKeiyoushi()">
        <div class="chip-info">
          <div class="chip-title">
            <span>Keiyoushi (Official)</span>
            <span class="verified-badge" title="Verified Community Index">
              <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
            </span>
          </div>
          <div class="chip-subtitle">1,400+ Manga, Webtoon, and Comic extensions</div>
        </div>
        <div class="chip-action">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/></svg>
          <span>Add & Fetch</span>
        </div>
      </div>
    </div>

    <!-- Custom Store Input -->
    <div class="preset-section">
      <div class="preset-label">Custom Repository URL</div>
      <div class="custom-input-group">
        <input id="customRepoInput" type="text" class="custom-input" placeholder="https://raw.githubusercontent.com/.../index.min.json" />
        <button onclick="addCustomRepo()">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/></svg>
          <span>Add</span>
        </button>
      </div>
    </div>

    <!-- Action Row -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
      <button class="secondary" style="width:100%;" onclick="fetchAllExtensions()">
        <svg class="icon-svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
        <span>Fetch / Sync All Extensions</span>
      </button>
    </div>

    <!-- Feedback Banner -->
    <div id="drawerStatus" class="drawer-status">
      <svg id="statusSpinner" class="icon-svg spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="14" fill="none"/></svg>
      <span id="statusText"></span>
    </div>
  </div>

  <!-- Main View Area -->
  <div class="content-area">
    ${
      state === 'RUNNING'
        ? `<div id="iframeLoader" class="iframe-loader">
            <svg class="loader-brand" viewBox="0 0 24 24" fill="none">
              <path d="M4 19V5l4 5.5L12 5l4 5.5L20 5v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.45"/>
            </svg>
            <div class="skeleton-stack">
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
            </div>
            <div class="loader-label">Loading MangaBar WebUI…</div>
          </div>
          <iframe id="mangabarFrame" src="${serverUrl}" allow="clipboard-read; clipboard-write" onload="hideLoader()"></iframe>`
        : state === 'STARTING'
        ? `
        <div class="placeholder-card">
          <svg class="brand-icon icon-svg spin" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="14" fill="none"/></svg>
          <div class="title">Launching MangaBar Server</div>
          <div class="subtitle">Starting local background server on port ${port}...</div>
        </div>
      `
        : state === 'ERROR'
        ? `
        <div class="placeholder-card">
          <svg class="brand-icon" style="color:#ef4444;" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm9-3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-.25 3.75a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5z"/></svg>
          <div class="title" style="color:#ef4444;">Server Encountered an Error</div>
          <div class="subtitle">Check the "MangaBar Server" output log tab for details.</div>
          <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-top:4px;">
            <button onclick="send('restart')" style="padding: 6px 14px;">
              <svg class="icon-svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a7 7 0 1 1 12.07 4.95l-.71-.71A6 6 0 1 0 2 8h2l-2.5 3L-1 8h2zm14 0a7 7 0 1 1-12.07-4.95l.71.71A6 6 0 1 0 14 8h-2l2.5-3L17 8h-2z"/></svg>
              <span>Restart Server</span>
            </button>
            <button class="secondary" onclick="send('showLogs')" style="padding: 6px 12px;">
              <svg class="icon-svg" viewBox="0 0 16 16"><path d="M14.5 3H1.5A1.5 1.5 0 0 0 0 4.5v7A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 3zm.5 8.5a.5.5 0 0 1-.5.5H1.5a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v7zM3 6h2v1H3V6zm0 2h5v1H3V8zm0 2h3v1H3v-1zm7-4h3v1h-3V6zm0 2h3v1h-3V8z"/></svg>
              <span>View Logs</span>
            </button>
          </div>
        </div>
      `
        : `
        <div class="placeholder-card">
          <svg class="brand-icon" viewBox="0 0 16 16"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.492-3.287.81V2.828zm7.5 9.605c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v-9.92c-.917-.318-2.107-.69-3.287-.81-1.094-.11-2.278-.037-3.213.493v9.746zM0 2.25A1.25 1.25 0 0 1 1.25 1c1.55 0 3.05.45 4.75 1.05C7.25 2.5 8 3 8 3s.75-.5 2-.95c1.7-.6 3.2-1.05 4.75-1.05A1.25 1.25 0 0 1 16 2.25v10.5A1.25 1.25 0 0 1 14.75 14c-1.4 0-2.8-.4-4.25-.9-1-.35-1.5-.6-2.5-.6s-1.5.25-2.5.6c-1.45.5-2.85.9-4.25.9A1.25 1.25 0 0 1 0 12.75V2.25z"/></svg>
          <div class="title">MangaBar Reader</div>
          <div class="subtitle">Read manga seamlessly inside Antigravity with zero external setup.</div>
          <button style="padding: 7px 18px; font-size: 13px;" onclick="send('start')">
            <svg class="icon-svg" viewBox="0 0 16 16"><path d="M4.5 2.8c-.5-.3-1.1.1-1.1.7v9c0 .6.6 1 1.1.7l7.5-4.5c.5-.3.5-1 0-1.4l-7.5-4.5z"/></svg>
            <span>Start Server</span>
          </button>
          
          <div class="info-list">
            <div><strong>Port:</strong> ${port}</div>
            <div style="word-break: break-all;"><strong>Data:</strong> ${dataDir}</div>
            <div><strong>Sources:</strong> Keiyoushi Ready</div>
          </div>
          
          <button class="secondary" onclick="send('configureStorage')">
            <svg class="icon-svg" viewBox="0 0 16 16"><path d="M1.75 2A1.75 1.75 0 0 0 0 3.75v8.5C0 13.22.78 14 1.75 14h12.5c.97 0 1.75-.78 1.75-1.75v-6.5c0-.97-.78-1.75-1.75-1.75H8.62l-1.3-1.46A1.75 1.75 0 0 0 6.01 2H1.75zm12.5 3.5c.14 0 .25.11.25.25v6.5a.25.25 0 0 1-.25.25H1.75a.25.25 0 0 1-.25-.25v-8.5a.25.25 0 0 1 .25-.25h4.26c.46 0 .9.19 1.22.51l1.6 1.8.37.19h4.8z"/></svg>
            <span>Change Storage Folder</span>
          </button>
        </div>
      `
    }
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    function send(command, extra = {}) {
      vscode.postMessage({ command, ...extra });
    }

    function toggleDrawer() {
      const drawer = document.getElementById('storesDrawer');
      const btn = document.getElementById('toggleDrawerBtn');
      if (!drawer) return;
      const isOpen = drawer.classList.toggle('open');
      if (btn) {
        btn.classList.toggle('active-toggle', isOpen);
      }
      if (isOpen) {
        send('getStoreSummary');
      }
    }

    function addKeiyoushi() {
      send('addExtensionStore', {
        url: 'https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json'
      });
    }

    function addCustomRepo() {
      const input = document.getElementById('customRepoInput');
      if (!input || !input.value.trim()) return;
      send('addExtensionStore', { url: input.value.trim() });
      input.value = '';
    }

    function fetchAllExtensions() {
      send('fetchAllExtensions');
    }

    function setStatus(type, message) {
      const bar = document.getElementById('drawerStatus');
      const text = document.getElementById('statusText');
      const spinner = document.getElementById('statusSpinner');
      if (!bar || !text) return;

      bar.className = 'drawer-status ' + type;
      text.textContent = message;
      if (spinner) {
        spinner.style.display = type === 'loading' ? 'inline-block' : 'none';
      }
    }

    // Handle messages sent back from the extension host
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'storeSummary') {
        const badge = document.getElementById('extensionCountBadge');
        if (badge) {
          const count = msg.summary?.totalCount || 0;
          badge.textContent = count > 0 ? count + ' Extensions' : 'No Stores Added';
        }
      } else if (msg.type === 'storeOpStatus') {
        setStatus(msg.status, msg.message);
        if (msg.status === 'success' && typeof msg.totalCount === 'number') {
          const badge = document.getElementById('extensionCountBadge');
          if (badge) {
            badge.textContent = msg.totalCount + ' Extensions';
          }
          // Optionally reload the iframe to show extensions
          reloadFrame();
        }
      } else if (msg.type === 'reload') {
        reloadFrame();
      }
    });

    function reloadFrame() {
      const iframe = document.getElementById('mangabarFrame');
      if (iframe) {
        try {
          iframe.contentWindow.location.reload();
        } catch (e) {
          iframe.src = iframe.src;
        }
      } else {
        send('reload');
      }
    }

    // Hide iframe loading overlay
    function hideLoader() {
      const loader = document.getElementById('iframeLoader');
      if (loader) loader.classList.add('hidden');
    }
    // Safety timeout — hide loader after 15s even if onload doesn't fire
    ${state === 'RUNNING' ? `setTimeout(hideLoader, 15000);` : ''}

    // Initial check on load
    ${state === 'RUNNING' ? `send('getStoreSummary');` : ''}
  </script>
</body>
</html>`;
  }
}
