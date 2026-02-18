// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '@redbyte/rb-logic-core';
import type { RunRecord } from '../recording/runRecord';
import type { Probe } from '../stores/probeStore';
import type { ToolchainProjectInput } from '../fpga/toolchainBackend';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import { stableStringify } from './stableStringify';
import { compareCodepoint } from './codepointSort';

export interface RBFpgaConstraints {
  type: 'xdc';
  text: string;
}

export interface RBFpgaConfig {
  board: 'basys3';
  constraints?: RBFpgaConstraints;
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
  meta?: {
    appVersion?: string;
    gitCommit?: string;
    tickRate?: number;
    tags?: string[];
    projectId?: string;
    labId?: string;
    labStepIndex?: number;
    appSurface?: string;
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
    .map((node) => ({
      ...node,
      config: node.config ?? {},
      state: node.state ?? {},
    }))
    .sort((a, b) => compareCodepoint(a.id, b.id));

  const connections = [...circuit.connections]
    .map((connection) => ({
      from: { nodeId: connection.from.nodeId, portName: connection.from.portName },
      to: { nodeId: connection.to.nodeId, portName: connection.to.portName },
    }))
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
  const normalizeEntry = (entry: any) => ({ ...entry });
  const inputs = [...(ioMapping.inputs ?? [])]
    .map(normalizeEntry)
    .sort((a, b) => {
      const left = `${a.nodeId}.${a.port}.${a.id}`;
      const right = `${b.nodeId}.${b.port}.${b.id}`;
      return compareCodepoint(left, right);
    });
  const outputs = [...(ioMapping.outputs ?? [])]
    .map(normalizeEntry)
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
    .map((vector) => ({ ...vector }))
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

export const decodeRBProject = (raw: string): RBProject => {
  const parsed = JSON.parse(raw) as RBProject;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid project: not an object');
  }
  if (parsed.kind !== 'rb-project' || parsed.version !== 1) {
    throw new Error('Invalid project: unsupported kind or version');
  }
  return parsed;
};
