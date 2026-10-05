import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from './configManager';
import {
  getServerJarPath,
  isServerJarInstalled,
  ensureServerJar,
  resolveJavaExecutable,
  toSafePath,
} from './installer';
import { getReaderEnhancerScript } from './readerEnhancer';
import { patchWebUIDirectories } from './webuiPatcher';

export type ServerState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR';

export class ServerManager {
  private childProcess: child_process.ChildProcess | null = null;
  private state: ServerState = 'STOPPED';
  private currentPort: number = 4567;
  private proxyServer: http.Server | null = null;
  private proxyPort: number = 0;
  private outputChannel: vscode.OutputChannel;
  private configManager: ConfigManager;
  private stateChangeEmitter = new vscode.EventEmitter<ServerState>();
  public readonly onDidChangeState = this.stateChangeEmitter.event;

  constructor(private context: vscode.ExtensionContext, configManager?: ConfigManager) {
    this.outputChannel = vscode.window.createOutputChannel('MangaBar Server');
    this.configManager = configManager || new ConfigManager(context);
    this.currentPort = this.configManager.getConfiguredPort();
  }

  public getState(): ServerState {
    return this.state;
  }

  public getPort(): number {
    return this.currentPort;
  }

  public showOutputChannel(): void {
    this.outputChannel.show();
  }

  public getServerUrl(): string {
    const custom = this.configManager.getCustomServerUrl();
    if (custom) {
      return custom.replace(/\/+$/, '');
    }
    if (this.proxyPort > 0) {
      return `http://127.0.0.1:${this.proxyPort}`;
    }
    return `http://127.0.0.1:${this.currentPort}`;
  }

  public getRawServerUrl(): string {
    const custom = this.configManager.getCustomServerUrl();
    if (custom) {
      return custom.replace(/\/+$/, '');
    }
    return `http://127.0.0.1:${this.currentPort}`;
  }

  public async startProxyServer(): Promise<number> {
    if (this.proxyServer && this.proxyPort > 0) {
      return this.proxyPort;
    }

    return new Promise((resolve) => {
      // Auto-brand WebUI cache directories on disk upon proxy startup
      try {
        patchWebUIDirectories(this.context.extensionPath, this.outputChannel);
      } catch (err: any) {
        this.outputChannel.appendLine(`[MangaBar] WebUI disk patch error: ${err.message}`);
      }

      const targetPort = this.currentPort;
      const enhancerCode = getReaderEnhancerScript();

      this.proxyServer = http.createServer((req, res) => {
        // 1. Serve enhancer script
        if (req.url === '/__mangabar_enhancer.js') {
          res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-cache',
          });
          res.end(enhancerCode);
          return;
        }

        // 1b. Serve MangaBar PNG/SVG icon for any favicon/logo/touch icon request
        const cleanUrl = (req.url || '').split('?')[0].toLowerCase();
        if (
          cleanUrl === '/__mangabar_icon.png' ||
          cleanUrl.endsWith('apple-touch-icon.png') ||
          cleanUrl.endsWith('favicon-96x96.png') ||
          cleanUrl.endsWith('web-app-manifest-192x192.png') ||
          cleanUrl.endsWith('web-app-manifest-512x512.png') ||
          cleanUrl.endsWith('logo192.png') ||
          cleanUrl.endsWith('logo512.png') ||
          cleanUrl.endsWith('favicon.ico')
        ) {
          const iconPngPath = path.join(this.context.extensionPath, 'media', 'icon.png');
          if (fs.existsSync(iconPngPath)) {
            const pngData = fs.readFileSync(iconPngPath);
            res.writeHead(200, {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=86400',
            });
            res.end(pngData);
            return;
          }
        }

        if (
          cleanUrl === '/__mangabar_icon.svg' ||
          cleanUrl.endsWith('favicon.svg') ||
          cleanUrl.includes('favicon')
        ) {
          const iconPath = path.join(this.context.extensionPath, 'media', 'mangabar-color.svg');
          if (fs.existsSync(iconPath)) {
            const svgData = fs.readFileSync(iconPath, 'utf8');
            res.writeHead(200, {
              'Content-Type': 'image/svg+xml; charset=utf-8',
              'Cache-Control': 'public, max-age=86400',
            });
            res.end(svgData);
            return;
          }
        }

        // 1c. Serve custom MangaBar webmanifest
        if (cleanUrl.includes('webmanifest') || cleanUrl.includes('manifest.json')) {
          const manifest = JSON.stringify({
            name: 'MangaBar',
            short_name: 'MangaBar',
            description: 'Manga & Comic Reader',
            icons: [
              {
                src: '/apple-touch-icon.png',
                sizes: '192x192 512x512',
                type: 'image/png',
              },
              {
                src: '/__mangabar_icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
              },
            ],
            start_url: '/',
            display: 'standalone',
            background_color: '#0d1117',
            theme_color: '#0d1117',
          });
          res.writeHead(200, {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
          });
          res.end(manifest);
          return;
        }

        // 2. Forward request to MangaBar server engine
        const headers: http.IncomingHttpHeaders = { ...req.headers, host: `127.0.0.1:${targetPort}` };
        delete headers['accept-encoding'];

        const upstream = http.request(
          {
            hostname: '127.0.0.1',
            port: targetPort,
            path: req.url,
            method: req.method,
            headers: headers,
          },
          (upstreamRes) => {
            const contentType = upstreamRes.headers['content-type'] || '';
            const isHtml = contentType.includes('text/html');
            const isReaderJs = !!req.url && /\/assets\/Reader-[A-Za-z0-9_-]+\.js(?:\?.*)?$/.test(req.url);
            const isReaderServiceJs = !!req.url && /\/assets\/ReaderService-[A-Za-z0-9_-]+\.js(?:\?.*)?$/.test(req.url);
            const isIndexJs = !!req.url && /\/assets\/index(?:-legacy)?-[A-Za-z0-9_-]+\.js(?:\?.*)?$/.test(req.url);

            if (isHtml) {
              let body = '';
              upstreamRes.setEncoding('utf8');
              upstreamRes.on('data', (chunk) => (body += chunk));
              upstreamRes.on('end', () => {
                // Deeply scrub HTML titles, favicons, meta tags, and brand strings in-flight
                body = body
                  .replace(/<title>.*?<\/title>/gi, '<title>MangaBar</title>')
                  .replace(/<meta\s+name="apple-mobile-web-app-title"\s+content=".*?"\s*\/?>/gi, '<meta name="apple-mobile-web-app-title" content="MangaBar" />')
                  .replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/gi, '<meta name="description" content="MangaBar - Manga & Comic Reader" />')
                  .replace(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/gi, '')
                  .replace(/<link[^>]*rel=["']apple-touch-icon["'][^>]*>/gi, '')
                  .replace(/https:\/\/github\.com\/(?:Suwayomi|MangaBar)\/(?:Suwayomi-)?(?:Server|WebUI|Engine|MangaBar)(?:%20| )?(?:Engine)?/gi, 'https://github.com/j-a-y-e-s-h/mangabar')
                  .replace(/https:\/\/discord\.gg\/DDZdqZWaHA/gi, 'https://github.com/j-a-y-e-s-h/mangabar/discussions')
                  .replace(/Suwayomi(-WebUI)?/gi, 'MangaBar')
                  .replace(/Suwayomi-Server/gi, 'MangaBar Engine')
                  .replace(/Suwayomi Server/gi, 'MangaBar Server')
                  .replace(/Suwayomi/gi, 'MangaBar')
                  .replace(/Tachidesk/gi, 'MangaBar Core')
                  .replace(/Tachiyomi/gi, 'MangaBar')
                  .replace(/Mihon/gi, 'MangaBar');

                // Inject proper favicon and touch icon tags in head
                const faviconTags =
                  '<link rel="icon" type="image/png" href="/apple-touch-icon.png" />' +
                  '<link rel="icon" type="image/svg+xml" href="/__mangabar_icon.svg" />' +
                  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />';
                if (body.includes('</head>')) {
                  body = body.replace('</head>', `${faviconTags}</head>`);
                }

                const injected = body.includes('</body>')
                  ? body.replace('</body>', '<script src="/__mangabar_enhancer.js"></script></body>')
                  : body + '<script src="/__mangabar_enhancer.js"></script>';
                const resHeaders = { ...upstreamRes.headers };
                delete resHeaders['content-length'];
                delete resHeaders['content-encoding'];
                resHeaders['content-type'] = 'text/html; charset=utf-8';
                res.writeHead(upstreamRes.statusCode || 200, resHeaders);
                res.end(injected);
              });
            } else if (isReaderJs || isReaderServiceJs || isIndexJs) {
              let body = '';
              upstreamRes.setEncoding('utf8');
              upstreamRes.on('data', (chunk) => (body += chunk));
              upstreamRes.on('end', () => {
                if (isReaderJs) {
                  // 1. Rewrite title from "Exit reader" to "Back to Manga"
                  body = body.replace(/title:\s*\w+\._\(\{\s*id:\s*[`'"]2mxCGH[`'"]\s*\}\)/g, 'title:"Back to Manga"');

                  // 2. Rewrite Wr exit binding in Reader-*.js so clicking the drawer back button dismisses controls instead of exiting manga
                  body = body.replace(
                    /\[\(\)\s*=>\s*\(\{\s*exit:\s*([a-zA-Z0-9_$]+)\.useExit\(\)\s*\}\)\]\s*,\s*\[[`'"]exit[`'"]\]/g,
                    '[()=>({exit:()=>{try{if(window.__MANGABAR_CLOSE_MENU__)window.__MANGABAR_CLOSE_MENU__();else{if(typeof $1!=="undefined"&&$1.updateSetting)$1.updateSetting("isStaticNav",!1);document.dispatchEvent(new KeyboardEvent("keydown",{key:"m",code:"KeyM",bubbles:!0}));document.dispatchEvent(new KeyboardEvent("keyup",{key:"m",code:"KeyM",bubbles:!0}));}}catch(_){}}})],[`exit`]'
                  );

                  // 3. Rewrite Wr button onClick directly as safeguard
                  body = body.replace(
                    /(title:\s*"Back to Manga"[\s\S]*?onClick:\s*)([a-zA-Z0-9_$]+)/g,
                    '$1()=>{try{if(window.__MANGABAR_CLOSE_MENU__)window.__MANGABAR_CLOSE_MENU__();else{document.dispatchEvent(new KeyboardEvent("keydown",{key:"m",code:"KeyM",bubbles:!0}));document.dispatchEvent(new KeyboardEvent("keyup",{key:"m",code:"KeyM",bubbles:!0}));}}catch(_){}}'
                  );
                } else if (isReaderServiceJs) {
                  // In ReaderService-*.js: Expose window.__MANGABAR_CLOSE_MENU__ and window.__MANGABAR_READER_STORE__
                  body = body.replace(
                    /([a-zA-Z0-9_$]+)=\(\)=>([a-zA-Z0-9_$]+)\.getState\(\)\.overlay/g,
                    '$1=()=>{try{if(typeof window!=="undefined"&&!window.__MANGABAR_CLOSE_MENU__){window.__MANGABAR_READER_STORE__=$2;window.__MANGABAR_CLOSE_MENU__=()=>{try{let s=$2.getState();if(s&&s.updateSetting)s.updateSetting("isStaticNav",!1);if(s&&s.overlay&&s.overlay.setIsVisible)s.overlay.setIsVisible(!1);}catch(_){try{document.dispatchEvent(new KeyboardEvent("keydown",{key:"m",code:"KeyM",bubbles:!0}));document.dispatchEvent(new KeyboardEvent("keyup",{key:"m",code:"KeyM",bubbles:!0}));}catch(__){}}};}}catch(_){};return $2.getState().overlay}'
                  );
                } else if (isIndexJs) {
                  // In index-*.js: Rewrite Suwayomi katakana circle logo in splash/loading screen with MangaBar brand badge
                  body = body.replace(
                    /R6\s*=\s*\(\{circleRingColor:e[^}]*\}\)\s*=>[\s\S]*?(?=,z6=)/,
                    'R6=({circleRingColor:e,circleFillColor:t,...n})=>(0,x.jsx)(rM,{viewBox:`0 0 100 100`,...n,children:(0,x.jsx)(`image`,{href:`/apple-touch-icon.png`,x:`0`,y:`0`,width:`100`,height:`100`})})'
                  );
                  body = body.replace(
                    /nL\s*=\s*\(\{circleRingColor:e[^}]*\}\)\s*=>[\s\S]*?(?=,e\("G"\))/,
                    'nL=({circleRingColor:e,circleFillColor:t,...n})=>(0,x.jsx)(Kg,{viewBox:"0 0 100 100",...n,children:(0,x.jsx)("image",{href:"/apple-touch-icon.png",x:"0",y:"0",width:"100",height:"100"})})'
                  );
                }

                const resHeaders = { ...upstreamRes.headers };
                delete resHeaders['content-length'];
                delete resHeaders['content-encoding'];
                delete resHeaders['etag'];
                resHeaders['content-type'] = 'application/javascript; charset=utf-8';
                resHeaders['cache-control'] = 'no-cache, no-store, must-revalidate';
                res.writeHead(upstreamRes.statusCode || 200, resHeaders);
                res.end(body);
              });
            } else {
              res.writeHead(upstreamRes.statusCode || 200, upstreamRes.headers);
              upstreamRes.pipe(res);
            }
          }
        );

        upstream.on('error', (err) => {
          if (!res.headersSent) {
            res.writeHead(502);
            res.end('Proxy error: ' + err.message);
          }
        });

        req.pipe(upstream);
      });

      this.proxyServer.on('upgrade', (req, socket, head) => {
        const proxySocket = net.connect(targetPort, '127.0.0.1', () => {
          proxySocket.write(
            `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
              Object.entries(req.headers)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                .join('\r\n') +
              '\r\n\r\n'
          );
          proxySocket.write(head);
          proxySocket.pipe(socket);
          socket.pipe(proxySocket);
        });
        proxySocket.on('error', () => socket.destroy());
      });

      this.proxyServer.listen(0, '127.0.0.1', () => {
        const addr = this.proxyServer?.address();
        if (addr && typeof addr === 'object') {
          this.proxyPort = addr.port;
          this.outputChannel.appendLine(`[MangaBar] Injected enhancer proxy listening on port ${this.proxyPort}`);
          resolve(this.proxyPort);
        } else {
          resolve(this.currentPort);
        }
      });

      this.proxyServer.on('error', (e) => {
        this.outputChannel.appendLine(`[MangaBar] Proxy server error: ${e.message}`);
        resolve(this.currentPort);
      });
    });
  }

  public stopProxyServer(): void {
    if (this.proxyServer) {
      try {
        this.proxyServer.close();
      } catch {}
      this.proxyServer = null;
      this.proxyPort = 0;
    }
  }

  private setState(newState: ServerState) {
    this.state = newState;
    this.stateChangeEmitter.fire(newState);
  }

  /**
   * Tests if MangaBar server's HTTP or GraphQL API is already alive and responding on a port.
   */
  public async isServerHealthy(port: number): Promise<boolean> {
    const url = `http://127.0.0.1:${port}/`;
    try {
      return await new Promise<boolean>((resolve) => {
        const req = http.get(url, { timeout: 1500 }, (res) => {
          res.resume();
          // Status 200 means server engine and webui are responsive
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
      });
    } catch {
      return false;
    }
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

  /**
   * Finds the PID listening on a given port on Windows/Unix.
   */
  private getListeningPid(port: number): number | null {
    try {
      if (process.platform === 'win32') {
        const out = child_process.execSync(`netstat -ano | findstr :${port}`, {
          encoding: 'utf8',
          windowsHide: true,
        });
        const lines = out.split('\n');
        for (const line of lines) {
          if (line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(pid) && pid > 0) {
              return pid;
            }
          }
        }
      } else {
        const out = child_process.execSync(`lsof -ti :${port}`, {
          encoding: 'utf8',
        });
        const pid = parseInt(out.trim(), 10);
        if (!isNaN(pid) && pid > 0) {
          return pid;
        }
      }
    } catch {
      // no process listening
    }
    return null;
  }

  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Forcefully kills a process by PID and awaits its termination.
   */
  private async forceKillPid(pid: number): Promise<void> {
    try {
      if (process.platform === 'win32') {
        child_process.execSync(`taskkill /F /T /PID ${pid}`, { windowsHide: true });
      } else {
        process.kill(-pid, 'SIGKILL');
      }
    } catch {
      // ignore if already dead
    }

    const start = Date.now();
    while (Date.now() - start < 3000) {
      if (!this.isPidAlive(pid)) {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  /**
   * Kills any process holding the specified port and awaits clearance.
   */
  private async killProcessOnPort(port: number): Promise<void> {
    const pid = this.getListeningPid(port);
    if (pid) {
      this.outputChannel.appendLine(`[MangaBar] Terminating process (PID: ${pid}) holding port ${port}...`);
      await this.forceKillPid(pid);
    }
  }

  private printMangaBarBanner(): void {
    const banner = [
      '========================================================================',
      ' __  __                         ____             ',
      '|  \\/  | __ _ _ __   __ _  __ _| __ )  __ _ _ __ ',
      '| |\\/| |/ _` | \'_ \\ / _` |/ _` |  _ \\ / _` | \'__|',
      '| |  | | (_| | | | | (_| | (_| | |_) | (_| | |   ',
      '|_|  |_|\\__,_|_| |_|\\__, |\\__,_|____/ \\__,_|_|   ',
      '                    |___/                        ',
      'MangaBar Server Engine v0.2.0 • High-Performance Manga Server',
      '========================================================================',
    ].join('\n');
    this.outputChannel.appendLine(banner);
  }

  private sanitizeLogOutput(text: string): string {
    if (!text) return text;

    const lines = text.split('\n');
    const filteredLines: string[] = [];

    for (const line of lines) {
      // Filter out ASCII art lines from upstream server banner
      if (
        /(\/ __|_|\\__ \\|\|___\/|\/__\/|\/ _ \\|suwayomi-server|tachidesk-server)/i.test(line) &&
        !line.includes('MangaBar')
      ) {
        continue;
      }

      // Rebrand string tokens
      const sanitized = line
        .replace(/Suwayomi-Server/gi, 'MangaBar Engine')
        .replace(/Suwayomi Server/gi, 'MangaBar Server')
        .replace(/Suwayomi-WebUI/gi, 'MangaBar WebUI')
        .replace(/Suwayomi/gi, 'MangaBar')
        .replace(/Tachidesk/gi, 'MangaBar Core')
        .replace(/Tachiyomi/gi, 'MangaBar')
        .replace(/suwayomi\.tachidesk/gi, 'mangabar.engine')
        .replace(/\[Mihon\]/gi, '[MangaBar]')
        .replace(/\[Mihon Error\]/gi, '[MangaBar Error]')
        .replace(/Mihon/gi, 'MangaBar');

      filteredLines.push(sanitized);
    }

    return filteredLines.join('\n');
  }

  public async startServer(): Promise<boolean> {
    if (this.state === 'RUNNING' && this.childProcess) {
      return true;
    }

    // STEP 0: Check if a custom server URL is configured
    const customUrl = this.configManager.getCustomServerUrl();
    if (customUrl) {
      this.outputChannel.appendLine(`[MangaBar] Using custom server URL: ${customUrl}`);
      this.setState('RUNNING');
      return true;
    }

    const defaultPort = this.configManager.getConfiguredPort();
    this.currentPort = defaultPort;

    // STEP 1: Check if an active server is already running on the configured port
    const alreadyHealthy = await this.isServerHealthy(this.currentPort);
    if (alreadyHealthy) {
      this.outputChannel.appendLine(
        `[MangaBar] Found existing active MangaBar server on port ${this.currentPort}. Connecting directly.`
      );
      await this.startProxyServer();
      this.setState('RUNNING');
      return true;
    }

    // STEP 2: If port is occupied by an unresponsive process or lingering zombie, clean it up
    const available = await this.isPortAvailable(this.currentPort);
    if (!available) {
      this.outputChannel.appendLine(
        `[MangaBar] Port ${this.currentPort} is busy. Checking for lingering zombie processes...`
      );
      await this.killProcessOnPort(this.currentPort);
      await new Promise((r) => setTimeout(r, 1200));

      // Re-verify port availability
      const rechecked = await this.isPortAvailable(this.currentPort);
      if (!rechecked) {
        this.setState('ERROR');
        vscode.window.showErrorMessage(
          `Port ${this.currentPort} is occupied by another application and could not be freed.`
        );
        return false;
      }
    }

    const extensionRoot = this.context.extensionPath;
    const workspaceRoot = this.configManager.getWorkspaceRoot();

    // STEP 3: Verify server jar is present (with user confirmation & custom server option)
    if (!isServerJarInstalled(extensionRoot, workspaceRoot)) {
      const choice = await vscode.window.showInformationMessage(
        'MangaBar requires the server engine binary (~60 MB). Would you like to automatically download it, or connect to an existing server?',
        { modal: true },
        'Download & Setup',
        'Use Custom Server URL',
        'Cancel'
      );

      if (choice === 'Use Custom Server URL') {
        const input = await vscode.window.showInputBox({
          prompt: 'Enter MangaBar server URL (e.g. http://127.0.0.1:4567 or remote host)',
          placeHolder: 'http://127.0.0.1:4567',
          value: 'http://127.0.0.1:4567',
        });
        if (input && input.trim()) {
          await this.configManager.setCustomServerUrl(input.trim());
          this.outputChannel.appendLine(`[MangaBar] Configured custom server URL: ${input.trim()}`);
          await this.startProxyServer();
          this.setState('RUNNING');
          return true;
        }
        this.setState('STOPPED');
        return false;
      }

      if (choice !== 'Download & Setup') {
        this.setState('STOPPED');
        return false;
      }

      this.setState('STARTING');
      this.outputChannel.appendLine('[MangaBar] Server binary missing. Starting download...');
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Downloading MangaBar Server Engine...',
            cancellable: false,
          },
          async (progress) => {
            let lastPercent = 0;
            await ensureServerJar(
              extensionRoot,
              workspaceRoot,
              (percent, downMB, totalMB) => {
                const increment = percent - lastPercent;
                lastPercent = percent;
                progress.report({
                  increment,
                  message: `${downMB} MB / ${totalMB} MB (${percent}%)`,
                });
              },
              this.configManager.getServerDownloadUrl()
            );
          }
        );
        this.outputChannel.appendLine('[MangaBar] Binary downloaded successfully.');
      } catch (err: any) {
        this.setState('ERROR');
        vscode.window.showErrorMessage(`Failed to download MangaBar server engine: ${err.message}`);
        this.outputChannel.appendLine(`[MangaBar Error] Download error: ${err.message}`);
        return false;
      }
    }

    // STEP 4: Resolve Java runtime
    let javaCmd = 'java';
    try {
      javaCmd = await resolveJavaExecutable(extensionRoot, workspaceRoot, (percent, downMB, totalMB) => {
        this.outputChannel.appendLine(`[MangaBar] Downloading Java runtime: ${downMB}/${totalMB} MB (${percent}%)`);
      });
      this.outputChannel.appendLine(`[MangaBar] Using Java runtime: ${javaCmd}`);
    } catch (javaErr: any) {
      this.outputChannel.appendLine(`[MangaBar] Java resolution notice: ${javaErr.message}`);
    }

    const rawJarPath = getServerJarPath(extensionRoot, workspaceRoot);
    const jarPath = toSafePath(rawJarPath);

    // Prepare data directory and config
    const rawDataDir = this.configManager.prepareDataDirectory(this.currentPort);
    const dataDir = toSafePath(rawDataDir);

    this.printMangaBarBanner();
    this.outputChannel.appendLine(`[MangaBar] Launching server on port ${this.currentPort}...`);
    this.outputChannel.appendLine(`[MangaBar] Data directory: ${dataDir}`);

    this.setState('STARTING');

    const javaArgs = [
      '-Djava.awt.headless=true',
      '-Dserver.initialOpenInBrowserEnabled=false',
      '-Dserver.systemTrayEnabled=false',
      '-Dsuwayomi.tachidesk.server.initialOpenInBrowserEnabled=false',
      '-Dsuwayomi.tachidesk.server.systemTrayEnabled=false',
      '-jar',
      jarPath,
      `--server.port=${this.currentPort}`,
      `--server.data-dir=${dataDir}`,
      '--server.initialOpenInBrowserEnabled=false',
      '--server.systemTrayEnabled=false',
    ];

    let lastErrorOutput = '';
    let processExitedEarly = false;
    let exitCodeResult: number | null = null;

    try {
      this.childProcess = child_process.spawn(javaCmd, javaArgs, {
        cwd: toSafePath(workspaceRoot),
        windowsHide: true,
      });

      this.childProcess.stdout?.on('data', (data) => {
        const text = this.sanitizeLogOutput(data.toString());
        if (text) {
          this.outputChannel.append(text);
        }
      });

      this.childProcess.stderr?.on('data', (data) => {
        const raw = data.toString();
        lastErrorOutput += raw;
        const text = this.sanitizeLogOutput(raw);
        if (text) {
          this.outputChannel.append(text);
        }
      });

      this.childProcess.on('exit', (code, signal) => {
        this.outputChannel.appendLine(
          `[MangaBar] Process exited with code: ${code}, signal: ${signal}`
        );
        processExitedEarly = true;
        exitCodeResult = code;
        this.childProcess = null;
        if (this.state === 'STARTING') {
          this.setState('ERROR');
        } else {
          this.setState('STOPPED');
        }
      });

      this.childProcess.on('error', (err) => {
        this.outputChannel.appendLine(`[MangaBar] Process spawn error: ${err.message}`);
        this.setState('ERROR');
        vscode.window.showErrorMessage(
          `Failed to launch MangaBar Server Engine. Error: ${err.message}`
        );
      });
    } catch (err: any) {
      this.setState('ERROR');
      vscode.window.showErrorMessage(`Failed to spawn server process: ${err.message}`);
      return false;
    }

    // Healthcheck polling with early exit detection
    const ready = await this.pollHealthcheck(
      60000,
      () => processExitedEarly,
      () => exitCodeResult,
      () => lastErrorOutput
    );

    if (ready) {
      await this.startProxyServer();
      this.setState('RUNNING');
      this.outputChannel.appendLine(`[MangaBar] Server is READY at ${this.getServerUrl()}`);
      return true;
    } else {
      this.setState('ERROR');
      return false;
    }
  }

  private async pollHealthcheck(
    timeoutMs: number,
    hasExited: () => boolean,
    getExitCode: () => number | null,
    getLastError: () => string
  ): Promise<boolean> {
    const startTime = Date.now();
    const url = `${this.getRawServerUrl()}/api/v1/about`;

    while (Date.now() - startTime < timeoutMs) {
      // Early exit detection: don't hang if process died
      if (hasExited()) {
        const code = getExitCode();
        const errDetails = getLastError().split('\n').filter(Boolean).slice(-2).join(' ') || 'Process exited prematurely.';
        this.outputChannel.appendLine(`[MangaBar] Server process terminated during startup (exit code: ${code}): ${errDetails}`);
        vscode.window.showErrorMessage(`MangaBar Server failed to start (exit code ${code}): ${errDetails}`);
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
        // continue polling
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    vscode.window.showErrorMessage('MangaBar Server failed to become responsive within timeout.');
    return false;
  }

  public async stopServer(): Promise<void> {
    const port = this.currentPort;
    this.outputChannel.appendLine(`[MangaBar] Stopping server on port ${port}...`);

    if (this.childProcess) {
      const pid = this.childProcess.pid;
      if (pid) {
        await this.forceKillPid(pid);
      }
      this.childProcess = null;
    }

    // Also check and kill any remaining process holding the port
    await this.killProcessOnPort(port);

    // Await port release
    const start = Date.now();
    while (Date.now() - start < 3000) {
      const isFree = await this.isPortAvailable(port);
      if (isFree) {
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    this.stopProxyServer();
    this.setState('STOPPED');
    this.outputChannel.appendLine('[MangaBar] Server stopped cleanly and port released.');
  }

  /**
   * Safely restarts the MangaBar server engine backend with proper lock and port clearance.
   */
  public async restartServer(): Promise<boolean> {
    this.outputChannel.appendLine('[MangaBar] Initiating safe server restart...');
    this.setState('STARTING');

    // Step 1: Cleanly stop existing server and await process termination
    await this.stopServer();

    // Step 2: Cooldown to allow OS file handles and H2 database lock (server.mv.db) to release
    this.outputChannel.appendLine('[MangaBar] Releasing database locks and network sockets...');
    await new Promise((r) => setTimeout(r, 1500));

    // Step 3: Re-verify port availability; force-kill any lingering zombie if needed
    let available = await this.isPortAvailable(this.currentPort);
    if (!available) {
      this.outputChannel.appendLine(
        `[MangaBar] Port ${this.currentPort} still busy after stop. Cleaning up lingering process...`
      );
      await this.killProcessOnPort(this.currentPort);
      await new Promise((r) => setTimeout(r, 1000));
      available = await this.isPortAvailable(this.currentPort);
    }

    this.setState('STOPPED');

    // Step 4: Start fresh server instance
    const success = await this.startServer();
    if (!success) {
      // If first attempt failed (e.g. slight lock contention), retry once more after 2s
      this.outputChannel.appendLine(
        '[MangaBar] First restart attempt did not succeed. Retrying once after clearing locks...'
      );
      await this.stopServer();
      await new Promise((r) => setTimeout(r, 2000));
      return await this.startServer();
    }
    return success;
  }

  public dispose() {
    this.stopProxyServer();
    this.stopServer();
    this.outputChannel.dispose();
    this.stateChangeEmitter.dispose();
  }
}
