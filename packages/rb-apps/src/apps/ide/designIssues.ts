import type { Circuit, Connection } from '@redbyte/rb-logic-core';
import { getDesignIssueSemantics } from './designChipMetadata';

export type DesignIssueKind = 'floating-output' | 'multiple-drivers' | 'unconnected-input';
export type DesignIssueSeverity = 'error' | 'warn';

export interface DesignIssueFocusTarget {
  nodeId: string;
  portKey?: string;
}

export interface DesignIssue {
  nodeId: string;
  portKey: string; // "nodeId.portName"
  kind: DesignIssueKind;
  severity: DesignIssueSeverity;
  title: string;
  message: string;
  hint: string;
  focusTarget: DesignIssueFocusTarget;
}

export interface DesignIssueMap {
  all: DesignIssue[];
  byNode: Map<string, DesignIssue[]>;
  byPort: Map<string, DesignIssue[]>;
}

function portRefToIds(
  ref: Connection['from'] | Connection['to'],
  fallbackPortName: string
): { nodeId: string; portName: string } | null {
  if (typeof ref === 'string') return null;
  const nodeId = ref.nodeId;
  const portName = ref.portName ?? (ref as { port?: string }).port ?? fallbackPortName;
  if (!nodeId || !portName) return null;
  return { nodeId, portName };
}

function addIssue(index: DesignIssueMap, issue: DesignIssue): void {
  index.all.push(issue);

  const byNode = index.byNode.get(issue.nodeId) ?? [];
  byNode.push(issue);
  index.byNode.set(issue.nodeId, byNode);

  const byPort = index.byPort.get(issue.portKey) ?? [];
  byPort.push(issue);
  index.byPort.set(issue.portKey, byPort);
}

function compareSeverity(left: DesignIssueSeverity, right: DesignIssueSeverity): number {
  if (left === right) return 0;
  return left === 'error' ? -1 : 1;
}

export function compareDesignIssues(left: DesignIssue, right: DesignIssue): number {
  const severityDiff = compareSeverity(left.severity, right.severity);
  if (severityDiff !== 0) return severityDiff;
  if (left.nodeId < right.nodeId) return -1;
  if (left.nodeId > right.nodeId) return 1;
  if (left.portKey < right.portKey) return -1;
  if (left.portKey > right.portKey) return 1;
  if (left.kind < right.kind) return -1;
  if (left.kind > right.kind) return 1;
  return 0;
}

export function computeDesignIssues(circuit: Circuit): DesignIssueMap {
  const issueMap: DesignIssueMap = {
    all: [],
    byNode: new Map<string, DesignIssue[]>(),
    byPort: new Map<string, DesignIssue[]>(),
  };

  const driverCountByInputPort = new Map<string, number>();

  for (const connection of circuit.connections) {
    const to = portRefToIds(connection.to, 'in');
    if (!to) continue;
    const portKey = `${to.nodeId}.${to.portName}`;
    driverCountByInputPort.set(portKey, (driverCountByInputPort.get(portKey) ?? 0) + 1);
  }

  for (const node of circuit.nodes) {
    const semantics = getDesignIssueSemantics(node.type);
    if (!semantics) continue;

    const inputPorts = semantics.inputPorts;

    for (const portName of inputPorts) {
      const portKey = `${node.id}.${portName}`;
      const driverCount = driverCountByInputPort.get(portKey) ?? 0;

      if (driverCount > 1) {
        addIssue(issueMap, {
          nodeId: node.id,
          portKey,
          kind: 'multiple-drivers',
          severity: 'error',
          title: 'Input has multiple drivers',
          message: 'Only one signal can drive this input at a time.',
          hint: 'Remove the extra wire so this pin has one clear source.',
          focusTarget: { nodeId: node.id, portKey: portName },
        });
        continue;
      }

      if (driverCount === 0 && semantics.role === 'logic') {
        addIssue(issueMap, {
          nodeId: node.id,
          portKey,
          kind: 'unconnected-input',
          severity: 'warn',
          title: 'Input is still unconnected',
          message: 'This input pin does not have a signal yet.',
          hint: 'Connect a source before you trust the circuit behavior.',
          focusTarget: { nodeId: node.id, portKey: portName },
        });
      }
    }

    if (semantics.role === 'output-observer') {
      const primaryInput = inputPorts[0];
      if (!primaryInput) continue;
      const primaryPortKey = `${node.id}.${primaryInput}`;
      const driverCount = driverCountByInputPort.get(primaryPortKey) ?? 0;
      if (driverCount === 0) {
        addIssue(issueMap, {
          nodeId: node.id,
          portKey: primaryPortKey,
          kind: 'floating-output',
          severity: 'error',
          title: 'Output has no driver',
          message: 'This output does not receive a signal from the circuit.',
          hint: 'Wire a gate or input into this output before you verify or export.',
          focusTarget: { nodeId: node.id, portKey: primaryInput },
        });
      }
    }
  }

  issueMap.all.sort(compareDesignIssues);
  for (const issues of issueMap.byNode.values()) {
    issues.sort(compareDesignIssues);
  }
  for (const issues of issueMap.byPort.values()) {
    issues.sort(compareDesignIssues);
  }

  return issueMap;
}

export function nodeIssueSeverity(
  nodeId: string,
  issueMap: DesignIssueMap
): DesignIssueSeverity | null {
  const issues = issueMap.byNode.get(nodeId);
  if (!issues || issues.length === 0) return null;
  return issues.some((issue) => issue.severity === 'error') ? 'error' : 'warn';
}
