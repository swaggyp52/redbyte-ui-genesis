#!/usr/bin/env node
/**
 * bless-capsule.js
 * 
 * Promote a proof capsule to "golden baseline" status for regression testing.
 * This creates a stable reference point that future runs can be compared against.
 * 
 * Usage:
 *   pnpm bless:capsule -- --capsule ops/proof/vector-run-2026-01-16T03-08-39.json [--force]
 *   node scripts/bless-capsule.js --capsule <path> [--force]
 * 
 * Exit codes:
 *   0: capsule blessed successfully
 *   2: invalid input / file not found / validation failed
 */

import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import { execSync } from 'child_process';
import { resolveRepoPath, findRepoRoot } from '../src/path-utils.js';

const EXIT_SUCCESS = 0;
const EXIT_INVALID = 2;
const SCHEMA_VERSION = 'v1';

// Parse CLI args
const args = process.argv.slice(2);
let capsulePath = null;
let forceOverwrite = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--capsule' && args[i + 1]) {
    capsulePath = args[++i];
  } else if (args[i] === '--force') {
    forceOverwrite = true;
  }
}

if (!capsulePath) {
  console.error('[BLESS] ERROR: Usage: bless-capsule.js --capsule <path> [--force]');
  process.exit(EXIT_INVALID);
}

console.log('[BLESS] Blessing capsule as golden baseline...');

try {
  // Resolve input path
  const resolvedPath = resolveRepoPath(capsulePath);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Capsule not found: ${resolvedPath}`);
  }
  
  // Load and validate capsule
  const capsuleContent = fs.readFileSync(resolvedPath, 'utf8');
  const capsule = JSON.parse(capsuleContent);
  
  // Validation: required fields
  if (!capsule.session_id || !capsule.timestamp) {
    throw new Error('Invalid capsule: missing session_id or timestamp');
  }
  
  // Validation: must have summary (either field)
  const summary = capsule.summary || capsule.test_summary;
  if (!summary) {
    throw new Error('Invalid capsule: missing summary or test_summary');
  }
  
  // Validation: if replay was enabled, must have passed
  if (capsule.replay_verdict && capsule.replay_verdict !== 'PASS') {
    throw new Error(`Capsule replay failed: ${capsule.replay_verdict}. Cannot bless failing capsules.`);
  }
  
  // Validation: if events reference exists, validate file + hash
  if (capsule.events && typeof capsule.events === 'object' && capsule.events.path) {
    const eventsPath = resolveRepoPath(capsule.events.path);
    if (!fs.existsSync(eventsPath)) {
      throw new Error(`Events file not found: ${capsule.events.path}`);
    }
    
    // Verify event file hash if present
    if (capsule.events.sha256) {
      const eventsContent = fs.readFileSync(eventsPath, 'utf8');
      const eventsHash = crypto.createHash('sha256').update(eventsContent).digest('hex');
      if (eventsHash !== capsule.events.sha256) {
        console.warn(`[BLESS] Warning: Events file hash mismatch (expected ${capsule.events.sha256}, got ${eventsHash})`);
      }
    }
  }
  
  // Calculate capsule SHA256
  const capsuleSha256 = crypto.createHash('sha256').update(capsuleContent).digest('hex');
  
  // Get current git SHA for blessing metadata
  const REPO_ROOT = findRepoRoot();
  let gitSha = 'unknown';
  try {
    gitSha = execSync('git rev-parse --short HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
  } catch (err) {
    console.warn('[BLESS] Warning: Could not determine git SHA');
  }
  
  // Get username/machine for audit trail
  const blessedBy = `${os.userInfo().username}@${os.hostname()}`;
  
  // Build events reference if present
  let eventsRef = null;
  if (capsule.events && typeof capsule.events === 'object' && capsule.events.path) {
    eventsRef = {
      path: capsule.events.path,
      sha256: capsule.events.sha256 || null,
      count: capsule.events.count || 0
    };
  }
  
  // Create blessed capsule with full metadata
  const blessedCapsule = {
    ...capsule,
    blessed_at: new Date().toISOString(),
    blessed_by: blessedBy,
    blessed_from: capsule.session_id,
    blessed_git_sha: gitSha,
    capsule_path: capsulePath,
    capsule_sha256: capsuleSha256,
    events_ref: eventsRef,
    schema_version: SCHEMA_VERSION
  };
  
  // Write to golden baseline location
  const goldenPath = resolveRepoPath('packages/rb-fpga-bridge/ops/proof/golden-baseline.json');
  
  // Check if golden baseline already exists
  if (fs.existsSync(goldenPath) && !forceOverwrite) {
    const existing = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
    console.error('[BLESS] ERROR: Golden baseline already exists.');
    console.error(`[BLESS]   Current baseline: ${existing.blessed_from || existing.session_id}`);
    console.error(`[BLESS]   Blessed at: ${existing.blessed_at || 'unknown'}`);
    console.error(`[BLESS]   Use --force to overwrite.`);
    process.exit(EXIT_INVALID);
  }
  
  // Ensure directory exists
  const goldenDir = goldenPath.substring(0, goldenPath.lastIndexOf('\\'));
  if (!fs.existsSync(goldenDir)) {
    fs.mkdirSync(goldenDir, { recursive: true });
  }
  
  fs.writeFileSync(goldenPath, JSON.stringify(blessedCapsule, null, 2));
  
  console.log(`[BLESS] ✓ Golden baseline created: golden-baseline.json`);
  console.log(`[BLESS]   Source: ${capsule.session_id}`);
  console.log(`[BLESS]   Blessed at: ${blessedCapsule.blessed_at}`);
  console.log(`[BLESS]   Blessed by: ${blessedBy}`);
  console.log(`[BLESS]   Git SHA: ${gitSha}`);
  console.log(`[BLESS]   Capsule SHA256: ${capsuleSha256.substring(0, 16)}...`);
  if (eventsRef) {
    console.log(`[BLESS]   Events: ${eventsRef.count} events (${eventsRef.path})`);
  }
  
  process.exit(EXIT_SUCCESS);
  
} catch (err) {
  console.error(`[BLESS] ERROR: ${err.message}`);
  process.exit(EXIT_INVALID);
}
