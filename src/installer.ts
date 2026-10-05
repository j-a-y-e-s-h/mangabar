import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as child_process from 'child_process';
import { URL } from 'url';

export const SERVER_VERSION = 'v2.4.2366';
export const RELEASE_TAG = 'v0.2.0';
export const JAR_FILENAME = 'mangabar-server.jar';
export const DEFAULT_SERVER_DOWNLOAD_URL = `https://github.com/j-a-y-e-s-h/mangabar/releases/download/${RELEASE_TAG}/mangabar-server.jar`;
export const FALLBACK_SERVER_DOWNLOAD_URL = `https://github.com/Suwayomi/Suwayomi-Server/releases/download/${SERVER_VERSION}/Suwayomi-Server-${SERVER_VERSION}.jar`;
export const ADOPTIUM_JRE21_URL =
  'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jre_x64_windows_hotspot_21.0.12.1_1.zip';

export function getBinDirectory(extensionRoot: string): string {
  const binDir = path.join(extensionRoot, 'bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
  return binDir;
}

export function getServerJarPath(extensionRoot: string, workspaceRoot?: string): string {
  const candidateDirs = [
    path.join(extensionRoot, 'bin'),
    workspaceRoot ? path.join(workspaceRoot, 'bin') : null,
  ].filter(Boolean) as string[];

  // 1. Check if mangabar-server.jar exists in any candidate dir
  for (const dir of candidateDirs) {
    const jar = path.join(dir, JAR_FILENAME);
    if (fs.existsSync(jar) && fs.statSync(jar).size > 150 * 1024 * 1024) {
      return jar;
    }
  }

  // 2. Check if any valid server engine jar exists and rename to mangabar-server.jar
  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.jar') && file !== JAR_FILENAME) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).size > 150 * 1024 * 1024) {
          const preferred = path.join(dir, JAR_FILENAME);
          try {
            fs.copyFileSync(fullPath, preferred);
            return preferred;
          } catch {
            return fullPath;
          }
        }
      }
    }
  }

  return path.join(extensionRoot, 'bin', JAR_FILENAME);
}

export function isServerJarInstalled(extensionRoot: string, workspaceRoot?: string): boolean {
  const jarPath = getServerJarPath(extensionRoot, workspaceRoot);
  if (!fs.existsSync(jarPath)) {
    return false;
  }
  const stat = fs.statSync(jarPath);
  return stat.size > 150 * 1024 * 1024;
}

/**
 * On Windows, paths containing spaces can break ClassGraph inside fat JARs.
 * Converting to an 8.3 short path resolves this reliably.
 */
export function toSafePath(targetPath: string): string {
  if (process.platform !== 'win32' || !targetPath.includes(' ') || !fs.existsSync(targetPath)) {
    return targetPath;
  }
  try {
    const isDir = fs.statSync(targetPath).isDirectory();
    const comMethod = isDir ? 'GetFolder' : 'GetFile';
    const escaped = targetPath.replace(/'/g, "''");
    const cmd = `powershell -NoProfile -Command "(New-Object -ComObject Scripting.FileSystemObject).${comMethod}('${escaped}').ShortPath"`;
    const shortPath = child_process.execSync(cmd, { windowsHide: true }).toString().trim();
    if (shortPath && fs.existsSync(shortPath)) {
      return shortPath;
    }
  } catch {
    // fallback to original path
  }
  return targetPath;
}

export function checkJavaVersion(javaExecutable: string): number | null {
  try {
    const res = child_process.spawnSync(javaExecutable, ['-version'], { windowsHide: true });
    const output = (res.stderr?.toString() || '') + (res.stdout?.toString() || '');
    // Regex matches e.g. 'openjdk version "21.0.12"' or 'java version "17.0.1"'
    const match = output.match(/version "(?:1\.)?(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  } catch {
    // not executable
  }
  return null;
}

export function findLocalJreExecutable(extensionRoot: string, workspaceRoot?: string): string | null {
  const exeName = process.platform === 'win32' ? 'java.exe' : 'java';
  const candidates = [
    path.join(extensionRoot, 'bin', 'jre', 'bin', exeName),
    path.join(extensionRoot, 'jre', 'bin', exeName),
  ];
  if (workspaceRoot) {
    candidates.push(path.join(workspaceRoot, 'bin', 'jre', 'bin', exeName));
    candidates.push(path.join(workspaceRoot, 'jre', 'bin', exeName));
  }

  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      const ver = checkJavaVersion(cand);
      if (ver && ver >= 21) {
        return cand;
      }
    }
  }
  return null;
}

export async function resolveJavaExecutable(
  extensionRoot: string,
  workspaceRoot?: string,
  onProgress?: (percent: number, downloadedMB: string, totalMB: string) => void
): Promise<string> {
  // 1. Check portable bundled JRE in extension or workspace
  const localJre = findLocalJreExecutable(extensionRoot, workspaceRoot);
  if (localJre) {
    return localJre;
  }

  // 2. Check JAVA_HOME
  if (process.env.JAVA_HOME) {
    const javaHomeExe = path.join(
      process.env.JAVA_HOME,
      'bin',
      process.platform === 'win32' ? 'java.exe' : 'java'
    );
    if (fs.existsSync(javaHomeExe)) {
      const ver = checkJavaVersion(javaHomeExe);
      if (ver && ver >= 21) {
        return javaHomeExe;
      }
    }
  }

  // 3. Check system PATH 'java'
  const sysVer = checkJavaVersion('java');
  if (sysVer && sysVer >= 21) {
    return 'java';
  }

  // 4. If on Windows and Java 21 is missing, download portable Adoptium JRE 21 into extensionRoot/bin/jre
  if (process.platform === 'win32') {
    const binDir = getBinDirectory(extensionRoot);
    const zipPath = path.join(binDir, 'jre21.zip');
    const jreTarget = path.join(binDir, 'jre');

    await downloadFileWithRedirects(ADOPTIUM_JRE21_URL, zipPath, (downloaded, total) => {
      if (onProgress && total > 0) {
        const percent = Math.min(100, Math.round((downloaded / total) * 100));
        const downMB = (downloaded / (1024 * 1024)).toFixed(1);
        const totMB = (total / (1024 * 1024)).toFixed(1);
        onProgress(percent, downMB, totMB);
      }
    });

    // Extract zip via PowerShell
    child_process.execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${binDir}' -Force"`,
      { windowsHide: true }
    );

    // Locate extracted directory and rename to 'jre'
    const items = fs.readdirSync(binDir);
    const extractedDir = items.find((i) => i.startsWith('jdk-21') || i.startsWith('jre-21'));
    if (extractedDir) {
      const srcPath = path.join(binDir, extractedDir);
      if (fs.existsSync(jreTarget)) {
        fs.rmSync(jreTarget, { recursive: true, force: true });
      }
      fs.renameSync(srcPath, jreTarget);
    }
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    const jreExe = path.join(jreTarget, 'bin', 'java.exe');
    if (fs.existsSync(jreExe)) {
      return jreExe;
    }
  }

  // Fallback to system java command
  return 'java';
}

export async function downloadFileWithRedirects(
  targetUrl: string,
  destPath: string,
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
): Promise<void> {
  const tempPath = `${destPath}.tmp`;
  if (fs.existsSync(tempPath)) {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // ignore
    }
  }

  return new Promise<void>((resolve, reject) => {
    function get(currentUrl: string, redirectCount = 0) {
      if (redirectCount > 10) {
        return reject(new Error('Too many redirects while downloading file.'));
      }

      const parsedUrl = new URL(currentUrl);
      const requester = parsedUrl.protocol === 'https:' ? https : http;

      const req = requester.get(
        currentUrl,
        {
          headers: {
            'User-Agent': 'MangaBar-Installer',
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, currentUrl).toString();
            res.resume();
            return get(redirectUrl, redirectCount + 1);
          }

          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`Download failed with HTTP status code ${res.statusCode}: ${res.statusMessage}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let downloadedBytes = 0;

          const fileStream = fs.createWriteStream(tempPath);

          res.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            if (onProgress && totalBytes > 0) {
              onProgress(downloadedBytes, totalBytes);
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close((err) => {
              if (err) {
                return reject(err);
              }
              try {
                if (fs.existsSync(destPath)) {
                  fs.unlinkSync(destPath);
                }
                fs.renameSync(tempPath, destPath);
                resolve();
              } catch (renameErr) {
                reject(renameErr);
              }
            });
          });

          fileStream.on('error', (err) => {
            try {
              if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
              }
            } catch {
              // ignore
            }
            reject(err);
          });
        }
      );

      req.on('error', (err) => {
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch {
          // ignore
        }
        reject(err);
      });
    }

    get(targetUrl);
  });
}

export async function ensureServerJar(
  extensionRoot: string,
  workspaceRoot?: string,
  onProgress?: (percent: number, downloadedMB: string, totalMB: string) => void,
  customDownloadUrl?: string
): Promise<string> {
  const jarPath = getServerJarPath(extensionRoot, workspaceRoot);

  if (isServerJarInstalled(extensionRoot, workspaceRoot)) {
    return jarPath;
  }

  const downloadUrl = customDownloadUrl || DEFAULT_SERVER_DOWNLOAD_URL;

  try {
    await downloadFileWithRedirects(downloadUrl, jarPath, (downloaded, total) => {
      if (onProgress && total > 0) {
        const percent = Math.min(100, Math.round((downloaded / total) * 100));
        const downloadedMB = (downloaded / (1024 * 1024)).toFixed(1);
        const totalMB = (total / (1024 * 1024)).toFixed(1);
        onProgress(percent, downloadedMB, totalMB);
      }
    });
  } catch (err: any) {
    if (!customDownloadUrl && downloadUrl !== FALLBACK_SERVER_DOWNLOAD_URL) {
      // Fallback to upstream release asset if GitHub repo release is pending
      await downloadFileWithRedirects(FALLBACK_SERVER_DOWNLOAD_URL, jarPath, (downloaded, total) => {
        if (onProgress && total > 0) {
          const percent = Math.min(100, Math.round((downloaded / total) * 100));
          const downloadedMB = (downloaded / (1024 * 1024)).toFixed(1);
          const totalMB = (total / (1024 * 1024)).toFixed(1);
          onProgress(percent, downloadedMB, totalMB);
        }
      });
    } else {
      throw err;
    }
  }

  return jarPath;
}
