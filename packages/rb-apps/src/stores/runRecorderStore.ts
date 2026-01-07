// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  type RunRecord,
  type RunRecorderMode,
  type RunProbe,
  type RunStimulusEvent,
  type RunTraceSample,
  type VerificationStatus,
} from '../recording/runRecord';

interface RecordingContext {
  circuitSnapshot: Circuit;
  tickRate: number;
  probes: RunProbe[];
  startTick: number;
  appVersion: string;
}

interface ReplayContext {
  record: RunRecord;
  replayIndex: number;
}

interface RunRecorderState {
  mode: RunRecorderMode;
  context: RecordingContext | null;
  replay: ReplayContext | null;
  stimulus: RunStimulusEvent[];
  trace: RunTraceSample[];
  replayTrace: RunTraceSample[];
  record: RunRecord | null;
  verificationStatus: VerificationStatus;
}

interface RunRecorderActions {
  arm: (context: RecordingContext) => void;
  startRecording: (context: RecordingContext) => void;
  stopRecording: (tickCount: number, missingNodes?: string[]) => void;
  recordEvent: (event: RunStimulusEvent) => void;
  removeEventAt: (index: number) => void;
  moveEvent: (fromIndex: number, toIndex: number) => void;
  recordTraceSample: (sample: RunTraceSample) => void;
  startReplay: (record: RunRecord) => void;
  recordReplaySample: (sample: RunTraceSample) => void;
  stopReplay: () => void;
  verifyReplay: () => void;
  reset: () => void;
  setRecord: (record: RunRecord | null) => void;
  setVerificationStatus: (status: VerificationStatus) => void;
}

const findMismatch = (expected: RunTraceSample[], actual: RunTraceSample[]) => {
  const expectedMap = new Map<number, RunTraceSample>();
  expected.forEach((sample) => {
    expectedMap.set(sample.tick, sample);
  });

  for (const sample of actual) {
    const expectedSample = expectedMap.get(sample.tick);
    if (!expectedSample) continue;
    for (const [probeId, actualValue] of Object.entries(sample.values)) {
      const expectedValue = expectedSample.values[probeId];
      if (expectedValue === undefined) continue;
      if (expectedValue !== actualValue) {
        return {
          tick: sample.tick,
          probeId,
          expected: expectedValue,
          actual: actualValue,
        };
      }
    }
  }

  return null;
};

export const useRunRecorderStore = create<RunRecorderState & RunRecorderActions>((set, get) => ({
  mode: 'idle',
  context: null,
  replay: null,
  stimulus: [],
  trace: [],
  replayTrace: [],
  record: null,
  verificationStatus: { status: 'unknown' },

  arm: (context) =>
    set({
      mode: 'armed',
      context,
      stimulus: [],
      trace: [],
      replayTrace: [],
      verificationStatus: { status: 'unknown' },
    }),

  startRecording: (context) =>
    set({
      mode: 'recording',
      context,
      stimulus: [],
      trace: [],
      replayTrace: [],
      verificationStatus: { status: 'unknown' },
    }),

  stopRecording: (tickCount, missingNodes = []) => {
    const context = get().context;
    if (!context) return;
    const startTick = context.startTick ?? 0;
    const runTickCount = Math.max(0, tickCount - startTick);
    const record: RunRecord = {
      version: 1,
      createdAt: Date.now(),
      appVersion: context.appVersion,
      circuitSnapshot: context.circuitSnapshot,
      engineConfig: { tickRate: context.tickRate },
      stimulus: [...get().stimulus],
      probes: context.probes,
      trace: [...get().trace],
      summary: {
        tickCount: runTickCount,
        startTick,
        missingNodes,
      },
    };

    set({
      mode: 'idle',
      record,
      context: null,
    });
  },

  recordEvent: (event) =>
    set((state) => {
      if (state.mode !== 'recording') return state;
      return { stimulus: [...state.stimulus, event] };
    }),

  removeEventAt: (index) =>
    set((state) => {
      if (index < 0 || index >= state.stimulus.length) return state;
      const next = [...state.stimulus];
      next.splice(index, 1);
      return { stimulus: next };
    }),

  moveEvent: (fromIndex, toIndex) =>
    set((state) => {
      if (fromIndex === toIndex) return state;
      if (fromIndex < 0 || fromIndex >= state.stimulus.length) return state;
      if (toIndex < 0 || toIndex >= state.stimulus.length) return state;
      const next = [...state.stimulus];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return { stimulus: next };
    }),

  recordTraceSample: (sample) =>
    set((state) => {
      if (state.mode !== 'recording') return state;
      return { trace: [...state.trace, sample] };
    }),

  startReplay: (record) =>
    set({
      mode: 'replaying',
      replay: { record, replayIndex: 0 },
      replayTrace: [],
      verificationStatus: { status: 'unknown' },
    }),

  recordReplaySample: (sample) =>
    set((state) => {
      if (state.mode !== 'replaying') return state;
      return { replayTrace: [...state.replayTrace, sample] };
    }),

  stopReplay: () =>
    set({
      mode: 'idle',
      replay: null,
    }),

  verifyReplay: () => {
    const record = get().record;
    if (!record) return;
    const mismatch = findMismatch(record.trace, get().replayTrace);
    if (mismatch) {
      set({ verificationStatus: { status: 'fail', mismatch } });
    } else {
      set({ verificationStatus: { status: 'pass' } });
    }
  },

  reset: () =>
    set({
      mode: 'idle',
      context: null,
      replay: null,
      stimulus: [],
      trace: [],
      replayTrace: [],
      record: null,
      verificationStatus: { status: 'unknown' },
    }),

  setRecord: (record) => set({ record }),
  setVerificationStatus: (verificationStatus) => set({ verificationStatus }),
}));
