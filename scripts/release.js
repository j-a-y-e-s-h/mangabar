/**
 * MangaBar Unified Release & Store Publishing Orchestrator
 *
 * Runs full pre-flight verification, compiles, packages .vsix, updates tags,
 * and publishes to both Microsoft VS Code Marketplace and Eclipse Open VSX.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

function run(cmd, desc) {
  console.log(`\n▶ ${desc}...`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✓ ${desc} completed.`);
  } catch (err) {
    console.error(`✗ Error during ${desc}:`, err.message);
    process.exit(1);
  }
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('========================================================');
  console.log('  MangaBar Dual-Store Release & CI/CD Orchestrator');
  console.log('========================================================');

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = pkg.version;
  const tag = `v${version}`;
  console.log(`Current version: ${version} (Tag: ${tag})`);

  // 1. Run build and tests
  run('npm run compile', 'Compiling TypeScript extension');
  run('node scripts/verify-enhancer.js', 'Verifying reader enhancer & search DOM');
  run('node scripts/test-all.js', 'Running end-to-end server & life-cycle test suite');

  // 2. Package VSIX
  const vsixFile = `mangabar-${version}.vsix`;
  run('npx @vscode/vsce package --no-dependencies', `Packaging ${vsixFile}`);

  if (!fs.existsSync(vsixFile)) {
    console.error(`VSIX package ${vsixFile} was not found!`);
    process.exit(1);
  }
  console.log(`✓ Package verified: ${vsixFile} (${(fs.statSync(vsixFile).size / 1024 / 1024).toFixed(2)} MB)`);

  // 3. Check for Direct Store Publishing Tokens
  const vscePat = process.env.VSCE_PAT;
  const ovsxToken = process.env.OPEN_VSX_TOKEN || process.env.OVSX_PAT;

  if (vscePat) {
    run(`npx @vscode/vsce publish --packagePath ${vsixFile} -p "${vscePat}" --no-dependencies`, 'Publishing to VS Code Marketplace');
  } else {
    console.log('\n[Notice] VSCE_PAT not in environment. Skipping direct CLI VS Code Marketplace publish.');
    console.log('         (GitHub Actions will publish automatically if VSCE_PAT is set in repo secrets)');
  }

  if (ovsxToken) {
    run(`npx ovsx publish ${vsixFile} --pat "${ovsxToken}"`, 'Publishing to Open VSX Registry');
  } else {
    console.log('\n[Notice] OPEN_VSX_TOKEN not in environment. Skipping direct CLI Open VSX publish.');
    console.log('         (GitHub Actions will publish automatically if OPEN_VSX_TOKEN is set in repo secrets)');
  }

  console.log('\n========================================================');
  console.log(`  Release ${version} Build & Packaging Complete!`);
  console.log('========================================================\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
