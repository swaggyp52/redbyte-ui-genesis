// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, TickEngineConfig } from '@redbyte/rb-logic-core';
import type { TestVector, IoMapping } from '@redbyte/rb-utils';
import { TickEngine } from '@redbyte/rb-logic-core';
import type { SequentialAnalysis } from './sequentialAnalysis';
import { analyzeSequentialLogic } from './sequentialAnalysis';
import { injectSimClock } from './simClockInjection';

/**
 * Sample of signals at a specific tick and phase
 */
export interface TraceSample {
  tick: number;
  phase: 'pre' | 'post';
  signals: Record<string, number>;
}

/**
 * Result of vector execution
 */
export interface VectorRunResult {
  pass: boolean;
  trace: TraceSample[];
  failures: Array<{
    tick: number;
    signal: string;
    expected: number;
    actual: number;
  }>;
  deterministicHash: string;
  schedule: 'combinational' | 'clocked_macro';
  warningBanner?: string; // e.g., "No clock mapped; using internal sim clock"
}

/**
 * Deterministic test vector runner
 *
 * Supports two execution schedules:
 *   - combinational: drive → tick() → sample/assert
 *   - clocked_macro: drive → (clk=0 tick) → (clk=1 tick) → (clk=0 tick) → sample/assert
 *
 * The 3-tick clocked_macro schedule matches the latch-gated behavior of DFlipFlop/etc.
 */
export async function runTestVectors(
  circuit: Circuit,
  vectors: TestVector[],
  ioMapping?: IoMapping
): Promise<VectorRunResult> {
  // Analyze sequential logic
  const analysis = analyzeSequentialLogic(circuit, ioMapping);

  // Determine schedule
  const schedule = analysis.hasClockedMacros ? 'clocked_macro' : 'combinational';

  // Prepare circuit (clone for safety)
  let simCircuit = JSON.parse(JSON.stringify(circuit));

  let warningBanner: string | undefined;
  if (analysis.hasClockedMacros && !analysis.hasClockNet) {
    // Inject internal sim clock
    injectSimClock(simCircuit, analysis.sequentialNodes.map((n) => n.id));
    warningBanner = 'No clock mapped; Verify used internal sim clock. Export will require CLK100MHZ mapping.';
  }

  // Create tick engine
  const tickEngine = new TickEngine(simCircuit, { tickRate: 100 } as TickEngineConfig);
  const engine = tickEngine.getEngine();

  const trace: TraceSample[] = [];
  const failures: Array<{
    tick: number;
    signal: string;
    expected: number;
    actual: number;
  }> = [];

  // Execute vectors
  for (let tickIdx = 0; tickIdx < vectors.length; tickIdx++) {
    const vector = vectors[tickIdx];

    if (schedule === 'combinational') {
      executeCombinatorialStep(engine, vector, tickIdx, trace, failures);
    } else {
      executeClockedMacroStep(engine, vector, tickIdx, trace, failures);
    }
  }

  // Compute deterministic hash
  const deterministicHash = computeDeterministicHash(trace);

  const pass = failures.length === 0;

  return {
    pass,
    trace,
    failures,
    deterministicHash,
    schedule,
    warningBanner,
  };
}

/**
 * Combinational execution: drive inputs → tick → sample
 */
function executeCombinatorialStep(
  engine: any,
  vector: TestVector,
  tickIdx: number,
  trace: TraceSample[],
  failures: Array<{ tick: number; signal: string; expected: number; actual: number }>
): void {
  // Drive inputs
  for (const [portName, value] of Object.entries(vector.inputs)) {
    driveInput(engine, portName, value);
  }

  // Combinational settle
  engine.tick();

  // Sample outputs
  const signals = engine.getAllSignals();
  const sampleData: Record<string, number> = {};

  for (const [key, val] of signals.entries()) {
    sampleData[key] = typeof val === 'number' ? val : val === 1 ? 1 : 0;
  }

  trace.push({
    tick: tickIdx,
    phase: 'post',
    signals: sampleData,
  });

  // Check expected outputs
  if (vector.expected) {
    for (const [portName, expected] of Object.entries(vector.expected)) {
      const expectedVal = typeof expected === 'boolean' ? (expected ? 1 : 0) : expected;
      const key = findSignalKey(signals, portName);
      if (key) {
        const actual = typeof signals.get(key) === 'number' ? signals.get(key) : 0;
        if (actual !== expectedVal) {
          failures.push({
            tick: tickIdx,
            signal: portName,
            expected: expectedVal,
            actual,
          });
        }
      }
    }
  }
}

/**
 * Clocked macro execution: 3-tick schedule
 *   1. Drive inputs (hold stable)
 *   2. clk=0 → tick() (settle/hold phase)
 *   3. clk=1 → tick() (transparent/update into latch)
 *   4. clk=0 → tick() (hold/latch captures)
 *   5. Sample outputs (post)
 */
function executeClockedMacroStep(
  engine: any,
  vector: TestVector,
  tickIdx: number,
  trace: TraceSample[],
  failures: Array<{ tick: number; signal: string; expected: number; actual: number }>
): void {
  // Drive inputs (hold them for 3 ticks)
  for (const [portName, value] of Object.entries(vector.inputs)) {
    driveInput(engine, portName, value);
  }

  // Three-tick clock sequence
  // Tick 0: clk=0, settle/hold phase
  driveInput(engine, '__sim_clk__', 0);
  engine.tick();

  // Tick 1: clk=1, transparent/update phase
  driveInput(engine, '__sim_clk__', 1);
  engine.tick();

  // Tick 2: clk=0, latch holds
  driveInput(engine, '__sim_clk__', 0);
  engine.tick();

  // Sample outputs (post-clock)
  const signals = engine.getAllSignals();
  const sampleData: Record<string, number> = {};

  for (const [key, val] of signals.entries()) {
    sampleData[key] = typeof val === 'number' ? val : val === 1 ? 1 : 0;
  }

  trace.push({
    tick: tickIdx,
    phase: 'post',
    signals: sampleData,
  });

  // Check expected outputs
  if (vector.expected) {
    for (const [portName, expected] of Object.entries(vector.expected)) {
      const expectedVal = typeof expected === 'boolean' ? (expected ? 1 : 0) : expected;
      const key = findSignalKey(signals, portName);
      if (key) {
        const actual = typeof signals.get(key) === 'number' ? signals.get(key) : 0;
        if (actual !== expectedVal) {
          failures.push({
            tick: tickIdx,
            signal: portName,
            expected: expectedVal,
            actual,
          });
        }
      }
    }
  }
}

/**
 * Drive an input signal (for both user inputs and clock)
 */
function driveInput(engine: any, portName: string, value: any): void {
  const inputVal = typeof value === 'boolean' ? (value ? 1 : 0) : typeof value === 'number' ? value : 0;

  // Find the input node in the circuit (typically a Switch or InputPin)
  const circuit = engine.getCircuit();
  const inputNode = circuit.nodes.find((n: any) => n.label === portName || n.id === portName);

  if (inputNode && inputNode.type === 'Switch') {
    engine.setNodeState(inputNode.id, { isOn: inputVal });
  } else if (inputNode && inputNode.type === '__sim_clk__') {
    engine.setNodeState(inputNode.id, { isOn: inputVal });
  } else if (portName === '__sim_clk__') {
    // Direct clock drive
    const simClk = circuit.nodes.find((n: any) => n.id === '__sim_clk__');
    if (simClk) {
      engine.setNodeState(simClk.id, { isOn: inputVal });
    }
  }
}

/**
 * Find signal key by port name in signal map
 */
function findSignalKey(signals: Map<string, any>, portName: string): string | undefined {
  // Try exact match first
  if (signals.has(portName)) return portName;

  // Try matching node output: "nodeId.portName"
  for (const key of signals.keys()) {
    if (key.endsWith(`.${portName}`)) {
      return key;
    }
  }

  // Try label match
  for (const key of signals.keys()) {
    if (key.includes(portName)) {
      return key;
    }
  }

  return undefined;
}

/**
 * Compute deterministic hash of trace
 * Uses simple string-based hash (not cryptographic, but deterministic)
 */
function computeDeterministicHash(trace: TraceSample[]): string {
  // Normalize trace to stable JSON
  const normalized = trace
    .sort((a, b) => a.tick - b.tick)
    .map((sample) => ({
      tick: sample.tick,
      phase: sample.phase,
      signals: Object.keys(sample.signals)
        .sort()
        .reduce(
          (acc, key) => {
            acc[key] = sample.signals[key];
            return acc;
          },
          {} as Record<string, number>
        ),
    }));

  const json = JSON.stringify(normalized);

  // Simple hash: sum of character codes
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `sha:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}
