const child_process = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const javaCmd = path.join(root, 'bin', 'jre21', 'bin', 'java.exe');
const jarPath = path.join(root, 'bin', 'mangabar-server.jar');
const dataDir = path.join(root, 'data');
const serverPort = 4567;

console.log('[DevServer] Launching MangaBar server engine on 127.0.0.1:' + serverPort + '...');

const javaArgs = [
  '-Xmx192m',
  '-Xms32m',
  '-XX:+UseSerialGC',
  '-XX:TieredStopAtLevel=1',
  '-XX:MinHeapFreeRatio=10',
  '-XX:MaxHeapFreeRatio=20',
  '-XX:MaxMetaspaceSize=96m',
  '-XX:+UseCompressedOops',
  '-XX:+UseCompressedClassPointers',
  '--add-opens=java.base/java.lang=ALL-UNNAMED',
  '--add-opens=java.base/java.util=ALL-UNNAMED',
  '--add-opens=java.base/java.lang.reflect=ALL-UNNAMED',
  '-Djava.awt.headless=true',
  `-Dconfig.file=${path.join(dataDir, 'server.conf')}`,
  `-Dsuwayomi.tachidesk.config.server.rootDir=${dataDir}`,
  `-Dsuwayomi.tachidesk.config.server.port=${serverPort}`,
  '-Dsuwayomi.tachidesk.config.server.ip=127.0.0.1',
  '-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false',
  '-Dsuwayomi.tachidesk.config.server.systemTrayEnabled=false',
  '-Dsuwayomi.tachidesk.config.server.kcefEnabled=false',
  '-Dsuwayomi.tachidesk.config.server.webUIInterface=BROWSER',
  '-Dsuwayomi.tachidesk.config.server.webUIChannel=BUNDLED',
  '-Dsuwayomi.tachidesk.config.server.webUIUpdateCheckInterval=0.0',
  '-Dsuwayomi.tachidesk.config.server.globalUpdateInterval=0.0',
  '-cp',
  `${path.join(root, 'bin', 'classes')};${jarPath}`,
  'suwayomi.tachidesk.MainKt',
];

const child = child_process.spawn(javaCmd, javaArgs, {
  cwd: dataDir,
  windowsHide: true,
});

child.stdout.on('data', (d) => {
  const text = d.toString();
  if (text.includes('CEF is') || text.includes('listening on') || text.includes('Started') || text.includes('ERROR')) {
    process.stdout.write(`[Server] ${text}`);
  }
});

child.stderr.on('data', (d) => {
  process.stderr.write(`[Server stderr] ${d.toString()}`);
});

child.on('exit', (code, sig) => {
  console.log(`[DevServer] Process exited with code ${code}, signal ${sig}`);
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  console.log('[DevServer] Shutting down...');
  child.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  child.kill();
  process.exit(0);
});
