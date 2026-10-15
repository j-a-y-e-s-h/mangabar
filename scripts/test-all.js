const path = require('path');
const fs = require('fs');
const assert = require('assert');

console.log('========================================================================');
console.log(' MangaBar Comprehensive Automated Verification Test Suite');
console.log('========================================================================\n');

const root = path.resolve(__dirname, '..');

// 1. Verify JRE and Binary Integrity
console.log('[Test 1/5] Verifying portable OpenJDK 21 & Server Binary...');
const jrePath = path.join(root, 'bin', 'jre21', 'bin', 'java.exe');
assert(fs.existsSync(jrePath), `JRE 21 java.exe not found at ${jrePath}`);

const child_process = require('child_process');
const verOutput = child_process.spawnSync(jrePath, ['-version']).stderr.toString();
assert(verOutput.includes('version "21') || verOutput.includes('openjdk 21'), `Expected Java 21, got: ${verOutput}`);
console.log('  ✅ OpenJDK 21 verified: ' + verOutput.split('\n')[0].trim());

const jarPath = path.join(root, 'bin', 'mangabar-server.jar');
assert(fs.existsSync(jarPath), 'mangabar-server.jar missing in bin/');
const jarStat = fs.statSync(jarPath);
assert(jarStat.size > 150 * 1024 * 1024, `mangabar-server.jar too small (${(jarStat.size / 1024 / 1024).toFixed(1)} MB)`);
console.log(`  ✅ Server binary verified: ${(jarStat.size / 1024 / 1024).toFixed(1)} MB`);

// 2. Verify ConfigManager default configuration & Pre-Seeded Extension Stores
console.log('\n[Test 2/5] Verifying configManager pre-seeded extension stores...');
const dataDir = path.join(root, 'data');
const confPath = path.join(dataDir, 'server.conf');
assert(fs.existsSync(confPath), 'server.conf missing in data/');
const confContent = fs.readFileSync(confPath, 'utf8');
assert(confContent.includes('server.extensionStores'), 'server.extensionStores missing in server.conf');
assert(confContent.includes('keiyoushi'), 'Keiyoushi extension repository URL missing in server.conf');
assert(confContent.includes('server.kcefEnabled = false'), 'CEF should be disabled in server.conf');
console.log('  ✅ server.conf correctly contains pre-seeded Keiyoushi repo & memory optimizations');

// 3. Verify Compiled JavaScript artifacts
console.log('\n[Test 3/5] Verifying compiled extension bundle in dist/...');
const extensionJs = path.join(root, 'dist', 'extension.js');
assert(fs.existsSync(extensionJs), 'dist/extension.js missing');
const extCode = fs.readFileSync(extensionJs, 'utf8');

// Verify Stepper steps exist in compiled code
assert(extCode.includes('Java 21 Runtime'), 'Step 1 (Java 21 Runtime) missing in bundle');
assert(extCode.includes('Server Engine Binary'), 'Step 2 (Server Engine Binary) missing in bundle');
assert(extCode.includes('Database & Cache'), 'Step 3 (Database & Cache) missing in bundle');
assert(extCode.includes('Web Reader UI'), 'Step 4 (Web Reader UI) missing in bundle');
console.log('  ✅ 4-step progress stepper verified in bundle');

// Verify Reassurance note exists
assert(extCode.includes('First-time setup only. Future starts will be instant.'), 'Reassurance text missing in bundle');
console.log('  ✅ "First-time setup only. Future starts will be instant." verified in bundle');

// Verify Welcome Banner
assert(extCode.includes('welcomeBanner'), 'welcomeBanner element missing in bundle');
assert(extCode.includes('openStoresFromBanner'), 'openStoresFromBanner handler missing in bundle');
assert(extCode.includes('dismissWelcomeBanner'), 'dismissWelcomeBanner handler missing in bundle');
assert(extCode.includes('checkWelcomeBanner'), 'checkWelcomeBanner function missing in bundle');
console.log('  ✅ Welcome banner & 1-click "Add Sources" flow verified in bundle');

// Verify Human-Friendly Offline Error Handling
assert(extCode.includes('Internet connection required for initial setup'), 'Friendly offline error message missing in bundle');
assert(extCode.includes('Initial Setup Requires Internet'), 'Friendly error title missing in bundle');
assert(extCode.includes('Retry Launch'), 'Retry Launch button missing in bundle');
console.log('  ✅ Non-technical human-friendly offline error recovery verified in bundle');

// 4. Verify Sync to All VS Code / Antigravity Extension Locations
console.log('\n[Test 4/5] Verifying installation targets sync...');
const syncTargets = [
  path.join(process.env.USERPROFILE, '.antigravity-ide', 'extensions', 'j-a-y-e-s-h.mangabar-0.2.0', 'dist', 'extension.js'),
  path.join(process.env.USERPROFILE, '.antigravity-ide', 'extensions', 'j-a-y-e-s-h.mangabar-0.2.0-universal', 'dist', 'extension.js'),
  path.join(process.env.USERPROFILE, '.vscode', 'extensions', 'j-a-y-e-s-h.mangabar-0.2.0', 'dist', 'extension.js'),
];

for (const target of syncTargets) {
  if (fs.existsSync(target)) {
    const code = fs.readFileSync(target, 'utf8');
    assert(code.includes('welcomeBanner'), `Target ${target} out of sync!`);
    assert(code.includes('First-time setup only'), `Target ${target} missing reassurance text!`);
    console.log(`  ✅ Verified sync: ${path.dirname(path.dirname(target))}`);
  }
}

// 5. Run Live Server, Proxy & API Verification
console.log('\n[Test 5/5] Running live server lifecycle, reverse proxy & API test...');
const lifecycleScript = path.join(__dirname, 'test-server-lifecycle.js');
const testRun = child_process.spawnSync('node', [lifecycleScript], {
  cwd: root,
  encoding: 'utf8',
  timeout: 60000,
});

if (testRun.status !== 0) {
  console.error(testRun.stderr || testRun.stdout);
  throw new Error(`test-server-lifecycle.js failed with code ${testRun.status}`);
}

console.log(testRun.stdout.split('\n').filter(l => l.startsWith('✅') || l.startsWith('🎉') || l.includes('verified')).join('\n'));

console.log('\n========================================================================');
console.log(' 🚀 ALL 5 VERIFICATION PHASES PASSED WITH 100% SUCCESS!');
console.log('========================================================================\n');
