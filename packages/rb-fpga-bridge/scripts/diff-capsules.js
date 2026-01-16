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
import { resolveRepoPath } from '../src/path-utils.js';

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

// Load capsules with shared path resolution
function loadCapsule(capsulePath) {
  const resolvedPath = resolveRepoPath(capsulePath);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Capsule not found: ${resolvedPath}`);
  }
  
  const content = fs.readFileSync(resolvedPath, 'utf8');
  const capsule = JSON.parse(content);
  
  // Load events with multi-schema support
  let events = [];
  if (capsule.events && typeof capsule.events === 'object' && capsule.events.path) {
    // Events reference format (NDJSON)
    const eventsPath = resolveRepoPath(capsule.events.path);
    if (!fs.existsSync(eventsPath)) {
      throw new Error(`Events file not found: ${eventsPath}`);
    }
    const eventsContent = fs.readFileSync(eventsPath, 'utf8');
    events = eventsContent.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  } else if (Array.isArray(capsule.events)) {
    // Inline events array
    events = capsule.events;
  } else if (Array.isArray(capsule.event_stream)) {
    // Fallback: event_stream field
    events = capsule.event_stream;
  }
  
  return { capsule, events };
}

/**
 * Normalize an event to canonical form for schema-agnostic comparison.
 * Handles different capsule types (fpga-proof, vector-run, etc).
 * @param {object} e - Raw event from capsule
 * @param {number} index - Position in event stream (for seq fallback)
 * @returns {object} Normalized event with stable fields
 */
function normalizeEvent(e, index) {
  // Derive seq from multiple possible sources
  const seq = Number(
    e.seq ?? 
    e.sequence ?? 
    e.i ?? 
    (index + 1)
  );
  
  // Derive tick from multiple possible sources
  const tick = Number(
    e.TICK ?? 
    e.tick ?? 
    e.payload?.TICK ?? 
    e.state?.TICK ?? 
    0
  );
  
  // Normalize type
  const type = String(e.type ?? e.kind ?? e.event ?? 'unknown').toLowerCase();
  
  // Extract IO fields (nested under payload or at top level)
  const SW = e.SW ?? e.payload?.SW ?? null;
  const BTN = e.BTN ?? e.payload?.BTN ?? null;
  const LED = e.LED ?? e.payload?.LED ?? null;
  
  return {
    seq,
    tick,
    type,
    SW,
    BTN,
    LED,
    // Preserve original for debugging
    _raw: e
  };
}

/**
 * Get a stable comparison key for an event.
 * Used to detect meaningful divergences.
 */
function getEventKey(normalized) {
  // For status/heartbeat events, just compare type
  if (normalized.type === 'status' || normalized.type === 'heartbeat') {
    return `${normalized.type}`;
  }
  
  // For io:update events, include IO state
  if (normalized.type === 'io:update') {
    return `${normalized.type}:SW=${normalized.SW},BTN=${normalized.BTN},LED=${normalized.LED}`;
  }
  
  // Generic: type + tick
  return `${normalized.type}:tick=${normalized.tick}`;
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

const summaryA = capA.summary;
const summaryB = capB.summary;

const totalDiff = summaryB.total_events - summaryA.total_events;
const passedDiff = summaryB.passed - summaryA.passed;
const failedDiff = summaryB.failed - summaryA.failed;

console.log(`Total Vectors:  A: ${summaryA.total_events.toString().padStart(3)}  B: ${summaryB.total_events.toString().padStart(3)}  Δ: ${totalDiff >= 0 ? '+' : ''}${totalDiff}`);
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

// Compare event streams (first divergence) with normalization
console.log('\n[DIFF] Event Stream Divergence');
console.log('='.repeat(60));

let firstDivergence = null;

// Normalize all events once
const normalizedA = eventsA.map((e, i) => normalizeEvent(e, i));
const normalizedB = eventsB.map((e, i) => normalizeEvent(e, i));

for (let i = 0; i < Math.min(normalizedA.length, normalizedB.length); i++) {
  const nA = normalizedA[i];
  const nB = normalizedB[i];
  
  // Compare types first (must match)
  if (nA.type !== nB.type) {
    firstDivergence = { 
      index: i, 
      eA: eventsA[i], 
      eB: eventsB[i], 
      nA, 
      nB,
      reason: `Type mismatch: ${nA.type} vs ${nB.type}` 
    };
    break;
  }
  
  // Get comparison keys
  const keyA = getEventKey(nA);
  const keyB = getEventKey(nB);
  
  if (keyA !== keyB) {
    firstDivergence = { 
      index: i, 
      eA: eventsA[i], 
      eB: eventsB[i], 
      nA, 
      nB,
      reason: 'IO state or timing divergence' 
    };
    break;
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
  
  if (firstDivergence.nA && firstDivergence.nB) {
    const nA = firstDivergence.nA;
    const nB = firstDivergence.nB;
    
    console.log(`\nA (normalized seq=${nA.seq}, tick=${nA.tick}):`);
    console.log(`  type: ${nA.type}`);
    if (nA.type === 'io:update') {
      console.log(`  SW:   ${nA.SW}`);
      console.log(`  BTN:  ${nA.BTN}`);
      console.log(`  LED:  ${nA.LED}`);
    }
    
    console.log(`\nB (normalized seq=${nB.seq}, tick=${nB.tick}):`);
    console.log(`  type: ${nB.type}`);
    if (nB.type === 'io:update') {
      console.log(`  SW:   ${nB.SW}`);
      console.log(`  BTN:  ${nB.BTN}`);
      console.log(`  LED:  ${nB.LED}`);
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
