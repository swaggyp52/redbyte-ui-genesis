// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { useRunRecorderStore } from '../stores/runRecorderStore';
import {
  decodeRunRecord,
  encodeRunRecord,
  indexStimulusByTick,
  type RunRecord,
} from '../recording/runRecord';
import { applyStimulusEvents } from '../recording/stimulus';
import { buildCircuitSummary } from '../recording/runRecordUtils';

const TEST_CIRCUIT: Circuit = {
  nodes: [{ id: 'sw1', type: 'Switch', position: { x: 0, y: 0 } }],
  connections: [],
};

describe('run recorder store', () => {
  beforeEach(() => {
    useRunRecorderStore.getState().reset();
  });

  it('records input toggle events during recording', () => {
    const store = useRunRecorderStore.getState();
    store.startRecording({
      circuitSnapshot: TEST_CIRCUIT,
      tickRate: 10,
      probes: [],
      startTick: 0,
      appVersion: 'test',
    });
    store.recordEvent({
      tick: 2,
      type: 'input_toggled',
      nodeId: 'sw1',
      portName: 'out',
      value: 1,
    });
    store.stopRecording(3, []);

    const record = useRunRecorderStore.getState().record;
    expect(record?.stimulus).toHaveLength(1);
    expect(record?.stimulus[0].tick).toBe(2);
  });

  it('indexes stimulus events by tick', () => {
    const byTick = indexStimulusByTick([
      { tick: 1, type: 'input_toggled', nodeId: 'a', portName: 'out', value: 1 },
      { tick: 2, type: 'input_toggled', nodeId: 'b', portName: 'out', value: 0 },
    ]);
    expect(byTick.get(1)?.[0].nodeId).toBe('a');
    expect(byTick.get(2)?.[0].nodeId).toBe('b');
  });

  it('applies stimulus events at the matching tick', () => {
    const baseCircuit: Circuit = {
      nodes: [{ id: 'sw1', type: 'Switch', position: { x: 0, y: 0 }, state: { isOn: 0 } }],
      connections: [],
    };
    const events = [
      { tick: 2, type: 'input_toggled' as const, nodeId: 'sw1', portName: 'out', value: 1 },
    ];
    const byTick = indexStimulusByTick(events);

    const tick1 = applyStimulusEvents(baseCircuit, byTick.get(1) ?? []);
    expect(tick1.nodes[0].state?.isOn ?? 0).toBe(0);

    const tick2 = applyStimulusEvents(baseCircuit, byTick.get(2) ?? []);
    expect(tick2.nodes[0].state?.isOn ?? 0).toBe(1);
  });

  it('verifies replay traces against recorded traces', () => {
    const record: RunRecord = {
      version: 1,
      createdAt: new Date().toISOString(),
      appVersion: 'test',
      circuitSnapshot: TEST_CIRCUIT,
      circuitSummary: buildCircuitSummary(TEST_CIRCUIT),
      engineConfig: { tickRate: 10 },
      stimulus: [],
      probes: [{ id: 'p1', nodeId: 'sw1', portName: 'out', label: 'SW', color: '#00ffff' }],
      trace: [{ tick: 1, values: { p1: 1 } }],
      summary: { tickCount: 1, startTick: 0, durationTicks: 1, missingNodes: [] },
    };

    const store = useRunRecorderStore.getState();
    store.setRecord(record);
    store.startReplay(record);
    store.recordReplaySample({ tick: 1, values: { p1: 1 } });
    store.verifyReplay();

    expect(useRunRecorderStore.getState().verificationStatus.status).toBe('pass');
  });

  it('fails verification on mismatched trace', () => {
    const record: RunRecord = {
      version: 1,
      createdAt: new Date().toISOString(),
      appVersion: 'test',
      circuitSnapshot: TEST_CIRCUIT,
      circuitSummary: buildCircuitSummary(TEST_CIRCUIT),
      engineConfig: { tickRate: 10 },
      stimulus: [],
      probes: [{ id: 'p1', nodeId: 'sw1', portName: 'out', label: 'SW', color: '#00ffff' }],
      trace: [{ tick: 1, values: { p1: 1 } }],
      summary: { tickCount: 1, startTick: 0, durationTicks: 1, missingNodes: [] },
    };

    const store = useRunRecorderStore.getState();
    store.setRecord(record);
    store.startReplay(record);
    store.recordReplaySample({ tick: 1, values: { p1: 0 } });
    store.verifyReplay();

    expect(useRunRecorderStore.getState().verificationStatus.status).toBe('fail');
  });

  it('round-trips run record export/import', () => {
    const record: RunRecord = {
      version: 1,
      createdAt: new Date().toISOString(),
      appVersion: 'test',
      circuitSnapshot: TEST_CIRCUIT,
      circuitSummary: buildCircuitSummary(TEST_CIRCUIT),
      engineConfig: { tickRate: 10 },
      stimulus: [],
      probes: [],
      trace: [],
      summary: { tickCount: 0, startTick: 0, durationTicks: 0, missingNodes: [] },
    };

    const encoded = encodeRunRecord(record);
    const decoded = decodeRunRecord(encoded);
    expect(decoded.version).toBe(1);
    expect(decoded.engineConfig.tickRate).toBe(10);
  });

  it('preserves digests on export/import', () => {
    const record: RunRecord = {
      version: 2,
      createdAt: new Date().toISOString(),
      appVersion: 'test',
      circuitSnapshot: TEST_CIRCUIT,
      circuitSummary: buildCircuitSummary(TEST_CIRCUIT),
      circuitDigest: 'circuit-digest',
      engineConfig: { tickRate: 20 },
      stimulus: [],
      stimulusDigest: 'stimulus-digest',
      probes: [],
      trace: [],
      traceDigest: 'trace-digest',
      summary: { tickCount: 0, startTick: 0, durationTicks: 0, missingNodes: [] },
    };

    const encoded = encodeRunRecord(record);
    const decoded = decodeRunRecord(encoded);
    expect(decoded.circuitDigest).toBe('circuit-digest');
    expect(decoded.stimulusDigest).toBe('stimulus-digest');
    expect(decoded.traceDigest).toBe('trace-digest');
  });

  it('advances playhead when stepping replay', () => {
    const record: RunRecord = {
      version: 1,
      createdAt: new Date().toISOString(),
      appVersion: 'test',
      circuitSnapshot: TEST_CIRCUIT,
      circuitSummary: buildCircuitSummary(TEST_CIRCUIT),
      engineConfig: { tickRate: 10 },
      stimulus: [],
      probes: [],
      trace: [],
      summary: { tickCount: 0, startTick: 0, durationTicks: 0, missingNodes: [] },
    };

    const store = useRunRecorderStore.getState();
    store.startReplay(record);
    store.setReplayPaused(true);
    store.setPlayheadTick(2);
    store.stepReplay(3);

    expect(useRunRecorderStore.getState().playheadTick).toBe(5);
    expect(useRunRecorderStore.getState().pendingStepTicks).toBe(3);
  });
});
