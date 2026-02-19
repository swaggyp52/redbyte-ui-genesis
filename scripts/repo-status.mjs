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
const AHEAD_WARN_LIMIT = 3;

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

function emitAheadLimitWarning() {
  try {
    const aheadRaw = execSync('git rev-list --count origin/main..HEAD', {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    const aheadCount = Number.parseInt(aheadRaw, 10);
    if (!Number.isFinite(aheadCount)) {
      console.log(`[warn] unable to parse ahead count: "${aheadRaw}"`);
      return;
    }
    if (aheadCount > AHEAD_WARN_LIMIT) {
      console.log(
        `[warn] local branch is ${aheadCount} commits ahead of origin/main (recommended <= ${AHEAD_WARN_LIMIT}).`
      );
      console.log(
        '[warn] guidance: push/PR the current lane stack now, or generate a bundle/patch handoff before adding more commits.'
      );
    }
  } catch {
    console.log('[warn] ahead-limit check skipped (origin/main not available locally).');
  }
}

console.log('RedByte UI Repository Status\n');
console.log('='.repeat(50));
emitAheadLimitWarning();

// 0. Static anti-shadow contract (fast fail)
if (!runCheck('IDE Boot Shadow Contract', 'pnpm gates:ide-boot-shadow-contract 2>&1')) {
  process.exit(1);
}

// 1. Build (includes typecheck in vite build for product apps)
if (!runCheck('Building', 'pnpm build 2>&1')) {
  process.exit(1);
}

// 2. Import roundtrip validation
if (!runCheck('Import Pipeline Validation', 'pnpm gates:import-roundtrip 2>&1')) {
  console.log('  [info] Import fixtures + roundtrip tests failed');
  process.exit(1);
}

// 3. Artifact verification
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
