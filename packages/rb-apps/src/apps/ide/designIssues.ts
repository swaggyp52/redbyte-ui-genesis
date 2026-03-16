/**
 * designIssues.ts — Real-time canvas error detection (Phase 3)
 *
 * Pure function, no React. O(n+e) scan of circuit nodes + connections.
 * Must complete <5ms on 100-node circuits.
 *
 * Issue kinds:
 * - floating-output: OUTPUT/Lamp node with no incoming connection
 * - multiple-drivers: an input port with 2+ connections driving it
 * - unconnected-input: a gate node with at least one input port unconnected
 */

import type { Circuit, Connection } from '@redbyte/rb-logic-core';

export type DesignIssueKind = 'floating-output' | 'multiple-drivers' | 'unconnected-input';

export interface DesignIssue {
  nodeId: string;
  portKey: string; // "nodeId.portName"
  kind: DesignIssueKind;
  message: string;
}

export interface DesignIssueMap {
  byNode: Map<string, DesignIssue[]>;
  byPort: Map<string, DesignIssue>;
}

// Node types that are module outputs (need at least one driver)
const OUTPUT_NODE_TYPES = new Set(['OUTPUT', 'Lamp']);

// Node types that are pure module inputs (they provide signal, not receive)
const INPUT_NODE_TYPES = new Set(['INPUT', 'Switch', 'InputPin', 'Clock', 'Button']);

// Node types that have no logic inputs (I/O or structural)
const NO_INPUT_TYPES = new Set([...INPUT_NODE_TYPES, ...OUTPUT_NODE_TYPES]);

// Gate node types that have named input ports — checked for unconnected inputs.
// This is the set of node types where a missing input is a real design error.
const GATE_INPUT_PORT_MAP: Record<string, string[]> = {
  AND:      ['a', 'b'],
  OR:       ['a', 'b'],
  NOT:      ['a'],
  NAND:     ['a', 'b'],
  NOR:      ['a', 'b'],
  XOR:      ['a', 'b'],
  XNOR:    ['a', 'b'],
  BUF:      ['a'],
  AND3:     ['a', 'b', 'c'],
  OR3:      ['a', 'b', 'c'],
  NAND3:    ['a', 'b', 'c'],
  NOR3:     ['a', 'b', 'c'],
  MUX2:     ['a', 'b', 's'],
  DFlipFlop: ['d', 'clk'],
};

function portRefToIds(ref: Connection['from']): { nodeId: string; portName: string } | null {
  if (typeof ref === 'string') return null; // legacy bare nodeId string — skip
  const nodeId = ref.nodeId;
  const portName = ref.portName ?? (ref as { port?: string }).port ?? '';
  if (!nodeId) return null;
  return { nodeId, portName };
}

export function computeDesignIssues(circuit: Circuit): DesignIssueMap {
  const byNode = new Map<string, DesignIssue[]>();
  const byPort = new Map<string, DesignIssue>();

  function addIssue(issue: DesignIssue): void {
    const list = byNode.get(issue.nodeId) ?? [];
    list.push(issue);
    byNode.set(issue.nodeId, list);
    byPort.set(issue.portKey, issue);
  }

  // Index: toPort key → count of drivers
  const driverCount = new Map<string, number>();
  // Index: toNodeId set (for floating-output detection)
  const nodesWithIncomingConnection = new Set<string>();

  for (const conn of circuit.connections) {
    const to = portRefToIds(conn.to);
    if (!to) continue;
    nodesWithIncomingConnection.add(to.nodeId);
    const portKey = `${to.nodeId}.${to.portName}`;
    driverCount.set(portKey, (driverCount.get(portKey) ?? 0) + 1);
  }

  // Build set of driven input ports per node (for unconnected-input check)
  const drivenPorts = new Set<string>();
  for (const [portKey] of driverCount) {
    drivenPorts.add(portKey);
  }

  for (const node of circuit.nodes) {
    // 1. Floating output: OUTPUT/Lamp with no driver
    if (OUTPUT_NODE_TYPES.has(node.type) && !nodesWithIncomingConnection.has(node.id)) {
      addIssue({
        nodeId: node.id,
        portKey: `${node.id}.__self`,
        kind: 'floating-output',
        message: 'No driver — this output has nothing connected to it.',
      });
    }

    // 2. Multiple drivers: any input port driven by 2+ connections
    if (!INPUT_NODE_TYPES.has(node.type)) {
      const inputPorts = GATE_INPUT_PORT_MAP[node.type] ?? [];
      for (const port of inputPorts) {
        const portKey = `${node.id}.${port}`;
        if ((driverCount.get(portKey) ?? 0) > 1) {
          addIssue({
            nodeId: node.id,
            portKey,
            kind: 'multiple-drivers',
            message: `Multiple drivers — only one signal can drive an input port.`,
          });
        }
      }
    }

    // 3. Unconnected input: gate node with a named input port missing a driver
    const gateInputs = GATE_INPUT_PORT_MAP[node.type];
    if (gateInputs) {
      for (const port of gateInputs) {
        const portKey = `${node.id}.${port}`;
        if (!drivenPorts.has(portKey)) {
          addIssue({
            nodeId: node.id,
            portKey,
            kind: 'unconnected-input',
            message: `Unconnected input — this pin has no signal.`,
          });
        }
      }
    }
  }

  return { byNode, byPort };
}

/**
 * Derive a per-node severity summary for rendering.
 * Returns 'error' if any issue is floating-output or multiple-drivers,
 * 'warn' if all issues are unconnected-input, null if no issues.
 */
export function nodeIssueSeverity(
  nodeId: string,
  issueMap: DesignIssueMap,
): 'error' | 'warn' | null {
  const issues = issueMap.byNode.get(nodeId);
  if (!issues || issues.length === 0) return null;
  const hasError = issues.some(
    (i) => i.kind === 'floating-output' || i.kind === 'multiple-drivers',
  );
  return hasError ? 'error' : 'warn';
}
