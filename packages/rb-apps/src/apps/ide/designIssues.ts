import type { Circuit, Connection } from '@redbyte/rb-logic-core';
import { getDesignIssueSemantics } from './designChipMetadata';

export type DesignIssueKind = 'floating-output' | 'multiple-drivers' | 'unconnected-input';
export type DesignIssueSeverity = 'error' | 'warn' | 'draft';

export interface DesignIssueFocusTarget {
  nodeId: string;
  portKey?: string;
}

export interface DesignIssue {
  nodeId: string;
  portKey: string; // "nodeId.portName"
  kind: DesignIssueKind;
  severity: DesignIssueSeverity;
  blocking: boolean;
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
  const order: Record<DesignIssueSeverity, number> = {
    error: 0,
    warn: 1,
    draft: 2,
  };
  return order[left] - order[right];
}

export function compareDesignIssues(left: DesignIssue, right: DesignIssue): number {
  const severityDiff = compareSeverity(left.severity, right.severity);
  if (severityDiff !== 0) return severityDiff;
  const kindOrder: Record<DesignIssueKind, number> = {
    'multiple-drivers': 0,
    'floating-output': 1,
    'unconnected-input': 2,
  };
  const kindDiff = kindOrder[left.kind] - kindOrder[right.kind];
  if (kindDiff !== 0) return kindDiff;
  if (left.nodeId < right.nodeId) return -1;
  if (left.nodeId > right.nodeId) return 1;
  if (left.portKey < right.portKey) return -1;
  if (left.portKey > right.portKey) return 1;
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

    const inputPorts = getRequiredInputPorts(node, semantics.inputPorts);

    for (const portName of inputPorts) {
      const portKey = `${node.id}.${portName}`;
      const driverCount = driverCountByInputPort.get(portKey) ?? 0;

      if (driverCount > 1) {
        addIssue(issueMap, {
          nodeId: node.id,
          portKey,
          kind: 'multiple-drivers',
          severity: 'error',
          blocking: true,
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
          severity: 'draft',
          blocking: false,
          title: 'Input not wired yet',
          message: 'This input pin does not have a source yet.',
          hint: 'Keep building, then connect a source before you verify or export.',
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
          severity: 'draft',
          blocking: false,
          title: 'Output not wired yet',
          message: 'This output is placed but does not receive a signal from the circuit yet.',
          hint: 'Keep building, then connect a gate or input before you verify or export.',
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

function getRequiredInputPorts(
  node: Circuit['nodes'][number],
  declaredPorts: string[]
): string[] {
  if (node.type !== 'Register1' && node.type !== 'RegisterBus' && node.type !== 'StateBank') {
    return declaredPorts;
  }

  const hasEnable = node.config?.hasEnable === true;
  const resetKind =
    typeof node.config?.resetKind === 'string'
      ? node.config.resetKind
      : 'none';

  return declaredPorts.filter((portName) => {
    if (portName === 'EN') return hasEnable;
    if (portName === 'RST') return resetKind !== 'none';
    return true;
  });
}

export function nodeIssueSeverity(
  nodeId: string,
  issueMap: DesignIssueMap
): DesignIssueSeverity | null {
  const issues = issueMap.byNode.get(nodeId);
  if (!issues || issues.length === 0) return null;
  if (issues.some((issue) => issue.severity === 'error')) return 'error';
  if (issues.some((issue) => issue.severity === 'warn')) return 'warn';
  return 'draft';
}
