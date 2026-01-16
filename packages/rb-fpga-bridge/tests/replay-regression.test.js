#!/usr/bin/env node
/**
 * Regression Test: Vector Runner + Proof Replay Integration
 * 
 * Ensures replay can discover NDJSON events via capsule pointer.
 * Prevents "No events found in proof" from shipping.
 * 
 * Usage: node tests/replay-regression.test.js
 * Exit: 0 if pass, 1 if fail
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

console.log('[TEST] Replay Regression Test');
console.log('[TEST] ========================================');

// Test 1: Run vector test with passthrough DUT
console.log('[TEST] Step 1: Run vector test (passthrough)...');
try {
  const output = execSync(
    'pnpm --filter @redbyte/fpga-bridge test:vectors -- --board basys3 --vectors packages/rb-fpga-bridge/examples/test-basic.json --dut passthrough',
    { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' }
  );
  
  // Extract capsule path from output
  const capsuleMatch = output.match(/\[PROOF\] capsule=(.+\.json)/);
  if (!capsuleMatch) {
    throw new Error('Could not find capsule path in output');
  }
  const capsulePath = capsuleMatch[1];
  console.log(`[TEST] ✓ Capsule generated: ${capsulePath}`);
  
  // Verify capsule exists
  if (!existsSync(capsulePath)) {
    throw new Error(`Capsule file not found: ${capsulePath}`);
  }
  
  // Verify capsule has events pointer
  const capsule = JSON.parse(readFileSync(capsulePath, 'utf8'));
  if (!capsule.events || typeof capsule.events !== 'object') {
    throw new Error('Capsule missing events object');
  }
  if (!capsule.events.path) {
    throw new Error('Capsule missing events.path');
  }
  if (!capsule.events.format) {
    throw new Error('Capsule missing events.format');
  }
  if (!capsule.events.sha256) {
    throw new Error('Capsule missing events.sha256');
  }
  console.log(`[TEST] ✓ Capsule has events pointer: ${capsule.events.path}`);
  
  // Verify NDJSON file exists
  if (!existsSync(capsule.events.path)) {
    throw new Error(`Events file not found: ${capsule.events.path}`);
  }
  console.log(`[TEST] ✓ Events NDJSON exists`);
  
  // Verify event count matches
  const eventsContent = readFileSync(capsule.events.path, 'utf8');
  const eventLines = eventsContent.split('\n').filter(line => line.trim());
  if (capsule.events.count !== eventLines.length) {
    throw new Error(`Event count mismatch: capsule says ${capsule.events.count}, file has ${eventLines.length}`);
  }
  console.log(`[TEST] ✓ Event count matches: ${capsule.events.count}`);
  
  // Check for [RUN] summary in output
  if (!output.includes('[RUN] task=vectors')) {
    throw new Error('Missing [RUN] summary line');
  }
  console.log('[TEST] ✓ [RUN] summary present');
  
  // Check for replay success (no "No events found")
  if (output.includes('No events found in proof')) {
    throw new Error('Replay failed with "No events found in proof"');
  }
  console.log('[TEST] ✓ Replay did not fail with "No events found"');
  
  // Check for replay verdict
  if (!output.includes('[REPLAY] events=')) {
    throw new Error('Missing [REPLAY] summary line');
  }
  console.log('[TEST] ✓ [REPLAY] summary present');
  
  console.log('[TEST] ========================================');
  console.log('[TEST] ✅ ALL CHECKS PASSED');
  process.exit(0);
  
} catch (error) {
  console.error(`[TEST] ❌ FAILED: ${error.message}`);
  if (error.stderr) console.error(error.stderr);
  process.exit(1);
}
