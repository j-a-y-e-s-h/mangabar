const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

function toSafePath(targetPath) {
    if (process.platform !== 'win32' || !targetPath.includes(' ') || !fs.existsSync(targetPath)) {
        return targetPath;
    }
    try {
        const isDir = fs.statSync(targetPath).isDirectory();
        const comMethod = isDir ? 'GetFolder' : 'GetFile';
        const escaped = targetPath.replace(/'/g, "''");
        const cmd = `powershell -NoProfile -Command "(New-Object -ComObject Scripting.FileSystemObject).${comMethod}('${escaped}').ShortPath"`;
        const shortPath = execSync(cmd, { windowsHide: true }).toString().trim();
        if (shortPath && fs.existsSync(shortPath)) {
            return shortPath;
        }
    } catch {
        // fallback
    }
    return targetPath;
}

async function testServer() {
    console.log('--- Testing Suwayomi Server Lifecycle ---');
    const rawJarPath = path.resolve(__dirname, '..', 'bin', 'Suwayomi-Server-v2.4.2366.jar');
    const rawTestDataDir = path.resolve(__dirname, '..', 'test-data');

    if (!fs.existsSync(rawTestDataDir)) {
        fs.mkdirSync(rawTestDataDir, { recursive: true });
    }

    const jarPath = toSafePath(rawJarPath);
    const testDataDir = toSafePath(rawTestDataDir);

    // Pre-seed config
    const confPath = path.join(rawTestDataDir, 'server.conf');
    const confContent = `server.port = 4567\nserver.downloadDir = "${path.join(rawTestDataDir, 'downloads').replace(/\\/g, '/')}"\nserver.extensionRepos = ["https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json"]\n`;
    fs.writeFileSync(confPath, confContent, 'utf8');

    const jreJava = path.resolve(__dirname, '..', 'bin', 'jre', 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    const javaCmd = fs.existsSync(jreJava) ? jreJava : 'java';

    console.log(`Starting Java with directory: ${testDataDir}`);
    console.log(`Jar path: ${jarPath}`);
    console.log(`Java command: ${javaCmd}`);

    const serverProcess = spawn(javaCmd, ['-jar', jarPath, '--server.port=4567', `--server.data-dir=${testDataDir}`], {
        cwd: testDataDir,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    console.log(`Server process spawned with PID: ${serverProcess.pid}`);

    serverProcess.stdout.on('data', (d) => {
        const text = d.toString().trim();
        if (text) console.log(`[STDOUT] ${text}`);
    });

    serverProcess.stderr.on('data', (d) => {
        const text = d.toString().trim();
        if (text) console.log(`[STDERR] ${text}`);
    });

    // Poll health endpoint (up to 45 seconds)
    let ready = false;
    for (let i = 0; i < 45; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
            const res = await new Promise((resolve, reject) => {
                const req = http.get('http://127.0.0.1:4567/api/v1/about', (res) => {
                    resolve(res.statusCode);
                });
                req.on('error', reject);
                req.setTimeout(1000, () => {
                    req.destroy();
                    reject(new Error('timeout'));
                });
            });
            if (res === 200) {
                console.log(`\nServer is HEALTHY! /api/v1/about responded with HTTP ${res}`);
                ready = true;
                break;
            }
        } catch (e) {
            process.stdout.write('.');
        }
    }

    if (!ready) {
        console.error('\nServer failed to become healthy within 45s');
    }

    // Terminate cleanly
    console.log(`\nKilling process tree for PID: ${serverProcess.pid}`);
    try {
        execSync(`taskkill /F /T /PID ${serverProcess.pid}`);
        console.log('taskkill executed successfully');
    } catch (e) {
        console.log('Error executing taskkill:', e.message);
    }

    // Clean up test data
    try {
        fs.rmSync(rawTestDataDir, { recursive: true, force: true });
        console.log('Cleaned up test data directory');
    } catch (e) {
        // Can be locked briefly
    }

    console.log('--- Test Finished Successfully ---');
    process.exit(ready ? 0 : 1);
}

testServer();
