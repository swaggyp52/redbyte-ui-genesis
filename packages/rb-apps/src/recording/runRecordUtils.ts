// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type {
  Circuit,
  CircuitSummary,
  DebugOverlay,
  MismatchEntry,
  MismatchReport,
  RunProbe,
  RunStimulusEvent,
  RunTraceSample,
} from './runRecord';
import { digestValue } from '../utils/digest';
import { compareCodepoint } from '../export/codepointSort';

export type CompatibilityStatus = 'exact' | 'close' | 'mismatch';

export const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

export const tickFromPosition = (x: number, width: number, maxTick: number) => {
  if (width <= 0 || maxTick <= 0) return 0;
  const ratio = clamp(x / width, 0, 1);
  return Math.round(ratio * maxTick);
};

export const positionFromTick = (tick: number, width: number, maxTick: number) => {
  if (width <= 0 || maxTick <= 0) return 0;
  const ratio = clamp(tick / maxTick, 0, 1);
  return ratio * width;
};

export const normalizeStimulusEvents = (events: RunStimulusEvent[]) => {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      if (a.event.tick === b.event.tick) {
        return a.index - b.index;
      }
      return a.event.tick - b.event.tick;
    })
    .map((item) => item.event);
};

export const buildCircuitSummary = (circuit: Circuit): CircuitSummary => {
  const nodeIds = circuit.nodes.map((node) => node.id).sort();
  return {
    nodeCount: circuit.nodes.length,
    connectionCount: circuit.connections.length,
    nodeIds,
  };
};

export const compareCircuitSummary = (
  current: CircuitSummary,
  record: CircuitSummary
): CompatibilityStatus => {
  const countsMatch =
    current.nodeCount === record.nodeCount && current.connectionCount === record.connectionCount;
  if (!countsMatch) return 'mismatch';

  const idsMatch =
    current.nodeIds.length === record.nodeIds.length &&
    current.nodeIds.every((id, index) => id === record.nodeIds[index]);

  return idsMatch ? 'exact' : 'close';
};

export const normalizeCircuit = (circuit: Circuit) => {
  const nodes = [...circuit.nodes]
    .map((node) => ({
      id: node.id,
      type: node.type,
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

export const normalizeStimulus = (events: RunStimulusEvent[]) => {
  return normalizeStimulusEvents(events).map((event) => ({
    tick: event.tick,
    type: event.type,
    nodeId: event.nodeId,
    portName: event.portName,
    value: event.value,
    label: event.label ?? '',
  }));
};

export const normalizeTrace = (trace: RunTraceSample[]) => {
  return trace.map((sample) => ({
    tick: sample.tick,
    values: sample.values,
  }));
};

export const digestCircuit = (circuit: Circuit) => digestValue(normalizeCircuit(circuit));
export const digestStimulus = (events: RunStimulusEvent[]) => digestValue(normalizeStimulus(events));
export const digestTrace = (trace: RunTraceSample[]) => digestValue(normalizeTrace(trace));

export const buildDebugOverlayFromSignals = (
  signals: Map<string, 0 | 1>,
  tick: number,
  tickRate: number
): DebugOverlay => {
  const nodeSignals: Record<string, Record<string, 0 | 1>> = {};
  const portKeySignals: Record<string, 0 | 1> = {};

  signals.forEach((value, key) => {
    const dotIndex = key.indexOf('.');
    if (dotIndex <= 0) return;
    const nodeId = key.slice(0, dotIndex);
    const portName = key.slice(dotIndex + 1);
    if (!nodeSignals[nodeId]) {
      nodeSignals[nodeId] = {};
    }
    nodeSignals[nodeId][portName] = value;
    portKeySignals[`${nodeId}:${portName}`] = value;
  });

  return {
    enabled: true,
    tick,
    timeSec: tickRate > 0 ? tick / tickRate : 0,
    signals: nodeSignals,
    portKeySignals,
  };
};

export const buildMismatchEntries = (
  mismatch: MismatchReport,
  probes: RunProbe[]
): MismatchEntry[] => {
  return mismatch.probeIds
    .map((probeId) => {
      const probe = probes.find((item) => item.id === probeId);
      if (!probe) return null;
      const expected = mismatch.expected[probeId];
      const actual = mismatch.actual[probeId];
      if (expected === undefined || actual === undefined) return null;
      return {
        probeId,
        nodeId: probe.nodeId,
        portName: probe.portName,
        label: probe.label,
        expected,
        actual,
      };
    })
    .filter((entry): entry is MismatchEntry => entry !== null);
};

export const buildMismatchReport = (
  expectedTrace: RunTraceSample[],
  actualTrace: RunTraceSample[],
  stimulus: RunStimulusEvent[],
  recentCount: number
): MismatchReport | null => {
  const expectedByTick = new Map<number, RunTraceSample>();
  expectedTrace.forEach((sample) => {
    expectedByTick.set(sample.tick, sample);
  });

  for (const sample of actualTrace) {
    const expected = expectedByTick.get(sample.tick);
    if (!expected) continue;

    const mismatchedProbes = Object.keys(sample.values).filter((probeId) => {
      const expectedValue = expected.values[probeId];
      if (expectedValue === undefined) return false;
      return expectedValue !== sample.values[probeId];
    });

    if (mismatchedProbes.length > 0) {
      const recentStimulus = stimulus
        .filter((event) => event.tick <= sample.tick)
        .slice(-recentCount);
      return {
        tick: sample.tick,
        probeIds: mismatchedProbes,
        expected: expected.values,
        actual: sample.values,
        recentStimulus,
      };
    }
  }

  return null;
};
