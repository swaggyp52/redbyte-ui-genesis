// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Node } from '@redbyte/rb-logic-core';
import type { RunStimulusEvent } from './runRecord';

const applyInputToggle = (node: Node, event: RunStimulusEvent) => {
  if (node.type !== 'Switch' && node.type !== 'INPUT') return node;
  return {
    ...node,
    state: {
      ...node.state,
      isOn: event.value,
    },
  };
};

export const applyStimulusEvents = (circuit: Circuit, events: RunStimulusEvent[]) => {
  if (!events.length) return circuit;

  const eventsByNode = new Map<string, RunStimulusEvent[]>();
  events.forEach((event) => {
    const list = eventsByNode.get(event.nodeId) ?? [];
    list.push(event);
    eventsByNode.set(event.nodeId, list);
  });

  const nextNodes = circuit.nodes.map((node) => {
    const nodeEvents = eventsByNode.get(node.id);
    if (!nodeEvents) return node;
    return nodeEvents.reduce((nextNode, event) => {
      if (event.type === 'input_toggled') {
        return applyInputToggle(nextNode, event);
      }
      return nextNode;
    }, node);
  });

  return {
    ...circuit,
    nodes: nextNodes,
  };
};
