#!/usr/bin/env node

/**
 * repo-status.mjs
 *
 * One-command health check for the RedByte UI repository.
 * Runs: build → artifact verification
 *
 * Exit codes:
 *   0 = Overall PASS (product is shippable)
 *   1 = Any check FAILED (stops at first failure)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

let totalChecks = 0;
let passCount = 0;
const failures = [];

function runCheck(name, command) {
    totalChecks++;
    console.log(`\n📋 ${name}...`);
    try {
        // Capture output to prevent noise
        execSync(command, { 
            stdio: ['pipe', 'pipe', 'pipe'], 
            cwd: ROOT,
            encoding: 'utf8'
        });
        console.log(`✅ ${name} PASS`);
        passCount++;
        return true;
    } catch (err) {
        console.log(`❌ ${name} FAIL`);
        failures.push(name);
        return false;
    }
}

function fileExists(filePath, desc) {
    const fullPath = path.join(ROOT, filePath);
    if (fs.existsSync(fullPath)) {
        console.log(`  ✓ ${desc}`);
        return true;
    } else {
        console.log(`  ✗ ${desc}`);
        return false;
    }
}

console.log('🔍 RedByte UI Repository Status\n');
console.log('═'.repeat(50));

// 1. Build (includes typecheck in vite build for product apps)
// Result: product is ready + artifacts in dist/
if (!runCheck('Building', 'pnpm build 2>&1')) {
    process.exit(1);
}

// 2. Import roundtrip validation (gates: import-roundtrip)
// Ensures HDL+XDC import pipeline is healthy
if (!runCheck('Import Pipeline Validation', 'pnpm gates:import-roundtrip 2>&1')) {
    console.log('  ℹ️  Import fixtures + roundtrip tests failed');
    process.exit(1);
}

// 3. Artifact verification
console.log('\n📋 Artifact Verification...');
const artifactChecks = [
    ['dist/index.html', 'Root index.html exists'],
    ['dist/os/index.html', '/os/index.html exists'],
    ['dist/build.json', 'build.json exists'],
    ['dist/_redirects', '_redirects exists'],
    ['dist/_headers', '_headers exists'],
    ['dist/os/version.json', '/os/version.json exists'],
];

let artifactPass = true;
for (const [filePath, desc] of artifactChecks) {
    if (!fileExists(filePath, desc)) {
        artifactPass = false;
    }
}

if (artifactPass) {
    console.log(`✅ Artifact Verification PASS`);
    passCount++;
} else {
    console.log(`❌ Artifact Verification FAIL`);
    failures.push('Artifact Verification');
    process.exit(1);
}
totalChecks++;

// Summary
console.log('\n' + '═'.repeat(50));
console.log(`\n📊 Results: ${passCount}/${totalChecks} checks passed\n`);

if (failures.length === 0) {
    console.log('✅ Repository Status: HEALTHY (product is shippable)\n');
    process.exit(0);
} else {
    console.log('❌ Repository Status: DEGRADED\n');
    console.log('Failed checks:');
    for (const failure of failures) {
        console.log(`  - ${failure}`);
    }
    console.log();
    process.exit(1);
}
