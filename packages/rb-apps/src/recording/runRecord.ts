// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, EventLogV1 } from '@redbyte/rb-logic-core';

export type RunRecorderMode = 'idle' | 'armed' | 'recording' | 'replaying';

export type RunStimulusEvent =
  | {
    tick: number;
    type: 'input_toggled';
    nodeId: string;
    portName: string;
    value: 0 | 1;
    label?: string;
  }
  | {
    tick: number;
    type: 'hw_io';
    deviceId: string;
    inputs: Record<string, number | string>;
    outputs: Record<string, number | string>;
  }
  | {
    tick: number;
    type: 'hw_connect';
    deviceId: string;
    target: string;
  };

export interface RunProbe {
  id: string;
  nodeId: string;
  portName: string;
  label: string;
  color: string;
}

export interface RunTraceSample {
  tick: number;
  values: Record<string, 0 | 1>;
}

export interface CircuitSummary {
  nodeCount: number;
  connectionCount: number;
  nodeIds: string[];
}

export interface RunRecord {
  version: number;
  createdAt: string;
  appVersion: string;
  circuitSnapshot: Circuit;
  circuitSummary?: CircuitSummary;
  circuitDigest?: string;
  engineConfig: {
    tickRate: number;
  };
  stimulus: RunStimulusEvent[];
  stimulusDigest?: string;
  probes: RunProbe[];
  trace: RunTraceSample[];
  traceDigest?: string;
  eventLog?: EventLogV1;
  summary: {
    tickCount: number;
    startTick: number;
    durationTicks: number;
    missingNodes: string[];
    ticks?: number;
    probeCount?: number;
    inputEventCount?: number;
    firstMismatchTick?: number;
  };
}

export interface MismatchReport {
  tick: number;
  probeIds: string[];
  expected: Record<string, 0 | 1>;
  actual: Record<string, 0 | 1>;
  recentStimulus: RunStimulusEvent[];
}

export interface MismatchEntry {
  probeId: string;
  nodeId: string;
  portName: string;
  label: string;
  expected: 0 | 1;
  actual: 0 | 1;
}

export interface DebugOverlay {
  enabled: boolean;
  tick: number;
  timeSec: number;
  signals: Record<string, Record<string, 0 | 1>>;
  portKeySignals?: Record<string, 0 | 1>;
}

export interface ProofPack {
  kind: 'rb-proof-pack';
  version: 1;
  createdAt: string;
  runRecord: RunRecord;
  normalizedCircuit: unknown;
  meta?: {
    appVersion?: string;
    gitCommit?: string;
    tickRate?: number;
    exampleId?: string;
  };
}

export interface VerificationStatus {
  status: 'unknown' | 'pass' | 'fail';
  mismatch?: MismatchReport;
}

export const encodeRunRecord = (record: RunRecord) => JSON.stringify(record, null, 2);

export const decodeRunRecord = (raw: string): RunRecord => {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid run record: not an object');
  }
  if (parsed.version !== 1 && parsed.version !== 2) {
    throw new Error(`Unsupported run record version: ${parsed.version}`);
  }
  if (!parsed.circuitSnapshot || !parsed.engineConfig) {
    throw new Error('Invalid run record: missing circuit snapshot or engine config');
  }
  if (typeof parsed.createdAt !== 'string') {
    parsed.createdAt = new Date(typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now()).toISOString();
  }
  if (!parsed.circuitSummary) {
    parsed.circuitSummary = undefined;
  }
  if (!parsed.circuitDigest) {
    parsed.circuitDigest = undefined;
  }
  if (!parsed.stimulusDigest) {
    parsed.stimulusDigest = undefined;
  }
  if (!parsed.traceDigest) {
    parsed.traceDigest = undefined;
  }
  if (!parsed.summary || typeof parsed.summary !== 'object') {
    parsed.summary = { tickCount: 0, startTick: 0, durationTicks: 0, missingNodes: [] };
  }
  if (typeof parsed.summary.startTick !== 'number') {
    parsed.summary.startTick = 0;
  }
  if (typeof parsed.summary.tickCount !== 'number') {
    parsed.summary.tickCount = 0;
  }
  if (typeof parsed.summary.durationTicks !== 'number') {
    parsed.summary.durationTicks = parsed.summary.tickCount ?? 0;
  }
  if (!Array.isArray(parsed.summary.missingNodes)) {
    parsed.summary.missingNodes = [];
  }
  return parsed as RunRecord;
};

export const indexStimulusByTick = (events: RunStimulusEvent[]) => {
  const byTick = new Map<number, RunStimulusEvent[]>();
  events.forEach((event) => {
    const list = byTick.get(event.tick) ?? [];
    list.push(event);
    byTick.set(event.tick, list);
  });
  return byTick;
};
