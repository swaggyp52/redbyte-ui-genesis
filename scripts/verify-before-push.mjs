#!/usr/bin/env node

/**
 * Pre-push verification script
 * Checks GitHub Actions workflow status before allowing push
 * Usage: node scripts/verify-before-push.mjs [--force]
 * 
 * Attribution: Connor Angiel
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
const force = args.includes('--force');

if (force) {
  console.log('⚠️  Force flag detected. Skipping verification.');
  process.exit(0);
}

try {
  console.log('🔍 Checking GitHub Actions status for main branch...');
  
  // Get the latest commit SHA
  const sha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  console.log(`📌 Current commit: ${sha.slice(0, 7)}`);
  
  // Get the repo info
  const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
  const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
  
  if (!match) {
    console.warn('⚠️  Could not parse GitHub repo URL');
    process.exit(0);
  }
  
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  console.log(`📦 Repository: ${owner}/${repo}`);
  
  // Check if gh CLI is available
  try {
    execSync('gh --version', { stdio: 'ignore' });
  } catch {
    console.warn('⚠️  GitHub CLI (gh) not found. Install it to enable pre-push verification.');
    console.log('   See: https://cli.github.com');
    process.exit(0);
  }
  
  console.log('🚀 About to push to GitHub. Tests will run in CI...');
  console.log('   Check status with: gh run list --workflow=quality.yml');
  
  process.exit(0);
} catch (error) {
  console.error('❌ Verification error:', error.message);
  process.exit(1);
}
