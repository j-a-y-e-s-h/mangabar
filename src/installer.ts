import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export const SERVER_VERSION = 'v2.4.2366';
export const JAR_FILENAME = `Suwayomi-Server-${SERVER_VERSION}.jar`;
export const DOWNLOAD_URL = `https://github.com/Suwayomi/Suwayomi-Server/releases/download/${SERVER_VERSION}/${JAR_FILENAME}`;

export function getBinDirectory(extensionRoot: string): string {
  const binDir = path.join(extensionRoot, 'bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
  return binDir;
}

export function getServerJarPath(extensionRoot: string): string {
  return path.join(getBinDirectory(extensionRoot), JAR_FILENAME);
}

export function isServerJarInstalled(extensionRoot: string): boolean {
  const jarPath = getServerJarPath(extensionRoot);
  if (!fs.existsSync(jarPath)) {
    return false;
  }
  const stat = fs.statSync(jarPath);
  // Official jar is ~182 MB (around 170-190 MB). A valid download must be at least 150 MB.
  return stat.size > 150 * 1024 * 1024;
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
        return reject(new Error('Too many redirects while downloading Suwayomi-Server.'));
      }

      const parsedUrl = new URL(currentUrl);
      const requester = parsedUrl.protocol === 'https:' ? https : http;

      const req = requester.get(
        currentUrl,
        {
          headers: {
            'User-Agent': 'Antigravity-Mihon-Installer',
          },
        },
        (res) => {
          // Follow HTTP redirects (301, 302, 307, 308)
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, currentUrl).toString();
            res.resume(); // consume response data to free up memory
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
                // Rename temp file to final destination atomically
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
  onProgress?: (percent: number, downloadedMB: string, totalMB: string) => void
): Promise<string> {
  const jarPath = getServerJarPath(extensionRoot);

  if (isServerJarInstalled(extensionRoot)) {
    return jarPath;
  }

  await downloadFileWithRedirects(DOWNLOAD_URL, jarPath, (downloaded, total) => {
    if (onProgress && total > 0) {
      const percent = Math.min(100, Math.round((downloaded / total) * 100));
      const downloadedMB = (downloaded / (1024 * 1024)).toFixed(1);
      const totalMB = (total / (1024 * 1024)).toFixed(1);
      onProgress(percent, downloadedMB, totalMB);
    }
  });

  return jarPath;
}
