import { describe, expect, it } from 'vitest';
import { loadExample, loadExampleAsProject } from '../index';
import traffic from '../17_traffic-light-fsm-basys3.json';
import alu from '../18_4bit-alu-basys3.json';

describe('legacy examples use the actual project connection migration', () => {
  it.each([
    ['17_traffic-light-fsm-basys3' as const, traffic],
    ['18_4bit-alu-basys3' as const, alu],
  ])('retains every original endpoint in %s', async (id, source) => {
    const example = await loadExample(id);
    expect(example.nodes).toHaveLength(source.nodes.length);
    expect(example.connections).toHaveLength(source.connections.length);
    for (const original of source.connections) {
      expect(example.connections.find((connection) => connection.id === original.id)).toMatchObject({
        from: { nodeId: original.fromNodeId, portName: original.fromPin },
        to: { nodeId: original.toNodeId, portName: original.toPin },
      });
    }
  });

  it('retains clock params, labels, positions and switch state through example-to-project conversion', async () => {
    const example = await loadExample('17_traffic-light-fsm-basys3');
    expect(example.nodes.find((node) => node.id === 'clk')).toMatchObject({
      label: 'CLK', position: { x: 100, y: 200 }, config: { frequency: 100000000 },
    });
    const project = loadExampleAsProject('17_traffic-light-fsm-basys3');
    expect(project.circuit.nodes.find((node) => node.id === 'clk')).toMatchObject({
      label: 'CLK', x: 100, y: 200, params: { frequency: 100000000 },
    });
    expect(project.circuit.nodes.find((node) => node.id === 'reset')?.state).toEqual({ isOn: false });
    expect(project.circuit.connections).toHaveLength(traffic.connections.length);
  });
});
