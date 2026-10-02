import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class ConfigManager {
  private extensionContext: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.extensionContext = context;
  }

  public getWorkspaceRoot(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    return this.extensionContext.extensionPath;
  }

  public getConfiguredPort(): number {
    const config = vscode.workspace.getConfiguration('mihon');
    return config.get<number>('serverPort', 4567);
  }

  public getDataDirectory(): string {
    const config = vscode.workspace.getConfiguration('mihon');
    const configuredPath = config.get<string>('dataDirectory', './data');
    if (path.isAbsolute(configuredPath)) {
      return configuredPath;
    }
    return path.resolve(this.getWorkspaceRoot(), configuredPath);
  }

  public getDownloadDirectory(): string {
    const config = vscode.workspace.getConfiguration('mihon');
    const configuredPath = config.get<string>('downloadDirectory', './data/downloads');
    if (path.isAbsolute(configuredPath)) {
      return configuredPath;
    }
    return path.resolve(this.getWorkspaceRoot(), configuredPath);
  }

  public getKeiyoushiRepoUrl(): string {
    const config = vscode.workspace.getConfiguration('mihon');
    return config.get<string>(
      'keiyoushiRepo',
      'https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json'
    );
  }

  public shouldAutoStart(): boolean {
    const config = vscode.workspace.getConfiguration('mihon');
    return config.get<boolean>('autoStartServer', true);
  }

  public async setCustomDataDirectory(newPath: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('mihon');
    await config.update('dataDirectory', newPath, vscode.ConfigurationTarget.Global);
  }

  public async setCustomDownloadDirectory(newPath: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('mihon');
    await config.update('downloadDirectory', newPath, vscode.ConfigurationTarget.Global);
  }

  /**
   * Pre-seeds Suwayomi server.conf with port, downloadDir, and Keiyoushi repository
   */
  public prepareDataDirectory(port: number): string {
    const dataDir = this.getDataDirectory();
    const downloadDir = this.getDownloadDirectory();
    const repoUrl = this.getKeiyoushiRepoUrl();

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const confPath = path.join(dataDir, 'server.conf');
    let confContent = '';

    if (fs.existsSync(confPath)) {
      try {
        confContent = fs.readFileSync(confPath, 'utf8');
      } catch {
        confContent = '';
      }
    }

    // Normalized Windows backslashes to forward slashes for HOCON / config format
    const safeDataDir = dataDir.replace(/\\/g, '/');
    const safeDownloadDir = downloadDir.replace(/\\/g, '/');

    // Check or update server.conf keys
    const lines = confContent ? confContent.split('\n') : [];
    const keysToSet: Record<string, string> = {
      'server.port': `${port}`,
      'server.ip': '"127.0.0.1"',
      'server.downloadDir': `"${safeDownloadDir}"`,
      'server.extensionRepos': `["${repoUrl}"]`,
    };

    const newLines: string[] = [];
    const seenKeys = new Set<string>();

    for (const line of lines) {
      const trimmed = line.trim();
      let handled = false;
      for (const key of Object.keys(keysToSet)) {
        if (trimmed.startsWith(`${key} =`) || trimmed.startsWith(`${key}=`)) {
          newLines.push(`${key} = ${keysToSet[key]}`);
          seenKeys.add(key);
          handled = true;
          break;
        }
      }
      if (!handled) {
        newLines.push(line);
      }
    }

    for (const [key, value] of Object.entries(keysToSet)) {
      if (!seenKeys.has(key)) {
        newLines.push(`${key} = ${value}`);
      }
    }

    try {
      fs.writeFileSync(confPath, newLines.join('\n'), 'utf8');
    } catch (err) {
      console.error('Failed to write server.conf:', err);
    }

    return dataDir;
  }
}
