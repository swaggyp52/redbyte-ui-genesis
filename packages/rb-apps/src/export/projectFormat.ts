// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type {
  Circuit,
  CompositeNodeDef,
  Connection,
  Node,
  PortRef,
} from '@redbyte/rb-logic-core';
import type { RunRecord } from '../recording/runRecord';
import type { Probe } from '../stores/probeStore';
import type { ToolchainProjectInput } from '../fpga/toolchainBackend';
import type { IoMapping, LabSpecV1, TestVector } from '@redbyte/rb-utils';
import { stableStringify } from './stableStringify';
import { compareCodepoint } from './codepointSort';

export interface RBFpgaConstraints {
  type: 'xdc';
  text: string;
}

export interface RBFpgaConfig {
  board: 'basys3';
  constraints?: RBFpgaConstraints;
  part?: string;
  preset?: string;
  top?: string;
}

export interface SubmoduleEntry {
  id: string;
  name: string;
  type: 'custom-chip' | 'hdl-module';
  inputPins: string[];
  outputPins: string[];
}

export interface TraceMetadata {
  tickCount: number;
  startTick?: number;
  sampleRate?: number;
  probeIds?: string[];
}

export interface RBProject {
  kind: 'rb-project';
  version: 1;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  circuit: Circuit;
  hdl?: ToolchainProjectInput;
  fpga?: RBFpgaConfig;
  layout?: {
    perspectiveId?: string;
    splitRatio?: number;
    dock?: { open?: boolean; tab?: string };
  };
  probes?: Probe[];
  oscilloscope?: {
    timeWindowSec?: number;
    paused?: boolean;
    showTickGuides?: boolean;
  };
  recorder?: {
    lastRunRecord?: RunRecord;
  };
  ioMapping?: IoMapping;
  vectors?: TestVector[];
  traceMetadata?: TraceMetadata;
  submodules?: SubmoduleEntry[];
  labSpec?: LabSpecV1;
  customComponents?: CompositeNodeDef[];
  meta?: {
    appVersion?: string;
    gitCommit?: string;
    tickRate?: number;
    tags?: string[];
    projectId?: string;
    labId?: string;
    labStepIndex?: number;
    appSurface?: string;
    studentName?: string;  // optional, manually entered — stored in project meta
    labCode?: string;      // optional instructor-defined e.g. "ECE347-L3-2026-02"
  };
}

export const createRBProject = (input: Omit<RBProject, 'kind' | 'version' | 'updatedAt'>): RBProject => ({
  ...input,
  kind: 'rb-project',
  version: 1,
  updatedAt: new Date().toISOString(),
});

const normalizeProjectCircuit = (circuit: Circuit): Circuit => {
  const nodes = [...circuit.nodes]
    .map((node, index) => normalizeProjectNode(node, index))
    .sort((a, b) => compareCodepoint(a.id, b.id));

  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      throw new Error(`Invalid project: duplicate node id "${node.id}"`);
    }
    nodeIds.add(node.id);
  }

  const connections = [...circuit.connections]
    .map((connection, index) => normalizeProjectConnection(connection, index))
    .map((connection) => {
      if (!nodeIds.has(connection.from.nodeId)) {
        throw new Error(
          `Invalid project: connection references missing node "${connection.from.nodeId}"`
        );
      }
      if (!nodeIds.has(connection.to.nodeId)) {
        throw new Error(
          `Invalid project: connection references missing node "${connection.to.nodeId}"`
        );
      }
      return connection;
    })
    .sort((a, b) => {
      const left = `${a.from.nodeId}.${a.from.portName}->${a.to.nodeId}.${a.to.portName}`;
      const right = `${b.from.nodeId}.${b.from.portName}->${b.to.nodeId}.${b.to.portName}`;
      return compareCodepoint(left, right);
    });

  return { nodes, connections };
};

const normalizeProbes = (probes?: Probe[]): Probe[] | undefined => {
  if (!probes) return probes;
  return [...probes]
    .map((probe) => ({ ...probe }))
    .sort((a, b) => {
      const left = `${a.nodeId}.${a.portName}.${a.id}`;
      const right = `${b.nodeId}.${b.portName}.${b.id}`;
      return compareCodepoint(left, right);
    });
};

const normalizeHdl = (hdl?: ToolchainProjectInput): ToolchainProjectInput | undefined => {
  if (!hdl) return hdl;
  const sources = [...(hdl.sources ?? [])]
    .map((source) => ({ ...source }))
    .sort((a, b) => {
      const left = `${a.path}.${a.language}`;
      const right = `${b.path}.${b.language}`;
      return compareCodepoint(left, right);
    });

  return {
    ...hdl,
    sources,
  };
};

const normalizeIoMapping = (ioMapping?: IoMapping): IoMapping | undefined => {
  if (!ioMapping) return ioMapping;
  const normalizeEntry = (
    entry: unknown,
    direction: 'in' | 'out',
    index: number
  ) => {
    if (!isRecord(entry)) return null;
    const id = readRequiredString(entry.id) ?? `io_${direction}_${index + 1}`;
    const label = readRequiredString(entry.label) ?? id;
    return {
      ...entry,
      id,
      nodeId: readOptionalString(entry.nodeId) ?? '',
      port: readOptionalString(entry.port) ?? (direction === 'in' ? 'out' : 'in'),
      label,
      pin: readOptionalString(entry.pin)?.toUpperCase() ?? '',
    };
  };
  const inputs = [...(ioMapping.inputs ?? [])]
    .map((entry, index) => normalizeEntry(entry, 'in', index))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => {
      const left = `${a.nodeId}.${a.port}.${a.id}`;
      const right = `${b.nodeId}.${b.port}.${b.id}`;
      return compareCodepoint(left, right);
    });
  const outputs = [...(ioMapping.outputs ?? [])]
    .map((entry, index) => normalizeEntry(entry, 'out', index))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => {
      const left = `${a.nodeId}.${a.port}.${a.id}`;
      const right = `${b.nodeId}.${b.port}.${b.id}`;
      return compareCodepoint(left, right);
    });
  return { inputs, outputs };
};

const normalizeVectors = (vectors?: TestVector[]): TestVector[] | undefined => {
  if (!vectors) return vectors;
  return [...vectors]
    .map((vector, index) => normalizeProjectVector(vector, index))
    .filter((vector): vector is NonNullable<typeof vector> => vector !== null)
    .sort((a, b) => a.tick - b.tick);
};

const normalizeSubmodules = (submodules?: SubmoduleEntry[]): SubmoduleEntry[] | undefined => {
  if (!submodules) return submodules;
  return [...submodules]
    .map((sub) => ({ ...sub }))
    .sort((a, b) => compareCodepoint(a.id, b.id));
};

export const encodeRBProject = (project: RBProject) => {
  const sortedTags = project.meta?.tags ? [...project.meta.tags].sort((a, b) => compareCodepoint(a, b)) : undefined;
  const normalized = {
    ...project,
    circuit: normalizeProjectCircuit(project.circuit),
    probes: normalizeProbes(project.probes),
    hdl: normalizeHdl(project.hdl),
    ioMapping: normalizeIoMapping(project.ioMapping),
    vectors: normalizeVectors(project.vectors),
    submodules: normalizeSubmodules(project.submodules),
    meta: project.meta
      ? {
          ...project.meta,
          tags: sortedTags,
        }
      : undefined,
  };
  return stableStringify(normalized);
};

export const normalizeRBProject = (value: unknown): RBProject => {
  if (!isRecord(value)) {
    throw new Error('Invalid project: not an object');
  }
  if (value.kind !== 'rb-project' || value.version !== 1) {
    throw new Error('Invalid project: unsupported kind or version');
  }

  const name = readRequiredString(value.name);
  if (!name) {
    throw new Error('Invalid project: name is required');
  }

  if (!isRecord(value.circuit)) {
    throw new Error('Invalid project: circuit is missing');
  }
  if (!Array.isArray(value.circuit.nodes) || !Array.isArray(value.circuit.connections)) {
    throw new Error('Invalid project: circuit must include nodes and connections arrays');
  }

  return {
    ...value,
    kind: 'rb-project',
    version: 1,
    createdAt: readOptionalString(value.createdAt) ?? '1970-01-01T00:00:00.000Z',
    updatedAt: readOptionalString(value.updatedAt) ?? '1970-01-01T00:00:00.000Z',
    name,
    description: readOptionalString(value.description) ?? undefined,
    circuit: normalizeProjectCircuit(value.circuit as Circuit),
    probes: normalizeProbes(Array.isArray(value.probes) ? value.probes : undefined),
    hdl: normalizeHdl(isRecord(value.hdl) ? (value.hdl as ToolchainProjectInput) : undefined),
    fpga: isRecord(value.fpga) ? { ...(value.fpga as RBFpgaConfig) } : undefined,
    layout: isRecord(value.layout)
      ? {
          ...(value.layout as NonNullable<RBProject['layout']>),
          dock: isRecord(value.layout.dock)
            ? { ...(value.layout.dock as NonNullable<NonNullable<RBProject['layout']>['dock']>) }
            : undefined,
        }
      : undefined,
    oscilloscope: isRecord(value.oscilloscope)
      ? { ...(value.oscilloscope as NonNullable<RBProject['oscilloscope']>) }
      : undefined,
    recorder: isRecord(value.recorder)
      ? { ...(value.recorder as NonNullable<RBProject['recorder']>) }
      : undefined,
    ioMapping: normalizeIoMapping(isRecord(value.ioMapping) ? (value.ioMapping as IoMapping) : undefined),
    vectors: normalizeVectors(Array.isArray(value.vectors) ? value.vectors as TestVector[] : undefined),
    traceMetadata: isRecord(value.traceMetadata)
      ? { ...(value.traceMetadata as TraceMetadata) }
      : undefined,
    submodules: normalizeSubmodules(Array.isArray(value.submodules) ? value.submodules as SubmoduleEntry[] : undefined),
    labSpec: isRecord(value.labSpec) ? { ...(value.labSpec as LabSpecV1) } : undefined,
    customComponents: Array.isArray(value.customComponents)
      ? value.customComponents.filter(isCompositeNodeDef)
      : undefined,
    meta: isRecord(value.meta) ? { ...(value.meta as NonNullable<RBProject['meta']>) } : undefined,
  };
};

export const decodeRBProject = (raw: string): RBProject => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid project: malformed JSON');
  }
  return normalizeRBProject(parsed);
};

function normalizeProjectNode(node: Node | Record<string, unknown>, index: number): Node {
  if (!isRecord(node)) {
    throw new Error(`Invalid project: node ${index + 1} is not an object`);
  }

  const id = readRequiredString(node.id);
  if (!id) {
    throw new Error(`Invalid project: node ${index + 1} is missing an id`);
  }

  const type = readRequiredString(node.type);
  if (!type) {
    throw new Error(`Invalid project: node "${id}" is missing a type`);
  }

  const rawPosition = isRecord(node.position) ? node.position : null;
  const x = readFiniteNumber(rawPosition?.x ?? node.x, 0);
  const y = readFiniteNumber(rawPosition?.y ?? node.y, 0);

  const normalized: Node = {
    ...(node as Node),
    id,
    type,
    position: { x, y },
    x,
    y,
    rotation: readFiniteNumber(node.rotation, 0),
    config: cloneRecord(node.config ?? node.params),
    state: cloneRecord(node.state),
  };

  const label = readOptionalString(node.label);
  if (label) {
    normalized.label = label;
  } else {
    delete normalized.label;
  }

  const inputs = cloneRecord(node.inputs);
  if (inputs) {
    normalized.inputs = inputs;
  } else {
    delete normalized.inputs;
  }

  const outputs = cloneRecord(node.outputs);
  if (outputs) {
    normalized.outputs = outputs;
  } else {
    delete normalized.outputs;
  }

  return normalized;
}

function normalizeProjectConnection(
  connection: Connection | Record<string, unknown>,
  index: number
): Connection {
  if (!isRecord(connection)) {
    throw new Error(`Invalid project: connection ${index + 1} is not an object`);
  }

  const normalized: Connection = {
    from: normalizePortRef(
      connection.from,
      'out',
      connection.fromPort,
      connection.fromPin,
      `connection ${index + 1} source`
    ),
    to: normalizePortRef(
      connection.to,
      'in',
      connection.toPort,
      connection.toPin,
      `connection ${index + 1} destination`
    ),
  };

  const id = readOptionalString(connection.id);
  if (id) {
    normalized.id = id;
  }

  return normalized;
}

function normalizePortRef(
  value: unknown,
  fallbackPortName: string,
  legacyPort: unknown,
  legacyPin: unknown,
  label: string
): PortRef {
  if (typeof value === 'string') {
    const nodeId = value.trim();
    if (!nodeId) {
      throw new Error(`Invalid project: ${label} is missing a node id`);
    }
    return {
      nodeId,
      portName:
        readOptionalString(legacyPort) ??
        readOptionalString(legacyPin) ??
        fallbackPortName,
    };
  }

  if (!isRecord(value)) {
    throw new Error(`Invalid project: ${label} is missing`);
  }

  const nodeId = readRequiredString(value.nodeId);
  if (!nodeId) {
    throw new Error(`Invalid project: ${label} is missing a node id`);
  }

  return {
    nodeId,
    portName:
      readOptionalString(value.portName) ??
      readOptionalString(value.port) ??
      readOptionalString(legacyPort) ??
      readOptionalString(legacyPin) ??
      fallbackPortName,
  };
}

function normalizeProjectVector(
  vector: TestVector | Record<string, unknown>,
  index: number
): TestVector | null {
  if (!isRecord(vector)) return null;
  return {
    ...(vector as TestVector),
    tick: readFiniteNumber(vector.tick, index),
    inputs: normalizeBitRecord(vector.inputs),
    expected: normalizeBitRecord(vector.expected),
  };
}

function normalizeBitRecord(value: unknown): Record<string, 0 | 1> {
  if (!isRecord(value)) return {};
  const normalized: Record<string, 0 | 1> = {};
  for (const [key, bit] of Object.entries(value)) {
    const nextKey = key.trim();
    if (!nextKey) continue;
    normalized[nextKey] = bit === true || bit === 1 || bit === '1' ? 1 : 0;
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cloneRecord(value: unknown): Record<string, any> | undefined {
  return isRecord(value) ? { ...value } : undefined;
}

function isCompositeNodeDef(value: unknown): value is CompositeNodeDef {
  return isRecord(value) && readRequiredString(value.name) !== null;
}
