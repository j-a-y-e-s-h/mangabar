const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN || '';
const OWNER = 'j-a-y-e-s-h';
const REPO = 'mangabar';
const TAG = 'v0.2.0';

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body || '{}'));
          } catch (_) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

function uploadAsset(uploadUrlTemplate, filePath, contentType) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(filePath);
    const uploadUrl = uploadUrlTemplate.replace(/\{(\?name,label)?\}/, `?name=${encodeURIComponent(fileName)}`);
    const parsed = new URL(uploadUrl);
    const fileSize = fs.statSync(filePath).size;
    console.log(`Uploading ${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'MangaBar-Uploader',
        'Content-Type': contentType,
        'Content-Length': fileSize,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✓ Uploaded ${fileName} successfully!`);
          resolve(body);
        } else {
          reject(new Error(`Failed uploading ${fileName}: HTTP ${res.statusCode} ${body}`));
        }
      });
    });

    req.on('error', reject);
    const stream = fs.createReadStream(filePath);
    stream.pipe(req);
  });
}

async function run() {
  console.log('[1/3] Creating GitHub Release on j-a-y-e-s-h/mangabar...');

  let release;
  try {
    release = await request(
      {
        hostname: 'api.github.com',
        path: `/repos/${OWNER}/${REPO}/releases`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'User-Agent': 'MangaBar-Uploader',
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github+json',
        },
      },
      JSON.stringify({
        tag_name: TAG,
        target_commitish: 'main',
        name: `MangaBar ${TAG} — Official Release`,
        body: `## 📖 MangaBar ${TAG}\n\nHigh-performance Manga, Manhwa & Comic reader inside your IDE (VS Code, Antigravity, Cursor, Windsurf).\n\n### 📦 Release Downloads\n- **\`antigravity-mangabar-0.2.0.vsix\`**: Installable IDE Extension package\n- **\`mangabar-server.jar\`**: Core MangaBar background server engine\n`,
        draft: false,
        prerelease: false,
      })
    );
    console.log(`✓ Created release ${release.name} (id: ${release.id})`);
  } catch (err) {
    if (err.message.includes('already_exists')) {
      console.log('Release already exists. Fetching existing release...');
      release = await request({
        hostname: 'api.github.com',
        path: `/repos/${OWNER}/${REPO}/releases/tags/${TAG}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'User-Agent': 'MangaBar-Uploader',
          'Accept': 'application/vnd.github+json',
        },
      });
    } else {
      throw err;
    }
  }

  const rootDir = path.resolve(__dirname, '..');
  const vsixPath = path.join(rootDir, 'antigravity-mangabar-0.2.0.vsix');
  const jarPath = path.join(rootDir, 'bin', 'mangabar-server.jar');

  // Upload .vsix
  if (fs.existsSync(vsixPath)) {
    console.log('[2/3] Uploading Extension .vsix package...');
    await uploadAsset(release.upload_url, vsixPath, 'application/octet-stream');
  }

  // Upload server jar
  if (fs.existsSync(jarPath)) {
    console.log('[3/3] Uploading MangaBar Server Engine JAR...');
    await uploadAsset(release.upload_url, jarPath, 'application/java-archive');
  }

  console.log('\n========================================');
  console.log('🎉 ALL RELEASES & ASSETS UPLOADED SUCCESSFULLY!');
  console.log(`👉 View Release: https://github.com/${OWNER}/${REPO}/releases/tag/${TAG}`);
  console.log('========================================');
}

run().catch((e) => {
  console.error('Error during release upload:', e.message);
  process.exit(1);
});
