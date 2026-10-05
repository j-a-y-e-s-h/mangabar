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
const candidates = [
  path.join(os.homedir(), '.antigravity-ide', 'extensions', 'local-developer.antigravity-mangabar-0.2.0'),
  path.join(os.homedir(), '.antigravity', 'extensions', 'local-developer.antigravity-mangabar-0.2.0'),
  path.join(os.homedir(), '.vscode', 'extensions', 'local-developer.antigravity-mangabar-0.2.0'),
];

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
    syncCount++;
  }
}

if (syncCount === 0) {
  console.log('[MangaBar Sync] Note: No installed extension folder matched for auto-sync.');
} else {
  console.log(`[MangaBar Sync] Successfully synced to ${syncCount} extension installation target(s).`);
}
