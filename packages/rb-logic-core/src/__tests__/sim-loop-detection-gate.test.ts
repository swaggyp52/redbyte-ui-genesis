import { describe, it, expect } from 'vitest';

// Ensure NodeRegistry is populated for CircuitEngine.
import '../index';
import { CircuitEngine } from '../CircuitEngine';
import type { Circuit } from '../types';

describe('sim:loop-detection-gate', () => {
  it('detects an obvious combinational feedback loop (NOT cycle) without hanging', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'n1', type: 'NOT', state: {} },
        { id: 'n2', type: 'NOT', state: {} },
      ],
      connections: [
        { from: { nodeId: 'n1', portName: 'out' }, to: { nodeId: 'n2', portName: 'in' } },
        { from: { nodeId: 'n2', portName: 'out' }, to: { nodeId: 'n1', portName: 'in' } },
      ],
    };

    const engine = new CircuitEngine(circuit);
    // A single tick should be bounded; issue should be present.
    engine.tick();
    const issue = engine.getLastIssue();
    expect(issue?.code).toBe('COMBINATIONAL_LOOP');
    expect(issue?.message).toMatch(/Feedback loop detected/i);
  });
});

