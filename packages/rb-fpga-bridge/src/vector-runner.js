#!/usr/bin/env node
/**
 * Vector Test Runner
 * 
 * Loads test vectors, runs them against mock bridge, collects events,
 * validates outputs, and generates proof capsule + report.
 * 
 * Usage:
 *   node src/vector-runner.js --board basys3 --vectors examples/test-basic.json
 * 
 * Output:
 *   ops/proof/vector-run-<timestamp>.json
 *   ops/proof/vector-run-<timestamp>-report.txt
 *   ops/proof/vector-events-<timestamp>.ndjson
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, createHmac, randomBytes } from 'crypto';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve paths
function findRepoRoot() {
  try {
    const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8', stdio: 'pipe' }).trim();
    return root;
  } catch {
    return resolve(__dirname, '..', '..', '..');
  }
}

const REPO_ROOT = findRepoRoot();
const PROOF_DIR = resolve(REPO_ROOT, 'ops', 'proof');
const BOARDS_FILE = resolve(__dirname, '..', 'boards', 'registry.json');

// Ensure output dir
mkdirSync(PROOF_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const proofJsonPath = `${PROOF_DIR}/vector-run-${timestamp}.json`;
const reportPath = `${PROOF_DIR}/vector-run-${timestamp}-report.txt`;
const eventsNdjsonPath = `${PROOF_DIR}/vector-events-${timestamp}.ndjson`;

// Parse CLI args
const args = process.argv.slice(2);
let boardId = 'basys3';
let vectorsFile = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--board') boardId = args[i + 1];
  if (args[i] === '--vectors') vectorsFile = args[i + 1];
}

if (!vectorsFile) {
  console.error('ERROR: --vectors <file> required');
  process.exit(1);
}

// Load board registry
function loadBoardRegistry() {
  const raw = readFileSync(BOARDS_FILE, 'utf8');
  const registry = JSON.parse(raw);
  return registry;
}

function findBoard(registry, boardId) {
  const board = registry.boards.find(b => b.id === boardId);
  if (!board) throw new Error(`Board '${boardId}' not found in registry`);
  return board;
}

// Load vectors
function loadVectors(file) {
  // Resolve file path relative to repo root, package root, or absolute
  let filePath = file;
  
  // If relative path, try multiple locations
  if (!file.startsWith('/') && !file.match(/^[A-Z]:/)) {
    const attempts = [
      resolve(REPO_ROOT, file),
      resolve(REPO_ROOT, 'packages/rb-fpga-bridge', file),
      resolve(__dirname, '..', file),
      file
    ];
    
    for (const attempt of attempts) {
      try {
        const raw = readFileSync(attempt, 'utf8');
        return JSON.parse(raw);
      } catch {
        // continue
      }
    }
    throw new Error(`Vector file not found: ${file} (tried: ${attempts.join(', ')})`);
  }
  
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

// Convert integer to bitstring (padded to width)
function intToBitstring(val, width) {
  if (typeof val === 'string') return val;
  return val.toString(2).padStart(width, '0');
}

// Mock bridge simulation
class MockBridge {
  constructor(board) {
    this.board = board;
    this.seq = 1;
    this.startTime = Date.now();
    this.events = [];
    this.state = {
      SW: '0'.repeat(board.widths.SW),
      BTN: '0'.repeat(board.widths.BTN),
      LED: '0'.repeat(board.widths.LED),
      TICK: '0'
    };
  }

  emitStatusEvent() {
    const evt = {
      type: 'status',
      seq: this.seq++,
      timestamp: Date.now(),
      source: 'mock',
      connected: true,
      port: 'MOCK',
      baud: 115200,
      lastMsgTs: null,
      lastMsg: null
    };
    this.events.push(evt);
    return evt;
  }

  applyInputs(sw, btn) {
    this.state.SW = intToBitstring(sw, this.board.widths.SW);
    this.state.BTN = intToBitstring(btn, this.board.widths.BTN);
    // Mock behavior: LED mirrors SW
    this.state.LED = this.state.SW;
    this.state.TICK = (parseInt(this.state.TICK || '0', 10) + 1).toString();
  }

  emitIoUpdateEvent() {
    const evt = {
      type: 'io:update',
      seq: this.seq++,
      timestamp: Date.now(),
      source: 'mock',
      SW: this.state.SW,
      BTN: this.state.BTN,
      LED: this.state.LED,
      TICK: this.state.TICK,
      ts_offset_ms: Date.now() - this.startTime
    };
    this.events.push(evt);
    return evt;
  }
}

// Vector validator
function validateVector(vec, board) {
  if (!vec.name || !vec.inputs || !vec.expect) {
    throw new Error('Vector must have name, inputs, expect');
  }
  if (typeof vec.inputs.SW === 'undefined' || typeof vec.inputs.BTN === 'undefined') {
    throw new Error('Vector inputs must have SW and BTN');
  }
  if (typeof vec.expect.LED === 'undefined') {
    throw new Error('Vector expect must have LED');
  }
  return true;
}

// Run tests
function runTests(registry, boardId, vectorsSpec) {
  const board = findBoard(registry, boardId);
  const bridge = new MockBridge(board);
  
  const results = [];
  let passed = 0;
  let failed = 0;

  // Initial status
  bridge.emitStatusEvent();

  for (const vec of vectorsSpec.vectors) {
    validateVector(vec, board);

    const sw = vec.inputs.SW;
    const btn = vec.inputs.BTN;
    const expectedLed = intToBitstring(vec.expect.LED, board.widths.LED);

    bridge.applyInputs(sw, btn);
    const ioEvent = bridge.emitIoUpdateEvent();

    const match = ioEvent.LED === expectedLed;
    if (match) {
      passed++;
      results.push({
        name: vec.name,
        result: 'PASS',
        inputs: { SW: sw, BTN: btn },
        expected: expectedLed,
        observed: ioEvent.LED,
        event: ioEvent
      });
    } else {
      failed++;
      results.push({
        name: vec.name,
        result: 'FAIL',
        inputs: { SW: sw, BTN: btn },
        expected: expectedLed,
        observed: ioEvent.LED,
        event: ioEvent,
        mismatch: `Expected LED=${expectedLed}, got LED=${ioEvent.LED}`
      });
    }
  }

  return { bridge, board, passed, failed, results };
}

// Write proof capsule
function writeProofCapsule(proofPath, capsule) {
  writeFileSync(proofPath, JSON.stringify(capsule, null, 2), 'utf8');
}

// Write NDJSON events
function writeEventsNdjson(ndjsonPath, events) {
  const lines = events.map(e => JSON.stringify(e)).join('\n');
  writeFileSync(ndjsonPath, lines + '\n', 'utf8');
}

// Write report
function writeReport(reportPath, report) {
  writeFileSync(reportPath, report, 'utf8');
}

// SHA256 hash
function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

// Get git SHA if available
function getGitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: REPO_ROOT, stdio: 'pipe' }).trim();
  } catch {
    return 'unknown';
  }
}

// Main execution
async function main() {
  try {
    console.log(`[VECTOR RUNNER] Starting...`);

    // Load inputs
    const registry = loadBoardRegistry();
    const vectorsSpec = loadVectors(vectorsFile);
    const vectorFileHash = sha256(readFileSync(vectorsFile, 'utf8'));

    if (vectorsSpec.board_id !== boardId) {
      console.error(`WARNING: Vector file specifies board_id='${vectorsSpec.board_id}', but --board=${boardId} requested`);
    }

    // Run tests
    const { bridge, board, passed, failed, results } = runTests(registry, boardId, vectorsSpec);

    // Build capsule
    const capsule = {
      session_id: `vector-run-${timestamp}`,
      timestamp: new Date().toISOString(),
      board_id: boardId,
      board_snapshot: board,
      vector_file_hash: vectorFileHash,
      git_sha: getGitSha(),
      node_version: process.version,
      started_at: new Date(bridge.startTime).toISOString(),
      ended_at: new Date().toISOString(),
      test_summary: {
        total: passed + failed,
        passed,
        failed
      },
      results: results.map(r => ({
        name: r.name,
        result: r.result,
        inputs: r.inputs,
        expected: r.expected,
        observed: r.observed,
        mismatch: r.mismatch || null
      })),
      events_ndjson_path: eventsNdjsonPath
    };

    // Build report
    let report = `[VECTOR RUN] ${new Date().toISOString()}\n`;
    report += `Board: ${boardId}\n`;
    report += `Vectors: ${passed + failed}\n`;
    report += `Passed: ${passed}\n`;
    report += `Failed: ${failed}\n`;
    report += `\n`;
    report += `Test Results:\n`;
    report += `---\n`;
    for (const r of results) {
      report += `${r.result.padEnd(6)} ${r.name}\n`;
      if (r.mismatch) report += `        ${r.mismatch}\n`;
    }
    report += `\n`;
    report += `Events collected: ${bridge.events.length}\n`;
    report += `Event stream: ${eventsNdjsonPath}\n`;
    report += `Proof capsule: ${proofJsonPath}\n`;

    // Write outputs
    writeProofCapsule(proofJsonPath, capsule);
    writeEventsNdjson(eventsNdjsonPath, bridge.events);
    writeReport(reportPath, report);

    // Output summary
    console.log(`[VECTOR RUN] board=${boardId} vectors=${passed + failed} pass=${passed} fail=${failed}`);
    console.log(`[PROOF] capsule=${proofJsonPath}`);
    console.log(`[REPORT] report=${reportPath}`);
    console.log(`[EVENTS] events=${eventsNdjsonPath}`);

    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();
