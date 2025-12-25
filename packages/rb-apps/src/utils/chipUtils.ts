// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '@redbyte/rb-logic-core';
import type { ChipPort } from '../stores/chipStore';

/**
 * Analyzes a circuit and suggests input/output ports based on
 * INPUT and OUTPUT nodes in the circuit.
 */
export function suggestChipPorts(circuit: Circuit): {
  inputs: ChipPort[];
  outputs: ChipPort[];
} {
  const inputs: ChipPort[] = [];
  const outputs: ChipPort[] = [];

  circuit.nodes.forEach((node) => {
    if (node.type === 'INPUT' || node.type === 'PowerSource' || node.type === 'Switch') {
      // These are potential chip inputs
      inputs.push({
        id: `input-${inputs.length}`,
        name: node.id.replace(/^(input-|power-|switch-)/, '').toUpperCase() || `IN${inputs.length}`,
        type: 'input',
        nodeRef: `${node.id}.out`,
      });
    } else if (node.type === 'OUTPUT' || node.type === 'Lamp') {
      // These are potential chip outputs
      outputs.push({
        id: `output-${outputs.length}`,
        name: node.id.replace(/^(output-|lamp-)/, '').toUpperCase() || `OUT${outputs.length}`,
        type: 'output',
        nodeRef: `${node.id}.in`,
      });
    }
  });

  // If no explicit INPUT/OUTPUT nodes, try to infer from circuit structure
  if (inputs.length === 0 && outputs.length === 0) {
    const { sources, sinks } = analyzeCircuitTopology(circuit);

    sources.forEach((nodeId, index) => {
      inputs.push({
        id: `input-${index}`,
        name: `IN${index}`,
        type: 'input',
        nodeRef: `${nodeId}.out`,
      });
    });

    sinks.forEach((nodeId, index) => {
      outputs.push({
        id: `output-${index}`,
        name: `OUT${index}`,
        type: 'output',
        nodeRef: `${nodeId}.out`,
      });
    });
  }

  return { inputs, outputs };
}

/**
 * Analyzes circuit topology to find source and sink nodes.
 * Sources: nodes with no inputs (or only self-loops)
 * Sinks: nodes with no outputs (or only self-loops)
 */
function analyzeCircuitTopology(circuit: Circuit): {
  sources: string[];
  sinks: string[];
} {
  const nodeIds = new Set(circuit.nodes.map((n) => n.id));
  const hasIncoming = new Set<string>();
  const hasOutgoing = new Set<string>();

  circuit.connections.forEach((conn) => {
    const fromId = conn.from.nodeId;
    const toId = conn.to.nodeId;

    // Ignore self-loops for topology analysis
    if (fromId !== toId) {
      hasOutgoing.add(fromId);
      hasIncoming.add(toId);
    }
  });

  const sources: string[] = [];
  const sinks: string[] = [];

  nodeIds.forEach((nodeId) => {
    if (!hasIncoming.has(nodeId)) {
      sources.push(nodeId);
    }
    if (!hasOutgoing.has(nodeId)) {
      sinks.push(nodeId);
    }
  });

  return { sources, sinks };
}

/**
 * Validates that chip ports reference valid nodes in the circuit
 */
export function validateChipPorts(
  circuit: Circuit,
  inputs: ChipPort[],
  outputs: ChipPort[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const nodeIds = new Set(circuit.nodes.map((n) => n.id));

  // Validate inputs
  inputs.forEach((input) => {
    const [nodeId] = input.nodeRef.split('.');
    if (!nodeIds.has(nodeId)) {
      errors.push(`Input port "${input.name}" references non-existent node: ${nodeId}`);
    }
  });

  // Validate outputs
  outputs.forEach((output) => {
    const [nodeId] = output.nodeRef.split('.');
    if (!nodeIds.has(nodeId)) {
      errors.push(`Output port "${output.name}" references non-existent node: ${nodeId}`);
    }
  });

  // Check for duplicate port names
  const allPortNames = [...inputs.map((i) => i.name), ...outputs.map((o) => o.name)];
  const uniqueNames = new Set(allPortNames);
  if (uniqueNames.size !== allPortNames.length) {
    errors.push('Duplicate port names detected');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes a circuit for chip creation by:
 * - Removing position information (will be recalculated when placed)
 * - Normalizing IDs
 */
export function prepareCircuitForChip(circuit: Circuit): Circuit {
  // Deep clone to avoid mutating original
  const cloned: Circuit = JSON.parse(JSON.stringify(circuit));

  // We keep positions for now - they'll be useful for displaying
  // the chip's internal structure if user wants to "peek inside"

  return cloned;
}

/**
 * Generates a unique chip name based on existing chips
 */
export function generateUniqueChipName(baseName: string, existingNames: string[]): string {
  const nameSet = new Set(existingNames);

  if (!nameSet.has(baseName)) {
    return baseName;
  }

  let counter = 2;
  while (nameSet.has(`${baseName} ${counter}`)) {
    counter++;
  }

  return `${baseName} ${counter}`;
}
