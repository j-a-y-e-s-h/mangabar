import * as vscode from 'vscode';
import { ServerManager } from './serverManager';
import { ConfigManager } from './configManager';
import { SidebarProvider } from './sidebarProvider';
import { ReaderPanel } from './readerPanel';

let serverManager: ServerManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  const configManager = new ConfigManager(context);
  serverManager = new ServerManager(context);

  const sidebarProvider = new SidebarProvider(context.extensionUri, serverManager, configManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'mihon.openReader';
  statusBarItem.tooltip = 'Mihon Reader: Click to Open';
  context.subscriptions.push(statusBarItem);

  const updateStatusBar = () => {
    if (!serverManager) return;
    const state = serverManager.getState();
    const port = serverManager.getPort();

    switch (state) {
      case 'RUNNING':
        statusBarItem.text = `$(book) Mihon :${port}`;
        statusBarItem.tooltip = `Mihon Server Running on port ${port}. Click to open reader.`;
        statusBarItem.backgroundColor = undefined;
        break;
      case 'STARTING':
        statusBarItem.text = `$(sync~spin) Mihon`;
        statusBarItem.tooltip = 'Mihon Server Starting...';
        statusBarItem.backgroundColor = undefined;
        break;
      case 'ERROR':
        statusBarItem.text = `$(warning) Mihon Error`;
        statusBarItem.tooltip = 'Mihon Server encountered an error. Click to restart.';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;
      case 'STOPPED':
      default:
        statusBarItem.text = `$(book) Mihon`;
        statusBarItem.tooltip = 'Mihon Server Stopped. Click to start & open.';
        statusBarItem.backgroundColor = undefined;
        break;
    }
    statusBarItem.show();
  };

  serverManager.onDidChangeState(() => {
    updateStatusBar();
  });
  updateStatusBar();

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('mihon.openReader', async () => {
      if (!serverManager) return;
      await ReaderPanel.createOrShow(context.extensionUri, serverManager);
    }),

    vscode.commands.registerCommand('mihon.startServer', async () => {
      if (!serverManager) return;
      await serverManager.startServer();
    }),

    vscode.commands.registerCommand('mihon.stopServer', async () => {
      if (!serverManager) return;
      await serverManager.stopServer();
    }),

    vscode.commands.registerCommand('mihon.restartServer', async () => {
      if (!serverManager) return;
      await serverManager.stopServer();
      await serverManager.startServer();
    }),

    vscode.commands.registerCommand('mihon.openWebBrowser', () => {
      if (!serverManager) return;
      vscode.env.openExternal(vscode.Uri.parse(serverManager.getServerUrl()));
    }),

    vscode.commands.registerCommand('mihon.configureStorage', async () => {
      const selectedFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Storage Folder for Mihon',
      });

      if (selectedFolder && selectedFolder.length > 0) {
        const folderPath = selectedFolder[0].fsPath;
        await configManager.setCustomDataDirectory(folderPath);
        vscode.window.showInformationMessage(`Mihon storage directory set to: ${folderPath}`);
        if (serverManager && serverManager.getState() === 'RUNNING') {
          const restart = await vscode.window.showInformationMessage(
            'Restart server now to apply new storage folder?',
            'Restart',
            'Later'
          );
          if (restart === 'Restart') {
            await serverManager.stopServer();
            await serverManager.startServer();
          }
        }
      }
    })
  );
}

export async function deactivate() {
  if (serverManager) {
    await serverManager.stopServer();
    serverManager.dispose();
  }
}
