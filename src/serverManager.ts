import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as http from 'http';
import * as net from 'net';
import { ConfigManager } from './configManager';
import {
  getServerJarPath,
  isServerJarInstalled,
  ensureServerJar,
  resolveJavaExecutable,
  toSafePath,
} from './installer';

export type ServerState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR';

export class ServerManager {
  private childProcess: child_process.ChildProcess | null = null;
  private state: ServerState = 'STOPPED';
  private currentPort: number = 4567;
  private outputChannel: vscode.OutputChannel;
  private configManager: ConfigManager;
  private stateChangeEmitter = new vscode.EventEmitter<ServerState>();
  public readonly onDidChangeState = this.stateChangeEmitter.event;

  constructor(private context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('Mihon Server');
    this.configManager = new ConfigManager(context);
    this.currentPort = this.configManager.getConfiguredPort();
  }

  public getState(): ServerState {
    return this.state;
  }

  public getPort(): number {
    return this.currentPort;
  }

  public getServerUrl(): string {
    return `http://127.0.0.1:${this.currentPort}`;
  }

  private setState(newState: ServerState) {
    this.state = newState;
    this.stateChangeEmitter.fire(newState);
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const tester = net
        .createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          tester.once('close', () => resolve(true)).close();
        })
        .listen(port, '127.0.0.1');
    });
  }

  private async findFreePort(startPort: number): Promise<number> {
    let port = startPort;
    while (!(await this.isPortAvailable(port))) {
      port++;
      if (port > startPort + 20) {
        throw new Error(`Could not find an available port in range ${startPort} - ${port}`);
      }
    }
    return port;
  }

  public async startServer(): Promise<boolean> {
    if (this.state === 'RUNNING' || this.state === 'STARTING') {
      return true;
    }

    const extensionRoot = this.context.extensionPath;
    const workspaceRoot = this.configManager.getWorkspaceRoot();

    // Check if server jar exists
    if (!isServerJarInstalled(extensionRoot, workspaceRoot)) {
      this.setState('STARTING');
      this.outputChannel.appendLine('[Mihon] Server binary missing. Starting download...');
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Downloading Suwayomi-Server v2.4.2366...',
            cancellable: false,
          },
          async (progress) => {
            let lastPercent = 0;
            await ensureServerJar(extensionRoot, workspaceRoot, (percent, downMB, totalMB) => {
              const increment = percent - lastPercent;
              lastPercent = percent;
              progress.report({
                increment,
                message: `${downMB} MB / ${totalMB} MB (${percent}%)`,
              });
            });
          }
        );
        this.outputChannel.appendLine('[Mihon] Binary downloaded successfully.');
      } catch (err: any) {
        this.setState('ERROR');
        vscode.window.showErrorMessage(`Failed to download Suwayomi server: ${err.message}`);
        this.outputChannel.appendLine(`[Mihon Error] Download error: ${err.message}`);
        return false;
      }
    }

    // Resolve Java 21+ executable (bundled portable or system)
    let javaCmd = 'java';
    try {
      javaCmd = await resolveJavaExecutable(extensionRoot, workspaceRoot, (percent, downMB, totalMB) => {
        this.outputChannel.appendLine(`[Mihon] Downloading Java runtime: ${downMB}/${totalMB} MB (${percent}%)`);
      });
      this.outputChannel.appendLine(`[Mihon] Using Java runtime: ${javaCmd}`);
    } catch (javaErr: any) {
      this.outputChannel.appendLine(`[Mihon] Java resolution notice: ${javaErr.message}`);
    }

    const rawJarPath = getServerJarPath(extensionRoot, workspaceRoot);
    const jarPath = toSafePath(rawJarPath);

    // Resolve port
    const defaultPort = this.configManager.getConfiguredPort();
    try {
      this.currentPort = await this.findFreePort(defaultPort);
      if (this.currentPort !== defaultPort) {
        this.outputChannel.appendLine(
          `[Mihon] Port ${defaultPort} is busy. Switched to available port ${this.currentPort}.`
        );
      }
    } catch (portErr: any) {
      this.setState('ERROR');
      vscode.window.showErrorMessage(portErr.message);
      return false;
    }

    // Prepare data directory and config
    const rawDataDir = this.configManager.prepareDataDirectory(this.currentPort);
    const dataDir = toSafePath(rawDataDir);

    this.outputChannel.appendLine(`[Mihon] Starting server on port ${this.currentPort}...`);
    this.outputChannel.appendLine(`[Mihon] Data directory: ${dataDir}`);

    this.setState('STARTING');

    const javaArgs = [
      '-jar',
      jarPath,
      `--server.port=${this.currentPort}`,
      `--server.data-dir=${dataDir}`,
    ];

    try {
      this.childProcess = child_process.spawn(javaCmd, javaArgs, {
        cwd: toSafePath(workspaceRoot),
        windowsHide: true,
      });

      this.childProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        this.outputChannel.append(text);
      });

      this.childProcess.stderr?.on('data', (data) => {
        const text = data.toString();
        this.outputChannel.append(text);
      });

      this.childProcess.on('exit', (code, signal) => {
        this.outputChannel.appendLine(
          `[Mihon] Process exited with code: ${code}, signal: ${signal}`
        );
        this.childProcess = null;
        this.setState('STOPPED');
      });

      this.childProcess.on('error', (err) => {
        this.outputChannel.appendLine(`[Mihon] Process spawn error: ${err.message}`);
        this.setState('ERROR');
        vscode.window.showErrorMessage(
          `Failed to launch Java Suwayomi Server. Error: ${err.message}`
        );
      });
    } catch (err: any) {
      this.setState('ERROR');
      vscode.window.showErrorMessage(`Failed to spawn server process: ${err.message}`);
      return false;
    }

    // Healthcheck polling (up to 90s to allow WebUI unpack on first run)
    const ready = await this.pollHealthcheck(90000);
    if (ready) {
      this.setState('RUNNING');
      this.outputChannel.appendLine(`[Mihon] Server is READY at ${this.getServerUrl()}`);
      return true;
    } else {
      this.setState('ERROR');
      this.outputChannel.appendLine(`[Mihon] Server failed to respond to healthcheck within timeout.`);
      vscode.window.showErrorMessage('Suwayomi Server failed to become responsive within timeout.');
      return false;
    }
  }

  private async pollHealthcheck(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    const url = `${this.getServerUrl()}/api/v1/about`;

    while (Date.now() - startTime < timeoutMs) {
      if (!this.childProcess) {
        return false;
      }
      try {
        const isUp = await new Promise<boolean>((resolve) => {
          const req = http.get(url, { timeout: 1500 }, (res) => {
            res.resume();
            resolve(res.statusCode === 200);
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
        });

        if (isUp) {
          return true;
        }
      } catch {
        // keep polling
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }

  public async stopServer(): Promise<void> {
    if (!this.childProcess) {
      this.setState('STOPPED');
      return;
    }

    const pid = this.childProcess.pid;
    this.outputChannel.appendLine(`[Mihon] Stopping server (PID: ${pid})...`);

    if (pid) {
      if (process.platform === 'win32') {
        try {
          child_process.execSync(`taskkill /F /T /PID ${pid}`);
        } catch {
          // ignore if already exited
        }
      } else {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          this.childProcess.kill('SIGKILL');
        }
      }
    }

    this.childProcess = null;
    this.setState('STOPPED');
    this.outputChannel.appendLine('[Mihon] Server stopped cleanly.');
  }

  public dispose() {
    this.stopServer();
    this.outputChannel.dispose();
    this.stateChangeEmitter.dispose();
  }
}
