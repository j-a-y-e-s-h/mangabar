const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN || '';
const OWNER = 'j-a-y-e-s-h';
const REPO = 'mangabar';

async function main() {
  console.log('[1/4] Pushing code to GitHub repository...');
  const remoteUrl = `https://${OWNER}:${TOKEN}@github.com/${OWNER}/${REPO}.git`;
  try {
    execSync(`git push "${remoteUrl}" main:main`, { stdio: 'inherit' });
    console.log('✓ Code pushed successfully to main branch!');
  } catch (err) {
    console.error('Push failed:', err.message);
    process.exit(1);
  }

  // 2. Configure default origin remote without leaking token in git config
  try {
    execSync(`git remote set-url origin https://github.com/${OWNER}/${REPO}.git`);
    console.log('✓ Local git remote origin updated.');
  } catch (_) {}
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
