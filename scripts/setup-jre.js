const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const url = 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jre_x64_windows_hotspot_21.0.12.1_1.zip';
const binDir = path.resolve(__dirname, '..', 'bin');
const zipPath = path.join(binDir, 'jre21.zip');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

console.log(`Downloading JRE 21 from: ${url}`);

function download(curUrl) {
  https.get(curUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return download(res.headers.location);
    }
    if (res.statusCode !== 200) {
      console.error('Download failed with HTTP ' + res.statusCode);
      process.exit(1);
    }

    const total = parseInt(res.headers['content-length'] || '0', 10);
    let downloaded = 0;
    const file = fs.createWriteStream(zipPath);

    res.on('data', (d) => {
      downloaded += d.length;
      if (total > 0 && Math.random() < 0.05) {
        process.stdout.write(`\rProgress: ${(downloaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB (${Math.round(downloaded / total * 100)}%)`);
      }
    });

    res.pipe(file);

    file.on('finish', () => {
      file.close(() => {
        console.log('\nJRE 21 zip downloaded and closed! Extracting...');
        try {
          execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${binDir}' -Force"`, { stdio: 'inherit' });

          const items = fs.readdirSync(binDir);
          const jreDir = items.find(i => i.startsWith('jdk-21') || i.startsWith('jre-21'));
          if (jreDir) {
            const srcPath = path.join(binDir, jreDir);
            const targetPath = path.join(binDir, 'jre');
            if (fs.existsSync(targetPath)) {
              fs.rmSync(targetPath, { recursive: true, force: true });
            }
            fs.renameSync(srcPath, targetPath);
            console.log(`Portable JRE 21 established at: ${targetPath}`);
          }
          if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
          }
          console.log('Setup finished successfully.');
        } catch (e) {
          console.error('Extraction error:', e);
          process.exit(1);
        }
      });
    });
  }).on('error', (err) => {
    console.error('Network error:', err);
    process.exit(1);
  });
}

download(url);
