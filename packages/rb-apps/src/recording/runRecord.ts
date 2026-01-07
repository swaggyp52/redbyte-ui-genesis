// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '@redbyte/rb-logic-core';
import type { EventLogV1 } from '@redbyte/rb-logic-core/src/determinism';

export type RunRecorderMode = 'idle' | 'armed' | 'recording' | 'replaying';

export interface RunStimulusEvent {
  tick: number;
  type: 'input_toggled';
  nodeId: string;
  portName: string;
  value: 0 | 1;
}

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

export interface RunRecord {
  version: 1;
  createdAt: number;
  appVersion: string;
  circuitSnapshot: Circuit;
  engineConfig: {
    tickRate: number;
  };
  stimulus: RunStimulusEvent[];
  probes: RunProbe[];
  trace: RunTraceSample[];
  eventLog?: EventLogV1;
  summary: {
    tickCount: number;
    startTick: number;
    missingNodes: string[];
  };
}

export interface VerificationStatus {
  status: 'unknown' | 'pass' | 'fail';
  mismatch?: {
    tick: number;
    probeId: string;
    expected: 0 | 1;
    actual: 0 | 1;
  };
}

export const encodeRunRecord = (record: RunRecord) => JSON.stringify(record, null, 2);

export const decodeRunRecord = (raw: string): RunRecord => {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid run record: not an object');
  }
  if (parsed.version !== 1) {
    throw new Error(`Unsupported run record version: ${parsed.version}`);
  }
  if (!parsed.circuitSnapshot || !parsed.engineConfig) {
    throw new Error('Invalid run record: missing circuit snapshot or engine config');
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
