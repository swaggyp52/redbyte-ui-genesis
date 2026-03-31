import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { computeDesignIssues, nodeIssueSeverity } from '../apps/ide/designIssues';

function portRef(nodeId: string, portName: string) {
  return { nodeId, portName };
}

function node(id: string, type: string) {
  return { id, type, x: 0, y: 0, config: {}, state: {} };
}

describe('computeDesignIssues', () => {
  it('empty circuit → no issues', () => {
    const circuit: Circuit = { nodes: [], connections: [] };
    const result = computeDesignIssues(circuit);
    expect(result.byNode.size).toBe(0);
    expect(result.byPort.size).toBe(0);
  });

  it('OUTPUT with no driver → floating-output', () => {
    const circuit: Circuit = {
      nodes: [node('out1', 'OUTPUT')],
      connections: [],
    };
    const result = computeDesignIssues(circuit);
    const issues = result.byNode.get('out1');
    expect(issues).toBeDefined();
    expect(issues![0].kind).toBe('floating-output');
  });

  it('Lamp with no driver → floating-output', () => {
    const circuit: Circuit = {
      nodes: [node('lamp1', 'Lamp')],
      connections: [],
    };
    const result = computeDesignIssues(circuit);
    expect(result.byNode.get('lamp1')?.[0].kind).toBe('floating-output');
  });

  it('OUTPUT with a driver → no floating-output issue', () => {
    const circuit: Circuit = {
      nodes: [node('sw1', 'Switch'), node('out1', 'OUTPUT')],
      connections: [
        { from: portRef('sw1', 'out'), to: portRef('out1', 'in') },
      ],
    };
    const result = computeDesignIssues(circuit);
    expect(result.byNode.get('out1')).toBeUndefined();
  });

  it('two connections to same AND input → multiple-drivers', () => {
    const circuit: Circuit = {
      nodes: [node('sw1', 'Switch'), node('sw2', 'Switch'), node('and1', 'AND')],
      connections: [
        { from: portRef('sw1', 'out'), to: portRef('and1', 'a') },
        { from: portRef('sw2', 'out'), to: portRef('and1', 'a') },
      ],
    };
    const result = computeDesignIssues(circuit);
    const issues = result.byNode.get('and1');
    expect(issues?.some((i) => i.kind === 'multiple-drivers')).toBe(true);
    expect(result.byPort.get('and1.a')?.[0]?.kind).toBe('multiple-drivers');
  });

  it('AND gate with one input unwired → unconnected-input', () => {
    const circuit: Circuit = {
      nodes: [node('sw1', 'Switch'), node('and1', 'AND')],
      connections: [
        { from: portRef('sw1', 'out'), to: portRef('and1', 'a') },
        // 'b' left unconnected
      ],
    };
    const result = computeDesignIssues(circuit);
    const issues = result.byNode.get('and1');
    expect(issues?.some((i) => i.kind === 'unconnected-input' && i.portKey === 'and1.b')).toBe(true);
  });

  it('fully wired AND → no issues', () => {
    const circuit: Circuit = {
      nodes: [
        node('sw1', 'Switch'),
        node('sw2', 'Switch'),
        node('and1', 'AND'),
        node('out1', 'OUTPUT'),
      ],
      connections: [
        { from: portRef('sw1', 'out'), to: portRef('and1', 'a') },
        { from: portRef('sw2', 'out'), to: portRef('and1', 'b') },
        { from: portRef('and1', 'out'), to: portRef('out1', 'in') },
      ],
    };
    const result = computeDesignIssues(circuit);
    expect(result.byNode.size).toBe(0);
  });

  it('complete half-adder → no issues', () => {
    const circuit: Circuit = {
      nodes: [
        node('sw_a', 'Switch'),
        node('sw_b', 'Switch'),
        node('xor1', 'XOR'),
        node('and1', 'AND'),
        node('out_sum', 'OUTPUT'),
        node('out_carry', 'OUTPUT'),
      ],
      connections: [
        { from: portRef('sw_a', 'out'), to: portRef('xor1', 'a') },
        { from: portRef('sw_b', 'out'), to: portRef('xor1', 'b') },
        { from: portRef('sw_a', 'out'), to: portRef('and1', 'a') },
        { from: portRef('sw_b', 'out'), to: portRef('and1', 'b') },
        { from: portRef('xor1', 'out'), to: portRef('out_sum', 'in') },
        { from: portRef('and1', 'out'), to: portRef('out_carry', 'in') },
      ],
    };
    const result = computeDesignIssues(circuit);
    expect(result.byNode.size).toBe(0);
  });

  it('DFlipFlop with missing D input → unconnected-input', () => {
    const circuit: Circuit = {
      nodes: [node('clk1', 'Clock'), node('dff1', 'DFlipFlop')],
      connections: [
        { from: portRef('clk1', 'out'), to: portRef('dff1', 'CLK') },
        // 'D' unconnected
      ],
    };
    const result = computeDesignIssues(circuit);
    expect(result.byPort.get('dff1.D')?.[0]?.kind).toBe('unconnected-input');
  });
});

describe('nodeIssueSeverity', () => {
  it('no issues → null', () => {
    const result = computeDesignIssues({ nodes: [], connections: [] });
    expect(nodeIssueSeverity('any', result)).toBeNull();
  });

  it('floating-output → error', () => {
    const result = computeDesignIssues({
      nodes: [node('out1', 'OUTPUT')],
      connections: [],
    });
    expect(nodeIssueSeverity('out1', result)).toBe('draft');
  });

  it('unconnected-input → warn', () => {
    const result = computeDesignIssues({
      nodes: [node('and1', 'AND')],
      connections: [],
    });
    expect(nodeIssueSeverity('and1', result)).toBe('draft');
  });

  it('multiple-drivers → error', () => {
    const result = computeDesignIssues({
      nodes: [node('sw1', 'Switch'), node('sw2', 'Switch'), node('and1', 'AND')],
      connections: [
        { from: portRef('sw1', 'out'), to: portRef('and1', 'a') },
        { from: portRef('sw2', 'out'), to: portRef('and1', 'a') },
      ],
    });
    expect(nodeIssueSeverity('and1', result)).toBe('error');
  });
});
