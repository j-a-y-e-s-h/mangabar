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
    const rawUrl = (config.get<string>('customServerUrl', '')).trim();
    if (!rawUrl) {
      return undefined;
    }
    const localPort = this.getConfiguredPort();
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();
      const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
      if ((host === '127.0.0.1' || host === 'localhost' || host === '::1') && port === localPort) {
        return undefined;
      }
    } catch {
      return undefined;
    }
    return rawUrl;
  }

  public async setCustomServerUrl(url: string): Promise<void> {
    const config = this.getConfig();
    await config.update('customServerUrl', url, vscode.ConfigurationTarget.Global);
  }

  public shouldAutoStart(): boolean {
    return this.getConfig().get<boolean>('autoStartServer', false);
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

  public getIdleSleepTimeoutMinutes(): number {
    return this.getConfig().get<number>('idleSleepTimeout', 5);
  }

  public async setIdleSleepTimeoutMinutes(minutes: number): Promise<void> {
    const config = this.getConfig();
    await config.update('idleSleepTimeout', minutes, vscode.ConfigurationTarget.Global);
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
      'server.kcefEnabled': 'false',
      'server.webUIInterface': '"BROWSER"',
      'server.webUIChannel': '"BUNDLED"',
      'server.webUIUpdateCheckInterval': '0.0',
      'server.globalUpdateInterval': '0.0',
      'server.downloadsPath': `"${safeDownloadDir}"`,
      'server.extensionStores': `["${repoUrl}"]`,
    };

    const newLines: string[] = [];
    const seenKeys = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      let handled = false;

      for (const key of Object.keys(keysToSet)) {
        if (trimmed.startsWith(`${key} =`) || trimmed.startsWith(`${key}=`)) {
          newLines.push(`${key} = ${keysToSet[key]}`);
          seenKeys.add(key);
          handled = true;

          const opensArray = trimmed.includes('[') && !trimmed.includes(']');
          const opensObject = trimmed.includes('{') && !trimmed.includes('}');

          if (key === 'server.extensionStores') {
            // Consume any dangling multi-line array URLs or closing brackets from previous rewrites
            while (i + 1 < lines.length) {
              const nextTrimmed = lines[i + 1].trim();
              if (nextTrimmed.startsWith('"') || nextTrimmed.startsWith('http') || nextTrimmed.startsWith(']') || nextTrimmed === ']') {
                i++;
                if (nextTrimmed.includes(']')) {
                  break;
                }
              } else {
                break;
              }
            }
          } else if (opensArray) {
            while (i + 1 < lines.length) {
              i++;
              if (lines[i].includes(']')) break;
            }
          } else if (opensObject) {
            while (i + 1 < lines.length) {
              i++;
              if (lines[i].includes('}')) break;
            }
          }

          break;
        }
      }

      if (!handled) {
        // Also discard any orphaned dangling array closing bracket from extensionStores
        if (trimmed.includes('List of extension store index URLs') && trimmed.startsWith(']')) {
          continue;
        }
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

    // Also sanitize external/system Tachidesk and Suwayomi config files to prevent headless browser launch crashes
    const extraConfigPaths = [
      path.join(process.env.LOCALAPPDATA || '', 'Tachidesk', 'server.conf'),
      path.join(os.homedir(), '.local', 'share', 'Tachidesk', 'server.conf'),
      path.join(os.homedir(), '.suwayomi', 'server.conf'),
    ];

    for (const extraPath of extraConfigPaths) {
      if (fs.existsSync(extraPath)) {
        try {
          let content = fs.readFileSync(extraPath, 'utf8');
          let modified = false;
          if (content.includes('server.initialOpenInBrowserEnabled = true')) {
            content = content.replace(/server\.initialOpenInBrowserEnabled\s*=\s*true/g, 'server.initialOpenInBrowserEnabled = false');
            modified = true;
          }
          if (content.includes('server.systemTrayEnabled = true')) {
            content = content.replace(/server\.systemTrayEnabled\s*=\s*true/g, 'server.systemTrayEnabled = false');
            modified = true;
          }
          if (content.includes('server.kcefEnabled = true')) {
            content = content.replace(/server\.kcefEnabled\s*=\s*true/g, 'server.kcefEnabled = false');
            modified = true;
          }
          if (modified) {
            fs.writeFileSync(extraPath, content, 'utf8');
          }
        } catch {
          // Ignore permission or file lock errors
        }
      }
    }

    return dataDir;
  }
}
