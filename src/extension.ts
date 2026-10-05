import * as vscode from 'vscode';
import { ServerManager } from './serverManager';
import { ConfigManager } from './configManager';
import { SidebarProvider } from './sidebarProvider';
import { ReaderPanel } from './readerPanel';

let serverManager: ServerManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  const configManager = new ConfigManager(context);
  serverManager = new ServerManager(context, configManager);

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
  statusBarItem.command = 'mangabar.toggleReader';
  statusBarItem.tooltip = 'MangaBar Reader: Click to Toggle (Ctrl+Alt+M)';
  context.subscriptions.push(statusBarItem);

  const updateStatusBar = () => {
    if (!serverManager) return;
    const state = serverManager.getState();
    const port = serverManager.getPort();

    switch (state) {
      case 'RUNNING':
        statusBarItem.text = `$(book) MangaBar :${port}`;
        statusBarItem.tooltip = `MangaBar Server Running on port ${port}. Click to toggle reader (Ctrl+Alt+M).`;
        statusBarItem.backgroundColor = undefined;
        break;
      case 'STARTING':
        statusBarItem.text = `$(sync~spin) MangaBar`;
        statusBarItem.tooltip = 'MangaBar Server Starting...';
        statusBarItem.backgroundColor = undefined;
        break;
      case 'ERROR':
        statusBarItem.text = `$(warning) MangaBar Error`;
        statusBarItem.tooltip = 'MangaBar Server encountered an error. Click to restart.';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;
      case 'STOPPED':
      default:
        statusBarItem.text = `$(book) MangaBar`;
        statusBarItem.tooltip = 'MangaBar Server Stopped. Click to start & open.';
        statusBarItem.backgroundColor = undefined;
        break;
    }
    statusBarItem.show();
  };

  serverManager.onDidChangeState(() => {
    updateStatusBar();
  });
  updateStatusBar();

  // Primary MangaBar Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('mangabar.toggleReader', async () => {
      if (!serverManager) return;
      await ReaderPanel.toggle(context.extensionUri, serverManager);
    }),

    vscode.commands.registerCommand('mangabar.toggleSidebar', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.mangabar-sidebar');
    }),

    vscode.commands.registerCommand('mangabar.toggleSideBarLocation', async () => {
      const currentLocation = configManager.getSideBarLocation();
      const newLocation = currentLocation === 'left' ? 'right' : 'left';
      await configManager.setSideBarLocation(newLocation);

      // Ensure the target side bar is visible
      if (newLocation === 'right') {
        try {
          await vscode.commands.executeCommand('workbench.action.toggleAuxiliaryBar');
        } catch {}
      }

      if (newLocation === 'right') {
        vscode.window.showInformationMessage(
          'MangaBar moved to Right Side Bar. If it did not move, drag the book icon in the Activity Bar to the right panel.',
          'Got it'
        );
      } else {
        vscode.window.showInformationMessage(
          'MangaBar moved to Left Activity Bar. If it did not move, drag the book icon to the left Activity Bar.',
          'Got it'
        );
      }
    }),

    vscode.commands.registerCommand('mangabar.openReader', async () => {
      if (!serverManager) return;
      await ReaderPanel.createOrShow(context.extensionUri, serverManager);
    }),

    vscode.commands.registerCommand('mangabar.startServer', async () => {
      if (!serverManager) return;
      await serverManager.startServer();
    }),

    vscode.commands.registerCommand('mangabar.stopServer', async () => {
      if (!serverManager) return;
      await serverManager.stopServer();
    }),

    vscode.commands.registerCommand('mangabar.reloadView', () => {
      sidebarProvider.reloadView();
      if (ReaderPanel.currentPanel) {
        ReaderPanel.currentPanel.reload();
      }
      vscode.window.setStatusBarMessage('$(refresh) MangaBar views reloaded', 2000);
    }),

    vscode.commands.registerCommand('mangabar.restartServer', async () => {
      if (!serverManager) return;
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'MangaBar: Restarting Server...',
          cancellable: false,
        },
        async (progress) => {
          if (!serverManager) return;
          progress.report({ message: 'Releasing locks & terminating process...' });
          const success = await serverManager.restartServer();
          sidebarProvider.reloadView();
          if (ReaderPanel.currentPanel) {
            ReaderPanel.currentPanel.reload();
          }
          if (success) {
            vscode.window.showInformationMessage('MangaBar Server restarted successfully.');
          }
        }
      );
    }),

    vscode.commands.registerCommand('mangabar.openWebBrowser', () => {
      if (!serverManager) return;
      vscode.env.openExternal(vscode.Uri.parse(serverManager.getServerUrl()));
    }),

    vscode.commands.registerCommand('mangabar.configureStorage', async () => {
      const selectedFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Storage Folder for MangaBar',
      });

      if (selectedFolder && selectedFolder.length > 0) {
        const folderPath = selectedFolder[0].fsPath;
        await configManager.setCustomDataDirectory(folderPath);
        vscode.window.showInformationMessage(`MangaBar storage directory set to: ${folderPath}`);
        if (serverManager && serverManager.getState() === 'RUNNING') {
          const restart = await vscode.window.showInformationMessage(
            'Restart server now to apply new storage folder?',
            'Restart',
            'Later'
          );
          if (restart === 'Restart') {
            await serverManager.restartServer();
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
