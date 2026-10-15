import * as vscode from 'vscode';
import { ServerManager, ServerState } from './serverManager';
import { ConfigManager } from './configManager';
import { MangaBarClient } from './mangabarClient';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'mangabar.sidebarView';
  private webviewView?: vscode.WebviewView;

  public isVisible(): boolean {
    return Boolean(this.webviewView && this.webviewView.visible);
  }

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly serverManager: ServerManager,
    private readonly configManager: ConfigManager
  ) {
    this.serverManager.onDidChangeState(() => {
      this.updateWebviewContent();
    });
    this.serverManager.onDidChangeStartupProgress((progress) => {
      if (this.webviewView && this.serverManager.getState() === 'STARTING') {
        this.webviewView.webview.postMessage({
          type: 'startupProgress',
          progress,
        });
      }
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
        case 'configureSleepTimeout':
          vscode.commands.executeCommand('mangabar.configureSleepTimeout');
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

    this.serverManager.registerActiveViewChecker(() => {
      return this.isVisible();
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.serverManager.resetIdleTimer();
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

  public async reloadView(): Promise<void> {
    if (!this.webviewView) {
      return;
    }
    const isHealthy = await this.serverManager.isServerHealthy(this.serverManager.getPort());
    if (!isHealthy) {
      this.serverManager.setOfflineState();
      this.updateWebviewContent();
      return;
    }
    this.webviewView.webview.postMessage({ type: 'reload' });
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
    .nav-cluster {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }
    .toolbar-sep {
      width: 1px;
      height: 16px;
      background: ${borderColor};
      margin: 0 3px;
      flex-shrink: 0;
    }
    .zoom-pill {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'};
      border: 1px solid ${borderColor};
      color: ${textColor};
      cursor: pointer;
      user-select: none;
      line-height: 1.2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 24px;
      transition: all 0.15s ease;
    }
    .zoom-pill:hover {
      background: ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.09)'};
      border-color: rgba(56, 189, 248, 0.5);
      color: #38bdf8;
    }
    .zoom-pill:active {
      transform: scale(0.95);
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
    
    /* 1-Click Extension Network Chip */
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
      background: ${isDark ? '#121212' : '#f5f5f5'} !important;
      color-scheme: ${isDark ? 'dark' : 'light'} !important;
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
      width: 44px;
      height: 44px;
      color: var(--vscode-button-background, #007acc);
      opacity: 0.9;
      animation: pulseGlow 2.2s infinite ease-in-out;
    }
    @keyframes pulseGlow {
      0%, 100% {
        transform: scale(1);
        opacity: 0.85;
      }
      50% {
        transform: scale(1.08);
        opacity: 1;
      }
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

    /* ── 4-Step Startup Progress Card ── */
    .startup-card {
      padding: 24px 16px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 14px;
      max-width: 320px;
      margin: 0 auto;
      user-select: none;
    }
    .startup-brand-cluster {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
    }
    .startup-brand-icon {
      width: 38px;
      height: 38px;
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
    .startup-title-stack {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .startup-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }
    .startup-detail {
      font-size: 11px;
      opacity: 0.75;
      line-height: 1.4;
      min-height: 15px;
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
      font-size: 10.5px;
      font-weight: 600;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.28);
      padding: 3px 8px;
      border-radius: 12px;
      display: none;
      align-items: center;
      gap: 5px;
      animation: fadeIn 0.2s ease;
    }
    .startup-stepper {
      width: 100%;
      background: ${cardBg};
      border: 1px solid ${borderColor};
      border-radius: 8px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      text-align: left;
    }
    .step-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      padding: 5px 6px;
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
    .step-row.completed .step-indicator {
      color: #10b981;
    }
    .step-row.active .step-indicator {
      color: #38bdf8;
    }
    .step-row.pending .step-indicator {
      color: ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'};
    }
    .step-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
    }
    .step-row.active {
      background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'};
      font-weight: 500;
    }
    .step-status-tag {
      font-size: 9.5px;
      opacity: 0.6;
      text-transform: uppercase;
      font-weight: 600;
    }
    .step-row.active .step-status-tag {
      color: #38bdf8;
      opacity: 1;
    }
    .step-row.completed .step-status-tag {
      color: #10b981;
      opacity: 0.9;
    }

    .startup-reassurance {
      font-size: 10px;
      opacity: 0.75;
      display: flex;
      align-items: center;
      gap: 5px;
      background: ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'};
      border: 1px solid ${borderColor};
      padding: 4px 8px;
      border-radius: 6px;
      line-height: 1.35;
      text-align: left;
      width: 100%;
    }
    .startup-reassurance svg {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
      color: #38bdf8;
    }

    /* ── Welcome Onboarding Banner ── */
    .welcome-banner {
      background: linear-gradient(135deg, rgba(0, 122, 204, 0.16), rgba(56, 189, 248, 0.08));
      border-bottom: 1px solid rgba(56, 189, 248, 0.3);
      padding: 7px 10px;
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      animation: fadeIn 0.3s ease;
      z-index: 8;
      flex-shrink: 0;
    }
    .welcome-left {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .welcome-sparkle {
      font-size: 13px;
      flex-shrink: 0;
    }
    .welcome-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
      line-height: 1.3;
    }
    .welcome-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .welcome-btn {
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 600;
      border-radius: 4px;
      background: #007acc;
      color: #ffffff;
      height: 22px;
    }
    .welcome-close {
      width: 20px;
      height: 20px;
      font-size: 10px;
      padding: 0;
      opacity: 0.65;
    }
  </style>
</head>
<body>

  <!-- Top Controls Bar -->
  <div class="header-bar">
    <div class="nav-cluster">
      ${
        state === 'RUNNING'
          ? `
          <button class="secondary icon-btn" id="btnNavBack" title="Back to Manga (Backspace / B / Alt+Left)" onclick="navBack()">
            <svg class="icon-svg" viewBox="0 0 16 16"><path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L4.31 7.5h8.94a.75.75 0 0 1 0 1.5H4.31l3.47 3.47a.75.75 0 0 1 0 1.06z"/></svg>
          </button>
          <button class="secondary icon-btn" id="btnNavForward" title="Forward (Alt+Right)" onclick="navForward()">
            <svg class="icon-svg" viewBox="0 0 16 16"><path d="M8.22 3.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.69 8.5H2.75a.75.75 0 0 1 0-1.5h8.94L8.22 3.53a.75.75 0 0 1 0-1.06z"/></svg>
          </button>
          <button class="secondary icon-btn" id="btnNavHome" title="Library Home (H)" onclick="navHome()">
            <svg class="icon-svg" viewBox="0 0 16 16"><path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 2 7.5V14a1 1 0 0 0 1 1h2.5a.5.5 0 0 0 .5-.5V11h4v3.5a.5.5 0 0 0 .5.5H13a1 1 0 0 0 1-1V7.5a.5.5 0 0 0 .354-.854l-6-6z"/></svg>
          </button>
          <button class="secondary icon-btn" id="btnNavSearch" title="Search Manga Across All Sources (/ or S)" onclick="navSearch()">
            <svg class="icon-svg" viewBox="0 0 24 24"><path d="M19.3 16.9c.4-.7.7-1.5.7-2.4 0-2.5-2-4.5-4.5-4.5S11 12 11 14.5s2 4.5 4.5 4.5c.9 0 1.7-.3 2.4-.7l3.2 3.2 1.4-1.4zm-3.8.1c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5M12 20v2C6.48 22 2 17.52 2 12S6.48 2 12 2c4.84 0 8.87 3.44 9.8 8h-2.07c-.64-2.46-2.4-4.47-4.73-5.41V5c0 1.1-.9 2-2 2h-2v2c0 .55-.45 1-1 1H8v2h2v3H9l-4.79-4.79C4.08 10.79 4 11.38 4 12c0 4.41 3.59 8 8 8"/></svg>
          </button>
          <div class="toolbar-sep"></div>
          `
          : ''
      }
      <div class="status-badge">
        <span class="indicator ${state.toLowerCase()}"></span>
        <span>${state === 'RUNNING' ? 'Running' : state === 'STARTING' ? 'Starting...' : state === 'ERROR' ? 'Error' : 'Stopped'}</span>
        ${state === 'RUNNING' ? `<span style="opacity:0.55;">:${port}</span>` : ''}
      </div>
    </div>
    
    <div class="actions">
      ${
        state === 'RUNNING'
          ? `
          <!-- Zoom & Scroll Controls -->
          <div class="nav-cluster">
            <button class="secondary icon-btn" title="Zoom Out (-)" onclick="zoomOut()">
              <svg class="icon-svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8z"/></svg>
            </button>
            <div class="zoom-pill" id="zoomLevelDisplay" title="Click to Reset Zoom (0)" onclick="zoomReset()">100%</div>
            <button class="secondary icon-btn" title="Zoom In (+)" onclick="zoomIn()">
              <svg class="icon-svg" viewBox="0 0 16 16"><path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/></svg>
            </button>
            <button class="secondary icon-btn" title="Scroll Down (Space / ▼)" onclick="scrollDown()">
              <svg class="icon-svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1.646 6.646a.5.5 0 0 1 .708 0L8 12.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/><path fill-rule="evenodd" d="M1.646 2.646a.5.5 0 0 1 .708 0L8 8.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>
            </button>
          </div>

          <div class="toolbar-sep"></div>

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
      <div class="preset-chip" onclick="addDefaultExtensionStore()">
        <div class="chip-info">
          <div class="chip-title">
            <span>MangaBar Extension Network</span>
            <span class="verified-badge" title="Verified Extension Network">
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
              <path d="M3 8.5v8.5c2.5-1 5-.5 6 1.5V6.5C7.8 4.8 5.2 4.5 3 5.5v3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
              <path d="M21 8.5v8.5c-2.5-1-5-.5-6 1.5V6.5c1.2-1.7 3.8-2 6-1v3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
              <path d="M8.5 17.5V7l3.5 5 3.5-5v10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 14v4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M5.5 4.2C7 3.2 8.5 3.5 9.5 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M18.5 4.2c-1.5-1-3-.7-4 .3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
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
          <div class="welcome-banner" id="welcomeBanner">
            <div class="welcome-left">
              <span class="welcome-sparkle">✨</span>
              <div class="welcome-text">
                <strong>Welcome to MangaBar!</strong>
                <span>Click <b>Stores</b> above or button to add manga sources in 1 click.</span>
              </div>
            </div>
            <div class="welcome-actions">
              <button class="welcome-btn" onclick="openStoresFromBanner()">Add Sources</button>
              <button class="secondary icon-btn welcome-close" title="Dismiss" onclick="dismissWelcomeBanner()">✕</button>
            </div>
          </div>
          <iframe id="mangabarFrame" src="${serverUrl}" allow="clipboard-read; clipboard-write" onload="onIframeLoad()"></iframe>`
        : state === 'STARTING'
        ? (() => {
            const progress = this.serverManager.getStartupProgress();
            const currentStep = progress?.step || 1;
            const percent = progress?.percent || (currentStep * 25);
            const title = progress?.title || 'Starting MangaBar Engine';
            const detail = progress?.detail || 'Initializing background server daemon...';
            const dl = progress?.downloadInfo;

            return `
        <div class="startup-card">
          <div class="startup-brand-cluster">
            <div class="startup-ring"></div>
            <svg class="startup-brand-icon" viewBox="0 0 24 24" fill="none">
              <path d="M3 8.5v8.5c2.5-1 5-.5 6 1.5V6.5C7.8 4.8 5.2 4.5 3 5.5v3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
              <path d="M21 8.5v8.5c-2.5-1-5-.5-6 1.5V6.5c1.2-1.7 3.8-2 6-1v3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
              <path d="M8.5 17.5V7l3.5 5 3.5-5v10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 14v4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M5.5 4.2C7 3.2 8.5 3.5 9.5 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M18.5 4.2c-1.5-1-3-.7-4 .3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
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

          <button class="secondary" onclick="send('showLogs')" style="padding: 5px 12px; font-size:11px;">
            <svg class="icon-svg" viewBox="0 0 16 16"><path d="M14.5 3H1.5A1.5 1.5 0 0 0 0 4.5v7A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 3zm.5 8.5a.5.5 0 0 1-.5.5H1.5a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v7zM3 6h2v1H3V6zm0 2h5v1H3V8zm0 2h3v1H3v-1zm7-4h3v1h-3V6zm0 2h3v1h-3V8z"/></svg>
            <span>View Server Logs</span>
          </button>
        </div>
      `;
          })()
        : state === 'ERROR'
        ? (() => {
            const errDetail = this.serverManager.getLastErrorDetail();
            const errTitle = errDetail && errDetail.includes('Internet connection required')
              ? 'Initial Setup Requires Internet'
              : 'Server Encountered an Error';
            const errSubtitle = errDetail || 'Check the "MangaBar Server" output log tab for details.';

            return `
        <div class="placeholder-card">
          <svg class="brand-icon" style="color:#ef4444;" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm9-3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-.25 3.75a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5z"/></svg>
          <div class="title" style="color:#ef4444;">${errTitle}</div>
          <div class="subtitle" style="max-width:280px; line-height:1.4;">${errSubtitle}</div>
          <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-top:4px;">
            <button onclick="send('restart')" style="padding: 6px 14px;">
              <svg class="icon-svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a7 7 0 1 1 12.07 4.95l-.71-.71A6 6 0 1 0 2 8h2l-2.5 3L-1 8h2zm14 0a7 7 0 1 1-12.07-4.95l.71.71A6 6 0 1 0 14 8h-2l2.5-3L17 8h-2z"/></svg>
              <span>Retry Launch</span>
            </button>
            <button class="secondary" onclick="send('showLogs')" style="padding: 6px 12px;">
              <svg class="icon-svg" viewBox="0 0 16 16"><path d="M14.5 3H1.5A1.5 1.5 0 0 0 0 4.5v7A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 3zm.5 8.5a.5.5 0 0 1-.5.5H1.5a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v7zM3 6h2v1H3V6zm0 2h5v1H3V8zm0 2h3v1H3v-1zm7-4h3v1h-3V6zm0 2h3v1h-3V8z"/></svg>
              <span>View Logs</span>
            </button>
          </div>
        </div>
      `;
          })()
        : `
        <div class="placeholder-card">
          <svg class="brand-icon" viewBox="0 0 24 24" fill="none">
            <path d="M3 8.5v8.5c2.5-1 5-.5 6 1.5V6.5C7.8 4.8 5.2 4.5 3 5.5v3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M21 8.5v8.5c-2.5-1-5-.5-6 1.5V6.5c1.2-1.7 3.8-2 6-1v3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M8.5 17.5V7l3.5 5 3.5-5v10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 14v4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M5.5 4.2C7 3.2 8.5 3.5 9.5 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M18.5 4.2c-1.5-1-3-.7-4 .3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <div class="title">MangaBar Reader</div>
          <div class="subtitle">Read manga seamlessly inside your IDE with zero external setup.</div>
          <button style="padding: 7px 18px; font-size: 13px;" onclick="send('start')">
            <svg class="icon-svg" viewBox="0 0 16 16"><path d="M4.5 2.8c-.5-.3-1.1.1-1.1.7v9c0 .6.6 1 1.1.7l7.5-4.5c.5-.3.5-1 0-1.4l-7.5-4.5z"/></svg>
            <span>Start Server</span>
          </button>
          
          <div class="info-list">
            <div><strong>Port:</strong> ${port}</div>
            <div style="word-break: break-all;"><strong>Data:</strong> ${dataDir}</div>
            <div><strong>Sources:</strong> Extension Network Ready</div>
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

    function toggleDrawer(forceOpen) {
      const drawer = document.getElementById('storesDrawer');
      const btn = document.getElementById('toggleDrawerBtn');
      if (!drawer) return;
      const isOpen = forceOpen !== undefined ? forceOpen : !drawer.classList.contains('open');
      drawer.classList.toggle('open', isOpen);
      if (btn) {
        btn.classList.toggle('active-toggle', isOpen);
      }
      if (isOpen) {
        send('getStoreSummary');
      }
    }

    function checkWelcomeBanner() {
      try {
        if (!localStorage.getItem('mangabar_onboarding_dismissed')) {
          const banner = document.getElementById('welcomeBanner');
          if (banner) banner.style.display = 'flex';
        }
      } catch (_) {}
    }

    function dismissWelcomeBanner() {
      try { localStorage.setItem('mangabar_onboarding_dismissed', 'true'); } catch(_) {}
      const banner = document.getElementById('welcomeBanner');
      if (banner) banner.style.display = 'none';
    }

    function openStoresFromBanner() {
      toggleDrawer(true);
      dismissWelcomeBanner();
    }

    function addDefaultExtensionStore() {
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

    // Bridge commands to the reading frame
    function sendCmd(action) {
      const iframe = document.getElementById('mangabarFrame');
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({ type: 'mangabar_cmd', action }, '*');
        } catch (_) {}
      }
    }

    function navBack() {
      sendCmd('back');
      const iframe = document.getElementById('mangabarFrame');
      if (iframe && iframe.contentWindow) {
        try { iframe.contentWindow.history.back(); } catch (_) {}
      }
    }

    function navForward() {
      sendCmd('forward');
      const iframe = document.getElementById('mangabarFrame');
      if (iframe && iframe.contentWindow) {
        try { iframe.contentWindow.history.forward(); } catch (_) {}
      }
    }

    function navHome() {
      sendCmd('home');
    }

    function navSearch() {
      sendCmd('search');
    }

    function zoomIn() {
      sendCmd('zoomIn');
    }

    function zoomOut() {
      sendCmd('zoomOut');
    }

    function zoomReset() {
      sendCmd('zoomReset');
    }

    function scrollDown() {
      sendCmd('scrollDown');
    }

    function scrollUp() {
      sendCmd('scrollUp');
    }

    function prevPage() {
      sendCmd('prevPage');
    }

    function nextPage() {
      sendCmd('nextPage');
    }

    // Outer window key shortcuts when webview has focus
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
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
        navBack();
      } else if (e.key === 'h' || e.key === 'H') {
        navHome();
      } else if (e.key === 's' || e.key === 'S' || e.key === '/') {
        navSearch();
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

    // Handle messages sent back from the extension host and reader frame
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'startupProgress' && msg.progress) {
        const p = msg.progress;
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
      } else if (msg.type === 'storeSummary') {
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
        const loader = document.getElementById('iframeLoader');
        if (loader) loader.classList.remove('hidden');
        sendCmd('reload');
      } else if (msg.type === 'mangabar_state') {
        if (msg.mounted !== false) {
          hideLoader();
        }
        const badge = document.getElementById('zoomLevelDisplay');
        if (badge && typeof msg.zoom === 'number') {
          const pct = Math.round(msg.zoom * 100);
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
      }
    });

    let reloadFallbackTimer = null;
    let frameMountFallbackTimer = null;
    function reloadFrame() {
      const loader = document.getElementById('iframeLoader');
      if (loader) {
        loader.classList.remove('hidden');
      }
      frameLoaded = false;
      send('reload');
      sendCmd('reload');

      if (reloadFallbackTimer) clearTimeout(reloadFallbackTimer);
      reloadFallbackTimer = setTimeout(() => {
        if (!frameLoaded) {
          const iframe = document.getElementById('mangabarFrame');
          if (iframe) {
            try {
              iframe.src = iframe.src;
            } catch (_) {}
          }
        }
      }, 1200);
    }

    let frameLoaded = false;
    function hideLoader() {
      frameLoaded = true;
      if (reloadFallbackTimer) {
        clearTimeout(reloadFallbackTimer);
        reloadFallbackTimer = null;
      }
      if (frameMountFallbackTimer) {
        clearTimeout(frameMountFallbackTimer);
        frameMountFallbackTimer = null;
      }
      const loader = document.getElementById('iframeLoader');
      if (loader) loader.classList.add('hidden');
      checkWelcomeBanner();
    }

    function onIframeLoad() {
      // Frame finished HTML download. Only dismiss overlay once React DOM mounts or via safe 4s fallback
      if (frameMountFallbackTimer) clearTimeout(frameMountFallbackTimer);
      frameMountFallbackTimer = setTimeout(() => {
        hideLoader();
      }, 4000);
    }
    // Safety check — if frame doesn't load within 15s, show gentle reload/restart action card instead of a blank void
    ${
      state === 'RUNNING'
        ? `setTimeout(() => {
          if (!frameLoaded) {
            const loader = document.getElementById('iframeLoader');
            if (loader) {
              loader.innerHTML = \`
                <div style="text-align:center; padding: 24px 16px; display:flex; flex-direction:column; align-items:center; gap:12px;">
                  <svg style="width:36px; height:36px; color:#f59e0b;" viewBox="0 0 16 16" fill="currentColor">
                    <path fill-rule="evenodd" d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.71c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                  </svg>
                  <div style="font-size:13px; font-weight:600;">Server is initializing...</div>
                  <div style="font-size:11px; opacity:0.75; max-width:240px; line-height:1.4;">Connecting to local MangaBar engine. If the reader does not appear shortly, click Reload.</div>
                  <div style="display:flex; gap:8px; margin-top:6px;">
                    <button onclick="reloadFrame()" style="padding:5px 14px;">
                      <svg class="icon-svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
                      <span>Reload</span>
                    </button>
                    <button class="secondary" onclick="send('restart')" style="padding:5px 12px;">
                      <svg class="icon-svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a7 7 0 1 1 12.07 4.95l-.71-.71A6 6 0 1 0 2 8h2l-2.5 3L-1 8h2zm14 0a7 7 0 1 1-12.07-4.95l.71.71A6 6 0 1 0 14 8h-2l2.5-3L17 8h-2z"/></svg>
                      <span>Restart</span>
                    </button>
                  </div>
                </div>
              \`;
            }
          }
        }, 15000);`
        : ''
    }

    // Initial check on load
    ${state === 'RUNNING' ? `send('getStoreSummary'); checkWelcomeBanner();` : ''}
  </script>
</body>
</html>`;
  }
}
