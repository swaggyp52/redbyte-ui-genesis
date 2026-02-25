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
import {
  exportBasys3Bundle,
} from '../../fpga/boards/basys3/basys3Bundle';
import type { SimulationIoRow } from '../../apps/ide/sim/simTypes';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { CircuitV1, IoMapping } from '@redbyte/rb-utils';

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

  it('has 7 test vectors', () => {
    expect(example!.vectors).toHaveLength(7);
  });

  it('verifies deterministically: all 7 vectors pass', () => {
    // Counter uses DFlipFlop (transparent latch) — requires explicit CLK macro per vector.
    // Direct CircuitEngine simulation: apply inputs, drive CLK 0→1→0, read OUTPUT state.isOn.
    const engine = new CircuitEngine(JSON.parse(JSON.stringify(example!.circuit)));

    // Boot-reset warmup: DFlipFlop composite SR-NAND latch initializes at Q=1,Q_inv=1 (invalid
    // state) due to all-zero signals on construction. With EN=1 and RST=0, one CLK pulse computes
    // D0=XOR(1,1)=0 and D1=XOR(1,1)=0, clocking both FFs to Q=0 — the correct start state
    // for vector 0 (which asserts RST=1 and confirms Q stays 00).
    engine.setNodeValue('en_node', 1 as 0 | 1);
    engine.setNodeValue('rst_node', 0 as 0 | 1);
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

// ─── GOLDEN GATE 4: Bundle validity for all 3 shipped examples ───────────────

/** Build IoMapping from an example's ioRows (uses port/pin as-is from catalog). */
function exampleToIoMapping(example: { ioRows: Array<{ id: string; nodeId: string; port: string; label: string; direction: 'in' | 'out'; pin: string }> }): IoMapping {
  return {
    inputs: example.ioRows
      .filter((r) => r.direction === 'in')
      .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
    outputs: example.ioRows
      .filter((r) => r.direction === 'out')
      .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
  };
}

describe('GOLDEN — Bundle validity: all 5 examples produce bundle.valid === true', () => {
  it('signal-tour: bundle.valid === true', () => {
    const ex = getIdeExampleById('signal-tour')!;
    const bundle = exportBasys3Bundle(ex.circuit as Circuit, exampleToIoMapping(ex));
    if (!bundle.valid) {
      throw new Error(`signal-tour bundle.valid is false. warnings: ${JSON.stringify(bundle.warnings)}`);
    }
    expect(bundle.valid).toBe(true);
  });

  it('logic-gates: bundle.valid === true', () => {
    const ex = getIdeExampleById('logic-gates')!;
    const bundle = exportBasys3Bundle(ex.circuit as Circuit, exampleToIoMapping(ex));
    if (!bundle.valid) {
      throw new Error(`logic-gates bundle.valid is false. warnings: ${JSON.stringify(bundle.warnings)}`);
    }
    expect(bundle.valid).toBe(true);
  });

  it('two-bit-counter: bundle.valid === true', () => {
    const ex = getIdeExampleById('two-bit-counter')!;
    const bundle = exportBasys3Bundle(ex.circuit as Circuit, exampleToIoMapping(ex));
    if (!bundle.valid) {
      throw new Error(`two-bit-counter bundle.valid is false. warnings: ${JSON.stringify(bundle.warnings)}`);
    }
    expect(bundle.valid).toBe(true);
  });

  it('half-adder: bundle.valid === true', () => {
    const ex = getIdeExampleById('half-adder')!;
    const bundle = exportBasys3Bundle(ex.circuit as Circuit, exampleToIoMapping(ex));
    if (!bundle.valid) {
      throw new Error(`half-adder bundle.valid is false. warnings: ${JSON.stringify(bundle.warnings)}`);
    }
    expect(bundle.valid).toBe(true);
  });

  it('full-adder: bundle.valid === true', () => {
    const ex = getIdeExampleById('full-adder')!;
    const bundle = exportBasys3Bundle(ex.circuit as Circuit, exampleToIoMapping(ex));
    if (!bundle.valid) {
      throw new Error(`full-adder bundle.valid is false. warnings: ${JSON.stringify(bundle.warnings)}`);
    }
    expect(bundle.valid).toBe(true);
  });
});

// ─── GOLDEN GATE 5: Verify must pass — with full diagnostic dump ──────────────
//
// Uses the vectorRunner path (same as STOP-SHIP 7) because it exercises the
// actual board-level scheduling logic. On failure the thrown message includes:
//   tick, signal, expected, actual, AND the Fix-path nodeId from ioRows.
// This is the exact information shown in VerifySurface → Mismatch Detail.

/**
 * Map a failing signal key (which is a nodeId) back to the ioRow so we can
 * include the "Fix in Design" target in the failure dump.
 */
function failureToFixPath(signal: string, ioRows: Array<{ nodeId: string; id: string; label: string }>) {
  const row = ioRows.find((r) => r.nodeId === signal || r.id === signal);
  return row ? `node=${row.nodeId} (label: ${row.label})` : `unknown nodeId "${signal}"`;
}

describe('GOLDEN — Gate A: verify must pass (full diagnostic dump)', () => {
  it.each([
    'signal-tour',
    'logic-gates',
    'two-bit-counter',
    'half-adder',
    'full-adder',
  ] as const)('%s: runTestVectors pass === true', async (exampleId) => {
    const ex = getIdeExampleById(exampleId)!;
    const result = await runTestVectors(ex.circuit as Circuit, ex.vectors);

    if (!result.pass || result.failures.length > 0) {
      const lines = result.failures.map((f) => {
        const fixPath = failureToFixPath(f.signal, ex.ioRows);
        return `  tick=${f.tick} signal=${f.signal} expected=${f.expected} actual=${f.actual} → fix: ${fixPath}`;
      });
      throw new Error(
        `[${exampleId}] ${result.failures.length} verify failure(s):\n${lines.join('\n')}\n` +
        `Schedule: ${result.schedule}  hash: ${result.deterministicHash}\n` +
        (result.warningBanner ? `Warning: ${result.warningBanner}` : '')
      );
    }

    expect(result.pass).toBe(true);
    expect(result.failures).toHaveLength(0);
  });
});

// ─── GOLDEN GATE 6: Mapping completeness — exact pins, no swaps ──────────────
//
// Asserts the catalog's declared pin assignments are stable and internally
// consistent. A scrambled catalog (swapped pins, duplicates, missing entries)
// will break this gate before it wastes a Vivado run.

/** Canonical pin assignments for every shipped example (sourced from examplesCatalog). */
const EXAMPLE_PIN_CONTRACT: Record<string, Record<string, string>> = {
  'signal-tour': {
    sw0: 'V17', sw1: 'V16', sw2: 'W16', sw3: 'W17',
    ld0: 'U16', ld1: 'E19', ld2: 'U19', ld3: 'V19',
  },
  'logic-gates': {
    sw0: 'V17', sw1: 'V16',
    ld0: 'U16', ld1: 'E19', ld2: 'U19',
  },
  'two-bit-counter': {
    clk: 'W5', en: 'V17', rst: 'U18',
    q0: 'U16', q1: 'E19',
  },
  'half-adder': {
    sw0: 'V17', sw1: 'W16',
    ld0: 'U16', ld1: 'E19',
  },
  'full-adder': {
    sw0: 'V17', sw1: 'W16', sw2: 'W15',
    ld0: 'U16', ld1: 'E19',
  },
};

describe('GOLDEN — Gate B: mapping completeness and exact pin contract', () => {
  it.each([
    'signal-tour',
    'logic-gates',
    'two-bit-counter',
    'half-adder',
    'full-adder',
  ] as const)('%s: all pins present, no duplicates, exact contract matches', (exampleId) => {
    const ex = getIdeExampleById(exampleId)!;
    const mapping = exampleToIoMapping(ex);
    const allRows = [...mapping.inputs, ...mapping.outputs];

    // 1. All pins are non-empty strings
    const emptyPins = allRows.filter((r) => !r.pin || r.pin.trim().length === 0);
    if (emptyPins.length > 0) {
      throw new Error(
        `[${exampleId}] ${emptyPins.length} row(s) have empty pins: ` +
        emptyPins.map((r) => r.id).join(', ')
      );
    }

    // 2. No duplicate pin assignments (swap detection)
    const pins = allRows.map((r) => r.pin);
    const duplicates = pins.filter((p, i) => pins.indexOf(p) !== i);
    if (duplicates.length > 0) {
      throw new Error(
        `[${exampleId}] Duplicate pin(s) — possible swap: ${[...new Set(duplicates)].join(', ')}\n` +
        allRows.map((r) => `  ${r.id}: ${r.pin}`).join('\n')
      );
    }

    // 3. Exact pin contract (catches catalog edits that silently change the wiring)
    const contract = EXAMPLE_PIN_CONTRACT[exampleId];
    if (contract) {
      for (const [rowId, expectedPin] of Object.entries(contract)) {
        const row = allRows.find((r) => r.id === rowId);
        if (!row) {
          throw new Error(`[${exampleId}] Contract row "${rowId}" not found in ioRows`);
        }
        if (row.pin !== expectedPin) {
          throw new Error(
            `[${exampleId}] Pin mismatch for "${rowId}": ` +
            `catalog says ${row.pin}, contract expects ${expectedPin}`
          );
        }
      }
    }

    expect(allRows.length).toBeGreaterThan(0);
  });
});
