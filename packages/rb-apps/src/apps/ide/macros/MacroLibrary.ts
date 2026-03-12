import type { Circuit, Connection, Node, PortRef } from '@redbyte/rb-logic-core';
import { compareCodepoint } from '../../../export/codepointSort';
import {
  pasteCluster,
  serializeCluster,
  type ClipboardCluster,
} from '../designClipboard';

export interface MacroPort {
  id: string;
  label: string;
  nodeId: string;
  portName: string;
}

export interface MacroDefinition {
  id: string;
  name: string;
  description?: string;
  inputs: MacroPort[];
  outputs: MacroPort[];
  cluster: ClipboardCluster;
  createdAt: number;
}

export interface MacroBoundaryAnalysis {
  inputs: MacroPort[];
  outputs: MacroPort[];
  errors: string[];
}

export interface SaveMacroInput {
  circuit: Circuit;
  selectedNodeIds: Set<string>;
  name: string;
  description?: string;
  selectedInputIds?: string[];
  selectedOutputIds?: string[];
  createdAt?: number;
  idFactory?: () => string;
}

export interface SaveMacroResult {
  library: MacroDefinition[];
  macro: MacroDefinition;
  analysis: MacroBoundaryAnalysis;
}

export interface MacroInstantiationOptions {
  nextInstanceIndex?: number;
}

export interface MacroInstantiationTemplate {
  instanceLabel: string;
  nodes: Node[];
  connections: Connection[];
  newIdMap: Map<string, string>;
}

export interface MacroInstantiationResult extends MacroInstantiationTemplate {
  circuit: Circuit;
  insertedNodeIds: string[];
}

const INPUT_NODE_TYPES = new Set(['INPUT', 'Switch', 'Button', 'Clock', 'CLOCK']);
const OUTPUT_NODE_TYPES = new Set(['OUTPUT', 'Lamp']);

function resolvePortRef(
  raw: Connection['from'] | Connection['to'],
  fallbackPortName: string
): { nodeId: string; portName: string } {
  if (typeof raw === 'string') {
    return {
      nodeId: raw,
      portName: fallbackPortName,
    };
  }

  const typed = raw as PortRef & { port?: string };
  return {
    nodeId: typed.nodeId,
    portName: typed.portName ?? typed.port ?? fallbackPortName,
  };
}

function buildPortId(kind: 'input' | 'output', nodeId: string, portName: string): string {
  return `${kind}:${nodeId}.${portName}`;
}

function readNodeLabel(node: Node | undefined, fallback: string): string {
  const explicitLabel = typeof node?.label === 'string' ? node.label.trim() : '';
  if (explicitLabel.length > 0) return explicitLabel;
  const configLabel =
    node && typeof node.config === 'object' && node.config && typeof node.config.label === 'string'
      ? node.config.label.trim()
      : '';
  if (configLabel.length > 0) return configLabel;
  return fallback;
}

function dedupeAndSortPorts(entries: MacroPort[]): MacroPort[] {
  const unique = new Map<string, MacroPort>();
  for (const entry of entries) {
    if (!unique.has(entry.id)) {
      unique.set(entry.id, { ...entry });
    }
  }
  return [...unique.values()].sort((left, right) => {
    const labelDelta = compareCodepoint(left.label, right.label);
    if (labelDelta !== 0) return labelDelta;
    const nodeDelta = compareCodepoint(left.nodeId, right.nodeId);
    if (nodeDelta !== 0) return nodeDelta;
    return compareCodepoint(left.portName, right.portName);
  });
}

function toSelectedIdSet(selectedNodeIds: Set<string>): Set<string> {
  const normalized = new Set<string>();
  for (const id of selectedNodeIds) {
    const trimmed = id.trim();
    if (trimmed.length > 0) normalized.add(trimmed);
  }
  return normalized;
}

function sanitizeMacroDescription(value?: string): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeInstanceBase(name: string): string {
  const normalized = name
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized.length > 0 ? normalized : 'Macro';
}

function sortMacroLibrary(library: MacroDefinition[]): MacroDefinition[] {
  return [...library].sort((left, right) => {
    const createdDelta = left.createdAt - right.createdAt;
    if (createdDelta !== 0) return createdDelta;
    const nameDelta = compareCodepoint(left.name, right.name);
    if (nameDelta !== 0) return nameDelta;
    return compareCodepoint(left.id, right.id);
  });
}

function filterPortsByIds(entries: MacroPort[], selectedIds?: string[]): MacroPort[] {
  if (!selectedIds || selectedIds.length === 0) {
    return entries.map((entry) => ({ ...entry }));
  }
  const allowed = new Set(selectedIds.map((entry) => entry.trim()).filter((entry) => entry.length > 0));
  return entries.filter((entry) => allowed.has(entry.id)).map((entry) => ({ ...entry }));
}

export function analyzeMacroBoundary(
  circuit: Circuit,
  selectedNodeIds: Set<string>
): MacroBoundaryAnalysis {
  const selected = toSelectedIdSet(selectedNodeIds);
  const nodeById = new Map(circuit.nodes.map((node) => [node.id, node] as const));
  const inputPorts: MacroPort[] = [];
  const outputPorts: MacroPort[] = [];

  for (const connection of circuit.connections) {
    const from = resolvePortRef(connection.from, 'out');
    const to = resolvePortRef(connection.to, 'in');
    const fromInside = selected.has(from.nodeId);
    const toInside = selected.has(to.nodeId);

    if (!fromInside && toInside) {
      const sourceNode = nodeById.get(from.nodeId);
      inputPorts.push({
        id: buildPortId('input', to.nodeId, to.portName),
        label: readNodeLabel(sourceNode, to.portName),
        nodeId: to.nodeId,
        portName: to.portName,
      });
    }

    if (fromInside && !toInside) {
      const targetNode = nodeById.get(to.nodeId);
      outputPorts.push({
        id: buildPortId('output', from.nodeId, from.portName),
        label: readNodeLabel(targetNode, from.portName),
        nodeId: from.nodeId,
        portName: from.portName,
      });
    }
  }

  if (inputPorts.length === 0) {
    for (const node of circuit.nodes) {
      if (!selected.has(node.id) || !INPUT_NODE_TYPES.has(node.type)) continue;
      inputPorts.push({
        id: buildPortId('input', node.id, 'out'),
        label: readNodeLabel(node, node.id),
        nodeId: node.id,
        portName: 'out',
      });
    }
  }

  if (outputPorts.length === 0) {
    for (const node of circuit.nodes) {
      if (!selected.has(node.id) || !OUTPUT_NODE_TYPES.has(node.type)) continue;
      outputPorts.push({
        id: buildPortId('output', node.id, 'in'),
        label: readNodeLabel(node, node.id),
        nodeId: node.id,
        portName: 'in',
      });
    }
  }

  const inputs = dedupeAndSortPorts(inputPorts);
  const outputs = dedupeAndSortPorts(outputPorts);
  const errors: string[] = [];

  if (selected.size === 0) {
    errors.push('Select at least one node to save a macro.');
  }
  if (inputs.length === 0) {
    errors.push('Macro must expose at least one input.');
  }
  if (outputs.length === 0) {
    errors.push('Macro must expose at least one output.');
  }

  return { inputs, outputs, errors };
}

export function saveMacro(
  library: MacroDefinition[],
  input: SaveMacroInput
): SaveMacroResult {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new Error('Macro name is required.');
  }

  const selected = toSelectedIdSet(input.selectedNodeIds);
  const analysis = analyzeMacroBoundary(input.circuit, selected);
  if (analysis.errors.length > 0) {
    throw new Error(analysis.errors.join(' '));
  }

  const inputs = filterPortsByIds(analysis.inputs, input.selectedInputIds);
  const outputs = filterPortsByIds(analysis.outputs, input.selectedOutputIds);
  if (inputs.length === 0) {
    throw new Error('Macro must keep at least one input.');
  }
  if (outputs.length === 0) {
    throw new Error('Macro must keep at least one output.');
  }

  const macro: MacroDefinition = {
    id: input.idFactory?.() ?? globalThis.crypto.randomUUID(),
    name,
    description: sanitizeMacroDescription(input.description),
    inputs,
    outputs,
    cluster: serializeCluster(input.circuit, selected),
    createdAt: input.createdAt ?? Date.now(),
  };

  const nextLibrary = sortMacroLibrary([
    ...library.filter((entry) => entry.id !== macro.id),
    macro,
  ]);

  return {
    library: nextLibrary,
    macro,
    analysis,
  };
}

export function deleteMacro(library: MacroDefinition[], macroId: string): MacroDefinition[] {
  return library.filter((entry) => entry.id !== macroId);
}

export function updateMacro(
  library: MacroDefinition[],
  macroId: string,
  updated: Partial<Pick<MacroDefinition, 'name' | 'description' | 'inputs' | 'outputs'>>
): MacroDefinition[] {
  return library.map((entry) => {
    if (entry.id !== macroId) return entry;
    const nextName = updated.name?.trim();
    return {
      ...entry,
      name: nextName && nextName.length > 0 ? nextName : entry.name,
      description:
        updated.description !== undefined
          ? sanitizeMacroDescription(updated.description)
          : entry.description,
      inputs: updated.inputs ? updated.inputs.map((port) => ({ ...port })) : entry.inputs,
      outputs: updated.outputs ? updated.outputs.map((port) => ({ ...port })) : entry.outputs,
    };
  });
}

export function getInstantiationTemplate(
  library: MacroDefinition[],
  macroId: string,
  circuit: Circuit,
  position: { x: number; y: number },
  options: MacroInstantiationOptions = {}
): MacroInstantiationTemplate {
  const macro = library.find((entry) => entry.id === macroId);
  if (!macro) {
    throw new Error(`Macro "${macroId}" was not found.`);
  }

  const pasted = pasteCluster(circuit, macro.cluster, position);
  const instanceIndex = Math.max(1, Math.floor(options.nextInstanceIndex ?? 1));

  return {
    instanceLabel: `${sanitizeInstanceBase(macro.name)}_${instanceIndex}`,
    nodes: pasted.pastedNodes,
    connections: pasted.pastedConnections,
    newIdMap: pasted.newIdMap,
  };
}

export function instantiateMacroIntoCircuit(
  library: MacroDefinition[],
  macroId: string,
  circuit: Circuit,
  position: { x: number; y: number },
  options: MacroInstantiationOptions = {}
): MacroInstantiationResult {
  const template = getInstantiationTemplate(library, macroId, circuit, position, options);
  return {
    ...template,
    insertedNodeIds: template.nodes.map((node) => node.id),
    circuit: {
      nodes: [...circuit.nodes, ...template.nodes],
      connections: [...circuit.connections, ...template.connections],
    },
  };
}