import { LogicGraph, LogicGate } from './LogicTypes';

function evalGate(g: LogicGate, input: number[]): number[] {
  switch (g.kind) {
    case 'and': return [input.every(v => v === 1) ? 1 : 0];
    case 'or': return [input.some(v => v === 1) ? 1 : 0];
    case 'not': return [input[0] === 1 ? 0 : 1];
    case 'nand': return [input.every(v => v === 1) ? 0 : 1];
    case 'nor': return [input.some(v => v === 1) ? 0 : 1];
    case 'xor': return [input.reduce((a,b) => a ^ b, 0)];
    case 'xnor': return [input.reduce((a,b) => a ^ b, 0) === 1 ? 0 : 1];
    case 'custom':
      return [0]; // placeholder for user-made blocks later
    default:
      return [0];
  }
}

export function stepGraph(graph: LogicGraph): LogicGraph {
  const next = { ...graph, values: { ...graph.values } };

  for (const gate of graph.gates) {
    const inbound: number[] = [];

    for (let i = 0; i < gate.inputs; i++) {
      inbound.push(0);
    }

    // find wires targeting this gate
    graph.wires
      .filter(w => w.toGate === gate.id)
      .forEach(w => {
        const src = graph.values[w.fromGate] ?? [0];
        inbound[w.toPin] = src[w.fromPin] ?? 0;
      });

    next.values[gate.id] = evalGate(gate, inbound);
  }

  return next;
}
