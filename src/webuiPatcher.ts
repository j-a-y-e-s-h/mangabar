import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

export function getWebUIDirectories(): string[] {
  const dirs: string[] = [];
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  dirs.push(path.join(localAppData, 'Tachidesk', 'webUI'));
  dirs.push(path.join(localAppData, 'Temp', 'Tachidesk', 'webUI-serve'));
  dirs.push(path.join(os.tmpdir(), 'Tachidesk', 'webUI-serve'));
  dirs.push(path.join(os.homedir(), '.mangabar', 'webUI'));
  dirs.push(path.join(os.homedir(), '.suwayomi', 'webUI'));
  return dirs.filter((d) => fs.existsSync(d));
}

export function patchWebUIDirectories(extensionPath: string, outputChannel?: vscode.OutputChannel): void {
  const iconPngPath = path.join(extensionPath, 'media', 'icon.png');
  const iconSvgPath = path.join(extensionPath, 'media', 'mangabar-color.svg');

  if (!fs.existsSync(iconPngPath) || !fs.existsSync(iconSvgPath)) {
    outputChannel?.appendLine('[MangaBar] WebUI patcher: Media assets (icon.png or mangabar-color.svg) not found.');
    return;
  }

  const iconPngBuffer = fs.readFileSync(iconPngPath);
  const iconSvgContent = fs.readFileSync(iconSvgPath, 'utf8');

  const webUIDirs = getWebUIDirectories();
  if (webUIDirs.length === 0) {
    outputChannel?.appendLine('[MangaBar] WebUI patcher: No WebUI directory currently exists on disk.');
    return;
  }

  for (const webUIDir of webUIDirs) {
    outputChannel?.appendLine(`[MangaBar] Branding WebUI cache directory: ${webUIDir}`);

    // 1. Overwrite all favicon and manifest PNGs with MangaBar PNG badge
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
      } catch (e: any) {
        outputChannel?.appendLine(`[MangaBar] Warning writing ${target}: ${e.message}`);
      }
    }

    // 2. Overwrite favicon.svg with official MangaBar vector color SVG
    try {
      fs.writeFileSync(path.join(webUIDir, 'favicon.svg'), iconSvgContent, 'utf8');
    } catch (e: any) {
      outputChannel?.appendLine(`[MangaBar] Warning writing favicon.svg: ${e.message}`);
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
      } catch (e: any) {
        outputChannel?.appendLine(`[MangaBar] Warning patching index.html: ${e.message}`);
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
      } catch (e: any) {
        outputChannel?.appendLine(`[MangaBar] Warning patching site.webmanifest: ${e.message}`);
      }
    }

    // 5. Patch index-*.js and index-legacy-*.js in assets directory
    const assetsDir = path.join(webUIDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      try {
        const files = fs.readdirSync(assetsDir);
        for (const file of files) {
          if (/^index(?:-legacy)?-[A-Za-z0-9_-]+\.js$/.test(file)) {
            const filePath = path.join(assetsDir, file);
            let js = fs.readFileSync(filePath, 'utf8');

            let modified = false;

            // Check if R6 / nL Suwayomi katakana icon exists or needs branding
            if (
              js.includes('26.46 38.07') ||
              js.includes('circleRingColor:e=`#35d4d5`') ||
              js.includes('circleRingColor:e="#35d4d5"') ||
              js.includes('R6=({circleRingColor:e') ||
              js.includes('nL=({circleRingColor:e')
            ) {
              // Modern bundle replacement (bounded by ,z6=)
              const beforeModern = js;
              js = js.replace(
                /R6\s*=\s*\(\{circleRingColor:e[^}]*\}\)\s*=>[\s\S]*?(?=,z6=)/,
                'R6=({circleRingColor:e,circleFillColor:t,...n})=>(0,x.jsx)(rM,{viewBox:`0 0 100 100`,...n,children:(0,x.jsx)(`image`,{href:`/apple-touch-icon.png`,x:`0`,y:`0`,width:`100`,height:`100`})})'
              );
              if (js !== beforeModern) modified = true;

              // Legacy bundle replacement (bounded by ,e("G"))
              const beforeLegacy = js;
              js = js.replace(
                /nL\s*=\s*\(\{circleRingColor:e[^}]*\}\)\s*=>[\s\S]*?(?=,e\("G"\))/,
                'nL=({circleRingColor:e,circleFillColor:t,...n})=>(0,x.jsx)(Kg,{viewBox:"0 0 100 100",...n,children:(0,x.jsx)("image",{href:"/apple-touch-icon.png",x:"0",y:"0",width:"100",height:"100"})})'
              );
              if (js !== beforeLegacy) modified = true;
            }

            if (modified) {
              fs.writeFileSync(filePath, js, 'utf8');
              outputChannel?.appendLine(`[MangaBar] Successfully branded splash logo in ${file}`);
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
              outputChannel?.appendLine(`[MangaBar] Successfully branded About links in ${file}`);
            }
          } else if (/^Reader(?:-legacy)?-[A-Za-z0-9_-]+\.js$/.test(file)) {
            const filePath = path.join(assetsDir, file);
            let js = fs.readFileSync(filePath, 'utf8');

            // 1. Top-left button: change to 'Close Menu' with 'X' SVG icon
            const wrRegex = /title:\s*[a-zA-Z0-9_$]+\._\(\{\s*id:\s*[`'"]2mxCGH[`'"]\s*\}\),\s*children:\s*\(0,\s*([a-zA-Z0-9_$.]+)\)\(([a-zA-Z0-9_$]+),\{sx:\{marginRight:2\},onClick:[a-zA-Z0-9_$]+,color:[`'"]inherit[`'"],children:[a-zA-Z0-9_$]+\(\(0,\s*\1\)\([a-zA-Z0-9_$]+,\{\}\),\s*\(0,\s*\1\)\([a-zA-Z0-9_$]+,\{\}\)\)\}\)\}\)/;
            const wrReplacement = 'title:"Close Menu",children:(0,$1)($2,{sx:{marginRight:2},onClick:(evt)=>{try{evt&&evt.stopPropagation&&evt.stopPropagation();}catch(_){};try{if(window.__MANGABAR_CLOSE_MENU__)window.__MANGABAR_CLOSE_MENU__();}catch(_){};try{if(window.__MANGABAR_READER_SERVICE__)window.__MANGABAR_READER_SERVICE__.updateSetting("isStaticNav",!1);}catch(_){};try{if(window.__MANGABAR_READER_STORE__)window.__MANGABAR_READER_STORE__.getState().overlay?.setIsVisible?.(!1);}catch(_){};try{let p=document.querySelector("button[title*=\\"Static\\"],button[title*=\\"pin\\"]");if(p)p.click();}catch(_){}},color:"inherit",children:(0,$1)("svg",{viewBox:"0 0 24 24",width:24,height:24,fill:"currentColor",children:(0,$1)("path",{d:"M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"})})})})';

            // 2. Settings drawer section: append single full-width 'Back to Manga' button below Settings
            const settingsRegex = /(\(0,\s*([a-zA-Z0-9_$.]+)\)\(([a-zA-Z0-9_$]+),\{onClick:\(\)=>[a-zA-Z0-9_$]+\(\),size:[`'"]large[`'"],sx:\{justifyContent:[`'"]start[`'"],textTransform:[`'"]none[`'"]\},variant:[`'"]contained[`'"],startIcon:\(0,\s*\2\)\([a-zA-Z0-9_$]+,\{\}\),children:[a-zA-Z0-9_$]+\._\(\{\s*id:\s*[`'"]Tz0i8g[`'"]\s*\}\)\}\))/;
            const settingsReplacement = '$1,(0,$2)($3,{onClick:()=>{try{let m=window.location.pathname.match(/\\/manga\\/([^\\/]+)/);let target=m?"/manga/"+m[1]:"/";if(window.history&&window.history.pushState){window.history.pushState(null,"",target);window.dispatchEvent(new PopStateEvent("popstate"));}else{window.location.href=target;}}catch(_){}},size:"large",sx:{justifyContent:"start",textTransform:"none",marginTop:1},variant:"outlined",color:"inherit",startIcon:(0,$2)("svg",{viewBox:"0 0 24 24",width:24,height:24,fill:"currentColor",children:(0,$2)("path",{d:"M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.65 1 5.75V21c0 .55.45 1 1 1 .1 0 .2 0 .3-.05C3.85 21.35 5.55 21 7 21c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.41.21.75-.19.75-.65V6c-.6-.45-1.55-.75-2.5-1zm-1 14c-1.05-.2-2.3-.3-3.5-.3-1.65 0-3.4.45-4.5 1.15V7.5c1.1-.7 2.85-1.15 4.5-1.15 1.2 0 2.45.1 3.5.3V19z"})}),children:"Back to Manga"})';

            let patched = js
              .replace(wrRegex, wrReplacement)
              .replace(settingsRegex, settingsReplacement);

            if (patched !== js) {
              fs.writeFileSync(filePath, patched, 'utf8');
              outputChannel?.appendLine(`[MangaBar] Successfully updated Reader controls in ${file}`);
            }
          } else if (/^ReaderService(?:-legacy)?-[A-Za-z0-9_-]+\.js$/.test(file)) {
            const filePath = path.join(assetsDir, file);
            let js = fs.readFileSync(filePath, 'utf8');
            let patched = js
              .replace(
                /Se\(\$r,`chapterUpdateQueues`,new Map\);[\s\S]*?export\{/,
                'Se($r,`chapterUpdateQueues`,new Map);try{window.__MANGABAR_READER_STORE__=H;window.__MANGABAR_READER_SERVICE__=$r;window.__MANGABAR_CLOSE_MENU__=()=>{try{$r.updateSetting("isStaticNav",!1);}catch(_){};try{H.getState().overlay.setIsVisible(!1);}catch(_){};};}catch(_){};export{'
              )
              .replace(
                /ie\(Pr,"chapterUpdateQueues",new Map\)[\s\S]*?\}\}\}\);/,
                'ie(Pr,"chapterUpdateQueues",new Map);try{window.__MANGABAR_READER_STORE__=at;window.__MANGABAR_READER_SERVICE__=Pr;window.__MANGABAR_CLOSE_MENU__=()=>{try{Pr.updateSetting("isStaticNav",!1);}catch(_){};try{at.getState().overlay.setIsVisible(!1);}catch(_){};};}catch(_){}}}});'
              );
            if (patched !== js) {
              fs.writeFileSync(filePath, patched, 'utf8');
              outputChannel?.appendLine(`[MangaBar] Successfully exposed menu close handler in ${file}`);
            }
          }
        }
      } catch (e: any) {
        outputChannel?.appendLine(`[MangaBar] Warning patching assets: ${e.message}`);
      }
    }
  }

  outputChannel?.appendLine('[MangaBar] WebUI cache branding completed.');
}
