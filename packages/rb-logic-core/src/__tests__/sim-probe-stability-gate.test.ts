import { describe, it, expect } from 'vitest';

// Ensure NodeRegistry is populated for CircuitEngine.
import '../index';
import { CircuitEngine } from '../CircuitEngine';
import { ProbeRecorder } from '../ProbeRecorder';
import type { Circuit } from '../types';

describe('sim:probe-stability-gate', () => {
  it('records one sample per tick and stays bounded', () => {
    const N = 500;
    const capacity = 256;

    const circuit: Circuit = {
      nodes: [{ id: 'clk', type: 'Clock', config: { period: 4 }, state: { tickCount: 0 } }],
      connections: [],
    };

    const engine = new CircuitEngine(circuit);
    const recorder = new ProbeRecorder(capacity);

    for (let t = 0; t < N; t++) {
      engine.tick();
      const v = engine.getAllSignals().get('clk.out') ?? 0;
      recorder.record(t, v as any);
    }

    expect(recorder.getTotalSamples()).toBe(N);
    expect(recorder.getCapacity()).toBe(capacity);
    expect(recorder.getLength()).toBe(capacity);
    expect(recorder.getDroppedSamples()).toBe(N - capacity);

    const samples = recorder.getSamples();
    expect(samples).toHaveLength(capacity);
    expect(samples[0]?.tick).toBe(N - capacity);
    expect(samples[samples.length - 1]?.tick).toBe(N - 1);

    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].tick).toBe(samples[i - 1].tick + 1);
    }
  });
});

