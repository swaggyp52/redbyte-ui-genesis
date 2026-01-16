#!/usr/bin/env node
/**
 * selftest-golden.js
 * 
 * Self-test for golden baseline workflow. Validates that bless + check work correctly.
 * 
 * Usage:
 *   pnpm selftest:golden
 *   node scripts/selftest-golden.js
 * 
 * Exit codes:
 *   0: self-test passed
 *   1: self-test failed
 */

import fs from 'fs';
import { spawn } from 'child_process';
import { resolveRepoPath } from '../src/path-utils.js';

const EXIT_SUCCESS = 0;
const EXIT_FAIL = 1;

console.log('[SELFTEST] Golden baseline workflow validation');
console.log('='.repeat(60));

async function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { cwd, stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    
    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  const bridgeRoot = resolveRepoPath('packages/rb-fpga-bridge');
  const tempGoldenPath = resolveRepoPath('packages/rb-fpga-bridge/ops/proof/selftest-golden-temp.json');
  const originalGoldenPath = resolveRepoPath('packages/rb-fpga-bridge/ops/proof/golden-baseline.json');
  
  let originalGolden = null;
  let testsPassed = 0;
  let testsFailed = 0;
  
  try {
    // Step 1: Backup existing golden if present
    console.log('\n[SELFTEST] Step 1: Backup existing golden baseline');
    if (fs.existsSync(originalGoldenPath)) {
      originalGolden = fs.readFileSync(originalGoldenPath, 'utf8');
      fs.unlinkSync(originalGoldenPath);
      console.log('  ✓ Backed up existing golden baseline');
    } else {
      console.log('  ℹ No existing golden baseline to backup');
    }
    
    // Step 2: Generate a test capsule
    console.log('\n[SELFTEST] Step 2: Generate test capsule');
    const vectorResult = await runCommand('node', [
      'src/vector-runner.js',
      '--board', 'basys3',
      '--vectors', 'packages/rb-fpga-bridge/examples/test-basic.json',
      '--no-replay'
    ], bridgeRoot);
    
    if (vectorResult.code !== 0) {
      console.error('  ✗ Failed to generate test capsule');
      console.error(vectorResult.stderr);
      testsFailed++;
      return;
    }
    
    // Extract capsule path from output
    const capsuleMatch = vectorResult.stdout.match(/capsule=(.*?vector-run-.*?\.json)/);
    if (!capsuleMatch) {
      console.error('  ✗ Could not find capsule path in output');
      testsFailed++;
      return;
    }
    
    const capsulePath = capsuleMatch[1].replace(/\\/g, '/');
    console.log(`  ✓ Generated capsule: ${capsulePath.split('/').pop()}`);
    testsPassed++;
    
    // Step 3: Bless the capsule
    console.log('\n[SELFTEST] Step 3: Bless capsule as golden baseline');
    const blessResult = await runCommand('node', [
      'scripts/bless-capsule.js',
      '--capsule', capsulePath
    ], bridgeRoot);
    
    if (blessResult.code !== 0) {
      console.error('  ✗ Failed to bless capsule');
      console.error(blessResult.stderr);
      testsFailed++;
      return;
    }
    
    console.log('  ✓ Blessed capsule successfully');
    testsPassed++;
    
    // Step 4: Verify golden baseline exists
    console.log('\n[SELFTEST] Step 4: Verify golden baseline file');
    if (!fs.existsSync(originalGoldenPath)) {
      console.error('  ✗ Golden baseline not created');
      testsFailed++;
      return;
    }
    
    const golden = JSON.parse(fs.readFileSync(originalGoldenPath, 'utf8'));
    if (!golden.blessed_at || !golden.capsule_sha256 || !golden.schema_version) {
      console.error('  ✗ Golden baseline missing required metadata');
      testsFailed++;
      return;
    }
    
    console.log('  ✓ Golden baseline created with all metadata');
    testsPassed++;
    
    // Step 5: Check against golden (should match)
    console.log('\n[SELFTEST] Step 5: Check capsule against golden baseline');
    const checkResult = await runCommand('node', [
      'scripts/check-golden.js',
      '--candidate', capsulePath
    ], bridgeRoot);
    
    if (checkResult.code !== 0) {
      console.error('  ✗ Check golden failed (expected exit 0)');
      console.error(checkResult.stdout);
      console.error(checkResult.stderr);
      testsFailed++;
      return;
    }
    
    console.log('  ✓ Check golden passed (MATCH)');
    testsPassed++;
    
    // Step 6: Try to bless again (should fail without --force)
    console.log('\n[SELFTEST] Step 6: Verify --force protection');
    const reblessResult = await runCommand('node', [
      'scripts/bless-capsule.js',
      '--capsule', capsulePath
    ], bridgeRoot);
    
    if (reblessResult.code === 0) {
      console.error('  ✗ Re-blessing succeeded without --force (should have failed)');
      testsFailed++;
      return;
    }
    
    console.log('  ✓ Re-blessing blocked without --force');
    testsPassed++;
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`[SELFTEST] Results: ${testsPassed} passed, ${testsFailed} failed`);
    
    if (testsFailed === 0) {
      console.log('[SELFTEST] ✓ All tests passed');
      process.exit(EXIT_SUCCESS);
    } else {
      console.log('[SELFTEST] ✗ Some tests failed');
      process.exit(EXIT_FAIL);
    }
    
  } catch (err) {
    console.error(`[SELFTEST] ERROR: ${err.message}`);
    process.exit(EXIT_FAIL);
  } finally {
    // Cleanup: restore original golden if it existed
    console.log('\n[SELFTEST] Cleanup: Restoring original golden baseline');
    if (originalGolden) {
      fs.writeFileSync(originalGoldenPath, originalGolden);
      console.log('  ✓ Restored original golden baseline');
    } else {
      // Remove test golden
      if (fs.existsSync(originalGoldenPath)) {
        fs.unlinkSync(originalGoldenPath);
        console.log('  ✓ Removed test golden baseline');
      }
    }
  }
}

main().catch(err => {
  console.error(`[SELFTEST] FATAL: ${err.message}`);
  process.exit(EXIT_FAIL);
});
