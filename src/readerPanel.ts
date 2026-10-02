import * as vscode from 'vscode';
import { ServerManager } from './serverManager';

export class ReaderPanel {
  public static currentPanel: ReaderPanel | undefined;
  public static readonly viewType = 'mihon.fullReader';

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
      'Mihon Reader',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    ReaderPanel.currentPanel = new ReaderPanel(panel, extensionUri, serverManager);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    serverManager: ServerManager
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.serverManager = serverManager;

    this.update();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.serverManager.onDidChangeState(() => {
      this.update();
    }, null, this.disposables);
  }

  public update() {
    const serverUrl = this.serverManager.getServerUrl();
    const isRunning = this.serverManager.getState() === 'RUNNING';

    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const bgColor = isDark ? '#141414' : '#fafafa';

    this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mihon Reader</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: ${bgColor};
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .offline {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--vscode-foreground, #ccc);
      font-family: sans-serif;
      gap: 12px;
    }
  </style>
</head>
<body>
  ${
    isRunning
      ? `<iframe src="${serverUrl}" allow="clipboard-read; clipboard-write; fullscreen"></iframe>`
      : `<div class="offline"><h2>Server is not running</h2><p>Please start the server from the Mihon sidebar view.</p></div>`
  }
</body>
</html>`;
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
