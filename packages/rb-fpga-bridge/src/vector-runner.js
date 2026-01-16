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
    // Always use git to find true repo root, regardless of CWD
    const root = execSync('git rev-parse --show-toplevel', { 
      encoding: 'utf8', 
      stdio: 'pipe',
      cwd: __dirname  // Run from script directory to ensure git context
    }).trim();
    return root;
  } catch {
    // Fallback: walk upward from script directory looking for .git or pnpm-workspace.yaml
    let current = __dirname;
    for (let i = 0; i < 10; i++) {
      if (readFileSync(resolve(current, '.git', 'config'), 'utf8') || 
          readFileSync(resolve(current, 'pnpm-workspace.yaml'), 'utf8')) {
        return current;
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    // Last resort: use current working directory
    return process.cwd();
  }
}

/**
 * Resolve a path to absolute form, enforcing repo-root-relative semantics.
 * Non-negotiable invariant: all file IO uses resolved absolute paths.
 * @param {string} input - Raw path (may have quotes, forward/backslashes)
 * @returns {string} Absolute path
 */
function resolveRepoPath(input) {
  // Strip surrounding quotes
  let clean = input.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) ||
      (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1);
  }

  // Reject path traversal
  if (clean.includes('..')) {
    throw new Error(`Path traversal not allowed: ${clean}`);
  }

  // Normalize slashes to backslashes (Windows)
  const normalized = clean.replace(/\//g, '\\');

  // If already absolute (has drive letter), return as-is
  if (/^[A-Za-z]:/.test(normalized)) {
    return normalized;
  }

  // Otherwise, treat as repo-root-relative
  const REPO_ROOT = findRepoRoot();
  const repoRootNorm = REPO_ROOT.replace(/\//g, '\\');
  return repoRootNorm + '\\' + normalized;
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
let dutMode = 'passthrough';
let replayEnabled = false;

// Parse CLI args
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--board') boardId = args[i + 1];
  if (args[i] === '--vectors') vectorsFile = args[i + 1];
  if (args[i] === '--dut') dutMode = args[i + 1];
  if (args[i] === '--replay') replayEnabled = true;
  if (args[i] === '--no-replay') replayEnabled = false;
}

// Replay policy: env var RB_FPGA_REPLAY=1 enables, or --replay flag
// Default: OFF for local dev (fast), ON in CI (set env)
if (process.env.RB_FPGA_REPLAY === '1' && replayEnabled === false) {
  replayEnabled = true;
}

if (!vectorsFile) {
  console.error('ERROR: --vectors <file> required');
  console.error('Usage: node vector-runner.js --board <board-id> --vectors <path> [--dut <mode>] [--replay | --no-replay]');
  console.error('  DUT modes: passthrough (default), invert, xor, counter, fsm');
  console.error('  Replay: controlled by RB_FPGA_REPLAY=1 env or --replay flag (default: OFF)');
  process.exit(1);
}

const validDutModes = ['passthrough', 'invert', 'xor', 'counter', 'fsm'];
if (!validDutModes.includes(dutMode)) {
  console.error(`ERROR: Invalid DUT mode '${dutMode}'. Valid modes: ${validDutModes.join(', ')}`);
  process.exit(1);
}

// Debug: show path context
// console.error(`[DEBUG] REPO_ROOT=${REPO_ROOT}, vectorsFile=${vectorsFile}`);

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
  const filePath = resolveRepoPath(file);
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
  constructor(board, dutMode = 'passthrough') {
    this.board = board;
    this.dutMode = dutMode;
    this.seq = 1;
    this.startTime = Date.now();
    this.events = [];
    this.state = {
      SW: '0'.repeat(board.widths.SW),
      BTN: '0'.repeat(board.widths.BTN),
      LED: '0'.repeat(board.widths.LED),
      TICK: '0'
    };
    // FSM state: 4-state Moore machine (S0=00, S1=01, S2=10, S3=11)
    this.fsmState = 0;
    this.prevBtn0 = 0; // For edge detection
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
    
    // DUT logic based on mode
    const swInt = parseInt(this.state.SW, 2);
    const btnInt = parseInt(this.state.BTN, 2);
    let ledInt = 0;
    
    switch (this.dutMode) {
      case 'passthrough':
        // LED mirrors SW
        ledInt = swInt;
        break;
      
      case 'invert':
        // LED is bitwise NOT of SW
        ledInt = (~swInt) & ((1 << this.board.widths.LED) - 1);
        break;
      
      case 'xor':
        // LED[0] = SW[0] XOR SW[1], rest = 0
        ledInt = (swInt & 1) ^ ((swInt >> 1) & 1);
        break;
      
      case 'counter':
        // LED shows TICK value (mod 2^LED_WIDTH)
        const tick = parseInt(this.state.TICK || '0', 10);
        ledInt = tick & ((1 << this.board.widths.LED) - 1);
        break;
      
      case 'fsm':
        // 4-state Moore machine (LED[1:0] = state encoding)
        // BTN[0] = advance (rising edge)
        // BTN[1] = reset to S0
        const btn0 = btnInt & 1;
        const btn1 = (btnInt >> 1) & 1;
        
        // Reset takes priority
        if (btn1 === 1) {
          this.fsmState = 0;
        }
        // Rising edge detection on BTN[0]
        else if (btn0 === 1 && this.prevBtn0 === 0) {
          this.fsmState = (this.fsmState + 1) % 4;
        }
        
        this.prevBtn0 = btn0;
        
        // LED[1:0] = state encoding, rest = 0
        ledInt = this.fsmState;
        break;
      
      default:
        ledInt = swInt;
    }
    
    this.state.LED = intToBitstring(ledInt, this.board.widths.LED);
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
function runTests(registry, boardId, vectorsSpec, dutMode) {
  const board = findBoard(registry, boardId);
  const bridge = new MockBridge(board, dutMode);
  
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
    
    // Use resolveRepoPath for hash computation
    const vectorsFilePath = resolveRepoPath(vectorsFile);
    const vectorFileHash = sha256(readFileSync(vectorsFilePath, 'utf8'));

    if (vectorsSpec.board_id !== boardId) {
      console.error(`WARNING: Vector file specifies board_id='${vectorsSpec.board_id}', but --board=${boardId} requested`);
    }

    // Run tests
    const { bridge, board, passed, failed, results } = runTests(registry, boardId, vectorsSpec, dutMode);

    // Write events NDJSON first to compute hash
    writeEventsNdjson(eventsNdjsonPath, bridge.events);
    const eventsContent = readFileSync(eventsNdjsonPath, 'utf8');
    const eventsHash = sha256(eventsContent);

    // Build capsule with events pointer
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
      events: {
        format: 'ndjson',
        path: eventsNdjsonPath,
        sha256: eventsHash,
        count: bridge.events.length
      }
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

    // Write outputs (events already written before capsule build)
    writeProofCapsule(proofJsonPath, capsule);
    writeReport(reportPath, report);

    // Output summary
    console.log(`[VECTOR RUN] board=${boardId} vectors=${passed + failed} pass=${passed} fail=${failed}`);
    console.log(`[PROOF] capsule=${proofJsonPath}`);
    console.log(`[REPORT] report=${reportPath}`);
    console.log(`[EVENTS] events=${eventsNdjsonPath}`);
    
    // Machine-parsable summary for CI/logging
    const verdict = failed === 0 ? 'PASS' : 'FAIL';
    console.log(`[RUN] task=vectors board=${boardId} dut=${dutMode} vectors=${passed + failed} verdict=${verdict} capsule=${proofJsonPath}`);

    let replayVerdict = 'SKIPPED';
    
    // Call replay on generated capsule (if enabled)
    if (replayEnabled) {
      console.log(`\n[REPLAY] Starting proof replay...`);
      try {
        const { spawn } = await import('child_process');
        const replayProcess = spawn('pnpm', ['--filter', '@redbyte/fpga-bridge', 'proof:replay', proofJsonPath], {
          cwd: REPO_ROOT,
          stdio: 'inherit'
        });

        await new Promise((resolve, reject) => {
          replayProcess.on('exit', code => {
            if (code === 0) {
              replayVerdict = 'PASS';
              resolve();
            } else {
              replayVerdict = 'FAIL';
              reject(new Error(`Replay exited with code ${code}`));
            }
          });
          replayProcess.on('error', reject);
        });
      } catch (replayError) {
        console.warn(`[REPLAY] Could not run proof:replay: ${replayError.message}`);
        replayVerdict = 'FAIL';
        // Don't fail if replay fails—vector run succeeded
      }
    } else {
      console.log(`\n[REPLAY] Skipped (use --replay or RB_FPGA_REPLAY=1 to enable)`);
    }

    // Final summary (always last line, CI can parse this)
    const finalVerdict = (verdict === 'PASS' && (replayVerdict === 'PASS' || replayVerdict === 'SKIPPED')) ? 'PASS' : 'FAIL';
    const failReason = verdict === 'FAIL' ? 'vectors_failed' : (replayVerdict === 'FAIL' ? 'replay_failed' : null);
    
    console.log(`[FINAL] task=vectors verdict=${finalVerdict}${failReason ? ' reason=' + failReason : ''} capsule=${proofJsonPath}`);

    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();
