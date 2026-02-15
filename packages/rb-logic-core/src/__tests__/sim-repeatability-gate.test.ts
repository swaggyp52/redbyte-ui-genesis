import { describe, it, expect } from 'vitest';

// Ensure NodeRegistry is populated for CircuitEngine.
import '../index';
import { CircuitEngine } from '../CircuitEngine';
import type { Circuit } from '../types';

function snapshotSignals(engine: CircuitEngine): Array<[string, unknown]> {
  return Array.from(engine.getAllSignals().entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function runFixture(): Array<{ tick: number; signals: Array<[string, unknown]>; out: unknown }> {
  const circuit: Circuit = {
    nodes: [
      { id: 'clk', type: 'Clock', config: { period: 4 }, state: { tickCount: 0 } },
      { id: 'd1', type: 'Delay', config: { delay: 2 }, state: { buffer: [] } },
      { id: 'out', type: 'OUTPUT', state: {} },
    ],
    connections: [
      { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'd1', portName: 'in' } },
      { from: { nodeId: 'd1', portName: 'out' }, to: { nodeId: 'out', portName: 'in' } },
    ],
  };

  const engine = new CircuitEngine(circuit);
  const trace: Array<{ tick: number; signals: Array<[string, unknown]>; out: unknown }> = [];

  for (let t = 0; t < 12; t++) {
    engine.tick();
    trace.push({
      tick: t,
      signals: snapshotSignals(engine),
      out: engine.getNodeState('out')?.isOn ?? 0,
    });
  }

  return trace;
}

describe('sim:repeatability-gate', () => {
  it('produces identical trace on repeated run', () => {
    const a = runFixture();
    const b = runFixture();
    expect(a).toEqual(b);
  });

  it('matches expected delayed clock pattern (sanity)', () => {
    const trace = runFixture();
    const outs = trace.map((e) => e.out);
    // setCircuit() runs one init tick, then the test loop runs 12 more ticks.
    // Clock period 4, delay 2. Starting from tick 0 within the loop:
    // Tick 0: Clock.out=0 (period 4: low for 2 ticks) → Delay input=0
    // Tick 1: Clock.out=1 (now 1 for 2 ticks)           → Delay still has 0 (buffered tick -1)
    // Tick 2: Clock.out=0 (back to low)                 → Delay now outputs prev 1
    // Pattern after init: [0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0]
    expect(outs).toEqual([0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0]);
  });
});

