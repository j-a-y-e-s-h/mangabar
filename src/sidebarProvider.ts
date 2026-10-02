import * as vscode from 'vscode';
import { ServerManager, ServerState } from './serverManager';
import { ConfigManager } from './configManager';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'mihon.sidebarView';
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
          await this.serverManager.stopServer();
          await this.serverManager.startServer();
          break;
        case 'openFullReader':
          vscode.commands.executeCommand('mihon.openReader');
          break;
        case 'openBrowser':
          vscode.env.openExternal(vscode.Uri.parse(this.serverManager.getServerUrl()));
          break;
        case 'configureStorage':
          vscode.commands.executeCommand('mihon.configureStorage');
          break;
      }
    });

    this.updateWebviewContent();

    // Auto-start server if enabled in settings
    if (this.configManager.shouldAutoStart() && this.serverManager.getState() === 'STOPPED') {
      this.serverManager.startServer();
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

    this.webviewView.webview.html = this.getHtmlForState(state, serverUrl, port, dataDir);
  }

  private getHtmlForState(
    state: ServerState,
    serverUrl: string,
    port: number,
    dataDir: string
  ): string {
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const bgColor = isDark ? '#1e1e1e' : '#f3f3f3';
    const textColor = isDark ? '#cccccc' : '#333333';
    const cardBg = isDark ? '#252526' : '#ffffff';
    const borderColor = isDark ? '#3c3c3c' : '#e0e0e0';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mihon Sidebar</title>
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
    }
    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: ${cardBg};
      border-bottom: 1px solid ${borderColor};
      font-size: 12px;
      flex-shrink: 0;
      gap: 6px;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }
    .indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .indicator.running { background-color: #4caf50; box-shadow: 0 0 6px #4caf50; }
    .indicator.starting { background-color: #ff9800; animation: pulse 1s infinite; }
    .indicator.stopped { background-color: #9e9e9e; }
    .indicator.error { background-color: #f44336; }
    
    @keyframes pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }
    
    .actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    button {
      background: var(--vscode-button-background, #007acc);
      color: var(--vscode-button-foreground, #ffffff);
      border: none;
      padding: 5px 9px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground, #0062a3);
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
    .content-area {
      flex: 1;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      flex: 1;
    }
    .placeholder-card {
      padding: 24px 16px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 14px;
    }
    .title {
      font-size: 15px;
      font-weight: 600;
    }
    .subtitle {
      font-size: 12px;
      opacity: 0.8;
      max-width: 260px;
      line-height: 1.4;
    }
    .info-list {
      text-align: left;
      font-size: 11px;
      background: ${cardBg};
      border: 1px solid ${borderColor};
      padding: 10px 14px;
      border-radius: 6px;
      width: 100%;
      max-width: 280px;
      line-height: 1.6;
    }
  </style>
</head>
<body>

  <div class="header-bar">
    <div class="status-badge">
      <span class="indicator ${state.toLowerCase()}"></span>
      <span>${state === 'RUNNING' ? 'Running' : state === 'STARTING' ? 'Starting...' : state === 'ERROR' ? 'Error' : 'Stopped'}</span>
      ${state === 'RUNNING' ? `<span style="opacity:0.6;">:${port}</span>` : ''}
    </div>
    <div class="actions">
      ${
        state === 'RUNNING'
          ? `
          <button title="Open in Full Scale Editor Tab" onclick="send('openFullReader')">⛶ Full</button>
          <button class="secondary" title="Open in External Browser" onclick="send('openBrowser')">🌐</button>
          <button class="secondary" title="Restart Server" onclick="send('restart')">↻</button>
          <button class="secondary" title="Stop Server" onclick="send('stop')">⏹</button>
        `
          : state === 'STARTING'
          ? `<span style="font-size:11px; opacity:0.7;">Loading...</span>`
          : `
          <button onclick="send('start')">▶ Start</button>
        `
      }
    </div>
  </div>

  <div class="content-area">
    ${
      state === 'RUNNING'
        ? `<iframe src="${serverUrl}" allow="clipboard-read; clipboard-write"></iframe>`
        : state === 'STARTING'
        ? `
        <div class="placeholder-card">
          <div class="title">Launching Suwayomi Server</div>
          <div class="subtitle">Starting local background server on port ${port}...</div>
        </div>
      `
        : state === 'ERROR'
        ? `
        <div class="placeholder-card">
          <div class="title" style="color:#f44336;">Server Encountered an Error</div>
          <div class="subtitle">Check the "Mihon Server" output log tab for details.</div>
          <button onclick="send('start')">🔄 Retry Start</button>
        </div>
      `
        : `
        <div class="placeholder-card">
          <div class="title">Mihon Reader</div>
          <div class="subtitle">Read manga seamlessly inside Antigravity with zero external setup.</div>
          <button style="padding: 8px 18px; font-size: 13px;" onclick="send('start')">▶ Start Server</button>
          
          <div class="info-list">
            <div><strong>Port:</strong> ${port}</div>
            <div style="word-break: break-all;"><strong>Data:</strong> ${dataDir}</div>
            <div><strong>Sources:</strong> Keiyoushi Ready</div>
          </div>
          
          <button class="secondary" onclick="send('configureStorage')">📁 Change Storage Folder</button>
        </div>
      `
    }
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function send(command) {
      vscode.postMessage({ command });
    }
  </script>
</body>
</html>`;
  }
}
