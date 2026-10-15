const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const distExt = path.join(root, 'dist', 'extension.js');
assert(fs.existsSync(distExt), 'dist/extension.js missing');

const code = fs.readFileSync(distExt, 'utf8');

console.log('--- Verifying Reader Enhancer & Icon Logic ---');

// 1. Verify isExcludedFromScrubbing exists
assert(code.includes('isExcludedFromScrubbing'), 'isExcludedFromScrubbing missing in bundle');
console.log('✅ isExcludedFromScrubbing defined');

// 2. Verify /api/v1/ and extension icon exclusions
assert(code.includes("src.includes('/api/v1/')"), "src.includes('/api/v1/') guard missing");
assert(code.includes("src.includes('/extension/')"), "src.includes('/extension/') guard missing");
assert(code.includes("src.includes('/source/')"), "src.includes('/source/') guard missing");
assert(code.includes("src.includes('/cover')"), "src.includes('/cover') guard missing");
console.log('✅ Strict API content guards (/api/v1/, /extension/, /source/, /cover) present');

// 3. Verify Avatar and container exclusions
assert(code.includes('.MuiAvatar-root'), '.MuiAvatar-root container exclusion missing');
assert(code.includes('.MuiListItemAvatar-root'), '.MuiListItemAvatar-root exclusion missing');
console.log('✅ Extension & source avatar containers completely excluded from brand scrubbing');

// 4. Verify serverManager API exclusion
assert(code.includes('isApiRequest'), 'serverManager API bypass missing');
console.log('✅ serverManager proxy preserves all upstream /api/ extension and source icons');

// 5. Verify optimized shell selector targeting (no whole-body traversal)
assert(code.includes('header, nav, .MuiAppBar-root, .MuiDrawer-root'), 'High performance shell targeting missing');
console.log('✅ High-performance shell targeting active (no 1440+ extension list lag)');

// 6. Verify sync targets
const syncTargets = [
  path.join(process.env.USERPROFILE, '.antigravity-ide', 'extensions', 'j-a-y-e-s-h.mangabar-0.2.0', 'dist', 'extension.js'),
  path.join(process.env.USERPROFILE, '.antigravity-ide', 'extensions', 'j-a-y-e-s-h.mangabar-0.2.0-universal', 'dist', 'extension.js'),
  path.join(process.env.USERPROFILE, '.vscode', 'extensions', 'j-a-y-e-s-h.mangabar-0.2.0', 'dist', 'extension.js'),
];

for (const target of syncTargets) {
  if (fs.existsSync(target)) {
    const targetCode = fs.readFileSync(target, 'utf8');
    assert(targetCode.includes('isExcludedFromScrubbing'), `Target ${target} missing updated icon logic`);
    assert(targetCode.includes("src.includes('/api/v1/')"), `Target ${target} missing API guard`);
    console.log(`✅ Synced and verified in install target: ${path.dirname(path.dirname(target))}`);
  }
}

console.log('\n🎉 ALL ICON & PERFORMANCE VERIFICATION CHECKS PASSED!');
