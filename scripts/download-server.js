const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const VERSION = 'v2.4.2366';
const JAR_NAME = `Suwayomi-Server-${VERSION}.jar`;
const DOWNLOAD_URL = `https://github.com/Suwayomi/Suwayomi-Server/releases/download/${VERSION}/${JAR_NAME}`;

const binDir = path.join(__dirname, '..', 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const targetPath = path.join(binDir, JAR_NAME);
const tempPath = `${targetPath}.tmp`;

console.log(`Checking Suwayomi-Server at: ${targetPath}`);
if (fs.existsSync(targetPath)) {
  const stat = fs.statSync(targetPath);
  if (stat.size > 150 * 1024 * 1024) {
    console.log(`Server JAR already exists (${(stat.size / 1024 / 1024).toFixed(1)} MB). Ready.`);
    process.exit(0);
  }
}

console.log(`Downloading ${JAR_NAME} from ${DOWNLOAD_URL}...`);

function get(currentUrl, redirectCount = 0) {
  if (redirectCount > 10) {
    console.error('Too many redirects');
    process.exit(1);
  }

  const parsedUrl = new URL(currentUrl);
  const client = parsedUrl.protocol === 'https:' ? https : http;

  const req = client.get(
    currentUrl,
    {
      headers: {
        'User-Agent': 'Antigravity-Mihon-Setup',
      },
    },
    (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, currentUrl).toString();
        res.resume();
        return get(nextUrl, redirectCount + 1);
      }

      if (res.statusCode !== 200) {
        console.error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
        process.exit(1);
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      let lastReport = 0;

      const fileStream = fs.createWriteStream(tempPath);

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        const now = Date.now();
        if (now - lastReport > 2000 || downloaded === total) {
          lastReport = now;
          const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
          const downMB = (downloaded / 1024 / 1024).toFixed(1);
          const totalMB = (total / 1024 / 1024).toFixed(1);
          console.log(`Progress: ${downMB} MB / ${totalMB} MB (${percent}%)`);
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => {
          if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
          }
          fs.renameSync(tempPath, targetPath);
          const finalStat = fs.statSync(targetPath);
          console.log(`Download complete! Saved to ${targetPath} (${(finalStat.size / 1024 / 1024).toFixed(1)} MB).`);
          process.exit(0);
        });
      });

      fileStream.on('error', (err) => {
        console.error('File stream error:', err);
        process.exit(1);
      });
    }
  );

  req.on('error', (err) => {
    console.error('Request error:', err);
    process.exit(1);
  });
}

get(DOWNLOAD_URL);
