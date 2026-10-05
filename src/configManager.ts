import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export class ConfigManager {
  private extensionContext: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.extensionContext = context;
  }

  private getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('mangabar');
  }

  public getWorkspaceRoot(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    return this.extensionContext.extensionPath;
  }

  public getConfiguredPort(): number {
    return this.getConfig().get<number>('serverPort', 4567);
  }

  public getDataDirectory(): string {
    const config = this.getConfig();
    const configuredPath = config.get<string>('dataDirectory');
    if (configuredPath && configuredPath !== './data') {
      if (path.isAbsolute(configuredPath)) {
        return configuredPath;
      }
      return path.resolve(this.getWorkspaceRoot(), configuredPath);
    }
    // Check if workspace has ./data or default to ~/.mangabar
    const wsData = path.resolve(this.getWorkspaceRoot(), './data');
    if (fs.existsSync(wsData)) {
      return wsData;
    }
    return path.join(os.homedir(), '.mangabar');
  }

  public getDownloadDirectory(): string {
    const config = this.getConfig();
    const configuredPath = config.get<string>('downloadDirectory');
    if (configuredPath && configuredPath !== './data/downloads') {
      if (path.isAbsolute(configuredPath)) {
        return configuredPath;
      }
      return path.resolve(this.getWorkspaceRoot(), configuredPath);
    }
    return path.join(this.getDataDirectory(), 'downloads');
  }

  public getExtensionRepoUrl(): string {
    const config = this.getConfig();
    return config.get<string>(
      'extensionRepo',
      'https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json'
    );
  }

  public getServerDownloadUrl(): string | undefined {
    const url = (this.getConfig().get<string>('serverDownloadUrl', '')).trim();
    return url.length > 0 ? url : undefined;
  }

  public getCustomServerUrl(): string | undefined {
    const config = this.getConfig();
    const url = (config.get<string>('customServerUrl', '')).trim();
    return url.length > 0 ? url : undefined;
  }

  public async setCustomServerUrl(url: string): Promise<void> {
    const config = this.getConfig();
    await config.update('customServerUrl', url, vscode.ConfigurationTarget.Global);
  }

  public shouldAutoStart(): boolean {
    return this.getConfig().get<boolean>('autoStartServer', true);
  }

  public async setCustomDataDirectory(newPath: string): Promise<void> {
    const config = this.getConfig();
    await config.update('dataDirectory', newPath, vscode.ConfigurationTarget.Global);
  }

  public async setCustomDownloadDirectory(newPath: string): Promise<void> {
    const config = this.getConfig();
    await config.update('downloadDirectory', newPath, vscode.ConfigurationTarget.Global);
  }

  public getSideBarLocation(): 'left' | 'right' {
    return this.getConfig().get<'left' | 'right'>('sideBarLocation', 'left');
  }

  public async setSideBarLocation(location: 'left' | 'right'): Promise<void> {
    const config = this.getConfig();
    await config.update('sideBarLocation', location, vscode.ConfigurationTarget.Global);
  }

  /**
   * Pre-seeds server.conf with port, downloadDir, and extension repository.
   */
  public prepareDataDirectory(port: number): string {
    const dataDir = this.getDataDirectory();
    const downloadDir = this.getDownloadDirectory();
    const repoUrl = this.getExtensionRepoUrl();
    const legacyDataHome = path.join(os.homedir(), '.suwayomi');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });

      if (fs.existsSync(legacyDataHome)) {
        try {
          const files = fs.readdirSync(legacyDataHome);
          for (const file of files) {
            const src = path.join(legacyDataHome, file);
            const dst = path.join(dataDir, file);
            if (!fs.existsSync(dst) && !file.includes('lock')) {
              try {
                if (fs.statSync(src).isDirectory()) {
                  fs.cpSync(src, dst, { recursive: true });
                } else {
                  fs.copyFileSync(src, dst);
                }
              } catch {}
            }
          }
          console.log('[MangaBar] Seamlessly migrated user database from legacy directory.');
        } catch (migErr) {
          console.error('[MangaBar] Migration notice:', migErr);
        }
      }
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

    const safeDataDir = dataDir.replace(/\\/g, '/');
    const safeDownloadDir = downloadDir.replace(/\\/g, '/');

    const lines = confContent ? confContent.split('\n') : [];
    const keysToSet: Record<string, string> = {
      'server.port': `${port}`,
      'server.ip': '"127.0.0.1"',
      'server.initialOpenInBrowserEnabled': 'false',
      'server.systemTrayEnabled': 'false',
      'server.downloadsPath': `"${safeDownloadDir}"`,
      'server.extensionStores': `["${repoUrl}"]`,
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
