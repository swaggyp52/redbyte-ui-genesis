// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '@redbyte/rb-logic-core';
import type { RunRecord } from '../recording/runRecord';
import type { Probe } from '../stores/probeStore';
import type { ToolchainProjectInput } from '../fpga/toolchainBackend';
import { stableStringify } from './stableStringify';

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
    .sort((a, b) => a.id.localeCompare(b.id));

  const connections = [...circuit.connections]
    .map((connection) => ({
      from: { nodeId: connection.from.nodeId, portName: connection.from.portName },
      to: { nodeId: connection.to.nodeId, portName: connection.to.portName },
    }))
    .sort((a, b) => {
      const left = `${a.from.nodeId}.${a.from.portName}->${a.to.nodeId}.${a.to.portName}`;
      const right = `${b.from.nodeId}.${b.from.portName}->${b.to.nodeId}.${b.to.portName}`;
      return left.localeCompare(right);
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
      return left.localeCompare(right);
    });
};

const normalizeHdl = (hdl?: ToolchainProjectInput): ToolchainProjectInput | undefined => {
  if (!hdl) return hdl;
  const sources = [...(hdl.sources ?? [])]
    .map((source) => ({ ...source }))
    .sort((a, b) => {
      const left = `${a.path}.${a.language}`;
      const right = `${b.path}.${b.language}`;
      return left.localeCompare(right);
    });

  return {
    ...hdl,
    sources,
  };
};

export const encodeRBProject = (project: RBProject) => {
  const sortedTags = project.meta?.tags ? [...project.meta.tags].sort((a, b) => a.localeCompare(b)) : undefined;
  const normalized = {
    ...project,
    circuit: normalizeProjectCircuit(project.circuit),
    probes: normalizeProbes(project.probes),
    hdl: normalizeHdl(project.hdl),
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
