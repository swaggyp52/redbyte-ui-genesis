import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { computeDesignIssues } from '../designIssues';

function makeCircuit(nodes: Circuit['nodes'], connections: Circuit['connections'] = []): Circuit {
  return { nodes, connections };
}

describe('computeDesignIssues', () => {
  it('detects an unconnected AND input from canonical metadata', () => {
    const circuit = makeCircuit(
      [
        { id: 'sw0', type: 'INPUT', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: {} },
        { id: 'and0', type: 'AND', position: { x: 80, y: 0 }, rotation: 0, config: {}, state: {} },
      ],
      [
        {
          from: { nodeId: 'sw0', portName: 'out' },
          to: { nodeId: 'and0', portName: 'a' },
        },
      ]
    );

    const issueMap = computeDesignIssues(circuit);
    const issues = issueMap.byNode.get('and0') ?? [];

    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe('unconnected-input');
    expect(issues[0]?.severity).toBe('warn');
    expect(issues[0]?.focusTarget).toEqual({ nodeId: 'and0', portKey: 'b' });
  });

  it('detects floating OUTPUT nodes as errors', () => {
    const circuit = makeCircuit([
      { id: 'out0', type: 'OUTPUT', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: {} },
    ]);

    const issueMap = computeDesignIssues(circuit);
    const issues = issueMap.byNode.get('out0') ?? [];

    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe('floating-output');
    expect(issues[0]?.severity).toBe('error');
    expect(issues[0]?.focusTarget).toEqual({ nodeId: 'out0', portKey: 'in' });
  });

  it('uses uppercase sequential port names from metadata for DFlipFlop', () => {
    const circuit = makeCircuit([
      { id: 'dff0', type: 'DFlipFlop', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: {} },
    ]);

    const issueMap = computeDesignIssues(circuit);
    const portKeys = Array.from(issueMap.byPort.keys()).sort();

    expect(portKeys).toContain('dff0.D');
    expect(portKeys).toContain('dff0.CLK');
    expect(portKeys).not.toContain('dff0.d');
    expect(portKeys).not.toContain('dff0.clk');
  });

  it('derives issue ports from metadata and skips unknown custom nodes', () => {
    const circuit = makeCircuit([
      { id: 'fa0', type: 'FullAdder', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: {} },
      { id: 'macro0', type: 'StudentMacro', position: { x: 120, y: 0 }, rotation: 0, config: {}, state: {} },
    ]);

    const issueMap = computeDesignIssues(circuit);
    const fullAdderIssues = issueMap.byNode.get('fa0') ?? [];

    expect(fullAdderIssues.map((issue) => issue.focusTarget.portKey)).toEqual(['A', 'B', 'Cin']);
    expect(issueMap.byNode.has('macro0')).toBe(false);
  });
});
