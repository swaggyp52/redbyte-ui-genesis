import type { Circuit, CompositeNodeDef, Node } from '@redbyte/rb-logic-core';
import type { HdlSource } from '../../fpga/toolchainBackend';

export const DESIGN_PROJECT_PROJECTION_VERSION = 1 as const;
export const DEFAULT_DESIGN_HIERARCHY_MAX_DEPTH = 8;

export type DesignHierarchyNodeKind =
  | 'top-module'
  | 'component-instance'
  | 'custom-component-instance';

export interface DesignHierarchyOpenTarget {
  kind: 'top-module' | 'component-instance' | 'custom-component';
  hierarchyId: string;
  nodeId?: string;
  componentType?: string;
}

export interface DesignHierarchyTruncation {
  reason: 'cycle' | 'depth-limit';
  componentType: string;
  activeComponentTypes: readonly string[];
}

export interface DesignHierarchyNode {
  hierarchyId: string;
  kind: DesignHierarchyNodeKind;
  label: string;
  runtimeType: string;
  nodeId: string | null;
  depth: number;
  selected: boolean;
  openTarget: DesignHierarchyOpenTarget;
  children: readonly DesignHierarchyNode[];
  truncation: DesignHierarchyTruncation | null;
}

export interface DesignHierarchyProjection {
  version: typeof DESIGN_PROJECT_PROJECTION_VERSION;
  root: DesignHierarchyNode;
  selectedHierarchyId: string | null;
  cycleCount: number;
  depthLimitCount: number;
}

export interface DesignHierarchyProjectionInput {
  /** Canonical project/top identity supplied by the owning project runtime. */
  topModule: {
    id: string;
    name: string;
  };
  circuit: Circuit;
  customComponents?: readonly CompositeNodeDef[];
  /** Current Design selection. It only applies to real top-level canvas nodes. */
  selectedNodeId?: string | null;
  /** Optional hierarchy selection, useful after opening a nested custom component. */
  selectedHierarchyId?: string | null;
  maxDepth?: number;
}

export interface DesignHierarchyBreadcrumb {
  hierarchyId: string;
  label: string;
  kind: DesignHierarchyNodeKind;
  openTarget: DesignHierarchyOpenTarget;
}

function requireIdentity(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`Design hierarchy requires a non-empty ${field}.`);
  }
  return trimmed;
}

function hierarchySegment(value: string): string {
  return encodeURIComponent(value);
}

function readNodeLabel(node: Node): string {
  const direct = typeof node.label === 'string' ? node.label.trim() : '';
  if (direct.length > 0) return direct;
  const configured =
    node.config && typeof node.config.label === 'string' ? node.config.label.trim() : '';
  if (configured.length > 0) return configured;
  return node.type;
}

function normalizeMaxDepth(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_DESIGN_HIERARCHY_MAX_DEPTH;
  return Math.max(1, Math.min(32, Math.floor(value as number)));
}

export function deriveDesignHierarchy(
  input: DesignHierarchyProjectionInput,
): DesignHierarchyProjection {
  const topId = requireIdentity(input.topModule.id, 'top module ID');
  const topName = requireIdentity(input.topModule.name, 'top module name');
  const maxDepth = normalizeMaxDepth(input.maxDepth);
  const definitionsByName = new Map<string, CompositeNodeDef>();
  for (const definition of input.customComponents ?? []) {
    // Match project runtime registration: later same-name definitions win.
    definitionsByName.set(definition.name, definition);
  }

  let cycleCount = 0;
  let depthLimitCount = 0;
  let resolvedSelectedHierarchyId: string | null = null;

  const buildInstances = (
    circuit: Circuit,
    parentHierarchyId: string,
    depth: number,
    activeComponentTypes: readonly string[],
  ): DesignHierarchyNode[] => circuit.nodes.map((node) => {
    const hierarchyId = `${parentHierarchyId}/instance:${hierarchySegment(node.id)}`;
    const customDefinition = definitionsByName.get(node.type);
    const selected =
      input.selectedHierarchyId === hierarchyId ||
      (!input.selectedHierarchyId && depth === 1 && input.selectedNodeId === node.id);
    if (selected) resolvedSelectedHierarchyId = hierarchyId;

    let children: readonly DesignHierarchyNode[] = [];
    let truncation: DesignHierarchyTruncation | null = null;

    if (customDefinition) {
      if (activeComponentTypes.includes(customDefinition.name)) {
        cycleCount += 1;
        truncation = {
          reason: 'cycle',
          componentType: customDefinition.name,
          activeComponentTypes: [...activeComponentTypes, customDefinition.name],
        };
      } else if (depth >= maxDepth) {
        depthLimitCount += 1;
        truncation = {
          reason: 'depth-limit',
          componentType: customDefinition.name,
          activeComponentTypes: [...activeComponentTypes, customDefinition.name],
        };
      } else {
        children = buildInstances(
          customDefinition.subcircuit,
          hierarchyId,
          depth + 1,
          [...activeComponentTypes, customDefinition.name],
        );
      }
    }

    const kind: DesignHierarchyNodeKind = customDefinition
      ? 'custom-component-instance'
      : 'component-instance';
    return {
      hierarchyId,
      kind,
      label: readNodeLabel(node),
      runtimeType: node.type,
      nodeId: node.id,
      depth,
      selected,
      openTarget: customDefinition
        ? {
            kind: 'custom-component',
            hierarchyId,
            nodeId: node.id,
            componentType: customDefinition.name,
          }
        : {
            kind: 'component-instance',
            hierarchyId,
            nodeId: node.id,
            componentType: node.type,
          },
      children,
      truncation,
    };
  });

  const rootHierarchyId = `top:${hierarchySegment(topId)}`;
  const rootSelected = input.selectedHierarchyId === rootHierarchyId;
  if (rootSelected) resolvedSelectedHierarchyId = rootHierarchyId;
  const root: DesignHierarchyNode = {
    hierarchyId: rootHierarchyId,
    kind: 'top-module',
    label: topName,
    runtimeType: topName,
    nodeId: null,
    depth: 0,
    selected: rootSelected,
    openTarget: {
      kind: 'top-module',
      hierarchyId: rootHierarchyId,
    },
    children: buildInstances(input.circuit, rootHierarchyId, 1, []),
    truncation: null,
  };

  return {
    version: DESIGN_PROJECT_PROJECTION_VERSION,
    root,
    selectedHierarchyId: resolvedSelectedHierarchyId,
    cycleCount,
    depthLimitCount,
  };
}

export function flattenDesignHierarchy(
  root: DesignHierarchyNode,
): DesignHierarchyNode[] {
  const result: DesignHierarchyNode[] = [];
  const visit = (node: DesignHierarchyNode): void => {
    result.push(node);
    for (const child of node.children) visit(child);
  };
  visit(root);
  return result;
}

export function findDesignHierarchyNode(
  root: DesignHierarchyNode,
  hierarchyId: string,
): DesignHierarchyNode | null {
  if (root.hierarchyId === hierarchyId) return root;
  for (const child of root.children) {
    const found = findDesignHierarchyNode(child, hierarchyId);
    if (found) return found;
  }
  return null;
}

export function buildDesignHierarchyBreadcrumbs(
  root: DesignHierarchyNode,
  hierarchyId: string,
): DesignHierarchyBreadcrumb[] {
  const path: DesignHierarchyNode[] = [];
  const visit = (node: DesignHierarchyNode): boolean => {
    path.push(node);
    if (node.hierarchyId === hierarchyId) return true;
    for (const child of node.children) {
      if (visit(child)) return true;
    }
    path.pop();
    return false;
  };
  if (!visit(root)) return [];
  return path.map((node) => ({
    hierarchyId: node.hierarchyId,
    label: node.label,
    kind: node.kind,
    openTarget: node.openTarget,
  }));
}

export type DesignSourceKind = 'visual-circuit' | 'custom-component' | 'hdl-source';

export interface DesignSourceEntry {
  id: string;
  kind: DesignSourceKind;
  label: string;
  path: string | null;
  language: 'redbyte-visual' | 'vhdl' | 'verilog';
  fileBacked: boolean;
  accessMode: 'canvas-editable' | 'definition-inspect-only' | 'preserved-code-read-only';
  nodeCount: number | null;
  connectionCount: number | null;
  characterCount: number | null;
  isTop: boolean;
}

export interface DesignSourcesProjection {
  version: typeof DESIGN_PROJECT_PROJECTION_VERSION;
  entries: readonly DesignSourceEntry[];
  fileBackedCount: number;
  visualDocumentCount: number;
}

export interface DesignSourcesProjectionInput {
  topModule: {
    id: string;
    name: string;
  };
  circuit: Circuit;
  customComponents?: readonly CompositeNodeDef[];
  /** Only real project HDL sources belong here. Generated preview filenames do not. */
  hdlSources?: readonly HdlSource[];
}

/**
 * Projects actual source objects without manufacturing generated HDL files.
 * Visual circuits and custom composites are explicitly non-file-backed; HDL
 * entries preserve only paths that already exist in project state.
 */
export function deriveDesignSources(
  input: DesignSourcesProjectionInput,
): DesignSourcesProjection {
  const topId = requireIdentity(input.topModule.id, 'top module ID');
  const topName = requireIdentity(input.topModule.name, 'top module name');
  const entries: DesignSourceEntry[] = [
    {
      id: `visual:${hierarchySegment(topId)}`,
      kind: 'visual-circuit',
      label: topName,
      path: null,
      language: 'redbyte-visual',
      fileBacked: false,
      accessMode: 'canvas-editable',
      nodeCount: input.circuit.nodes.length,
      connectionCount: input.circuit.connections.length,
      characterCount: null,
      isTop: true,
    },
  ];

  (input.customComponents ?? []).forEach((definition, index) => {
    entries.push({
      id: `custom:${hierarchySegment(definition.name)}:${index}`,
      kind: 'custom-component',
      label: definition.name,
      path: null,
      language: 'redbyte-visual',
      fileBacked: false,
      accessMode: 'definition-inspect-only',
      nodeCount: definition.subcircuit.nodes.length,
      connectionCount: definition.subcircuit.connections.length,
      characterCount: null,
      isTop: false,
    });
  });

  const hdlPathOccurrences = new Map<string, number>();
  for (const source of input.hdlSources ?? []) {
    const occurrenceKey = `${source.language}:${source.path}`;
    const occurrence = hdlPathOccurrences.get(occurrenceKey) ?? 0;
    hdlPathOccurrences.set(occurrenceKey, occurrence + 1);
    entries.push({
      id: `hdl:${source.language}:${hierarchySegment(source.path)}:${occurrence}`,
      kind: 'hdl-source',
      label: source.path,
      path: source.path,
      language: source.language,
      fileBacked: true,
      accessMode: 'preserved-code-read-only',
      nodeCount: null,
      connectionCount: null,
      characterCount: source.text.length,
      // A top-module name does not identify a source file. Do not guess.
      isTop: false,
    });
  }

  return {
    version: DESIGN_PROJECT_PROJECTION_VERSION,
    entries,
    fileBackedCount: entries.filter((entry) => entry.fileBacked).length,
    visualDocumentCount: entries.filter((entry) => !entry.fileBacked).length,
  };
}
