// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
import { buildCircuitSummary, buildMismatchReport, digestCircuit, digestStimulus, digestTrace, normalizeStimulusEvents, } from '../recording/runRecordUtils';
/** Maximum trace samples before recording is automatically capped. */
const MAX_TRACE_SAMPLES = 50_000;
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createRunRecorderStore() {
    return create((set, get) => ({
        mode: 'idle',
        context: null,
        replay: null,
        stimulus: [],
        trace: [],
        replayTrace: [],
        record: null,
        verificationStatus: { status: 'unknown' },
        debugOverlay: null,
        playheadTick: 0,
        replayPaused: false,
        pendingStepTicks: null,
        pendingJumpTick: null,
        arm: (context) => set({
            mode: 'armed',
            context,
            stimulus: [],
            trace: [],
            replayTrace: [],
            verificationStatus: { status: 'unknown' },
            debugOverlay: null,
            playheadTick: 0,
            replayPaused: false,
            pendingStepTicks: null,
            pendingJumpTick: null,
        }),
        startRecording: (context) => set({
            mode: 'recording',
            context,
            stimulus: [],
            trace: [],
            replayTrace: [],
            verificationStatus: { status: 'unknown' },
            debugOverlay: null,
            playheadTick: 0,
            replayPaused: false,
            pendingStepTicks: null,
            pendingJumpTick: null,
        }),
        stopRecording: (tickCount, missingNodes = []) => {
            const context = get().context;
            if (!context)
                return;
            const startTick = context.startTick ?? 0;
            const runTickCount = Math.max(0, tickCount - startTick);
            const normalizedStimulus = normalizeStimulusEvents(get().stimulus);
            const probeCount = context.probes.length;
            const record = {
                version: 2,
                createdAt: new Date().toISOString(),
                appVersion: context.appVersion,
                circuitSnapshot: context.circuitSnapshot,
                circuitSummary: buildCircuitSummary(context.circuitSnapshot),
                circuitDigest: digestCircuit(context.circuitSnapshot),
                engineConfig: { tickRate: context.tickRate },
                stimulus: normalizedStimulus,
                stimulusDigest: digestStimulus(normalizedStimulus),
                probes: context.probes,
                trace: [...get().trace],
                traceDigest: digestTrace(get().trace),
                summary: {
                    tickCount: runTickCount,
                    startTick,
                    durationTicks: runTickCount,
                    missingNodes,
                    ticks: runTickCount,
                    probeCount,
                    inputEventCount: normalizedStimulus.length,
                },
            };
            set({
                mode: 'idle',
                record,
                context: null,
                debugOverlay: null,
                playheadTick: 0,
                replayPaused: false,
                pendingStepTicks: null,
                pendingJumpTick: null,
            });
        },
        recordEvent: (event) => set((state) => {
            if (state.mode !== 'recording')
                return state;
            return { stimulus: [...state.stimulus, event] };
        }),
        removeEventAt: (index) => set((state) => {
            if (index < 0 || index >= state.stimulus.length)
                return state;
            const next = [...state.stimulus];
            next.splice(index, 1);
            return { stimulus: next };
        }),
        moveEvent: (fromIndex, toIndex) => set((state) => {
            if (fromIndex === toIndex)
                return state;
            if (fromIndex < 0 || fromIndex >= state.stimulus.length)
                return state;
            if (toIndex < 0 || toIndex >= state.stimulus.length)
                return state;
            const next = [...state.stimulus];
            const [item] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, item);
            return { stimulus: next };
        }),
        applyEditedEvents: (events) => set((state) => {
            if (state.record) {
                return {
                    record: {
                        ...state.record,
                        stimulus: [...events],
                    },
                };
            }
            return { stimulus: [...events] };
        }),
        normalizeEvents: () => set((state) => {
            if (!state.record)
                return state;
            return {
                record: {
                    ...state.record,
                    stimulus: normalizeStimulusEvents(state.record.stimulus),
                },
            };
        }),
        recordTraceSample: (sample) => set((state) => {
            if (state.mode !== 'recording')
                return state;
            if (state.trace.length >= MAX_TRACE_SAMPLES) {
                // Cap reached — drop oldest 10% to make room without per-sample copies
                const dropCount = Math.floor(MAX_TRACE_SAMPLES * 0.1);
                const trimmed = state.trace.slice(dropCount);
                trimmed.push(sample);
                return { trace: trimmed };
            }
            // Efficient append: mutate-then-return new ref
            const next = state.trace.concat(sample);
            return { trace: next };
        }),
        startReplay: (record) => set({
            mode: 'replaying',
            replay: { record, replayIndex: 0 },
            replayTrace: [],
            verificationStatus: { status: 'unknown' },
            debugOverlay: null,
            playheadTick: 0,
            replayPaused: false,
            pendingStepTicks: null,
            pendingJumpTick: null,
        }),
        recordReplaySample: (sample) => set((state) => {
            if (state.mode !== 'replaying')
                return state;
            if (state.replayTrace.length >= MAX_TRACE_SAMPLES) {
                const dropCount = Math.floor(MAX_TRACE_SAMPLES * 0.1);
                const trimmed = state.replayTrace.slice(dropCount);
                trimmed.push(sample);
                return { replayTrace: trimmed };
            }
            const next = state.replayTrace.concat(sample);
            return { replayTrace: next };
        }),
        stopReplay: () => set({
            mode: 'idle',
            replay: null,
            debugOverlay: null,
            replayPaused: false,
            pendingStepTicks: null,
            pendingJumpTick: null,
        }),
        verifyReplay: () => {
            const record = get().record;
            if (!record)
                return;
            const mismatch = buildMismatchReport(record.trace, get().replayTrace, record.stimulus, 10);
            if (mismatch) {
                set({
                    verificationStatus: { status: 'fail', mismatch },
                    record: {
                        ...record,
                        summary: {
                            ...record.summary,
                            firstMismatchTick: mismatch.tick,
                        },
                    },
                });
            }
            else {
                set({
                    verificationStatus: { status: 'pass' },
                    record: {
                        ...record,
                        summary: {
                            ...record.summary,
                            firstMismatchTick: undefined,
                        },
                    },
                });
            }
        },
        reset: () => set({
            mode: 'idle',
            context: null,
            replay: null,
            stimulus: [],
            trace: [],
            replayTrace: [],
            record: null,
            verificationStatus: { status: 'unknown' },
            debugOverlay: null,
            playheadTick: 0,
            replayPaused: false,
            pendingStepTicks: null,
            pendingJumpTick: null,
        }),
        setPlayheadTick: (tick) => set({ playheadTick: Math.max(0, Math.floor(tick)) }),
        setReplayPaused: (paused) => set({ replayPaused: paused }),
        stepReplay: (ticks) => set((state) => {
            if (state.mode !== 'replaying' || !state.replayPaused)
                return state;
            if (ticks <= 0)
                return state;
            return {
                pendingStepTicks: ticks,
                playheadTick: Math.max(0, state.playheadTick + ticks),
            };
        }),
        jumpReplay: (tick) => set((state) => {
            if (state.mode !== 'replaying')
                return state;
            const nextTick = Math.max(0, Math.floor(tick));
            return { pendingJumpTick: nextTick, playheadTick: nextTick };
        }),
        setRecord: (record) => set({
            record,
            debugOverlay: null,
            playheadTick: 0,
            replayPaused: false,
            pendingStepTicks: null,
            pendingJumpTick: null,
        }),
        setVerificationStatus: (verificationStatus) => set({ verificationStatus }),
        setDebugOverlay: (debugOverlay) => set({ debugOverlay }),
    }));
}
export const useRunRecorderStore = ((...args) => {
    if (!_store)
        _store = createRunRecorderStore();
    return _store(...args);
});
useRunRecorderStore.getState = () => {
    if (!_store)
        _store = createRunRecorderStore();
    return _store.getState();
};
useRunRecorderStore.setState = (...a) => {
    if (!_store)
        _store = createRunRecorderStore();
    return _store.setState(...a);
};
useRunRecorderStore.subscribe = (...a) => {
    if (!_store)
        _store = createRunRecorderStore();
    return _store.subscribe(...a);
};
