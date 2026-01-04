// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Node } from '@redbyte/rb-logic-core';

export interface HealthIssue {
  type: 'unconnected-input' | 'floating-output' | 'disconnected-subgraph' | 'no-inputs' | 'no-outputs';
  severity: 'hint' | 'warning';
  message: string;
  nodeId: string;
  portName?: string;
}

export interface CircuitHealth {
  issues: HealthIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
  isHealthy: boolean;
}

/**
 * Check if a port is an input based on naming convention
 */
function isInputPort(portName: string): boolean {
  return portName.startsWith('in');
}

/**
 * Get all ports for a node based on its type
 */
function getNodePorts(node: Node): { inputs: string[]; outputs: string[] } {
  // Common node port configurations
  const portConfig: Record<string, { inputs: string[]; outputs: string[] }> = {
    PowerSource: { inputs: [], outputs: ['out'] },
    Switch: { inputs: [], outputs: ['out'] },
    INPUT: { inputs: [], outputs: ['out'] },
    Lamp: { inputs: ['in'], outputs: [] },
    OUTPUT: { inputs: ['in'], outputs: [] },
    Wire: { inputs: ['in'], outputs: ['out'] },
    AND: { inputs: ['in1', 'in2'], outputs: ['out'] },
    OR: { inputs: ['in1', 'in2'], outputs: ['out'] },
    NOT: { inputs: ['in'], outputs: ['out'] },
    NAND: { inputs: ['in1', 'in2'], outputs: ['out'] },
    NOR: { inputs: ['in1', 'in2'], outputs: ['out'] },
    XOR: { inputs: ['in1', 'in2'], outputs: ['out'] },
    XNOR: { inputs: ['in1', 'in2'], outputs: ['out'] },
  };

  return portConfig[node.type] || { inputs: ['in'], outputs: ['out'] };
}

/**
 * Analyze circuit health and return issues
 */
export function analyzeCircuitHealth(circuit: Circuit): CircuitHealth {
  const issues: HealthIssue[] = [];

  if (circuit.nodes.length === 0) {
    return {
      issues: [],
      hasErrors: false,
      hasWarnings: false,
      isHealthy: true,
    };
  }

  // Track connected ports
  const connectedInputs = new Set<string>();
  const connectedOutputs = new Set<string>();

  circuit.connections.forEach((conn) => {
    connectedOutputs.add(`${conn.from.nodeId}.${conn.from.portName}`);
    connectedInputs.add(`${conn.to.nodeId}.${conn.to.portName}`);
  });

  // Check each node for issues
  circuit.nodes.forEach((node) => {
    const ports = getNodePorts(node);

    // Check for unconnected inputs (excluding power sources and switches)
    if (!['PowerSource', 'Switch', 'INPUT'].includes(node.type)) {
      ports.inputs.forEach((portName) => {
        const portId = `${node.id}.${portName}`;
        if (!connectedInputs.has(portId)) {
          issues.push({
            type: 'unconnected-input',
            severity: 'warning',
            message: `${node.type} has unconnected input "${portName}"`,
            nodeId: node.id,
            portName,
          });
        }
      });
    }

    // Check for floating outputs (excluding lamps and outputs)
    if (!['Lamp', 'OUTPUT'].includes(node.type)) {
      ports.outputs.forEach((portName) => {
        const portId = `${node.id}.${portName}`;
        if (!connectedOutputs.has(portId)) {
          issues.push({
            type: 'floating-output',
            severity: 'hint',
            message: `${node.type} output "${portName}" is not connected`,
            nodeId: node.id,
            portName,
          });
        }
      });
    }
  });

  // Check for no input sources
  const hasInputSources = circuit.nodes.some(
    (n) => n.type === 'PowerSource' || n.type === 'Switch' || n.type === 'INPUT'
  );
  if (!hasInputSources && circuit.nodes.length > 0) {
    // Find first node to associate with this hint
    const firstNode = circuit.nodes[0];
    issues.push({
      type: 'no-inputs',
      severity: 'hint',
      message: 'Circuit has no input sources (try adding a Switch or PowerSource)',
      nodeId: firstNode.id,
    });
  }

  // Check for no outputs
  const hasOutputs = circuit.nodes.some((n) => n.type === 'Lamp' || n.type === 'OUTPUT');
  if (!hasOutputs && circuit.nodes.length > 0) {
    // Find first node to associate with this hint
    const firstNode = circuit.nodes[0];
    issues.push({
      type: 'no-outputs',
      severity: 'hint',
      message: 'Circuit has no outputs (try adding a Lamp)',
      nodeId: firstNode.id,
    });
  }

  const hasWarnings = issues.some((i) => i.severity === 'warning');
  const hasErrors = false; // No error-level issues yet

  return {
    issues,
    hasErrors,
    hasWarnings,
    isHealthy: issues.length === 0,
  };
}

/**
 * Get nodes in a trace path from a given node
 */
export function getTracePath(
  nodeId: string,
  circuit: Circuit,
  direction: 'upstream' | 'downstream' | 'both' = 'both',
  maxHops: number = 2
): Set<string> {
  const traced = new Set<string>();
  const queue: Array<{ id: string; hops: number }> = [{ id: nodeId, hops: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (traced.has(current.id) || current.hops > maxHops) continue;

    traced.add(current.id);

    if (current.hops < maxHops) {
      // Find connected nodes
      if (direction === 'upstream' || direction === 'both') {
        // Find nodes feeding into current
        circuit.connections
          .filter((conn) => conn.to.nodeId === current.id)
          .forEach((conn) => {
            if (!traced.has(conn.from.nodeId)) {
              queue.push({ id: conn.from.nodeId, hops: current.hops + 1 });
            }
          });
      }

      if (direction === 'downstream' || direction === 'both') {
        // Find nodes current feeds into
        circuit.connections
          .filter((conn) => conn.from.nodeId === current.id)
          .forEach((conn) => {
            if (!traced.has(conn.to.nodeId)) {
              queue.push({ id: conn.to.nodeId, hops: current.hops + 1 });
            }
          });
      }
    }
  }

  return traced;
}
