/**
 * MangaBar Extension Live Sync Utility.
 * Automatically synchronizes compiled bundles and media assets into the
 * active Antigravity IDE installed extension directory so code and logo
 * changes immediately reflect upon 'Developer: Reload Window'.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const rootDir = path.resolve(__dirname, '..');

const extensionBases = [
  path.join(os.homedir(), '.antigravity-ide', 'extensions'),
  path.join(os.homedir(), '.antigravity', 'extensions'),
  path.join(os.homedir(), '.vscode', 'extensions'),
  path.join(os.homedir(), '.cursor', 'extensions'),
];

const candidates = [];
for (const base of extensionBases) {
  if (fs.existsSync(base)) {
    try {
      const items = fs.readdirSync(base);
      for (const item of items) {
        if (item.toLowerCase().includes('mangabar')) {
          candidates.push(path.join(base, item));
        }
      }
    } catch (e) {
      // Ignore read errors
    }
  }
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  try {
    fs.cpSync(src, dest, { recursive: true, force: true });
  } catch {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      for (const file of fs.readdirSync(src)) {
        copyRecursive(path.join(src, file), path.join(dest, file));
      }
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

let syncCount = 0;
for (const targetDir of candidates) {
  if (fs.existsSync(targetDir)) {
    console.log(`[MangaBar Sync] Updating active extension directory: ${targetDir}`);
    // 1. Copy dist/
    copyRecursive(path.join(rootDir, 'dist'), path.join(targetDir, 'dist'));
    // 2. Copy media/
    copyRecursive(path.join(rootDir, 'media'), path.join(targetDir, 'media'));
    // 3. Copy package.json
    copyRecursive(path.join(rootDir, 'package.json'), path.join(targetDir, 'package.json'));
    // 4. Copy README.md (both case variations for IDE details webview)
    copyRecursive(path.join(rootDir, 'README.md'), path.join(targetDir, 'README.md'));
    copyRecursive(path.join(rootDir, 'README.md'), path.join(targetDir, 'readme.md'));
    // 5. Copy bin/ if present in workspace and missing in target extension
    const srcBin = path.join(rootDir, 'bin');
    const targetBin = path.join(targetDir, 'bin');
    if (fs.existsSync(srcBin) && !fs.existsSync(targetBin)) {
      console.log(`[MangaBar Sync] Copying binary runtime to: ${targetBin}`);
      copyRecursive(srcBin, targetBin);
    }
    syncCount++;
  }
}

// Also ensure ~/.mangabar/bin has a copy of the server jar and jre if available
const srcBin = path.join(rootDir, 'bin');
const globalMangabarBin = path.join(os.homedir(), '.mangabar', 'bin');
if (fs.existsSync(srcBin)) {
  const globalJar = path.join(globalMangabarBin, 'mangabar-server.jar');
  if (!fs.existsSync(globalJar)) {
    console.log(`[MangaBar Sync] Ensuring global ~/.mangabar/bin runtime...`);
    copyRecursive(srcBin, globalMangabarBin);
  }
}

if (syncCount === 0) {
  console.log('[MangaBar Sync] Note: No installed extension folder matched for auto-sync.');
} else {
  console.log(`[MangaBar Sync] Successfully synced to ${syncCount} extension installation target(s).`);
}
