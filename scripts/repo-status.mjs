#!/usr/bin/env node

/**
 * repo-status.mjs
 *
 * One-command health check for the RedByte UI repository.
 * Runs: static boot shadow contract -> build -> import gate -> artifact checks.
 *
 * Exit codes:
 *   0 = Overall PASS (product is shippable)
 *   1 = Any check FAILED
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

let totalChecks = 0;
let passCount = 0;
const failures = [];

function runCheck(name, command) {
  totalChecks++;
  console.log(`\n[CHECK] ${name}...`);
  try {
    execSync(command, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: ROOT,
      encoding: 'utf8',
    });
    console.log(`[PASS] ${name}`);
    passCount++;
    return true;
  } catch {
    console.log(`[FAIL] ${name}`);
    failures.push(name);
    return false;
  }
}

function fileExists(filePath, description) {
  const fullPath = path.join(ROOT, filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`  [ok] ${description}`);
    return true;
  }
  console.log(`  [missing] ${description}`);
  return false;
}

console.log('RedByte UI Repository Status\n');
console.log('='.repeat(50));

// 0. Git ahead signal (warn only; does not block feature work)
console.log('\n[CHECK] Git Ahead Limit...');
try {
  execSync('pnpm -s gates:git-ahead-limit 2>&1', {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
  });
  console.log('[PASS] Git Ahead Limit');
} catch (error) {
  const details = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
  console.log('[WARN] Git Ahead Limit');
  if (details.length > 0) {
    console.log(`  ${details}`);
  }
}

// 1. Static anti-shadow contract (fast fail)
if (!runCheck('IDE Boot Shadow Contract', 'pnpm gates:ide-boot-shadow-contract 2>&1')) {
  process.exit(1);
}

// 2. Static IDE export contract (real pipeline, no preview payloads)
if (
  !runCheck(
    'IDE Export Real Pipeline Contract',
    'pnpm -s gates:ide-export-real-pipeline-contract 2>&1'
  )
) {
  process.exit(1);
}

// 3. Build (includes typecheck in vite build for product apps)
if (!runCheck('Building', 'pnpm build 2>&1')) {
  process.exit(1);
}

// 4. Import roundtrip validation
if (!runCheck('Import Pipeline Validation', 'pnpm gates:import-roundtrip 2>&1')) {
  console.log('  [info] Import fixtures + roundtrip tests failed');
  process.exit(1);
}

// 5. Artifact verification
console.log('\n[CHECK] Artifact Verification...');
const artifactChecks = [
  ['dist/index.html', 'Root index.html exists'],
  ['dist/os/index.html', '/os/index.html exists'],
  ['dist/build.json', 'build.json exists'],
  ['dist/_redirects', '_redirects exists'],
  ['dist/_headers', '_headers exists'],
  ['dist/os/version.json', '/os/version.json exists'],
];

let artifactPass = true;
for (const [filePath, description] of artifactChecks) {
  if (!fileExists(filePath, description)) {
    artifactPass = false;
  }
}

if (artifactPass) {
  console.log('[PASS] Artifact Verification');
  passCount++;
} else {
  console.log('[FAIL] Artifact Verification');
  failures.push('Artifact Verification');
  process.exit(1);
}
totalChecks++;

console.log('\n' + '='.repeat(50));
console.log(`\nResults: ${passCount}/${totalChecks} checks passed\n`);

if (failures.length === 0) {
  console.log('Repository Status: HEALTHY (product is shippable)\n');
  process.exit(0);
}

console.log('Repository Status: DEGRADED\n');
console.log('Failed checks:');
for (const failure of failures) {
  console.log(`  - ${failure}`);
}
console.log();
process.exit(1);
