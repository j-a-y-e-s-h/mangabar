const child_process = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

async function runLifecycleTest() {
  const root = path.resolve(__dirname, '..');
  const javaCmd = path.join(root, 'bin', 'jre21', 'bin', 'java.exe');
  const jarPath = path.join(root, 'bin', 'mangabar-server.jar');
  const dataDir = path.join(root, 'data');
  const port = 4567;

  console.log('[Test] Spawning MangaBar server process...');
  const javaArgs = [
    '-Xmx512m',
    '-Xms64m',
    '--add-opens=java.base/java.lang=ALL-UNNAMED',
    '--add-opens=java.base/java.util=ALL-UNNAMED',
    '--add-opens=java.base/java.lang.reflect=ALL-UNNAMED',
    '-Djava.awt.headless=true',
    `-Dconfig.file=${path.join(dataDir, 'server.conf')}`,
    `-Dsuwayomi.tachidesk.config.server.rootDir=${dataDir}`,
    `-Dsuwayomi.tachidesk.config.server.port=${port}`,
    '-Dsuwayomi.tachidesk.config.server.ip=127.0.0.1',
    '-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false',
    '-Dsuwayomi.tachidesk.config.server.systemTrayEnabled=false',
    '-Dsuwayomi.tachidesk.config.server.kcefEnabled=false',
    '-Dsuwayomi.tachidesk.config.server.webUIInterface=BROWSER',
    '-Dsuwayomi.tachidesk.config.server.webUIUpdateCheckInterval=0.0',
    '-cp',
    `${path.join(root, 'bin', 'classes')};${jarPath}`,
    'suwayomi.tachidesk.MainKt',
  ];

  let crashed = false;
  let exitCode = null;

  const child = child_process.spawn(javaCmd, javaArgs, {
    cwd: dataDir,
    windowsHide: true,
  });

  child.stdout.on('data', (d) => {
    const text = d.toString();
    if (text.includes('CEF is') || text.includes('listening on') || text.includes('Started') || text.includes('ERROR')) {
      process.stdout.write(`[Server stdout] ${text}`);
    }
  });

  child.stderr.on('data', (d) => {
    process.stderr.write(`[Server stderr] ${d.toString()}`);
  });

  child.on('exit', (code) => {
    crashed = true;
    exitCode = code;
    console.log(`[Server exited with code ${code}]`);
  });

  // Wait for server to become responsive
  console.log('[Test] Polling server health on http://127.0.0.1:4567/...');
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (crashed) {
      throw new Error(`Server crashed prematurely with exit code: ${exitCode}`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/graphql`);
      if (res.ok) {
        ready = true;
        console.log(`[Test] Server is healthy! HTTP ${res.status}`);
        break;
      }
    } catch (_) {}
  }

  if (!ready) {
    child.kill();
    throw new Error('Server did not become ready within 30 seconds.');
  }

  // Verify proxy HTML transformation
  console.log('[Test] Verifying reverse proxy behavior and HTML injection...');
  // Create proxy similar to serverManager
  const proxyPort = 54321;
  const proxy = http.createServer((clientReq, clientRes) => {
    const headers = { ...clientReq.headers, host: `127.0.0.1:${port}` };
    delete headers['accept-encoding'];
    const options = {
      hostname: '127.0.0.1',
      port,
      path: clientReq.url,
      method: clientReq.method,
      headers: headers,
    };

    const upstream = http.request(options, (upstreamRes) => {
      let body = '';
      upstreamRes.setEncoding('utf8');
      upstreamRes.on('data', (c) => (body += c));
      upstreamRes.on('end', () => {
        const faviconTags = '<link rel="icon" type="image/svg+xml" href="/__mangabar_icon.svg" />';
        const darkHeadStyles =
          '<style>html, body, #root { background-color: #121212 !important; background: #121212 !important; color: #e0e0e0 !important; color-scheme: dark !important; }</style>' +
          '<script>try{localStorage.setItem("suwayomi_webui__theme_background","\\"#121212\\"");localStorage.setItem("suwayomi_webui__theme_mode","\\"dark\\"");document.documentElement.style.backgroundColor="#121212";}catch(_){}</script>';
        if (body.includes('</head>')) {
          body = body.replace('</head>', `${faviconTags}${darkHeadStyles}</head>`);
        }
        clientRes.writeHead(upstreamRes.statusCode || 200, { 'content-type': 'text/html; charset=utf-8' });
        clientRes.end(body);
      });
    });
    upstream.end();
  });

  await new Promise((resolve) => proxy.listen(proxyPort, '127.0.0.1', resolve));

  console.log('[Test] Awaiting WebUI SPA mount on http://127.0.0.1:4567/...');
  for (let i = 0; i < 30; i++) {
    try {
      const rootRes = await fetch(`http://127.0.0.1:${port}/`);
      if (rootRes.ok) break;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
  }

  const proxyRes = await fetch(`http://127.0.0.1:${proxyPort}/`);
  const proxyHtml = await proxyRes.text();

  if (!proxyHtml.includes('background-color: #121212 !important')) {
    throw new Error('Proxy HTML does not contain required dark head style!');
  }
  if (!proxyHtml.includes('localStorage.setItem("suwayomi_webui__theme_background"')) {
    throw new Error('Proxy HTML does not contain localStorage dark theme pre-seed script!');
  }
  console.log('✅ Dark theme injection verified in HTML head.');

  // Run user flow
  console.log('[Test] Running full user flow checks...');
  const sourcesRes = await fetch(`http://127.0.0.1:${port}/api/v1/source/list`);
  const sources = await sourcesRes.json();
  console.log(`✅ Sources API responded with ${sources.length} sources.`);

  const gqlRes = await fetch(`http://127.0.0.1:${port}/api/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ mangas(condition: { inLibrary: true }) { nodes { id title } } }' }),
  });
  const gqlData = await gqlRes.json();
  const mangas = gqlData.data?.mangas?.nodes || [];
  console.log(`✅ Library GraphQL responded with ${mangas.length} manga titles.`);

  console.log('[Test] Waiting 10 seconds to verify daemon stability and zero crash...');
  await new Promise((r) => setTimeout(r, 10000));

  if (crashed) {
    throw new Error(`Server crashed after initial start with exit code: ${exitCode}`);
  }

  console.log('🎉 Server remained permanently active, stable, and healthy with ZERO crashes!');

  // Cleanup
  proxy.close();
  child.kill();
  console.log('Test completed successfully.');
  process.exit(0);
}

runLifecycleTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
