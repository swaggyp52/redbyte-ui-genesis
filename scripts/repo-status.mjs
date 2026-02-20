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

// 2a. Synth subset compiler legality/export stability contract
if (!runCheck('IDE Synth Subset Contract', 'pnpm -s ide:gate:synth-subset-contract 2>&1')) {
  process.exit(1);
}

// 2b. Vivado-ready export pack contract
if (!runCheck('IDE Vivado Pack Contract', 'pnpm -s ide:gate:vivado-pack-contract 2>&1')) {
  process.exit(1);
}

// 2ba. RBProject archive inclusion contract
if (
  !runCheck(
    'IDE Export Includes RBProject Contract',
    'pnpm -s ide:gate:export-includes-rbproj-contract 2>&1'
  )
) {
  process.exit(1);
}

// 2bb. Vivado ZIP import deterministic contract
if (!runCheck('IDE ZIP Import Contract', 'pnpm -s ide:gate:zip-import-contract 2>&1')) {
  process.exit(1);
}

// 2c. Hardware bring-up proof loop contract
if (!runCheck('IDE Bring-Up Contract', 'pnpm -s ide:gate:bringup-contract 2>&1')) {
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

// 4a. IDE UX runtime contracts (self-contained preview harness)
if (!runCheck('IDE Project Overview Contract', 'pnpm -s ide:gate:project-overview-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Project Health Live Contract', 'pnpm -s ide:gate:project-health-live-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Project Continue CTA Contract', 'pnpm -s ide:gate:project-continue-cta-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Persistence Contract', 'pnpm -s ide:gate:persistence-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Workbench Layout Contract', 'pnpm -s ide:gate:workbench-layout-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Design Workbench Contract', 'pnpm -s ide:gate:design-workbench-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Design Fit Contract', 'pnpm -s ide:gate:design-fit-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Design Build Fast Contract', 'pnpm -s ide:gate:design-build-fast-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Design Live Sim Contract', 'pnpm -s ide:gate:design-live-sim-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Live Sim Contract', 'pnpm -s ide:gate:live-sim-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Sequential Sim Contract', 'pnpm -s ide:gate:seq-sim-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Primary CTA Contract', 'pnpm -s ide:gate:primary-cta-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Diagnostics Jump Contract', 'pnpm -s ide:gate:diagnostics-jump-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Design Multiselect Contract', 'pnpm -s ide:gate:design-multiselect-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Examples Contract', 'pnpm -s ide:gate:examples-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Design System Contract', 'pnpm -s ide:gate:design-system-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Shell Chrome Contract', 'pnpm -s ide:gate:shell-chrome-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Screenshot Baselines', 'pnpm -s ide:gate:screenshots 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Verify Workbench Contract', 'pnpm -s ide:gate:verify-workbench-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Verify Summary Contract', 'pnpm -s ide:gate:verify-summary-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Evidence Capsule Contract', 'pnpm -s ide:gate:evidence-capsule-contract 2>&1')) {
  process.exit(1);
}
if (
  !runCheck(
    'IDE Export Artifact Explorer Contract',
    'pnpm -s ide:gate:export-artifact-explorer-contract 2>&1'
  )
) {
  process.exit(1);
}
if (!runCheck('IDE Export Blockers Contract', 'pnpm -s ide:gate:export-blockers-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Export Ready Contract', 'pnpm -s ide:gate:export-ready-contract 2>&1')) {
  process.exit(1);
}
if (!runCheck('IDE Hardware Checklist Contract', 'pnpm -s ide:gate:hardware-checklist-contract 2>&1')) {
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
