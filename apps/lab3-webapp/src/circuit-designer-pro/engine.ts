import type { CircuitDesignerDoc, CircuitNode } from '../plugins/LabDoc';
import type { EvaluationResult } from './types';

const GATE_TYPE_INPUTS: Record<CircuitNode['type'], number> = {
  AND: 2,
  OR: 2,
  NOT: 1,
  XOR: 2,
  INPUT: 0,
  OUTPUT: 1,
  CONST_0: 0,
  CONST_1: 0,
};

interface EvaluationResultWithGet extends EvaluationResult {
  get: (nodeId: string) => boolean | undefined;
}

/**
 * Evaluate circuit: compute output values for all nodes
 * Uses topological sort from inputs → outputs to detect combinational loops
 */
export function evaluateCircuit(circuit: CircuitDesignerDoc): EvaluationResultWithGet {
  const values = new Map<string, boolean | undefined>();

  // Initialize INPUT, CONST nodes
  circuit.nodes.forEach(node => {
    if (node.type === 'INPUT') {
      values.set(node.id, node.config?.value === true);
    } else if (node.type === 'CONST_0') {
      values.set(node.id, false);
    } else if (node.type === 'CONST_1') {
      values.set(node.id, true);
    }
  });

  // Build adjacency map: nodeId → list of target nodeIds
  const adjacency = new Map<string, string[]>();
  circuit.nodes.forEach(node => adjacency.set(node.id, []));

  circuit.wires.forEach(wire => {
    const targets = adjacency.get(wire.from.nodeId) || [];
    targets.push(wire.to.nodeId);
    adjacency.set(wire.from.nodeId, targets);
  });

  // Topological sort with cycle detection (DFS)
  const visited = new Set<string>();
  const recStack = new Set<string>();
  let hasCycle = false;

  const dfs = (nodeId: string) => {
    if (hasCycle) return;
    visited.add(nodeId);
    recStack.add(nodeId);

    const targets = adjacency.get(nodeId) || [];
    for (const target of targets) {
      if (!visited.has(target)) {
        dfs(target);
      } else if (recStack.has(target)) {
        hasCycle = true;
        return;
      }
    }

    recStack.delete(nodeId);
  };

  circuit.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  });

  if (hasCycle) {
    return {
      values,
      error: 'Combinational loop detected in circuit',
      get: (nodeId: string) => values.get(nodeId),
    };
  }

  // Evaluate gates in topological order
  const evaluationOrder: string[] = [];
  const tempVisited = new Set<string>();
  const tempRecStack = new Set<string>();

  const topoDfs = (nodeId: string) => {
    tempVisited.add(nodeId);
    tempRecStack.add(nodeId);

    const targets = adjacency.get(nodeId) || [];
    for (const target of targets) {
      if (!tempVisited.has(target)) {
        topoDfs(target);
      }
    }

    tempRecStack.delete(nodeId);
    evaluationOrder.unshift(nodeId); // Reverse for topological order
  };

  circuit.nodes.forEach(node => {
    if (!tempVisited.has(node.id)) {
      topoDfs(node.id);
    }
  });

  // Evaluate gates
  evaluationOrder.forEach(nodeId => {
    const node = circuit.nodes.find(n => n.id === nodeId);
    if (!node || node.type === 'INPUT' || node.type === 'OUTPUT' || node.type.startsWith('CONST')) return;

    // Find input wires for this node, sorted by input port
    const inputWires = circuit.wires
      .filter(w => w.to.nodeId === nodeId)
      .sort((a, b) => a.to.port - b.to.port);
    
    const inputValues = inputWires.map(w => values.get(w.from.nodeId) === true);

    let output: boolean | undefined;

    switch (node.type) {
      case 'AND':
        output = inputValues.length > 0 && inputValues.every(v => v);
        break;
      case 'OR':
        output = inputValues.some(v => v);
        break;
      case 'NOT':
        output = inputValues.length > 0 ? !inputValues[0] : undefined;
        break;
      case 'XOR':
        output = inputValues.filter(v => v).length % 2 === 1;
        break;
      default:
        output = undefined;
    }

    values.set(nodeId, output);
  });

  return {
    values,
    get: (nodeId: string) => values.get(nodeId),
  };
}

/**
 * Add a node to the circuit (returns new doc, doesn't mutate)
 */
export function addNode(
  circuit: CircuitDesignerDoc,
  gateType: CircuitNode['type'],
  x: number,
  y: number
): CircuitDesignerDoc {
  const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newNode: CircuitNode = {
    id: newId,
    type: gateType,
    x,
    y,
    config: {
      inputCount: GATE_TYPE_INPUTS[gateType] || 2,
    },
  };

  return {
    ...circuit,
    nodes: [...circuit.nodes, newNode],
  };
}

/**
 * Delete a node and all connected wires
 */
export function deleteNode(circuit: CircuitDesignerDoc, nodeId: string): CircuitDesignerDoc {
  return {
    ...circuit,
    nodes: circuit.nodes.filter(n => n.id !== nodeId),
    wires: circuit.wires.filter(w => w.from.nodeId !== nodeId && w.to.nodeId !== nodeId),
  };
}

/**
 * Connect two nodes with a wire
 */
export function connectWire(
  circuit: CircuitDesignerDoc,
  fromNodeId: string,
  fromPort: number,
  toNodeId: string,
  toPort: number
): CircuitDesignerDoc {
  const newWire = {
    id: `wire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    from: { nodeId: fromNodeId, port: fromPort },
    to: { nodeId: toNodeId, port: toPort },
  };

  return {
    ...circuit,
    wires: [...circuit.wires, newWire],
  };
}

/**
 * Delete a wire
 */
export function deleteWire(circuit: CircuitDesignerDoc, wireId: string): CircuitDesignerDoc {
  return {
    ...circuit,
    wires: circuit.wires.filter(w => w.id !== wireId),
  };
}

/**
 * Move a node
 */
export function moveNode(circuit: CircuitDesignerDoc, nodeId: string, x: number, y: number): CircuitDesignerDoc {
  return {
    ...circuit,
    nodes: circuit.nodes.map(n => (n.id === nodeId ? { ...n, x, y } : n)),
  };
}

/**
 * Set input node value
 */
export function setNodeValue(circuit: CircuitDesignerDoc, nodeId: string, value: boolean): CircuitDesignerDoc {
  return {
    ...circuit,
    nodes: circuit.nodes.map(n =>
      n.id === nodeId ? { ...n, config: { ...n.config, value } } : n
    ),
  };
}
