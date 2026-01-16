#!/usr/bin/env node
/**
 * visualize-capsule.js
 *
 * ASCII waveform-lite visualizer for proof capsules.
 * Shows per-vector tick, inputs, expected, observed, and verdict.
 *
 * Exit codes:
 *   0: all vectors pass
 *   1: one or more vectors fail
 *   2: invalid input / load error
 */

import fs from 'fs';
import path from 'path';
import { resolveRepoPath } from '../src/path-utils.js';

const EXIT_PASS = 0;
const EXIT_FAIL = 1;
const EXIT_INVALID = 2;

// Parse args
const args = process.argv.slice(2);
let capsuleArg = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--capsule' && args[i + 1]) {
    capsuleArg = args[++i];
  }
}

if (!capsuleArg) {
  console.error('[VIS] ERROR: Usage: visualize-capsule.js --capsule <path>');
  process.exit(EXIT_INVALID);
}

function loadCapsule(filePath) {
  const resolved = resolveRepoPath(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Capsule not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  const capsule = JSON.parse(raw);

  // Load events (external NDJSON preferred)
  let events = [];
  if (capsule.events && typeof capsule.events === 'object' && capsule.events.path) {
    const eventsPath = resolveRepoPath(capsule.events.path);
    if (!fs.existsSync(eventsPath)) {
      throw new Error(`Events file not found: ${eventsPath}`);
    }
    const ndjson = fs.readFileSync(eventsPath, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    events = ndjson;
  } else if (Array.isArray(capsule.events)) {
    events = capsule.events;
  } else if (Array.isArray(capsule.event_stream)) {
    events = capsule.event_stream;
  }

  return { capsule, events };
}

function formatRow(cols) {
  return cols.map(c => c.toString().padEnd(18)).join(' ');
}

try {
  const { capsule, events } = loadCapsule(capsuleArg);
  const ioEvents = events.filter(e => e.type === 'io:update');
  const results = capsule.results || [];

  console.log('[VIS] Capsule visualization');
  console.log('='.repeat(80));

  const header = formatRow(['idx', 'tick', 'SW', 'BTN', 'expected', 'observed', 'verdict']);
  console.log(header);
  console.log('-'.repeat(header.length));

  let failCount = 0;
  let firstMismatch = null;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const io = ioEvents[i] || {};
    const tick = io.TICK ?? '?';
    const sw = (r.inputs?.SW ?? io.SW ?? '').toString();
    const btn = (r.inputs?.BTN ?? io.BTN ?? '').toString();
    const expected = r.expected ?? '';
    const observed = r.observed ?? '';
    const verdict = r.result || 'UNKNOWN';

    if (verdict !== 'PASS' && !firstMismatch) {
      firstMismatch = { index: i, name: r.name, expected, observed, tick };
    }
    if (verdict !== 'PASS') failCount++;

    console.log(formatRow([i, tick, sw, btn, expected, observed, verdict]));
  }

  console.log('\n');
  if (firstMismatch) {
    console.log('[First mismatch]');
    console.log(`  idx=${firstMismatch.index} name=${firstMismatch.name || ''}`);
    console.log(`  tick=${firstMismatch.tick}`);
    console.log(`  expected=${firstMismatch.expected}`);
    console.log(`  observed=${firstMismatch.observed}`);
  } else {
    console.log('[VIS] No mismatches');
  }

  const passCount = results.length - failCount;
  const verdict = failCount === 0 ? 'PASS' : 'FAIL';
  console.log(`\n[VIS] total=${results.length} pass=${passCount} fail=${failCount} verdict=${verdict} capsule=${capsuleArg}`);

  process.exit(failCount === 0 ? EXIT_PASS : EXIT_FAIL);
} catch (err) {
  console.error(`[VIS] ERROR: ${err.message}`);
  process.exit(EXIT_INVALID);
}
