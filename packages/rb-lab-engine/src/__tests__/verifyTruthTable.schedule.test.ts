import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LabProjectV1, TruthTableCheckpoint } from '@redbyte/rb-utils';

const { DeterministicCircuitEngine } = vi.hoisted(() => {
  const normalizeBit = (value: number | boolean | undefined): number => {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value === 0 ? 0 : 1;
    return 0;
  };

  class DeterministicCircuitEngine {
    static instances: DeterministicCircuitEngine[] = [];

    private readonly values = new Map<string, number>();
    private qState = 0;
    private lastClock = 0;
    readonly clockTrace: number[] = [];

    constructor(_circuit: unknown) {
      DeterministicCircuitEngine.instances.push(this);
    }

    setNodeValue(nodeId: string, value: number | boolean): void {
      this.values.set(nodeId, normalizeBit(value));
    }

    tick(): void {
      const clk = this.values.get('sw_clk') ?? this.values.get('sw_enter') ?? 0;
      const data = this.values.get('sw_d') ?? this.values.get('sw_in0') ?? 0;
      const a = this.values.get('sw_a') ?? 0;
      const b = this.values.get('sw_b') ?? 0;

      // Simple deterministic combinational output.
      this.values.set('comb_and', a & b);

      // Deterministic sequential behavior for tests: toggle on rising edge when D=1.
      if (this.lastClock === 0 && clk === 1 && data === 1) {
        this.qState = this.qState === 1 ? 0 : 1;
      }

      this.clockTrace.push(clk);
      this.lastClock = clk;
    }

    getNodeState(nodeId: string): { isOn?: number } {
      if (nodeId === 'led_q') {
        return { isOn: this.qState };
      }
      if (nodeId === 'out_y') {
        return { isOn: this.values.get('comb_and') ?? 0 };
      }
      return {};
    }

    getNodeValue(nodeId: string, port: string): number {
      if (nodeId === 'ff_q' && port === 'Q') {
        return this.qState;
      }
      if (nodeId === 'and1' && port === 'out') {
        return this.values.get('comb_and') ?? 0;
      }
      return this.values.get(`${nodeId}.${port}`) ?? 0;
    }
  }

  return { DeterministicCircuitEngine };
});

vi.mock('@redbyte/rb-logic-core', () => ({
  CircuitEngine: DeterministicCircuitEngine,
}));

vi.mock('../adapters/circuitAdapter', () => ({
  toLegacyCircuit: (circuit: unknown) => circuit,
}));

import { verifyTruthTable } from '../verification/verifyTruthTable';

function makeClockedProject(): LabProjectV1 {
  return {
    schemaVersion: '1.0',
    projectId: 'clocked-project',
    name: 'Clocked Test Project',
    createdAt: '2026-02-25T00:00:00.000Z',
    updatedAt: '2026-02-25T00:00:00.000Z',
    circuit: {
      schemaVersion: '1.0',
      nodes: [
        { id: 'sw_d', type: 'SWITCH', x: 20, y: 20, label: 'D' },
        { id: 'sw_clk', type: 'SWITCH', x: 20, y: 80, label: 'CLK' },
        { id: 'ff_q', type: 'DFlipFlop', x: 220, y: 50, label: 'FF_Q' },
        { id: 'led_q', type: 'Lamp', x: 420, y: 50, label: 'Q' },
      ],
      connections: [],
    },
    simulation: { tickRate: 10, currentTick: 0, probes: [] },
    evidence: { actions: [], snapshots: [] },
  };
}

function makeCombinationalProject(): LabProjectV1 {
  return {
    schemaVersion: '1.0',
    projectId: 'comb-project',
    name: 'Combinational Test Project',
    createdAt: '2026-02-25T00:00:00.000Z',
    updatedAt: '2026-02-25T00:00:00.000Z',
    circuit: {
      schemaVersion: '1.0',
      nodes: [
        { id: 'sw_a', type: 'SWITCH', x: 20, y: 20, label: 'A' },
        { id: 'sw_b', type: 'SWITCH', x: 20, y: 80, label: 'B' },
        { id: 'and1', type: 'AND', x: 220, y: 50, label: 'and1' },
        { id: 'out_y', type: 'OUTPUT', x: 420, y: 50, label: 'Y' },
      ],
      connections: [],
    },
    simulation: { tickRate: 10, currentTick: 0, probes: [] },
    evidence: { actions: [], snapshots: [] },
  };
}

describe('verifyTruthTable schedule contract', () => {
  beforeEach(() => {
    DeterministicCircuitEngine.instances.length = 0;
  });

  it('uses clocked_macro [0,1,0] and samples post-macro outputs', async () => {
    const checkpoint: TruthTableCheckpoint = {
      id: 'clocked-sequence',
      type: 'truth-table',
      title: 'Clocked Macro Sequence',
      config: {
        schedule: 'clocked_macro',
        clockSignal: 'CLK',
        inputs: ['D', 'CLK'],
        outputs: ['Q'],
        table: [
          { inputs: { D: true, CLK: false }, outputs: { Q: true } },
        ],
      },
      spec: {
        // Intentionally conflicting spec row proves config-first resolution.
        inputs: ['D', 'CLK'],
        outputs: ['Q'],
        expectedTable: [{ D: false, CLK: false, Q: false }],
      },
    };

    const result = await verifyTruthTable(makeClockedProject(), checkpoint);

    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.evidence.actual).toEqual([{ D: 1, Q: 1 }]);

    const engine = DeterministicCircuitEngine.instances[0];
    expect(engine.clockTrace).toEqual([0, 1, 0]);
  });

  it('keeps sequential state carryover deterministic across rows', async () => {
    const checkpoint: TruthTableCheckpoint = {
      id: 'clocked-carryover',
      type: 'truth-table',
      title: 'Clocked Carryover',
      config: {
        schedule: 'clocked_macro',
        clockSignal: 'CLK',
        inputs: ['D', 'CLK'],
        outputs: ['Q'],
        table: [
          { inputs: { D: true, CLK: false }, outputs: { Q: true } },
          { inputs: { D: true, CLK: false }, outputs: { Q: false } },
        ],
      },
      spec: { inputs: ['D', 'CLK'], outputs: ['Q'], expectedTable: [] },
    };

    const result = await verifyTruthTable(makeClockedProject(), checkpoint);

    expect(result.passed).toBe(true);
    expect(result.evidence.actual).toEqual([{ D: 1, Q: 1 }, { D: 1, Q: 0 }]);

    const engine = DeterministicCircuitEngine.instances[0];
    expect(engine.clockTrace).toEqual([0, 1, 0, 0, 1, 0]);
  });

  it('fails deterministically when clocked_macro has no clockSignal', async () => {
    const checkpoint: TruthTableCheckpoint = {
      id: 'clocked-missing-clock',
      type: 'truth-table',
      title: 'Missing Clock Signal',
      config: {
        schedule: 'clocked_macro',
        inputs: ['D'],
        outputs: ['Q'],
        table: [{ inputs: { D: true }, outputs: { Q: true } }],
      },
      spec: { inputs: ['D'], outputs: ['Q'], expectedTable: [] },
    };

    const result = await verifyTruthTable(makeClockedProject(), checkpoint);

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].message).toContain('clockSignal');
  });

  it('preserves legacy spec-only combinational checkpoints', async () => {
    const checkpoint = {
      id: 'legacy-combinational',
      type: 'truth-table',
      title: 'Legacy Combinational',
      spec: {
        inputs: ['A', 'B'],
        outputs: ['Y'],
        expectedTable: [{ A: 1, B: 0, Y: 0 }],
      },
    } as unknown as TruthTableCheckpoint;

    const result = await verifyTruthTable(makeCombinationalProject(), checkpoint);

    expect(result.passed).toBe(true);
    expect(result.evidence.actual).toEqual([{ A: 1, B: 0, Y: 0 }]);
  });

  it('is deterministic across repeated runs for the same input snapshot', async () => {
    const checkpoint: TruthTableCheckpoint = {
      id: 'clocked-determinism',
      type: 'truth-table',
      title: 'Clocked Determinism',
      config: {
        schedule: 'clocked_macro',
        clockSignal: 'CLK',
        inputs: ['D', 'CLK'],
        outputs: ['Q'],
        table: [
          { inputs: { D: true, CLK: false }, outputs: { Q: true } },
          { inputs: { D: true, CLK: false }, outputs: { Q: false } },
        ],
      },
      spec: { inputs: ['D', 'CLK'], outputs: ['Q'], expectedTable: [] },
    };

    const project = makeClockedProject();
    const first = await verifyTruthTable(project, checkpoint);
    const second = await verifyTruthTable(project, checkpoint);

    expect(first.passed).toBe(second.passed);
    expect(first.failures).toEqual(second.failures);
    expect(first.evidence).toEqual(second.evidence);
  });
});
