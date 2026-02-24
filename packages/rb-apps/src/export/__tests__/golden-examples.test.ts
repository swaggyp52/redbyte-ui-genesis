/**
 * GOLDEN EXAMPLES CI GATE
 *
 * These tests are STOP-SHIP gates for the three IDE showcase examples.
 * Every example must:
 *   1. Verify deterministically (all vectors pass)
 *   2. Export without spurious "no driver" warnings for INPUT/OUTPUT nodes
 *
 * Run: pnpm vitest run src/export/__tests__/golden-examples.test.ts
 */
import { describe, it, expect } from 'vitest';
import { getIdeExampleById } from '../../apps/ide/examplesCatalog';
import {
  buildVerifyRowsDeterministicFromCircuit,
} from '../../apps/ide/sim/simEngine';
import { buildVerifyReport } from '../../apps/ide/verifyReport';
import { runTestVectors } from '../../fpga/boards/basys3/vectorRunner';
import { circuitToVerilog } from '@redbyte/rb-fpga-toolchain';
import type { SimulationIoRow } from '../../apps/ide/sim/simTypes';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { CircuitV1 } from '@redbyte/rb-utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert IdeExampleDefinition.ioRows to SimulationIoRow[] (structurally compatible) */
function toSimIoRows(ioRows: { id: string; label: string; direction: 'in' | 'out'; nodeId: string }[]): SimulationIoRow[] {
  return ioRows.map((row) => ({
    id: row.id,
    label: row.label,
    direction: row.direction,
    nodeId: row.nodeId,
  }));
}

/** Convert Circuit (modern PortRef format) to CircuitV1 legacy format for Verilog generator */
function toCircuitV1(circuit: Circuit): CircuitV1 {
  return {
    nodes: (circuit.nodes as any[]).map((n: any) => ({
      id: n.id,
      type: n.type,
      label: n.label ?? n.id,
      x: n.x ?? n.position?.x ?? 0,
      y: n.y ?? n.position?.y ?? 0,
      config: n.config ?? {},
    })),
    connections: (circuit.connections as any[]).map((c: any) => {
      const fromNodeId = typeof c.from === 'string' ? c.from : c.from.nodeId;
      const toNodeId = typeof c.to === 'string' ? c.to : c.to.nodeId;
      const fromPin =
        typeof c.from === 'string'
          ? c.fromPin ?? c.fromPort ?? 'out'
          : c.from.portName ?? c.from.port ?? c.fromPin ?? 'out';
      const toPin =
        typeof c.to === 'string'
          ? c.toPin ?? c.toPort ?? 'in'
          : c.to.portName ?? c.to.port ?? c.toPin ?? 'in';
      return { fromNodeId, fromPin, toNodeId, toPin };
    }),
  } as CircuitV1;
}

// ─── GOLDEN GATE 1: Signal Tour ───────────────────────────────────────────────

describe('GOLDEN — Signal Tour: Switches → LEDs', () => {
  const example = getIdeExampleById('signal-tour');

  it('example definition exists', () => {
    expect(example).toBeDefined();
  });

  it('has 8 test vectors', () => {
    expect(example!.vectors).toHaveLength(8);
  });

  it('verifies deterministically: all 8 vectors pass', () => {
    const ioRows = toSimIoRows(example!.ioRows);
    const rows = buildVerifyRowsDeterministicFromCircuit(
      example!.circuit as Circuit,
      ioRows,
      example!.vectors
    );
    expect(rows.length).toBeGreaterThan(0);
    const failures = rows.filter((r) => r.expected !== r.actual);
    expect(failures).toHaveLength(0);
  });

  it('buildVerifyReport status is pass', () => {
    const ioRows = toSimIoRows(example!.ioRows);
    const rows = buildVerifyRowsDeterministicFromCircuit(
      example!.circuit as Circuit,
      ioRows,
      example!.vectors
    );
    const report = buildVerifyReport({
      scenarioId: 'signal-tour-gate',
      scenarioName: 'Signal Tour gate',
      status: rows.filter((r) => r.expected !== r.actual).length === 0 ? 'pass' : 'fail',
      deterministicHash: 'gate_test',
      rows,
      vectors: [],
      generatedAtIso: new Date().toISOString(),
    });
    expect(report.status).toBe('pass');
    expect(report.firstFailingTick).toBeUndefined();
  });

  it('runTestVectors (vectorRunner path) pass === true', async () => {
    const result = await runTestVectors(
      example!.circuit as Circuit,
      example!.vectors
    );
    expect(result.failures).toHaveLength(0);
    expect(result.pass).toBe(true);
  });
});

// ─── GOLDEN GATE 2: Logic Gates ──────────────────────────────────────────────

describe('GOLDEN — Logic Gates: AND / OR / XOR', () => {
  const example = getIdeExampleById('logic-gates');

  it('example definition exists', () => {
    expect(example).toBeDefined();
  });

  it('has 4 test vectors', () => {
    expect(example!.vectors).toHaveLength(4);
  });

  it('verifies deterministically: all 4 vectors pass', () => {
    const ioRows = toSimIoRows(example!.ioRows);
    const rows = buildVerifyRowsDeterministicFromCircuit(
      example!.circuit as Circuit,
      ioRows,
      example!.vectors
    );
    expect(rows.length).toBeGreaterThan(0);
    const failures = rows.filter((r) => r.expected !== r.actual);
    expect(failures).toHaveLength(0);
  });

  it('buildVerifyReport status is pass', () => {
    const ioRows = toSimIoRows(example!.ioRows);
    const rows = buildVerifyRowsDeterministicFromCircuit(
      example!.circuit as Circuit,
      ioRows,
      example!.vectors
    );
    const report = buildVerifyReport({
      scenarioId: 'logic-gates-gate',
      scenarioName: 'Logic Gates gate',
      status: rows.filter((r) => r.expected !== r.actual).length === 0 ? 'pass' : 'fail',
      deterministicHash: 'gate_test',
      rows,
      vectors: [],
      generatedAtIso: new Date().toISOString(),
    });
    expect(report.status).toBe('pass');
  });
});

// ─── GOLDEN GATE 3: 2-Bit Counter ────────────────────────────────────────────

describe('GOLDEN — 2-Bit Up Counter', () => {
  const example = getIdeExampleById('two-bit-counter');

  it('example definition exists', () => {
    expect(example).toBeDefined();
  });

  it('has 6 test vectors', () => {
    expect(example!.vectors).toHaveLength(6);
  });

  it('verifies deterministically: all 6 vectors pass', () => {
    // Counter uses DFlipFlop (transparent latch) — requires explicit CLK macro per vector.
    // Direct CircuitEngine simulation: apply inputs, drive CLK 0→1→0, read OUTPUT state.isOn.
    const engine = new CircuitEngine(JSON.parse(JSON.stringify(example!.circuit)));

    // Boot-reset warmup: DFlipFlop composite SR-NAND latch initializes at Q=1,Q_inv=1 (invalid
    // state) due to all-zero signals on construction. With EN=1, one CLK pulse computes
    // D0=XOR(1,1)=0 and D1=XOR(1,1)=0, clocking both FFs to Q=0 — the correct start state
    // for vector 0 (which expects q0=1 after the first count from 00→01).
    engine.setNodeValue('en_node', 1 as 0 | 1);
    engine.setNodeValue('clk_node', 0 as 0 | 1); engine.tick();
    engine.setNodeValue('clk_node', 1 as 0 | 1); engine.tick();
    engine.setNodeValue('clk_node', 0 as 0 | 1); engine.tick();

    const failures: Array<{ tick: number; signal: string; expected: number; actual: number }> = [];

    for (const vector of example!.vectors) {
      const tick = typeof vector.tick === 'number' ? vector.tick : 0;

      // Drive data inputs (skip clk_node — we drive it manually below)
      for (const [nodeId, value] of Object.entries(vector.inputs ?? {})) {
        if (nodeId === 'clk_node') continue;
        engine.setNodeValue(nodeId, (value ? 1 : 0) as 0 | 1);
      }

      // CLK macro: hold(0) → rising-edge(1) → hold(0)
      engine.setNodeValue('clk_node', 0); engine.tick();
      engine.setNodeValue('clk_node', 1); engine.tick();
      engine.setNodeValue('clk_node', 0); engine.tick();

      // Read OUTPUT node state.isOn (OUTPUTBehavior stores value in state, not signalCache)
      for (const [nodeId, expected] of Object.entries(vector.expected ?? {})) {
        const nodeState = engine.getNodeState(nodeId);
        const actual: number = nodeState?.isOn === 1 || nodeState?.isOn === true ? 1 : 0;
        const expectedNum: number =
          expected === 1 || (expected as unknown as boolean) === true ? 1 : 0;
        if (actual !== expectedNum) {
          failures.push({ tick, signal: nodeId, expected: expectedNum, actual });
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(`Counter CLK-macro failures (${failures.length}):\n${JSON.stringify(failures, null, 2)}`);
    }
  });
});

describe('GOLDEN — Verilog export: no false "no driver" for INPUT nodes', () => {
  it('signal-tour: INPUT nodes (sw0..sw3) produce no driver warnings', () => {
    const example = getIdeExampleById('signal-tour')!;
    const v1 = toCircuitV1(example.circuit as Circuit);
    const result = circuitToVerilog(v1);
    // No warning should mention sw0_node, sw1_node, sw2_node, sw3_node as missing drivers
    const driverWarnings = result.warnings.filter((w: string) =>
      w.includes('has no driver') && (
        w.includes('sw0_node') ||
        w.includes('sw1_node') ||
        w.includes('sw2_node') ||
        w.includes('sw3_node')
      )
    );
    if (driverWarnings.length > 0) {
      throw new Error(`INPUT node warnings (all warnings: ${JSON.stringify(result.warnings)}):\n${JSON.stringify(driverWarnings)}`);
    }
  });

  it('signal-tour: OUTPUT nodes (ld0..ld3) produce no driver warnings', () => {
    const example = getIdeExampleById('signal-tour')!;
    const v1 = toCircuitV1(example.circuit as Circuit);
    const result = circuitToVerilog(v1);
    const driverWarnings = result.warnings.filter((w: string) =>
      w.includes('has no driver') && (
        w.includes('ld0_node') ||
        w.includes('ld1_node') ||
        w.includes('ld2_node') ||
        w.includes('ld3_node')
      )
    );
    expect(driverWarnings).toHaveLength(0);
  });
});

// ─── Regression: resolveVectorBitSymbol nodeId lookup ────────────────────────

describe('REGRESSION — B1: resolveVectorBitSymbol must match nodeId keys', () => {
  it('signal-tour vectors use nodeId keys (ld0_node) not label keys (ld0)', () => {
    // All expected keys in signal-tour use nodeId format
    const example = getIdeExampleById('signal-tour')!;
    const allInputKeys = example.vectors.flatMap((v) => Object.keys(v.inputs ?? {}));
    const allExpectedKeys = example.vectors.flatMap((v) => Object.keys(v.expected ?? {}));
    // Confirm they use nodeId format (contain underscore)
    expect(allInputKeys.every((k) => k.endsWith('_node'))).toBe(true);
    expect(allExpectedKeys.every((k) => k.endsWith('_node'))).toBe(true);
  });

  it('buildVerifyRowsDeterministicFromCircuit resolves nodeId-keyed expected values', () => {
    const example = getIdeExampleById('signal-tour')!;
    const ioRows = toSimIoRows(example.ioRows);
    const rows = buildVerifyRowsDeterministicFromCircuit(
      example.circuit as Circuit,
      ioRows,
      // Use only tick 1 vector: sw0=1, expected ld0=1
      [example.vectors[1]!]
    );
    const ld0Row = rows.find((r) => r.signal === 'ld0');
    expect(ld0Row).toBeDefined();
    expect(ld0Row!.expected).toBe('1');
  });
});
