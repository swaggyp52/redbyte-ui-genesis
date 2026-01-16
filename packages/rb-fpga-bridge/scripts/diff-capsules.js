#!/usr/bin/env node
/**
 * diff-capsules.js
 * 
 * Compare two proof capsules to detect regressions, event drifts, and behavioral changes.
 * This is the "offline FPGA" engineering tool for hardware-agnostic verification.
 * 
 * Usage:
 *   pnpm diff:capsules -- --a <capsuleA.json> --b <capsuleB.json>
 *   node scripts/diff-capsules.js --a ops/proof/vector-run-A.json --b ops/proof/vector-run-B.json
 * 
 * Exit codes:
 *   0: capsules identical or acceptable differences
 *   1: significant differences detected (regressions, mismatches)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse CLI args
const args = process.argv.slice(2);
let capsuleA = null;
let capsuleB = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--a' && args[i + 1]) {
    capsuleA = args[++i];
  } else if (args[i] === '--b' && args[i + 1]) {
    capsuleB = args[++i];
  }
}

if (!capsuleA || !capsuleB) {
  console.error('[DIFF] ERROR: Usage: diff-capsules.js --a <capsuleA.json> --b <capsuleB.json>');
  process.exit(1);
}

// Load capsules
function loadCapsule(capsulePath) {
  if (!fs.existsSync(capsulePath)) {
    throw new Error(`Capsule not found: ${capsulePath}`);
  }
  
  const content = fs.readFileSync(capsulePath, 'utf8');
  const capsule = JSON.parse(content);
  
  // Load events (reference or inline)
  let events = [];
  if (capsule.events && typeof capsule.events === 'object' && capsule.events.path) {
    // Events reference format
    const eventsPath = capsule.events.path;
    if (!fs.existsSync(eventsPath)) {
      throw new Error(`Events file not found: ${eventsPath}`);
    }
    const eventsContent = fs.readFileSync(eventsPath, 'utf8');
    events = eventsContent.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  } else if (Array.isArray(capsule.events)) {
    // Inline events (legacy)
    events = capsule.events;
  }
  
  return { capsule, events };
}

console.log('[DIFF] Loading capsules...');
const { capsule: capA, events: eventsA } = loadCapsule(capsuleA);
const { capsule: capB, events: eventsB } = loadCapsule(capsuleB);

// Compare metadata
console.log('\n[DIFF] Metadata Comparison');
console.log('='.repeat(60));

const metadataFields = [
  ['board_id', 'Board'],
  ['git_sha', 'Git SHA'],
  ['node_version', 'Node Version']
];

for (const [field, label] of metadataFields) {
  const valA = capA[field];
  const valB = capB[field];
  const match = valA === valB ? '✓' : '✗';
  console.log(`${match} ${label.padEnd(20)} A: ${valA}  B: ${valB}`);
}

// Compare test summary
console.log('\n[DIFF] Test Summary');
console.log('='.repeat(60));

const summaryA = capA.test_summary;
const summaryB = capB.test_summary;

const totalDiff = summaryB.total - summaryA.total;
const passedDiff = summaryB.passed - summaryA.passed;
const failedDiff = summaryB.failed - summaryA.failed;

console.log(`Total Vectors:  A: ${summaryA.total.toString().padStart(3)}  B: ${summaryB.total.toString().padStart(3)}  Δ: ${totalDiff >= 0 ? '+' : ''}${totalDiff}`);
console.log(`Passed:         A: ${summaryA.passed.toString().padStart(3)}  B: ${summaryB.passed.toString().padStart(3)}  Δ: ${passedDiff >= 0 ? '+' : ''}${passedDiff}`);
console.log(`Failed:         A: ${summaryA.failed.toString().padStart(3)}  B: ${summaryB.failed.toString().padStart(3)}  Δ: ${failedDiff >= 0 ? '+' : ''}${failedDiff}`);

// Verdict comparison
const verdictA = summaryA.failed === 0 ? 'PASS' : 'FAIL';
const verdictB = summaryB.failed === 0 ? 'PASS' : 'FAIL';

if (verdictA !== verdictB) {
  console.log(`\n⚠️  VERDICT CHANGED: ${verdictA} → ${verdictB}`);
}

// Compare event counts
console.log('\n[DIFF] Event Stream');
console.log('='.repeat(60));

const eventCountDiff = eventsB.length - eventsA.length;
console.log(`Event Count:    A: ${eventsA.length.toString().padStart(3)}  B: ${eventsB.length.toString().padStart(3)}  Δ: ${eventCountDiff >= 0 ? '+' : ''}${eventCountDiff}`);

// SHA comparison (if both have events reference)
if (capA.events?.sha256 && capB.events?.sha256) {
  const sameHash = capA.events.sha256 === capB.events.sha256;
  console.log(`Events Hash:    ${sameHash ? '✓ MATCH' : '✗ MISMATCH'}`);
  if (!sameHash) {
    console.log(`  A: ${capA.events.sha256.slice(0, 16)}...`);
    console.log(`  B: ${capB.events.sha256.slice(0, 16)}...`);
  }
}

// Compare vector results
console.log('\n[DIFF] Vector Results');
console.log('='.repeat(60));

const resultsA = capA.results || [];
const resultsB = capB.results || [];

let firstMismatch = null;
const mismatchedVectors = [];

for (let i = 0; i < Math.max(resultsA.length, resultsB.length); i++) {
  const rA = resultsA[i];
  const rB = resultsB[i];
  
  if (!rA) {
    mismatchedVectors.push({ index: i, reason: 'Missing in A', name: rB.name, resultB: rB.result });
    if (!firstMismatch) firstMismatch = { index: i, rA: null, rB };
    continue;
  }
  
  if (!rB) {
    mismatchedVectors.push({ index: i, reason: 'Missing in B', name: rA.name, resultA: rA.result });
    if (!firstMismatch) firstMismatch = { index: i, rA, rB: null };
    continue;
  }
  
  // Compare results
  if (rA.result !== rB.result) {
    mismatchedVectors.push({ 
      index: i, 
      reason: `Verdict changed: ${rA.result} → ${rB.result}`,
      name: rA.name 
    });
    if (!firstMismatch) firstMismatch = { index: i, rA, rB };
  } else if (rA.observed !== rB.observed) {
    mismatchedVectors.push({ 
      index: i, 
      reason: `Observed value changed`,
      name: rA.name,
      observedA: rA.observed,
      observedB: rB.observed
    });
    if (!firstMismatch) firstMismatch = { index: i, rA, rB };
  }
}

if (mismatchedVectors.length === 0) {
  console.log('✓ All vector results match');
} else {
  console.log(`✗ ${mismatchedVectors.length} mismatched vectors:`);
  for (const v of mismatchedVectors.slice(0, 5)) {
    console.log(`  [${v.index}] ${v.name}: ${v.reason}`);
    if (v.observedA && v.observedB) {
      console.log(`      Observed: ${v.observedA} → ${v.observedB}`);
    }
  }
  if (mismatchedVectors.length > 5) {
    console.log(`  ... and ${mismatchedVectors.length - 5} more`);
  }
}

// First mismatch details
if (firstMismatch) {
  console.log('\n[DIFF] First Mismatch Details');
  console.log('='.repeat(60));
  console.log(`Vector Index: ${firstMismatch.index}`);
  
  if (firstMismatch.rA && firstMismatch.rB) {
    console.log(`Name: ${firstMismatch.rA.name}`);
    console.log(`\nA (${firstMismatch.rA.result}):`);
    console.log(`  Expected: ${firstMismatch.rA.expected}`);
    console.log(`  Observed: ${firstMismatch.rA.observed}`);
    console.log(`\nB (${firstMismatch.rB.result}):`);
    console.log(`  Expected: ${firstMismatch.rB.expected}`);
    console.log(`  Observed: ${firstMismatch.rB.observed}`);
  } else if (!firstMismatch.rA) {
    console.log(`Missing in A: ${firstMismatch.rB.name}`);
  } else {
    console.log(`Missing in B: ${firstMismatch.rA.name}`);
  }
}

// Compare event streams (first divergence)
console.log('\n[DIFF] Event Stream Divergence');
console.log('='.repeat(60));

let firstDivergence = null;

for (let i = 0; i < Math.min(eventsA.length, eventsB.length); i++) {
  const eA = eventsA[i];
  const eB = eventsB[i];
  
  // Compare key fields
  if (eA.type !== eB.type || eA.seq !== eB.seq) {
    firstDivergence = { index: i, eA, eB, reason: 'Type or seq mismatch' };
    break;
  }
  
  // Compare io fields for io:update events
  if (eA.type === 'io:update' && eB.type === 'io:update') {
    if (eA.SW !== eB.SW || eA.BTN !== eB.BTN || eA.LED !== eB.LED || eA.TICK !== eB.TICK) {
      firstDivergence = { index: i, eA, eB, reason: 'IO state divergence' };
      break;
    }
  }
}

if (!firstDivergence && eventsA.length !== eventsB.length) {
  firstDivergence = { 
    index: Math.min(eventsA.length, eventsB.length), 
    eA: null, 
    eB: null, 
    reason: 'Event count mismatch' 
  };
}

if (!firstDivergence) {
  console.log('✓ Event streams identical');
} else {
  console.log(`✗ First divergence at event ${firstDivergence.index}: ${firstDivergence.reason}`);
  
  if (firstDivergence.eA && firstDivergence.eB) {
    console.log(`\nA (seq=${firstDivergence.eA.seq}):`);
    console.log(`  type: ${firstDivergence.eA.type}`);
    if (firstDivergence.eA.type === 'io:update') {
      console.log(`  SW:   ${firstDivergence.eA.SW}`);
      console.log(`  BTN:  ${firstDivergence.eA.BTN}`);
      console.log(`  LED:  ${firstDivergence.eA.LED}`);
      console.log(`  TICK: ${firstDivergence.eA.TICK}`);
    }
    
    console.log(`\nB (seq=${firstDivergence.eB.seq}):`);
    console.log(`  type: ${firstDivergence.eB.type}`);
    if (firstDivergence.eB.type === 'io:update') {
      console.log(`  SW:   ${firstDivergence.eB.SW}`);
      console.log(`  BTN:  ${firstDivergence.eB.BTN}`);
      console.log(`  LED:  ${firstDivergence.eB.LED}`);
      console.log(`  TICK: ${firstDivergence.eB.TICK}`);
    }
  }
}

// Summary
console.log('\n[DIFF] Summary');
console.log('='.repeat(60));

const hasDifferences = 
  verdictA !== verdictB || 
  mismatchedVectors.length > 0 || 
  firstDivergence !== null ||
  eventCountDiff !== 0;

if (!hasDifferences) {
  console.log('✓ Capsules are functionally identical');
  console.log('[DIFF] verdict=MATCH');
  process.exit(0);
} else {
  console.log('✗ Significant differences detected:');
  if (verdictA !== verdictB) console.log(`  - Verdict changed: ${verdictA} → ${verdictB}`);
  if (mismatchedVectors.length > 0) console.log(`  - ${mismatchedVectors.length} vector result mismatches`);
  if (firstDivergence) console.log(`  - Event stream divergence at index ${firstDivergence.index}`);
  if (eventCountDiff !== 0) console.log(`  - Event count changed by ${eventCountDiff}`);
  console.log('[DIFF] verdict=DIVERGED');
  process.exit(1);
}
