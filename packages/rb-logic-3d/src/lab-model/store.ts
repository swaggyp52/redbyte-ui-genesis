import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { produce } from 'immer';
import { LabGraph, LabNode, LabWire, LabTimeline, LabEvent, LabSnapshot, LabSession } from './types';
import { validateLabGraph, validateTimeline, fingerprintState, fingerprintStateSync } from './validators';
import { SketchRuntime } from './sketchEngine';
import type { LabTemplate } from './labTemplate';
import { fingerprintLabTemplate } from './labTemplate';

interface InteractionState {
    mode: 'orbit' | 'wire';
    hoveredPin: { nodeId: string; pinId: string } | null;
    wireStartPin: { nodeId: string; pinId: string } | null;
    dragPosition: { x: number; y: number; z: number } | null;
    highlightedPins: Array<{ nodeId: string; pinId: string }>;
    selectedNetId: string | null;
}

type PlaybackState = 'live:stopped' | 'live:running' | 'replay:paused' | 'replay:playing';

interface SimulationState {
    playbackState: PlaybackState;
    isRunning: boolean;
    playbackMode: 'live' | 'replay';
    tick: number;
    pinStates: Record<string, number>; // "nodeId:pinId" -> 1/0
    replayScrubTick: number; // The tick we are viewing in replay mode
    lastReconstructionMs: number;
}

interface SketchState {
    source: string;
    status: 'idle' | 'loaded' | 'error';
    error: string | null;
    serial: string[];
    sketchHash: string | null;
}

interface LabStoreState {
    graph: LabGraph; // The CURRENT state (live) OR the DERIVED state (replay)
    timeline: LabTimeline;

    interaction: InteractionState;
    simulation: SimulationState;
    sketch: SketchState;
    labSession: LabSession | null;

    // Reliability
    integrityError: string | null;
    lastGoodSnapshot: LabSnapshot | null;

    // Actions
    setInteractionMode: (mode: 'orbit' | 'wire') => void;
    setHighlightedPins: (pins: Array<{ nodeId: string; pinId: string }>) => void;
    setSelectedNetId: (netId: string | null) => void;

    // Simulation & Timeline
    runSimulationStep: () => void;
    toggleSimulation: (running?: boolean) => void;
    setPlaybackMode: (mode: 'live' | 'replay') => void;
    scrub: (tick: number) => void;

    // Interaction
    setHoveredPin: (pin: { nodeId: string; pinId: string } | null) => void;
    startWire: (nodeId: string, pinId: string) => void;
    cancelWire: () => void;
    updateDragPosition: (pos: { x: number; y: number; z: number } | null) => void;

    // Mutation (Guarded in Replay)
    addNode: (node: LabNode) => void;
    updateNodePose: (id: string, position: { x: number, y: number, z: number }, rotation: { x: number, y: number, z: number, w: number }) => void;
    addWire: (wire: LabWire) => void;
    removeWire: (id: string) => void;
    reset: () => void;

    // Sketch
    setSketchSource: (source: string) => void;
    loadSketch: () => void;
    clearSerial: () => void;

    // Lab Session
    startLabSession: (template: LabTemplate) => void;
    clearLabSession: () => void;

    // Recovery
    recover: () => void;

    // User Interaction (P0 Determinism)
    setUserPinState: (nodeId: string, pinId: string, value: number) => void;
}

const SNAPSHOT_INTERVAL_TICKS = 200; // Create a snapshot every N ticks
const TICK_MS = 50;
const SKETCH_STEP_BUDGET = 2000;
const RECONSTRUCTION_WARN_MS = 16;
const DEBUG_INVARIANTS = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;

const createEmptyGraph = (): LabGraph => ({ nodes: [], wires: [], net: {} });

const createEmptySnapshot = (): LabSnapshot => {
    const graph = createEmptyGraph();
    const pinStates: Record<string, number> = {};
    return {
        tick: 0,
        graph,
        pinStates,
        traceHash: fingerprintStateSync({ graph, pinStates, tick: 0 })
    };
};

const playbackModeFromState = (state: PlaybackState): 'live' | 'replay' =>
    state.startsWith('live') ? 'live' : 'replay';

const isRunningFromState = (state: PlaybackState): boolean =>
    state === 'live:running' || state === 'replay:playing';

const applyPlaybackState = (simulation: SimulationState, nextState: PlaybackState): void => {
    simulation.playbackState = nextState;
    simulation.playbackMode = playbackModeFromState(nextState);
    simulation.isRunning = isRunningFromState(nextState);
};

const pauseLiveSimulationForEdit = (state: LabStoreState): void => {
    if (state.simulation.playbackState !== 'live:running') return;
    applyPlaybackState(state.simulation, 'live:stopped');
    state.timeline.events.push({
        type: 'SIMULATION_STOP',
        tick: state.simulation.tick,
        seq: state.timeline.events.length,
        source: 'user',
        ts: Date.now()
    });
};

const resyncEventSeq = (events: LabEvent[]): LabEvent[] =>
    events.map((event, index) => ({ ...event, seq: index }));

const cloneGraph = (graph: LabGraph): LabGraph => JSON.parse(JSON.stringify(graph));

import { FpgaSimEngine } from './fpga-sim/engine';

const sketchRuntime = new SketchRuntime({ tickMs: TICK_MS, stepBudget: SKETCH_STEP_BUDGET });
const fpgaEngine = new FpgaSimEngine('passthrough'); // Default to passthrough for MVP

const buildWireAdjacency = (graph: LabGraph): Map<string, Set<string>> => {
    const adjacency = new Map<string, Set<string>>();
    const addEdge = (from: string, to: string) => {
        if (!adjacency.has(from)) adjacency.set(from, new Set());
        adjacency.get(from)!.add(to);
    };
    for (const wire of graph.wires) {
        const a = `${wire.sourceNodeId}:${wire.sourcePinId}`;
        const b = `${wire.targetNodeId}:${wire.targetPinId}`;
        addEdge(a, b);
        addEdge(b, a);
    }
    return adjacency;
};

const propagatePinDiffs = (
    graph: LabGraph,
    pinStates: Record<string, number>,
    diffs: Record<string, number>
): Record<string, number> => {
    const adjacency = buildWireAdjacency(graph);
    const expanded: Record<string, number> = {};
    const queue: Array<{ key: string; value: number }> = Object.entries(diffs).map(([key, value]) => ({ key, value }));
    const visited = new Set<string>();

    while (queue.length > 0) {
        const { key, value } = queue.shift()!;
        if (visited.has(key)) continue;
        visited.add(key);

        if (pinStates[key] !== value) {
            pinStates[key] = value;
            expanded[key] = value;
        }

        const neighbors = adjacency.get(key);
        if (!neighbors) continue;
        for (const next of neighbors) {
            if (!visited.has(next)) {
                queue.push({ key: next, value });
            }
        }
    }

    return expanded;
};

const scheduleSnapshotFingerprint = (
    setState: (fn: (state: LabStoreState) => void) => void,
    snapshotSource: { graph: LabGraph; pinStates: Record<string, number>; tick: number }
) => {
    if (typeof crypto === 'undefined' || !crypto.subtle) return;
    const snapshotTick = snapshotSource.tick;
    queueMicrotask(() => {
        void fingerprintState(snapshotSource)
            .then((hash) => {
                setState(produce((draft: LabStoreState) => {
                    const target = draft.timeline.snapshots.find((snap) => snap.tick === snapshotTick);
                    if (target) {
                        target.fingerprint = hash;
                    }
                }));
            })
            .catch(() => {
                // Ignore fingerprint failures in background
            });
    });
};

const applyIntegrityRecovery = (
    state: LabStoreState,
    reason: string,
    options?: { clearError?: boolean }
) => {
    const snapshot = state.lastGoodSnapshot;
    if (!snapshot) {
        state.graph = createEmptyGraph();
        state.timeline = { events: [], snapshots: [createEmptySnapshot()] };
        state.simulation.tick = 0;
        state.simulation.pinStates = {};
        state.simulation.replayScrubTick = 0;
        applyPlaybackState(state.simulation, 'replay:paused');
        state.integrityError = options?.clearError ? null : reason;
        return;
    }

    state.graph = cloneGraph(snapshot.graph);
    state.simulation.pinStates = { ...snapshot.pinStates };
    state.simulation.tick = snapshot.tick;
    state.simulation.replayScrubTick = snapshot.tick;
    applyPlaybackState(state.simulation, 'replay:paused');

    const truncatedEvents = state.timeline.events.filter((event) => event.tick <= snapshot.tick);
    state.timeline.events = resyncEventSeq(truncatedEvents);
    state.timeline.events.push({
        type: 'INTEGRITY_RECOVERY',
        tick: snapshot.tick,
        seq: state.timeline.events.length,
        source: 'engine',
        reason
    });

    const truncatedSnapshots = state.timeline.snapshots.filter((snap) => snap.tick <= snapshot.tick);
    state.timeline.snapshots = truncatedSnapshots.length > 0 ? truncatedSnapshots : [createEmptySnapshot()];

    state.integrityError = options?.clearError ? null : reason;
};

const assertInvariants = (state: LabStoreState, context: string) => {
    if (!DEBUG_INVARIANTS) return;
    if (state.integrityError) return;
    const graphResult = validateLabGraph(state.graph);
    const timelineResult = validateTimeline(state.timeline);
    if (!graphResult.valid || !timelineResult.valid) {
        const message = !graphResult.valid
            ? graphResult.errors[0]
            : timelineResult.errors[0];
        applyIntegrityRecovery(state, `Integrity Warning (${context}): ${message}`);
    }
};

export const useLabStore = create<LabStoreState>()(
    subscribeWithSelector((set, get) => {
        const initialSnapshot = createEmptySnapshot();
        const lastGoodSnapshot = createEmptySnapshot();
        return {
            graph: createEmptyGraph(),
            timeline: {
                events: [],
                snapshots: [initialSnapshot],
            },
            interaction: {
                mode: 'orbit',
                hoveredPin: null,
                wireStartPin: null,
                dragPosition: null,
                highlightedPins: [],
                selectedNetId: null,
            },
            simulation: {
                playbackState: 'live:stopped',
                isRunning: false,
                playbackMode: 'live',
                tick: 0,
                pinStates: {},
                replayScrubTick: 0,
                lastReconstructionMs: 0,
            },
            sketch: {
                source: '',
                status: 'idle',
                error: null,
                serial: [],
                sketchHash: null,
            },
            labSession: null,
            integrityError: null,
            lastGoodSnapshot,

            setInteractionMode: (mode) =>
                set(produce((state: LabStoreState) => { state.interaction.mode = mode; })),
            setHighlightedPins: (pins) =>
                set(produce((state: LabStoreState) => { state.interaction.highlightedPins = pins; })),
            setSelectedNetId: (netId) =>
                set(produce((state: LabStoreState) => { state.interaction.selectedNetId = netId; })),

            toggleSimulation: (running) =>
                set(produce((state: LabStoreState) => {
                    if (state.integrityError) return;
                    const nextRunning = running ?? !state.simulation.isRunning;

                    if (state.simulation.playbackMode === 'replay') {
                        applyPlaybackState(state.simulation, nextRunning ? 'replay:playing' : 'replay:paused');
                        return;
                    }

                    if (nextRunning === state.simulation.isRunning) return;
                    applyPlaybackState(state.simulation, nextRunning ? 'live:running' : 'live:stopped');

                    state.timeline.events.push({
                        type: nextRunning ? 'SIMULATION_START' : 'SIMULATION_STOP',
                        tick: state.simulation.tick,
                        seq: state.timeline.events.length,
                        source: 'user',
                        ts: Date.now()
                    });
                    assertInvariants(state, 'toggleSimulation');
                })),

            setPlaybackMode: (mode) =>
                set(produce((state: LabStoreState) => {
                    if (state.integrityError) return;
                    if (state.simulation.playbackState === 'live:running' && mode === 'replay') {
                        return;
                    }
                    if (mode === 'live') {
                        applyPlaybackState(state.simulation, 'live:stopped');
                        const targetTick = state.simulation.tick;
                        const { derivedGraph, derivedPinStates, reconstructionMs } = deriveStateAtTick(state.timeline, targetTick);
                        state.graph = derivedGraph;
                        state.simulation.pinStates = derivedPinStates;
                        state.simulation.lastReconstructionMs = reconstructionMs;
                    } else {
                        applyPlaybackState(state.simulation, 'replay:paused');
                        state.simulation.replayScrubTick = state.simulation.tick;
                    }
                })),

            scrub: (tick) =>
                set(produce((state: LabStoreState) => {
                    if (state.simulation.playbackMode !== 'replay') return;
                    if (state.simulation.playbackState === 'replay:playing') return;

                    const maxTick = state.simulation.tick;
                    const targetTick = Math.max(0, Math.min(tick, maxTick));

                    state.simulation.replayScrubTick = targetTick;

                    const { derivedGraph, derivedPinStates, reconstructionMs } = deriveStateAtTick(state.timeline, targetTick);
                    state.graph = derivedGraph;
                    state.simulation.pinStates = derivedPinStates;
                    state.simulation.lastReconstructionMs = reconstructionMs;
                })),

            runSimulationStep: () =>
                set(produce((state: LabStoreState) => {
                    if (state.integrityError) return;

                    if (state.simulation.playbackState === 'replay:playing') {
                        const maxTick = state.simulation.tick;
                        const nextTick = Math.min(state.simulation.replayScrubTick + 1, maxTick);
                        if (nextTick === state.simulation.replayScrubTick) {
                            applyPlaybackState(state.simulation, 'replay:paused');
                            return;
                        }
                        state.simulation.replayScrubTick = nextTick;
                        const { derivedGraph, derivedPinStates, reconstructionMs } = deriveStateAtTick(state.timeline, nextTick);
                        state.graph = derivedGraph;
                        state.simulation.pinStates = derivedPinStates;
                        state.simulation.lastReconstructionMs = reconstructionMs;
                        return;
                    }

                    if (state.simulation.playbackState !== 'live:running') return;

                    state.simulation.tick++;
                    const currentTick = state.simulation.tick;

                    if (currentTick % SNAPSHOT_INTERVAL_TICKS === 0) {
                        const snapshotGraph = cloneGraph(state.graph);
                        const snapshotPinStates = { ...state.simulation.pinStates };
                        const snapshot: LabSnapshot = {
                            tick: currentTick,
                            graph: snapshotGraph,
                            pinStates: snapshotPinStates,
                            traceHash: fingerprintStateSync({ graph: snapshotGraph, pinStates: snapshotPinStates, tick: currentTick })
                        };

                        state.timeline.snapshots.push(snapshot);
                        scheduleSnapshotFingerprint(set, { graph: snapshotGraph, pinStates: snapshotPinStates, tick: currentTick });

                        const graphResult = validateLabGraph(state.graph);
                        const timelineResult = validateTimeline(state.timeline);
                        if (graphResult.valid && timelineResult.valid) {
                            state.lastGoodSnapshot = snapshot;
                        } else {
                            const message = !graphResult.valid ? graphResult.errors[0] : timelineResult.errors[0];
                            applyIntegrityRecovery(state, `Integrity Warning (snapshot): ${message}`);
                            return;
                        }
                    }

                    const diffs: Record<string, number> = {};
                    const serialOutputs: string[] = [];
                    let sketchError: string | null = null;

                    if (state.sketch.status === 'loaded' && sketchRuntime.hasProgram()) {
                        sketchRuntime.step({
                            tick: currentTick,
                            graph: state.graph,
                            pinStates: state.simulation.pinStates,
                            emitSerial: (text) => serialOutputs.push(text),
                            emitError: (message) => { sketchError = message; },
                            onPinWrite: (pinKey, value) => {
                                const expanded = propagatePinDiffs(state.graph, state.simulation.pinStates, { [pinKey]: value });
                                Object.assign(diffs, expanded);
                            }
                        });
                    }

                    // --- FPGA SIMULATION ---
                    // Find Basys3 part
                    const fpgaNode = state.graph.nodes.find(n => n.type === 'fpga-basys3');
                    if (fpgaNode) {
                        // 1. Gather Inputs (SW, BTN)
                        const fpgaInputs: Record<string, 0 | 1> = {};
                        // Iterate all pins of the FPGA node to find their current state
                        // We rely on 'pinStates' which holds the state of the NET connected to the pin
                        // Optimization: In a real engine we'd cache the pin list
                        // For MVP, knowing we have fixed pins SW0-15, BTN0-4
                        const inputPins = [
                            ...Array.from({ length: 16 }, (_, i) => `SW${i}`),
                            ...Array.from({ length: 5 }, (_, i) => `BTN${i}`)
                        ];

                        inputPins.forEach(pinId => {
                            const key = `${fpgaNode.id}:${pinId}`;
                            fpgaInputs[pinId] = (state.simulation.pinStates[key] ?? 0) as 0 | 1;
                        });

                        // 2. Run Engine Tick
                        const fpgaOutputs = fpgaEngine.tick(fpgaInputs);

                        // 3. Apply Outputs (LEDs, 7Seg)
                        Object.entries(fpgaOutputs).forEach(([pinId, value]) => {
                            const key = `${fpgaNode.id}:${pinId}`;
                            // Only propagate if changed (engine.tick returns changes, but let's be safe)
                            if (state.simulation.pinStates[key] !== value) {
                                // Direct write to pin state?
                                // Ideally we treat this as a "driver". 
                                // propagatePinDiffs handles net logic.
                                const expanded = propagatePinDiffs(state.graph, state.simulation.pinStates, { [key]: value });
                                Object.assign(diffs, expanded);
                            }
                        });
                    }
                    // -----------------------

                    if (Object.keys(diffs).length > 0) {
                        state.timeline.events.push({
                            type: 'SIM_PIN_DIFF',
                            tick: currentTick,
                            seq: state.timeline.events.length,
                            source: 'engine',
                            pinDiffs: diffs
                        });
                    }

                    if (serialOutputs.length > 0) {
                        for (const text of serialOutputs) {
                            state.timeline.events.push({
                                type: 'SERIAL_OUTPUT',
                                tick: currentTick,
                                seq: state.timeline.events.length,
                                source: 'engine',
                                text
                            });
                        }
                        const merged = [...state.sketch.serial, ...serialOutputs];
                        state.sketch.serial = merged.slice(-200);
                    }

                    if (sketchError) {
                        state.sketch.status = 'error';
                        state.sketch.error = sketchError;
                        state.timeline.events.push({
                            type: 'SKETCH_ERROR',
                            tick: currentTick,
                            seq: state.timeline.events.length,
                            source: 'engine',
                            message: sketchError
                        });
                        applyPlaybackState(state.simulation, 'live:stopped');
                        return;
                    }

                    assertInvariants(state, 'runSimulationStep');
                })),

            setHoveredPin: (pin) =>
                set(produce((state: LabStoreState) => { state.interaction.hoveredPin = pin; })),

            startWire: (nodeId, pinId) =>
                set(produce((state: LabStoreState) => {
                    if (state.simulation.playbackMode === 'replay') return;
                    if (state.integrityError) return;
                    pauseLiveSimulationForEdit(state);
                    state.interaction.wireStartPin = { nodeId, pinId };
                    state.interaction.mode = 'wire';
                })),

            cancelWire: () =>
                set(produce((state: LabStoreState) => {
                    state.interaction.wireStartPin = null;
                    state.interaction.mode = 'orbit';
                    state.interaction.dragPosition = null;
                })),

            updateDragPosition: (pos) =>
                set(produce((state: LabStoreState) => { state.interaction.dragPosition = pos; })),

            addNode: (node) =>
                set(produce((state: LabStoreState) => {
                    if (state.simulation.playbackMode === 'replay') return;
                    if (state.integrityError) return;
                    pauseLiveSimulationForEdit(state);
                    state.graph.nodes.push(node);

                    const valid = validateLabGraph(state.graph);
                    if (!valid.valid) {
                        state.graph.nodes.pop();
                        return;
                    }

                    state.timeline.events.push({
                        type: 'PLACE_PART',
                        part: node,
                        tick: state.simulation.tick,
                        seq: state.timeline.events.length,
                        source: 'user',
                        ts: Date.now()
                    });
                    assertInvariants(state, 'addNode');
                })),

            updateNodePose: (id, position, rotation) =>
                set(produce((state: LabStoreState) => {
                    if (state.simulation.playbackMode === 'replay') return;
                    if (state.integrityError) return;
                    pauseLiveSimulationForEdit(state);
                    const node = state.graph.nodes.find((n) => n.id === id);
                    if (node) {
                        const sanePos = {
                            x: isFinite(position.x) ? position.x : node.pose.position.x,
                            y: isFinite(position.y) ? position.y : node.pose.position.y,
                            z: isFinite(position.z) ? position.z : node.pose.position.z
                        };

                        let rx = isFinite(rotation.x) ? rotation.x : 0;
                        let ry = isFinite(rotation.y) ? rotation.y : 0;
                        let rz = isFinite(rotation.z) ? rotation.z : 0;
                        let rw = isFinite(rotation.w) ? rotation.w : 1;

                        const len = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw);
                        if (len < 0.0001) { rx = 0; ry = 0; rz = 0; rw = 1; }
                        else if (Math.abs(len - 1.0) > 0.001) {
                            rx /= len; ry /= len; rz /= len; rw /= len;
                        }

                        node.pose.position = sanePos;
                        node.pose.rotation = { x: rx, y: ry, z: rz, w: rw };

                        state.timeline.events.push({
                            type: 'MOVE_PART',
                            nodeId: id,
                            position: sanePos,
                            rotation: node.pose.rotation,
                            tick: state.simulation.tick,
                            seq: state.timeline.events.length,
                            source: 'user',
                            ts: Date.now()
                        });
                        assertInvariants(state, 'updateNodePose');
                    }
                })),

            addWire: (wire) =>
                set(produce((state: LabStoreState) => {
                    if (state.simulation.playbackMode === 'replay') return;
                    if (state.integrityError) return;
                    pauseLiveSimulationForEdit(state);
                    state.graph.wires.push(wire);

                    const valid = validateLabGraph(state.graph);
                    if (!valid.valid) {
                        state.graph.wires.pop();
                        return;
                    }

                    state.timeline.events.push({
                        type: 'ADD_WIRE',
                        wire,
                        tick: state.simulation.tick,
                        seq: state.timeline.events.length,
                        source: 'user',
                        ts: Date.now()
                    });
                    assertInvariants(state, 'addWire');
                })),

            removeWire: (id) =>
                set(produce((state: LabStoreState) => {
                    if (state.simulation.playbackMode === 'replay') return;
                    if (state.integrityError) return;
                    pauseLiveSimulationForEdit(state);
                    state.graph.wires = state.graph.wires.filter((w) => w.id !== id);
                    state.timeline.events.push({
                        type: 'REMOVE_WIRE',
                        wireId: id,
                        tick: state.simulation.tick,
                        seq: state.timeline.events.length,
                        source: 'user',
                        ts: Date.now()
                    });
                    assertInvariants(state, 'removeWire');
                })),

            setSketchSource: (source) =>
                set(produce((state: LabStoreState) => {
                    if (state.simulation.playbackMode === 'replay') return;
                    if (state.integrityError) return;
                    state.sketch.source = source;
                    if (state.sketch.status !== 'idle') {
                        state.sketch.status = 'idle';
                        state.sketch.error = null;
                        state.sketch.sketchHash = null;
                    }
                })),

            loadSketch: () =>
                set(produce((state: LabStoreState) => {
                    if (state.simulation.playbackMode === 'replay') return;
                    if (state.integrityError) return;
                    const source = state.sketch.source ?? '';
                    if (!source.trim()) {
                        state.sketch.status = 'idle';
                        state.sketch.error = 'Sketch source is empty.';
                        state.sketch.sketchHash = null;
                        return;
                    }
                    const result = sketchRuntime.load(source);
                    if (!result.ok) {
                        state.sketch.status = 'error';
                        state.sketch.error = result.error ?? 'Sketch failed to compile.';
                        state.sketch.sketchHash = null;
                        state.timeline.events.push({
                            type: 'SKETCH_ERROR',
                            tick: state.simulation.tick,
                            seq: state.timeline.events.length,
                            source: 'engine',
                            message: state.sketch.error
                        });
                        applyPlaybackState(state.simulation, 'live:stopped');
                        return;
                    }
                    state.sketch.status = 'loaded';
                    state.sketch.error = null;
                    state.sketch.serial = [];
                    state.sketch.sketchHash = result.hash ?? null;
                    state.timeline.events.push({
                        type: 'SKETCH_LOADED',
                        tick: state.simulation.tick,
                        seq: state.timeline.events.length,
                        source: 'engine',
                        sketchHash: result.hash ?? 'unknown'
                    });
                })),

            clearSerial: () =>
                set(produce((state: LabStoreState) => {
                    state.sketch.serial = [];
                })),

            startLabSession: (template) =>
                set(produce((state: LabStoreState) => {
                    const templateHash = fingerprintLabTemplate(template);
                    const sessionId = `lab-${state.simulation.tick}-${state.timeline.events.length}`;
                    state.labSession = {
                        sessionId,
                        templateId: template.lab_id,
                        templateHash,
                        startedAtTick: state.simulation.tick,
                        status: 'active'
                    };
                })),

            clearLabSession: () =>
                set(produce((state: LabStoreState) => { state.labSession = null; })),

            recover: () =>
                set(produce((state: LabStoreState) => {
                    const recoveryMsg = state.integrityError || 'Manual Recovery';
                    applyIntegrityRecovery(state, recoveryMsg, { clearError: true });
                })),

            setUserPinState: (nodeId, pinId, value) =>
                set(produce((state: LabStoreState) => {
                    // In Replay mode, user interaction is blocked (read-only)
                    if (state.simulation.playbackMode === 'replay') return;
                    if (state.integrityError) return;

                    // If simulation is running, we might want to pause or queue.
                    // For MVP-3, we allow immediate injection into pinStates,
                    // but MUST record it as an event to be replayable.

                    // 1. Update State
                    const key = `${nodeId}:${pinId}`;
                    state.simulation.pinStates[key] = value;

                    // 2. Record Event (Deterministic)
                    state.timeline.events.push({
                        type: 'SIM_PIN_DIFF',
                        pinDiffs: { [key]: value },
                        tick: state.simulation.tick,
                        seq: state.timeline.events.length,
                        source: 'user', // Explicitly user-driven
                        ts: Date.now()
                    });

                    // Note: If sim is running, this might happen between ticks.
                    // Ideally interaction events should align with ticks. 
                    // But since we use ticks for replay, as long as it's recorded at 'tick',
                    // it will be replayed at 'tick'.

                    assertInvariants(state, 'setUserPinState');
                })),

            reset: () => {
                sketchRuntime.reset();
                const resetSnapshot = createEmptySnapshot();
                const resetGoodSnapshot = createEmptySnapshot();
                set({
                    graph: createEmptyGraph(),
                    timeline: { events: [], snapshots: [resetSnapshot] },
                    simulation: {
                        playbackState: 'live:stopped',
                        isRunning: false,
                        playbackMode: 'live',
                        tick: 0,
                        pinStates: {},
                        replayScrubTick: 0,
                        lastReconstructionMs: 0,
                    },
                    sketch: {
                        source: '',
                        status: 'idle',
                        error: null,
                        serial: [],
                        sketchHash: null,
                    },
                    interaction: {
                        mode: 'orbit',
                        hoveredPin: null,
                        wireStartPin: null,
                        dragPosition: null,
                        highlightedPins: [],
                        selectedNetId: null,
                    },
                    integrityError: null,
                    lastGoodSnapshot: resetGoodSnapshot,
                    labSession: null
                });
            },
        };
    })
);

// --- HELPER: Deterministic State Derivation ---
function deriveStateAtTick(timeline: LabTimeline, targetTick: number): { derivedGraph: LabGraph, derivedPinStates: Record<string, number>, reconstructionMs: number } {
    const start = performance.now();

    try {
        // 1. Find nearest snapshot <= targetTick
        let bestSnap = timeline.snapshots[0];
        for (const snap of timeline.snapshots) {
            if (snap.tick <= targetTick && snap.tick > bestSnap.tick) {
                bestSnap = snap;
            }
        }

        // 2. Clone snapshot state
        const graph: LabGraph = JSON.parse(JSON.stringify(bestSnap.graph));
        const pinStates: Record<string, number> = { ...bestSnap.pinStates };

        // 3. Replay events from snapshot.tick + 1 to targetTick
        const relevantEvents = timeline.events.filter(e => e.tick >= bestSnap.tick && e.tick <= targetTick);
        // Sort by seq to be absolutely sure
        relevantEvents.sort((a, b) => a.seq - b.seq);

        for (const event of relevantEvents) {
            switch (event.type) {
                case 'PLACE_PART':
                    graph.nodes.push(event.part);
                    break;
                case 'MOVE_PART':
                    const n = graph.nodes.find(n => n.id === event.nodeId);
                    if (n) {
                        n.pose.position = event.position;
                        n.pose.rotation = event.rotation;
                    }
                    break;
                case 'ADD_WIRE':
                    graph.wires.push(event.wire);
                    break;
                case 'REMOVE_WIRE':
                    graph.wires = graph.wires.filter(w => w.id !== event.wireId);
                    break;
                case 'SIM_PIN_DIFF':
                    Object.entries(event.pinDiffs).forEach(([key, val]) => {
                        pinStates[key] = val;
                    });
                    break;
            }
        }

        const duration = performance.now() - start;
        if (duration > RECONSTRUCTION_WARN_MS) {
            console.warn(`[Performance] deriveStateAtTick took ${duration.toFixed(2)}ms. Consider increasing snapshot frequency.`);
        }

        return { derivedGraph: graph, derivedPinStates: pinStates, reconstructionMs: duration };
    } catch (error) {
        const duration = performance.now() - start;
        const fallback = timeline.snapshots[0];
        return {
            derivedGraph: fallback ? JSON.parse(JSON.stringify(fallback.graph)) : createEmptyGraph(),
            derivedPinStates: fallback ? { ...fallback.pinStates } : {},
            reconstructionMs: duration
        };
    }
}
