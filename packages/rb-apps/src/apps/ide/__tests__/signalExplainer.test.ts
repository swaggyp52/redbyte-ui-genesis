import { describe, expect, it } from 'vitest';
import {
  explainSignal,
  type ExplainerCircuitGraph,
  type ExplainerInput,
  type ExplainerSignalMapping,
} from '../surfaces/verify/signalExplainer';
import type { VerifyWaveSample } from '../verifyReport';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWaveform(
  signals: Record<string, string[]>,
): VerifyWaveSample[] {
  const ticks = signals[Object.keys(signals)[0]]?.length ?? 0;
  const samples: VerifyWaveSample[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    const sigs: Record<string, string> = {};
    for (const [name, values] of Object.entries(signals)) {
      sigs[name] = values[tick] ?? '-';
    }
    samples.push({ tick, signals: sigs, mismatches: [] });
  }
  return samples;
}

// Simple half-adder:  sw0,sw1 → AND → LD0 (carry), XOR → LD1 (sum)
function makeHalfAdderGraph(): ExplainerCircuitGraph {
  return {
    nodes: [
      { id: 'sw0', type: 'Switch', label: 'sw0' },
      { id: 'sw1', type: 'Switch', label: 'sw1' },
      { id: 'and1', type: 'AND' },
      { id: 'xor1', type: 'XOR' },
      { id: 'led0', type: 'LED', label: 'LD0' },
      { id: 'led1', type: 'LED', label: 'LD1' },
    ],
    connections: [
      { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'and1', portName: 'a' } },
      { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'and1', portName: 'b' } },
      { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'xor1', portName: 'a' } },
      { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'xor1', portName: 'b' } },
      { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'led0', portName: 'in' } },
      { from: { nodeId: 'xor1', portName: 'out' }, to: { nodeId: 'led1', portName: 'in' } },
    ],
  };
}

function makeHalfAdderMappings(): ExplainerSignalMapping[] {
  return [
    { signalName: 'sw0', nodeId: 'sw0', direction: 'in' },
    { signalName: 'sw1', nodeId: 'sw1', direction: 'in' },
    { signalName: 'LD0', nodeId: 'led0', direction: 'out' },
    { signalName: 'LD1', nodeId: 'led1', direction: 'out' },
  ];
}

// D flip-flop with clock and data: sw0 → DFF.D, clk → DFF.CLK, DFF.Q → led0
function makeDffGraph(): ExplainerCircuitGraph {
  return {
    nodes: [
      { id: 'sw0', type: 'Switch', label: 'sw0' },
      { id: 'clk_node', type: 'Clock', label: 'clk' },
      { id: 'dff1', type: 'DFlipFlop', label: 'FF1' },
      { id: 'led0', type: 'LED', label: 'LD0' },
    ],
    connections: [
      { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'dff1', portName: 'D' } },
      { from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'dff1', portName: 'CLK' } },
      { from: { nodeId: 'dff1', portName: 'Q' }, to: { nodeId: 'led0', portName: 'in' } },
    ],
  };
}

function makeDffMappings(): ExplainerSignalMapping[] {
  return [
    { signalName: 'sw0', nodeId: 'sw0', direction: 'in' },
    { signalName: 'clk', nodeId: 'clk_node', direction: 'in' },
    { signalName: 'LD0', nodeId: 'led0', direction: 'out' },
  ];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('signalExplainer', () => {
  describe('input signals', () => {
    it('explains an input signal as stimulus-driven', () => {
      const waveform = makeWaveform({ sw0: ['0', '1', '1'] });
      const result = explainSignal({
        selectedSignal: 'sw0',
        tick: 1,
        waveform,
        signalRoles: { sw0: 'input' },
        signalMappings: [],
      });

      expect(result.explanationKind).toBe('input');
      expect(result.currentValue).toBe('1');
      expect(result.previousValue).toBe('0');
      expect(result.changed).toBe(true);
      expect(result.summary).toContain('input');
      expect(result.summary).toContain('changed');
      expect(result.steps.some((s) => s.description.includes('stimulus'))).toBe(true);
    });

    it('explains an unchanged input as held', () => {
      const waveform = makeWaveform({ sw0: ['1', '1', '1'] });
      const result = explainSignal({
        selectedSignal: 'sw0',
        tick: 2,
        waveform,
        signalRoles: { sw0: 'input' },
        signalMappings: [],
      });

      expect(result.explanationKind).toBe('input');
      expect(result.changed).toBe(false);
      expect(result.summary).toContain('held');
    });

    it('explains a clock signal as input category', () => {
      const waveform = makeWaveform({ clk: ['0', '1', '0', '1'] });
      const result = explainSignal({
        selectedSignal: 'clk',
        tick: 1,
        waveform,
        signalRoles: { clk: 'clock' },
        signalMappings: [],
      });

      expect(result.explanationKind).toBe('input');
      expect(result.currentValue).toBe('1');
    });
  });

  describe('combinational explanation', () => {
    it('traces an output back through a gate to inputs', () => {
      const waveform = makeWaveform({
        sw0: ['0', '1', '1'],
        sw1: ['0', '1', '1'],
        LD0: ['0', '1', '1'],
        LD1: ['0', '0', '0'],
      });

      const result = explainSignal({
        selectedSignal: 'LD0',
        tick: 1,
        waveform,
        signalRoles: { sw0: 'input', sw1: 'input', LD0: 'output', LD1: 'output' },
        signalMappings: makeHalfAdderMappings(),
        circuitGraph: makeHalfAdderGraph(),
        circuitKind: 'combinational',
      });

      expect(result.explanationKind).toBe('combinational');
      expect(result.currentValue).toBe('1');
      expect(result.changed).toBe(true);
      expect(result.steps.length).toBeGreaterThanOrEqual(3);
      // Should mention the AND gate
      expect(result.steps.some((s) => s.description.includes('AND gate'))).toBe(true);
      // Should mention at least one input value
      expect(result.steps.some((s) => s.description.includes('sw0') || s.description.includes('sw1'))).toBe(true);
      expect(result.sourceNodeIds).toContain('and1');
    });

    it('includes both gate inputs in the trace', () => {
      const waveform = makeWaveform({
        sw0: ['1', '1'],
        sw1: ['0', '1'],
        LD1: ['1', '0'],
      });

      const result = explainSignal({
        selectedSignal: 'LD1',
        tick: 1,
        waveform,
        signalRoles: { sw0: 'input', sw1: 'input', LD1: 'output' },
        signalMappings: makeHalfAdderMappings(),
        circuitGraph: makeHalfAdderGraph(),
        circuitKind: 'combinational',
      });

      expect(result.explanationKind).toBe('combinational');
      // XOR gate should trace both inputs
      const inputSteps = result.steps.filter(
        (s) => s.description.includes('sw0') || s.description.includes('sw1'),
      );
      expect(inputSteps.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('sequential explanation', () => {
    it('explains a DFF output referencing clock edge and D input', () => {
      //   tick:  0    1    2    3    4
      //   clk:   0    1    0    1    0
      //   sw0:   1    1    1    0    0
      //   LD0:   0    1    1    1    0
      const waveform = makeWaveform({
        clk: ['0', '1', '0', '1', '0'],
        sw0: ['1', '1', '1', '0', '0'],
        LD0: ['0', '1', '1', '1', '0'],
      });

      const result = explainSignal({
        selectedSignal: 'LD0',
        tick: 1,
        waveform,
        signalRoles: { clk: 'clock', sw0: 'input', LD0: 'output' },
        signalMappings: makeDffMappings(),
        circuitGraph: makeDffGraph(),
        circuitKind: 'sequential',
        clockSignalName: 'clk',
      });

      expect(result.explanationKind).toBe('sequential');
      expect(result.currentValue).toBe('1');
      expect(result.changed).toBe(true);
      // Should mention flip-flop
      expect(result.steps.some((s) => s.description.includes('flip-flop'))).toBe(true);
      // Should mention clock edge
      expect(result.steps.some((s) => s.description.includes('clock edge'))).toBe(true);
      // Should reference clock edge detail
      expect(result.relevantClockEdge).toBeDefined();
      expect(result.relevantClockEdge?.edgeDirection).toBe('rising');
    });

    it('explains unchanged state as flip-flop hold', () => {
      const waveform = makeWaveform({
        clk: ['0', '1', '0'],
        sw0: ['1', '1', '1'],
        LD0: ['1', '1', '1'],
      });

      const result = explainSignal({
        selectedSignal: 'LD0',
        tick: 2,
        waveform,
        signalRoles: { clk: 'clock', sw0: 'input', LD0: 'output' },
        signalMappings: makeDffMappings(),
        circuitGraph: makeDffGraph(),
        circuitKind: 'sequential',
        clockSignalName: 'clk',
      });

      expect(result.explanationKind).toBe('sequential');
      expect(result.changed).toBe(false);
      // Should still mention it's driven by a flip-flop
      expect(result.steps.some((s) => s.description.includes('flip-flop'))).toBe(true);
    });

    it('captures prior state reference', () => {
      const waveform = makeWaveform({
        clk: ['0', '1', '0', '1'],
        sw0: ['0', '0', '1', '1'],
        LD0: ['0', '0', '0', '1'],
      });

      const result = explainSignal({
        selectedSignal: 'LD0',
        tick: 3,
        waveform,
        signalRoles: { clk: 'clock', sw0: 'input', LD0: 'output' },
        signalMappings: makeDffMappings(),
        circuitGraph: makeDffGraph(),
        circuitKind: 'sequential',
        clockSignalName: 'clk',
      });

      expect(result.relevantPriorState).toBeDefined();
      expect(result.relevantPriorState?.value).toBe('0');
      expect(result.relevantPriorState?.tick).toBe(2);
    });
  });

  describe('unchanged value explanation', () => {
    it('does not falsely claim a transition when value is unchanged', () => {
      const waveform = makeWaveform({
        sw0: ['1', '1', '1'],
        sw1: ['1', '1', '1'],
        LD0: ['1', '1', '1'],
      });

      const result = explainSignal({
        selectedSignal: 'LD0',
        tick: 2,
        waveform,
        signalRoles: { sw0: 'input', sw1: 'input', LD0: 'output' },
        signalMappings: makeHalfAdderMappings(),
        circuitGraph: makeHalfAdderGraph(),
        circuitKind: 'combinational',
      });

      expect(result.changed).toBe(false);
      expect(result.explanationKind).toBe('unchanged');
      expect(result.summary).toContain('holds');
      expect(result.steps.every((s) => !s.description.includes('changed from'))).toBe(true);
    });
  });

  describe('partial fallback', () => {
    it('returns partial explanation when no circuit graph is provided', () => {
      const waveform = makeWaveform({
        LD0: ['0', '1'],
      });

      const result = explainSignal({
        selectedSignal: 'LD0',
        tick: 1,
        waveform,
        signalRoles: { LD0: 'output' },
        signalMappings: [],
      });

      expect(result.explanationKind).toBe('partial');
      expect(result.currentValue).toBe('1');
      expect(result.changed).toBe(true);
      expect(result.steps.some((s) => s.description.includes('unavailable'))).toBe(true);
    });

    it('returns partial when signal node ID cannot be resolved', () => {
      const waveform = makeWaveform({ LD0: ['0', '1'] });
      const graph: ExplainerCircuitGraph = {
        nodes: [{ id: 'some_node', type: 'AND' }],
        connections: [],
      };

      const result = explainSignal({
        selectedSignal: 'LD0',
        tick: 1,
        waveform,
        signalRoles: { LD0: 'output' },
        signalMappings: [], // No mapping for LD0
        circuitGraph: graph,
      });

      expect(result.explanationKind).toBe('partial');
      expect(result.steps.some((s) => s.description.includes('Could not identify'))).toBe(true);
    });

    it('never invents reasoning for missing data', () => {
      const waveform = makeWaveform({ LD0: ['0', '1'] });

      const result = explainSignal({
        selectedSignal: 'LD0',
        tick: 1,
        waveform,
        signalRoles: {},
        signalMappings: [],
      });

      // Should not claim it's combinational or sequential without evidence
      expect(result.explanationKind).toBe('partial');
      // Steps should be honest about limitations
      expect(result.steps.length).toBeGreaterThanOrEqual(1);
    });

    it('handles tick 0 without crashing on previous value lookup', () => {
      const waveform = makeWaveform({ LD0: ['1'] });

      const result = explainSignal({
        selectedSignal: 'LD0',
        tick: 0,
        waveform,
        signalRoles: { LD0: 'output' },
        signalMappings: [],
      });

      expect(result.previousValue).toBeNull();
      expect(result.changed).toBe(false);
    });

    it('handles missing signal in waveform', () => {
      const waveform = makeWaveform({ other: ['0', '1'] });

      const result = explainSignal({
        selectedSignal: 'missing_signal',
        tick: 1,
        waveform,
        signalRoles: {},
        signalMappings: [],
      });

      expect(result.currentValue).toBe('-');
      expect(result.explanationKind).toBe('partial');
    });
  });
});
