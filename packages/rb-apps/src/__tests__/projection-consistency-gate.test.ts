import { describe, expect, it } from 'vitest';
import { CircuitEngine, fromCircuitV1, toCircuitV1, type Circuit } from '@redbyte/rb-logic-core';
import { netlistFromCircuit } from '../export/netlistExport';
import { verilogFromNetlist } from '../export/verilogExport';

const projectionFixture: Circuit = {
  nodes: [
    { id: 'out', type: 'Lamp', position: { x: 200, y: 40 }, config: {}, state: {} },
    { id: 'a', type: 'Switch', position: { x: 0, y: 20 }, config: {}, state: { isOn: 0 } },
    { id: 'g', type: 'AND', position: { x: 100, y: 40 }, config: {}, state: {} },
    { id: 'b', type: 'Switch', position: { x: 0, y: 60 }, config: {}, state: { isOn: 0 } },
  ],
  connections: [
    { from: { nodeId: 'g', portName: 'out' }, to: { nodeId: 'out', portName: 'in' } },
    { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'g', portName: 'b' } },
    { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'g', portName: 'a' } },
  ],
};

function simulateAndTrace(circuit: Circuit): Array<0 | 1> {
  const engine = new CircuitEngine(circuit);
  const pattern: Array<{ a: 0 | 1; b: 0 | 1 }> = [
    { a: 0, b: 0 },
    { a: 0, b: 1 },
    { a: 1, b: 0 },
    { a: 1, b: 1 },
    { a: 1, b: 1 },
  ];

  const outputs: Array<0 | 1> = [];
  for (const step of pattern) {
    engine.setNodeState('a', { isOn: step.a });
    engine.setNodeState('b', { isOn: step.b });
    engine.tick();
    const value = engine.getNodeState('out')?.isOn ? 1 : 0;
    outputs.push(value);
  }
  return outputs;
}

describe('RC D3 projection consistency gate', () => {
  it('graph topology projects consistently to netlist/verilog and simulation truth table', () => {
    const netlist = netlistFromCircuit(projectionFixture);
    const verilog = verilogFromNetlist(netlist);

    expect(netlist.nodes.map((node) => node.id).sort()).toEqual(['a', 'b', 'g', 'out']);
    expect(netlist.nets).toHaveLength(3);
    expect(verilog).toContain('AND u_g');
    expect(verilog).toContain('Switch u_a');
    expect(verilog).toContain('Switch u_b');
    expect(verilog).toContain('Lamp u_out');

    const trace = simulateAndTrace(projectionFixture);
    expect(trace).toEqual([0, 0, 0, 1, 1]);
  });

  it('Circuit ↔ CircuitV1 roundtrip does not drift verilog topology or simulation trace', () => {
    const v1 = toCircuitV1(projectionFixture);
    const roundtripped = fromCircuitV1(v1);

    const verilogA = verilogFromNetlist(netlistFromCircuit(projectionFixture));
    const verilogB = verilogFromNetlist(netlistFromCircuit(roundtripped));
    expect(verilogB).toBe(verilogA);

    const traceA = simulateAndTrace(projectionFixture);
    const traceB = simulateAndTrace(roundtripped);
    expect(traceB).toEqual(traceA);
  });

  it('projection generation does not mutate canonical circuit graph', () => {
    const before = JSON.stringify(projectionFixture);
    const netlist = netlistFromCircuit(projectionFixture);
    verilogFromNetlist(netlist);
    const after = JSON.stringify(projectionFixture);
    expect(after).toBe(before);
  });
});
