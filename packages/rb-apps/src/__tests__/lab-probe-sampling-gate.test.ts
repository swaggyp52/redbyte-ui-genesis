import { describe, expect, it } from 'vitest';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { ProbeRecorder } from '../../../rb-logic-core/src/ProbeRecorder';
import type { Circuit, Signal } from '@redbyte/rb-logic-core';

/**
 * Phase 4 Gate: Probe Sampling
 *
 * This gate validates probe recording behavior:
 * 1. Use CircuitEngine + ProbeRecorder
 * 2. Run 500 ticks on a moderate circuit
 * 3. Attach probes to multiple nets
 * 4. Assert:
 *    - Bounded buffer (no unbounded growth)
 *    - Monotonic ticks (samples in order)
 *    - Stable sample count
 *    - No exceptions during recording
 *
 * Pure, deterministic test (no React, no DOM, no timers).
 */

function createModerateCircuit(): Circuit {
  // 4-bit ripple counter: 4 T flip-flops chained
  // Each flip-flop toggles on rising edge of previous
  return {
    nodes: [
      // T flip-flops (using D flip-flop + XOR feedback pattern)
      { id: 'clk', type: 'CLOCK', x: 0, y: 0, config: { frequency: 1 }, state: {} },
      { id: 'tff0', type: 'D_FLIPFLOP', x: 100, y: 0, config: {}, state: { Q: 0 } },
      { id: 'tff1', type: 'D_FLIPFLOP', x: 200, y: 0, config: {}, state: { Q: 0 } },
      { id: 'tff2', type: 'D_FLIPFLOP', x: 300, y: 0, config: {}, state: { Q: 0 } },
      { id: 'tff3', type: 'D_FLIPFLOP', x: 400, y: 0, config: {}, state: { Q: 0 } },
      { id: 'not0', type: 'NOT', x: 50, y: 50, config: {}, state: {} },
      { id: 'not1', type: 'NOT', x: 150, y: 50, config: {}, state: {} },
      { id: 'not2', type: 'NOT', x: 250, y: 50, config: {}, state: {} },
      { id: 'not3', type: 'NOT', x: 350, y: 50, config: {}, state: {} },
    ],
    connections: [
      // Clock to first flip-flop
      { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'tff0', portName: 'clk' } },
      // T flip-flop feedback (Q -> NOT -> D)
      { from: { nodeId: 'tff0', portName: 'Q' }, to: { nodeId: 'not0', portName: 'in' } },
      { from: { nodeId: 'not0', portName: 'out' }, to: { nodeId: 'tff0', portName: 'D' } },
      { from: { nodeId: 'tff1', portName: 'Q' }, to: { nodeId: 'not1', portName: 'in' } },
      { from: { nodeId: 'not1', portName: 'out' }, to: { nodeId: 'tff1', portName: 'D' } },
      { from: { nodeId: 'tff2', portName: 'Q' }, to: { nodeId: 'not2', portName: 'in' } },
      { from: { nodeId: 'not2', portName: 'out' }, to: { nodeId: 'tff2', portName: 'D' } },
      { from: { nodeId: 'tff3', portName: 'Q' }, to: { nodeId: 'not3', portName: 'in' } },
      { from: { nodeId: 'not3', portName: 'out' }, to: { nodeId: 'tff3', portName: 'D' } },
      // Ripple chain (Q -> next CLK)
      { from: { nodeId: 'tff0', portName: 'Q' }, to: { nodeId: 'tff1', portName: 'clk' } },
      { from: { nodeId: 'tff1', portName: 'Q' }, to: { nodeId: 'tff2', portName: 'clk' } },
      { from: { nodeId: 'tff2', portName: 'Q' }, to: { nodeId: 'tff3', portName: 'clk' } },
    ],
  };
}

describe('Phase 4: Probe Sampling Gate', () => {
  it('records 500 ticks without unbounded growth (bounded buffer)', () => {
    const circuit = createModerateCircuit();
    const engine = new CircuitEngine(circuit);
    const capacity = 256;
    const recorder = new ProbeRecorder(capacity);

    const ticks = 500;
    for (let i = 0; i < ticks; i++) {
      engine.tick();
      const q0State = engine.getNodeState('tff0');
      const value: Signal = q0State?.Q ? 1 : 0;
      recorder.record(i, value);
    }

    // Bounded buffer: length <= capacity
    expect(recorder.getLength()).toBeLessThanOrEqual(capacity);

    // Total samples recorded
    expect(recorder.getTotalSamples()).toBe(ticks);

    // Dropped samples = total - capacity
    const expectedDropped = Math.max(0, ticks - capacity);
    expect(recorder.getDroppedSamples()).toBe(expectedDropped);
  });

  it('maintains monotonic tick order in samples', () => {
    const circuit = createModerateCircuit();
    const engine = new CircuitEngine(circuit);
    const recorder = new ProbeRecorder(256);

    for (let i = 0; i < 500; i++) {
      engine.tick();
      const q0State = engine.getNodeState('tff0');
      const value: Signal = q0State?.Q ? 1 : 0;
      recorder.record(i, value);
    }

    const samples = recorder.getSamples();

    // Verify monotonic tick order
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].tick).toBeGreaterThan(samples[i - 1].tick);
    }
  });

  it('records stable sample count with deterministic circuit behavior', () => {
    const circuit = createModerateCircuit();
    const engine1 = new CircuitEngine(circuit);
    const engine2 = new CircuitEngine(circuit);
    const recorder1 = new ProbeRecorder(256);
    const recorder2 = new ProbeRecorder(256);

    const ticks = 500;

    // Run 1
    for (let i = 0; i < ticks; i++) {
      engine1.tick();
      const q0State = engine1.getNodeState('tff0');
      const value: Signal = q0State?.Q ? 1 : 0;
      recorder1.record(i, value);
    }

    // Run 2 (same circuit, same inputs)
    for (let i = 0; i < ticks; i++) {
      engine2.tick();
      const q0State = engine2.getNodeState('tff0');
      const value: Signal = q0State?.Q ? 1 : 0;
      recorder2.record(i, value);
    }

    // Both runs should produce identical sample counts
    expect(recorder2.getTotalSamples()).toBe(recorder1.getTotalSamples());
    expect(recorder2.getLength()).toBe(recorder1.getLength());
    expect(recorder2.getDroppedSamples()).toBe(recorder1.getDroppedSamples());

    // Samples should be identical
    const samples1 = recorder1.getSamples();
    const samples2 = recorder2.getSamples();
    expect(samples2).toEqual(samples1);
  });

  it('handles multiple probes without exceptions', () => {
    const circuit = createModerateCircuit();
    const engine = new CircuitEngine(circuit);

    // Create recorder for each flip-flop output
    const recorders = {
      q0: new ProbeRecorder(256),
      q1: new ProbeRecorder(256),
      q2: new ProbeRecorder(256),
      q3: new ProbeRecorder(256),
    };

    const ticks = 500;
    for (let i = 0; i < ticks; i++) {
      engine.tick();

      // Record all 4 flip-flop outputs
      const q0 = engine.getNodeState('tff0')?.Q ? 1 : 0;
      const q1 = engine.getNodeState('tff1')?.Q ? 1 : 0;
      const q2 = engine.getNodeState('tff2')?.Q ? 1 : 0;
      const q3 = engine.getNodeState('tff3')?.Q ? 1 : 0;

      recorders.q0.record(i, q0 as Signal);
      recorders.q1.record(i, q1 as Signal);
      recorders.q2.record(i, q2 as Signal);
      recorders.q3.record(i, q3 as Signal);
    }

    // All recorders should have stable sample counts
    Object.values(recorders).forEach((recorder) => {
      expect(recorder.getTotalSamples()).toBe(ticks);
      expect(recorder.getLength()).toBeLessThanOrEqual(256);
      expect(recorder.getDroppedSamples()).toBe(Math.max(0, ticks - 256));
    });
  });

  it('produces deterministic samples for same tick sequence', () => {
    const circuit = createModerateCircuit();
    const engine = new CircuitEngine(circuit);
    const recorder = new ProbeRecorder(256);

    const ticks = 100;
    for (let i = 0; i < ticks; i++) {
      engine.tick();
      const q0State = engine.getNodeState('tff0');
      const value: Signal = q0State?.Q ? 1 : 0;
      recorder.record(i, value);
    }

    const samples = recorder.getSamples();

    // Re-run same circuit
    const engine2 = new CircuitEngine(circuit);
    const recorder2 = new ProbeRecorder(256);

    for (let i = 0; i < ticks; i++) {
      engine2.tick();
      const q0State = engine2.getNodeState('tff0');
      const value: Signal = q0State?.Q ? 1 : 0;
      recorder2.record(i, value);
    }

    const samples2 = recorder2.getSamples();

    // Samples must be identical
    expect(samples2.length).toBe(samples.length);
    for (let i = 0; i < samples.length; i++) {
      expect(samples2[i].tick).toBe(samples[i].tick);
      expect(samples2[i].value).toBe(samples[i].value);
    }
  });
});
