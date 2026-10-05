/**
 * MangaBar WebUI Branding Patcher.
 * Permanently updates the Tachidesk WebUI distribution on disk so the
 * loading splash screen, favicons, app manifest, and page titles display
 * the official MangaBar logo and branding without relying solely on proxy interception.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function getWebUIDirectories() {
  const dirs = [];
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  dirs.push(path.join(localAppData, 'Tachidesk', 'webUI'));
  dirs.push(path.join(os.homedir(), '.mangabar', 'webUI'));
  dirs.push(path.join(os.homedir(), '.suwayomi', 'webUI'));
  return dirs.filter((d) => fs.existsSync(d));
}

function patchWebUI() {
  const rootDir = path.resolve(__dirname, '..');
  const iconPngPath = path.join(rootDir, 'media', 'icon.png');
  const iconSvgPath = path.join(rootDir, 'media', 'mangabar-color.svg');

  if (!fs.existsSync(iconPngPath) || !fs.existsSync(iconSvgPath)) {
    console.error('[MangaBar Patch] Missing media assets (icon.png or mangabar-color.svg).');
    return;
  }

  const iconPngBuffer = fs.readFileSync(iconPngPath);
  const iconSvgContent = fs.readFileSync(iconSvgPath, 'utf8');

  const webUIDirs = getWebUIDirectories();
  if (webUIDirs.length === 0) {
    console.log('[MangaBar Patch] No WebUI directory found on disk to patch.');
    return;
  }

  for (const webUIDir of webUIDirs) {
    console.log(`[MangaBar Patch] Patching WebUI at: ${webUIDir}`);

    // 1. Overwrite all favicon and manifest PNGs with official MangaBar PNG badge
    const pngTargets = [
      'apple-touch-icon.png',
      'favicon-96x96.png',
      'favicon.ico',
      'web-app-manifest-192x192.png',
      'web-app-manifest-512x512.png',
    ];
    for (const target of pngTargets) {
      const fullPath = path.join(webUIDir, target);
      try {
        fs.writeFileSync(fullPath, iconPngBuffer);
        console.log(`[MangaBar Patch] Updated ${target}`);
      } catch (e) {
        console.warn(`[MangaBar Patch] Failed writing ${target}:`, e.message);
      }
    }

    // 2. Overwrite favicon.svg with official MangaBar vector color SVG
    try {
      fs.writeFileSync(path.join(webUIDir, 'favicon.svg'), iconSvgContent, 'utf8');
      console.log('[MangaBar Patch] Updated favicon.svg');
    } catch (e) {
      console.warn('[MangaBar Patch] Failed writing favicon.svg:', e.message);
    }

    // 3. Patch index.html branding and title
    const indexHtmlPath = path.join(webUIDir, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      try {
        let html = fs.readFileSync(indexHtmlPath, 'utf8');
        html = html
          .replace(/<title>.*?<\/title>/gi, '<title>MangaBar</title>')
          .replace(/<meta\s+name="apple-mobile-web-app-title"\s+content=".*?"\s*\/?>/gi, '<meta name="apple-mobile-web-app-title" content="MangaBar" />')
          .replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/gi, '<meta name="description" content="MangaBar - Manga & Comic Reader" />')
          .replace(/Suwayomi(-WebUI)?/gi, 'MangaBar');
        fs.writeFileSync(indexHtmlPath, html, 'utf8');
        console.log('[MangaBar Patch] Updated index.html');
      } catch (e) {
        console.warn('[MangaBar Patch] Failed patching index.html:', e.message);
      }
    }

    // 4. Patch site.webmanifest
    const manifestPath = path.join(webUIDir, 'site.webmanifest');
    if (fs.existsSync(manifestPath)) {
      try {
        let manifest = fs.readFileSync(manifestPath, 'utf8');
        manifest = manifest
          .replace(/"name":\s*"[^"]*"/g, '"name":"MangaBar"')
          .replace(/"short_name":\s*"[^"]*"/g, '"short_name":"MangaBar"');
        fs.writeFileSync(manifestPath, manifest, 'utf8');
        console.log('[MangaBar Patch] Updated site.webmanifest');
      } catch (e) {
        console.warn('[MangaBar Patch] Failed patching site.webmanifest:', e.message);
      }
    }

    // 5. Patch index-*.js and index-legacy-*.js in assets
    const assetsDir = path.join(webUIDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      for (const file of files) {
        if (/^index(?:-legacy)?-[A-Za-z0-9_-]+\.js$/.test(file)) {
          const filePath = path.join(assetsDir, file);
          let js = fs.readFileSync(filePath, 'utf8');

          // Check if R6 / nL Suwayomi katakana icon exists or needs branding
          if (
            js.includes('26.46 38.07') ||
            js.includes('circleRingColor:e=`#35d4d5`') ||
            js.includes('circleRingColor:e="#35d4d5"') ||
            js.includes('R6=({circleRingColor:e') ||
            js.includes('nL=({circleRingColor:e')
          ) {
            console.log(`[MangaBar Patch] Patching R6 / nL splash logo in ${file}...`);

            // Modern bundle replacement (bounded by ,z6=)
            js = js.replace(
              /R6\s*=\s*\(\{circleRingColor:e[^}]*\}\)\s*=>[\s\S]*?(?=,z6=)/,
              'R6=({circleRingColor:e,circleFillColor:t,...n})=>(0,x.jsx)(rM,{viewBox:`0 0 100 100`,...n,children:(0,x.jsx)(`image`,{href:`/apple-touch-icon.png`,x:`0`,y:`0`,width:`100`,height:`100`})})'
            );

            // Legacy bundle replacement (bounded by ,e("G"))
            js = js.replace(
              /nL\s*=\s*\(\{circleRingColor:e[^}]*\}\)\s*=>[\s\S]*?(?=,e\("G"\))/,
              'nL=({circleRingColor:e,circleFillColor:t,...n})=>(0,x.jsx)(Kg,{viewBox:"0 0 100 100",...n,children:(0,x.jsx)("image",{href:"/apple-touch-icon.png",x:"0",y:"0",width:"100",height:"100"})})'
            );

            fs.writeFileSync(filePath, js, 'utf8');
            console.log(`[MangaBar Patch] Successfully patched ${file}`);
          }
        } else if (/^About(?:-legacy)?-[A-Za-z0-9_-]+\.js$/.test(file)) {
          const filePath = path.join(assetsDir, file);
          let js = fs.readFileSync(filePath, 'utf8');
          const repoUrl = 'https://github.com/j-a-y-e-s-h/mangabar';
          const discussionsUrl = 'https://github.com/j-a-y-e-s-h/mangabar/discussions';

          let patched = js
            .replace(/https:\/\/github\.com\/Suwayomi\/Suwayomi-WebUI/g, repoUrl)
            .replace(/https:\/\/github\.com\/Suwayomi\/Suwayomi-Server/g, repoUrl)
            .replace(/https:\/\/github\.com\/MangaBar\/MangaBar(?:%20| )?Engine/g, repoUrl)
            .replace(/https:\/\/github\.com\/MangaBar\/MangaBar/g, repoUrl)
            .replace(/to:w\.github/g, `to:"${repoUrl}"`)
            .replace(/secondary:w\.github/g, `secondary:"${repoUrl}"`)
            .replace(/to:U\.github/g, `to:"${repoUrl}"`)
            .replace(/secondary:U\.github/g, `secondary:"${repoUrl}"`)
            .replace(/to:w\.discord/g, `to:"${discussionsUrl}"`)
            .replace(/secondary:w\.discord/g, `secondary:"${discussionsUrl}"`)
            .replace(/to:U\.discord/g, `to:"${discussionsUrl}"`)
            .replace(/secondary:U\.discord/g, `secondary:"${discussionsUrl}"`);

          if (patched !== js) {
            fs.writeFileSync(filePath, patched, 'utf8');
            console.log(`[MangaBar Patch] Successfully branded About links in ${file}`);
          }
        }
      }
    }
  }

  console.log('[MangaBar Patch] All WebUI assets have been branded successfully.');
}

if (require.main === module) {
  patchWebUI();
}

module.exports = { patchWebUI, getWebUIDirectories };
