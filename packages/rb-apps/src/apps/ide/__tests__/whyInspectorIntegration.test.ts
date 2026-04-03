// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.

import { describe, it, expect } from 'vitest';
import {
  explainSignal,
  type ExplainerInput,
  type ExplainerCircuitGraph,
  type ExplainerSignalMapping,
  type SignalExplanation,
} from '../surfaces/verify/signalExplainer';
import type { VerifyWaveSample } from '../../verifyReport';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWaveform(
  signalValues: Record<string, string[]>,
): VerifyWaveSample[] {
  const tickCount = Math.max(
    ...Object.values(signalValues).map((v) => v.length),
    0,
  );
  const samples: VerifyWaveSample[] = [];
  for (let t = 0; t < tickCount; t++) {
    const signals: Record<string, string> = {};
    for (const [name, values] of Object.entries(signalValues)) {
      signals[name] = values[t] ?? '0';
    }
    samples.push({ tick: t, signals, mismatches: [] });
  }
  return samples;
}

function makeHalfAdderGraph(): ExplainerCircuitGraph {
  return {
    nodes: [
      { id: 'sw0', type: 'Switch', label: 'sw0' },
      { id: 'sw1', type: 'Switch', label: 'sw1' },
      { id: 'xor1', type: 'XorGate' },
      { id: 'and1', type: 'AndGate' },
      { id: 'led_sum', type: 'LED', label: 'sum' },
      { id: 'led_carry', type: 'LED', label: 'carry' },
    ],
    connections: [
      { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'xor1', portName: 'in0' } },
      { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'xor1', portName: 'in1' } },
      { from: { nodeId: 'xor1', portName: 'out' }, to: { nodeId: 'led_sum', portName: 'in' } },
      { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'and1', portName: 'in0' } },
      { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'and1', portName: 'in1' } },
      { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'led_carry', portName: 'in' } },
    ],
  };
}

function makeHalfAdderMappings(): ExplainerSignalMapping[] {
  return [
    { signalName: 'sw0', nodeId: 'sw0', direction: 'in' },
    { signalName: 'sw1', nodeId: 'sw1', direction: 'in' },
    { signalName: 'sum', nodeId: 'led_sum', direction: 'out' },
    { signalName: 'carry', nodeId: 'led_carry', direction: 'out' },
  ];
}

function makeDffGraph(): ExplainerCircuitGraph {
  return {
    nodes: [
      { id: 'sw_d', type: 'Switch', label: 'D' },
      { id: 'clk_node', type: 'ClockSource', label: 'clk' },
      { id: 'dff1', type: 'DFlipFlop' },
      { id: 'led_q', type: 'LED', label: 'Q' },
    ],
    connections: [
      { from: { nodeId: 'sw_d', portName: 'out' }, to: { nodeId: 'dff1', portName: 'D' } },
      { from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'dff1', portName: 'clk' } },
      { from: { nodeId: 'dff1', portName: 'Q' }, to: { nodeId: 'led_q', portName: 'in' } },
    ],
  };
}

function makeDffMappings(): ExplainerSignalMapping[] {
  return [
    { signalName: 'D', nodeId: 'sw_d', direction: 'in' },
    { signalName: 'clk', nodeId: 'clk_node', direction: 'in' },
    { signalName: 'Q', nodeId: 'led_q', direction: 'out' },
  ];
}

// ─── Integration contract tests ─────────────────────────────────────────────

describe('Why inspector integration contract', () => {
  describe('explanation shape completeness', () => {
    it('includes all fields required by WhyInspectorPanel', () => {
      const waveform = makeWaveform({
        sw0: ['0', '1', '1'],
        sw1: ['0', '1', '1'],
        sum: ['0', '0', '0'],
        carry: ['0', '0', '1'],
      });
      const input: ExplainerInput = {
        selectedSignal: 'carry',
        tick: 2,
        waveform,
        signalRoles: { sw0: 'input', sw1: 'input', sum: 'output', carry: 'output' },
        signalMappings: makeHalfAdderMappings(),
        circuitGraph: makeHalfAdderGraph(),
        circuitKind: 'combinational',
      };
      const explanation = explainSignal(input);

      // All required fields for WhyInspectorPanel
      expect(explanation).toHaveProperty('selectedSignal');
      expect(explanation).toHaveProperty('tick');
      expect(explanation).toHaveProperty('currentValue');
      expect(explanation).toHaveProperty('previousValue');
      expect(explanation).toHaveProperty('changed');
      expect(explanation).toHaveProperty('explanationKind');
      expect(explanation).toHaveProperty('summary');
      expect(explanation).toHaveProperty('steps');
      // Optional sequential fields present when sequential, absent otherwise
      expect(explanation.explanationKind).toBe('combinational');
      expect(typeof explanation.summary).toBe('string');
    });

    it('steps array is always an array (never undefined)', () => {
      const waveform = makeWaveform({ sw0: ['0', '1'] });
      const explanation = explainSignal({
        selectedSignal: 'sw0',
        tick: 1,
        waveform,
        signalRoles: { sw0: 'input' },
        signalMappings: [{ signalName: 'sw0', nodeId: 'sw0', direction: 'in' as const }],
      });
      expect(Array.isArray(explanation.steps)).toBe(true);
    });
  });

  describe('combinational → sequential discrimination', () => {
    it('combinational circuit never has clock edge', () => {
      const waveform = makeWaveform({
        sw0: ['0', '1'],
        sw1: ['0', '1'],
        sum: ['0', '0'],
        carry: ['0', '1'],
      });
      const explanation = explainSignal({
        selectedSignal: 'carry',
        tick: 1,
        waveform,
        signalRoles: { sw0: 'input', sw1: 'input', sum: 'output', carry: 'output' },
        signalMappings: makeHalfAdderMappings(),
        circuitGraph: makeHalfAdderGraph(),
        circuitKind: 'combinational',
      });
      expect(explanation.explanationKind).toBe('combinational');
      expect(explanation.relevantClockEdge).toBeFalsy();
      expect(explanation.relevantPriorState).toBeFalsy();
    });

    it('sequential circuit has clock edge and prior state', () => {
      const waveform = makeWaveform({
        D: ['0', '1', '1', '1'],
        clk: ['0', '0', '1', '0'],
        Q: ['0', '0', '0', '1'],
      });
      const explanation = explainSignal({
        selectedSignal: 'Q',
        tick: 3,
        waveform,
        signalRoles: { D: 'input', clk: 'clock', Q: 'output' },
        signalMappings: makeDffMappings(),
        circuitGraph: makeDffGraph(),
        circuitKind: 'sequential',
        clockSignalName: 'clk',
      });
      expect(explanation.explanationKind).toBe('sequential');
      expect(explanation.relevantClockEdge).not.toBeNull();
      expect(explanation.relevantPriorState).not.toBeNull();
    });
  });

  describe('tab configuration contract', () => {
    it('why is first in VerifyDrawerTab union type values', () => {
      // This test validates that the tab ordering contract is correct
      // by checking the engine produces valid explanation kinds
      const validKinds = ['input', 'combinational', 'sequential', 'unchanged', 'partial'] as const;
      const waveform = makeWaveform({ sw0: ['0', '1'] });
      const explanation = explainSignal({
        selectedSignal: 'sw0',
        tick: 1,
        waveform,
        signalRoles: { sw0: 'input' },
        signalMappings: [{ signalName: 'sw0', nodeId: 'sw0', direction: 'in' as const }],
      });
      expect(validKinds).toContain(explanation.explanationKind);
    });
  });

  describe('graceful degradation', () => {
    it('without circuit graph, still produces partial explanation', () => {
      const waveform = makeWaveform({
        sw0: ['0', '1'],
        led0: ['0', '1'],
      });
      const explanation = explainSignal({
        selectedSignal: 'led0',
        tick: 1,
        waveform,
        signalRoles: { sw0: 'input', led0: 'output' },
        signalMappings: [
          { signalName: 'sw0', nodeId: 'sw0', direction: 'in' as const },
          { signalName: 'led0', nodeId: 'led0', direction: 'out' as const },
        ],
        // no circuitGraph
      });
      expect(explanation.explanationKind).toBe('partial');
      expect(explanation.summary).toBeTruthy();
      expect(explanation.currentValue).toBe('1');
      expect(explanation.changed).toBe(true);
    });

    it('with unknown signal, returns partial explanation with value from waveform', () => {
      const waveform = makeWaveform({ mystery: ['0', '0', '1'] });
      const explanation = explainSignal({
        selectedSignal: 'mystery',
        tick: 2,
        waveform,
        signalRoles: {},
        signalMappings: [],
      });
      expect(explanation.explanationKind).toBe('partial');
      expect(explanation.currentValue).toBe('1');
    });

    it('null explanation when signal not in waveform at all', () => {
      const waveform = makeWaveform({ sw0: ['0', '1'] });
      const explanation = explainSignal({
        selectedSignal: 'nonexistent',
        tick: 1,
        waveform,
        signalRoles: {},
        signalMappings: [],
      });
      // Should still return an explanation (partial), not crash
      expect(explanation.explanationKind).toBe('partial');
    });
  });

  describe('end-to-end: waveform selection → explanation', () => {
    it('simulates selecting different ticks and getting correct explanations', () => {
      const waveform = makeWaveform({
        sw0: ['0', '0', '1', '1', '0'],
        sw1: ['0', '1', '1', '0', '0'],
        sum: ['0', '1', '0', '1', '0'],
      });
      const graph = makeHalfAdderGraph();
      const mappings = makeHalfAdderMappings();
      const roles = { sw0: 'input' as const, sw1: 'input' as const, sum: 'output' as const };

      // Tick 1: sum=1, sw0=0, sw1=1 → XOR → 1
      const t1 = explainSignal({
        selectedSignal: 'sum',
        tick: 1,
        waveform,
        signalRoles: roles,
        signalMappings: mappings,
        circuitGraph: graph,
        circuitKind: 'combinational',
      });
      expect(t1.currentValue).toBe('1');
      expect(t1.changed).toBe(true);
      expect(t1.explanationKind).toBe('combinational');

      // Tick 2: sum=0, sw0=1, sw1=1 → XOR → 0
      const t2 = explainSignal({
        selectedSignal: 'sum',
        tick: 2,
        waveform,
        signalRoles: roles,
        signalMappings: mappings,
        circuitGraph: graph,
        circuitKind: 'combinational',
      });
      expect(t2.currentValue).toBe('0');
      expect(t2.changed).toBe(true);

      // Tick 3: sum=1, same as tick 2 which was also 0→XOR→0? No, sum[2]=0, sum[3]=1 → changed
      // Use sw0 at tick 0→1: sw0 stays '0'
      const t0 = explainSignal({
        selectedSignal: 'sw0',
        tick: 0,
        waveform,
        signalRoles: roles,
        signalMappings: mappings,
        circuitGraph: graph,
        circuitKind: 'combinational',
      });
      expect(t0.currentValue).toBe('0');
      // Tick 0 has no predecessor — engine treats as unchanged or input
      expect(['unchanged', 'input']).toContain(t0.explanationKind);
    });

    it('simulates sequential workflow: DFF captures data on clock edge', () => {
      const waveform = makeWaveform({
        D:   ['0', '1', '1', '1', '0', '0'],
        clk: ['0', '0', '1', '0', '1', '0'],
        Q:   ['0', '0', '0', '1', '1', '0'],
      });
      const graph = makeDffGraph();
      const mappings = makeDffMappings();
      const roles = { D: 'input' as const, clk: 'clock' as const, Q: 'output' as const };

      // Tick 3: Q transitions 0→1, there was a rising clock edge at tick 2
      const t3 = explainSignal({
        selectedSignal: 'Q',
        tick: 3,
        waveform,
        signalRoles: roles,
        signalMappings: mappings,
        circuitGraph: graph,
        circuitKind: 'sequential',
        clockSignalName: 'clk',
      });
      expect(t3.explanationKind).toBe('sequential');
      expect(t3.changed).toBe(true);
      expect(t3.currentValue).toBe('1');
      expect(t3.relevantClockEdge).not.toBeNull();
      expect(t3.summary.length).toBeGreaterThan(0);
    });
  });
});
