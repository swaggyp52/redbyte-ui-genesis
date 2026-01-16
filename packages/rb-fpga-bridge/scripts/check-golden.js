#!/usr/bin/env node
/**
 * check-golden.js
 * 
 * Compare a candidate capsule against the golden baseline to detect regressions.
 * This is a thin wrapper around diff-capsules that enforces golden baseline semantics.
 * 
 * Usage:
 *   pnpm check:golden -- --candidate ops/proof/vector-run-latest.json
 *   node scripts/check-golden.js --candidate <path>
 * 
 * Exit codes (inherited from diff-capsules):
 *   0: MATCH - candidate matches golden (no regressions)
 *   1: DIVERGED - candidate differs from golden (regression detected)
 *   2: INVALID - golden baseline missing or parse error
 */

import fs from 'fs';
import { spawn } from 'child_process';
import { resolveRepoPath } from '../src/path-utils.js';

const EXIT_MATCH = 0;
const EXIT_DIVERGED = 1;
const EXIT_INVALID = 2;

// Parse CLI args
const args = process.argv.slice(2);
let candidatePath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--candidate' && args[i + 1]) {
    candidatePath = args[++i];
  }
}

if (!candidatePath) {
  console.error('[GOLDEN] ERROR: Usage: check-golden.js --candidate <path>');
  process.exit(EXIT_INVALID);
}

console.log('[GOLDEN] Checking candidate against golden baseline...');

try {
  // Validate candidate exists
  const resolvedCandidate = resolveRepoPath(candidatePath);
  if (!fs.existsSync(resolvedCandidate)) {
    throw new Error(`Candidate capsule not found: ${resolvedCandidate}`);
  }
  
  // Validate golden baseline exists
  const goldenPath = resolveRepoPath('packages/rb-fpga-bridge/ops/proof/golden-baseline.json');
  if (!fs.existsSync(goldenPath)) {
    console.error('[GOLDEN] ERROR: Golden baseline not found. Run `pnpm bless:capsule` first.');
    process.exit(EXIT_INVALID);
  }
  
  // Load golden metadata for display
  const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
  console.log(`[GOLDEN] Baseline: ${golden.blessed_from || golden.session_id}`);
  console.log(`[GOLDEN]   Blessed at: ${golden.blessed_at || 'unknown'}`);
  console.log(`[GOLDEN]   Git SHA: ${golden.blessed_git_sha || golden.git_sha || 'unknown'}`);
  console.log('');
  
  // Spawn diff-capsules with golden vs. candidate
  const diffProcess = spawn('node', [
    'scripts/diff-capsules.js',
    '--a', goldenPath,
    '--b', resolvedCandidate
  ], {
    cwd: resolveRepoPath('packages/rb-fpga-bridge'),
    stdio: 'inherit'
  });
  
  diffProcess.on('close', (code) => {
    if (code === EXIT_MATCH) {
      console.log('[GOLDEN] ✓ PASS - Candidate matches golden baseline (no regressions)');
    } else if (code === EXIT_DIVERGED) {
      console.log('[GOLDEN] ✗ FAIL - Candidate diverges from golden (regression detected)');
    } else {
      console.log('[GOLDEN] ✗ ERROR - Diff tool reported invalid input');
    }
    process.exit(code);
  });
  
  diffProcess.on('error', (err) => {
    console.error(`[GOLDEN] ERROR: Failed to spawn diff-capsules: ${err.message}`);
    process.exit(EXIT_INVALID);
  });
  
} catch (err) {
  console.error(`[GOLDEN] ERROR: ${err.message}`);
  process.exit(EXIT_INVALID);
}
