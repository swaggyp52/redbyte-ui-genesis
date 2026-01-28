// Aborted to update types.ts first
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { produce } from 'immer';
import { LabGraph, LabNode, LabWire, LabNet, LabTimeline, LabEvent, LabSnapshot, PinState } from './types';
import { validateLabGraph, validateTimeline, repairLabGraph, fingerprintStateSync } from './validators';

// ... imports ...

// ... interfaces ...

// ... store creation ...

runSimulationStep: () =>
    set(produce((state: LabStoreState) => {
        if (state.simulation.playbackMode === 'replay') return;
        if (state.integrityError) return; // Halt on corruption

        state.simulation.tick++;
        const currentTick = state.simulation.tick;

        // --- SNAPSHOT POLICY ---
        if (currentTick % SNAPSHOT_INTERVAL_TICKS === 0) {
            const snapshot: LabSnapshot = {
                tick: currentTick,
                graph: JSON.parse(JSON.stringify(state.graph)), // Deep copy
                pinStates: { ...state.simulation.pinStates },
                // Synchronous Checksum for Drift Detection
                // fingerprint will be filled after object creation or via helper
            };
            snapshot.fingerprint = fingerprintStateSync(snapshot);

            state.timeline.snapshots.push(snapshot);

            // Invariant Check (Lazy, every snapshot)
            const valid = validateLabGraph(state.graph);
            if (valid.valid) {
                state.lastGoodSnapshot = snapshot;
            } else {
                state.integrityError = `Corruption Detected at Tick ${currentTick}: ${valid.errors[0]}`;
                state.simulation.isRunning = false;
            }
        }

        // ... simulation logic ...
        // (rest of runSimulationStep is unchanged, skipping for brevity in this replace block if possible, but I need to target the whole function or careful ranges.
        // I will target the imports and then specific methods using multiple chunks if needed, or replacement of the `recover` and `runSimulationStep` blocks.
        // actually I can just replace the chunks.)

        // ...
    })),

    // ...

    recover: () =>
        set(produce((state: LabStoreState) => {
            if (state.lastGoodSnapshot) {
                const snap = state.lastGoodSnapshot;

                // 1. Restore State
                state.graph = JSON.parse(JSON.stringify(snap.graph));
                state.simulation.pinStates = { ...snap.pinStates };
                state.simulation.tick = snap.tick;

                // 2. Truncate History (Deterministic Recovery)
                // Keep events that happened <= snap.tick
                state.timeline.events = state.timeline.events.filter(e => e.tick <= snap.tick);

                // 3. Emit Recovery Event
                const recoveryMsg = state.integrityError || 'Manual Recovery';
                state.timeline.events.push({
                    type: 'INTEGRITY_RECOVERY' as any, // Type cast if not in LabEvent yet
                    tick: snap.tick,
                    seq: state.timeline.events.length,
                    source: 'engine',
                    reason: recoveryMsg
                } as any);

                state.integrityError = null;
                state.simulation.isRunning = false;
                console.warn(`System Recovered to Snapshot at Tick ${snap.tick}. Reason: ${recoveryMsg}`);
            } else {
                // Hard Reset
                state.graph = { nodes: [], wires: [], net: {} };
                state.simulation.tick = 0;
                state.timeline.events = [];
                state.integrityError = null;
            }
        })),

        interface InteractionState {
    mode: 'orbit' | 'wire';
    hoveredPin: { nodeId: string; pinId: string } | null;
    wireStartPin: { nodeId: string; pinId: string } | null;
    dragPosition: { x: number; y: number; z: number } | null;
}

interface SimulationState {
    isRunning: boolean;
    tick: number;
    pinStates: Record<string, number>; // "nodeId:pinId" -> 1/0
    playbackMode: 'live' | 'replay';
    replayScrubTick: number; // The tick we are viewing in replay mode
}

interface LabStoreState {
    graph: LabGraph; // The CURRENT state (live) OR the DERIVED state (replay)
    timeline: LabTimeline;

    interaction: InteractionState;
    simulation: SimulationState;

    // Reliability
    integrityError: string | null;
    lastGoodSnapshot: LabSnapshot | null;

    // Actions
    setInteractionMode: (mode: 'orbit' | 'wire') => void;

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

    // Recovery
    recover: () => void;
}

const SNAPSHOT_INTERVAL_TICKS = 200; // Create a snapshot every N ticks

export const useLabStore = create<LabStoreState>()(
    subscribeWithSelector((set, get) => ({
        graph: {
            nodes: [],
            wires: [],
            net: {},
        },
        timeline: {
            events: [],
            snapshots: [{ tick: 0, graph: { nodes: [], wires: [], net: {} }, pinStates: {} }], // Initial snapshot
        },
        interaction: {
            mode: 'orbit',
            hoveredPin: null,
            wireStartPin: null,
            dragPosition: null,
        },
        simulation: {
            isRunning: false,
            tick: 0,
            pinStates: {},
            playbackMode: 'live',
            replayScrubTick: 0,
        },
        integrityError: null,
        lastGoodSnapshot: { tick: 0, graph: { nodes: [], wires: [], net: {} }, pinStates: {} },

        setInteractionMode: (mode) =>
            set(produce((state: LabStoreState) => { state.interaction.mode = mode; })),

        toggleSimulation: (running) =>
            set(produce((state: LabStoreState) => {
                if (state.simulation.playbackMode === 'replay' && running) {
                    // If user Hits play in replay mode, maybe we jump to live? 
                    // For safety, let's auto-switch to live if they explicitly run.
                    state.simulation.playbackMode = 'live';
                }
                const next = running ?? !state.simulation.isRunning;
                state.simulation.isRunning = next;

                // Record start/stop events
                const seq = state.timeline.events.length;
                state.timeline.events.push({
                    type: next ? 'SIMULATION_START' : 'SIMULATION_STOP',
                    tick: state.simulation.tick,
                    seq,
                    source: 'user',
                    ts: Date.now()
                });
            })),

        setPlaybackMode: (mode) =>
            set(produce((state: LabStoreState) => {
                state.simulation.playbackMode = mode;
                state.simulation.isRunning = false; // Stop simulation when switching modes
                if (mode === 'live') {
                    // Restore latest live state
                    // We need to re-derive from the latest snapshot + events up to current tick
                    const targetTick = state.simulation.tick;
                    // For MVP simplicity, we can just let runSimulationStep continue from where it was
                    // The graph state in 'live' should inherently BE the latest if we didn't corrupt it during replay.
                    // IMPORTANT: 'scrub' updates state.graph. We MUST restore state.graph when going back to live.

                    // Optimization: Actually, let's just re-derive state at maxTick to be safe.
                    // Or, we can keep 'liveGraph' separately in memory? 
                    // For MVP, strictly deriving is safest.
                    const { derivedGraph, derivedPinStates } = deriveStateAtTick(state.timeline, targetTick);
                    state.graph = derivedGraph;
                    state.simulation.pinStates = derivedPinStates;
                } else {
                    state.simulation.replayScrubTick = state.simulation.tick;
                }
            })),

        scrub: (tick) =>
            set(produce((state: LabStoreState) => {
                if (state.simulation.playbackMode !== 'replay') return;

                // Clamp tick
                const maxTick = state.simulation.tick;
                const targetTick = Math.max(0, Math.min(tick, maxTick));

                state.simulation.replayScrubTick = targetTick;

                // DERIVE STATE
                const { derivedGraph, derivedPinStates } = deriveStateAtTick(state.timeline, targetTick);
                state.graph = derivedGraph;
                state.simulation.pinStates = derivedPinStates;
            })),

        runSimulationStep: () =>
            set(produce((state: LabStoreState) => {
                if (state.simulation.playbackMode === 'replay') return;
                if (state.integrityError) return; // Halt on corruption

                state.simulation.tick++;
                const currentTick = state.simulation.tick;

                // --- SNAPSHOT POLICY ---
                if (currentTick % SNAPSHOT_INTERVAL_TICKS === 0) {
                    const snapshot = {
                        tick: currentTick,
                        graph: JSON.parse(JSON.stringify(state.graph)), // Deep copy
                        pinStates: { ...state.simulation.pinStates }
                    };
                    state.timeline.snapshots.push(snapshot);

                    // Invariant Check (Lazy, every snapshot)
                    const valid = validateLabGraph(state.graph);
                    if (valid.valid) {
                        state.lastGoodSnapshot = snapshot;
                        // Trigger async fingerprinting here (e.g., calculate hash for snapshot.graph)
                        // void calculateGraphFingerprint(snapshot.graph).then(fingerprint => { /* store fingerprint */ });
                    } else {
                        state.integrityError = `Corruption Detected at Tick ${currentTick}: ${valid.errors[0]}`;
                        state.simulation.isRunning = false;
                    }
                }

                // --- MVP BLINK LOGIC ---
                const arduino = state.graph.nodes.find(n => n.type === 'arduino-nano');
                const diffs: Record<string, number> = {};

                if (arduino) {
                    const cycle = 40;
                    const val = (currentTick % cycle) < 20 ? 1 : 0;
                    const d13Key = `${arduino.id}:D13`;

                    // Only record diff if changed
                    if (state.simulation.pinStates[d13Key] !== val) {
                        state.simulation.pinStates[d13Key] = val;
                        diffs[d13Key] = val;

                        // Propagate
                        const d13Wires = state.graph.wires.filter(w =>
                            (w.sourceNodeId === arduino.id && w.sourcePinId === 'D13') ||
                            (w.targetNodeId === arduino.id && w.targetPinId === 'D13')
                        );

                        d13Wires.forEach(w => {
                            const otherNodeId = w.sourceNodeId === arduino.id ? w.targetNodeId : w.sourceNodeId;
                            const otherPinId = w.sourceNodeId === arduino.id ? w.targetPinId : w.sourcePinId;
                            const key = `${otherNodeId}:${otherPinId}`;

                            if (state.simulation.pinStates[key] !== val) {
                                state.simulation.pinStates[key] = val;
                                diffs[key] = val;
                            }
                        });
                    }
                }

                // Emit Tick Event with Diffs
                if (Object.keys(diffs).length > 0) {
                    state.timeline.events.push({
                        type: 'SIM_PIN_DIFF',
                        tick: currentTick,
                        seq: state.timeline.events.length,
                        source: 'engine',
                        pinDiffs: diffs
                    });
                }
            })),

        setHoveredPin: (pin) =>
            set(produce((state: LabStoreState) => { state.interaction.hoveredPin = pin; })),

        startWire: (nodeId, pinId) =>
            set(produce((state: LabStoreState) => {
                if (state.simulation.playbackMode === 'replay') return;
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
                state.graph.nodes.push(node);

                // Immediate Validation
                const valid = validateLabGraph(state.graph);
                if (!valid.valid) {
                    // Rollback! (By not modifying, but Immer is a proxy...)
                    // We need to revert the push.
                    state.graph.nodes.pop();
                    console.error("Blocked Invalid Node Placement:", valid.errors);
                    return;
                }

                // Record Event
                state.timeline.events.push({
                    type: 'PLACE_PART',
                    part: node,
                    tick: state.simulation.tick,
                    seq: state.timeline.events.length,
                    source: 'user',
                    ts: Date.now()
                });
            })),

        updateNodePose: (id, position, rotation) =>
            set(produce((state: LabStoreState) => {
                if (state.simulation.playbackMode === 'replay') return;
                const node = state.graph.nodes.find((n) => n.id === id);
                if (node) {
                    node.pose.position = position;
                    node.pose.rotation = rotation;

                    // Debounce or reduce frequency of move events in real implementation
                    // For MVP-1, we might just record final move? 
                    // Let's assume this is called on drag end for now, or record every frame (bad).
                    // Refactoring to record only significant moves or drag-end is better, 
                    // but verifying with USER plan: "record events: placePart, movePart..."
                    // We'll record it.

                    state.timeline.events.push({
                        type: 'MOVE_PART',
                        nodeId: id,
                        position,
                        rotation,
                        tick: state.simulation.tick,
                        seq: state.timeline.events.length,
                        source: 'user',
                        ts: Date.now()
                    });
                }
                // We trust Pose from OrbitControls mostly, but could clamp here if needed.
            })),

        addWire: (wire) =>
            set(produce((state: LabStoreState) => {
                if (state.simulation.playbackMode === 'replay') return;
                state.graph.wires.push(wire);

                const valid = validateLabGraph(state.graph);
                if (!valid.valid) {
                    state.graph.wires.pop();
                    console.error("Blocked Invalid Wire:", valid.errors);
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
            })),

        removeWire: (id) =>
            set(produce((state: LabStoreState) => {
                if (state.simulation.playbackMode === 'replay') return;
                // Validation not strictly needed for removal unless it breaks something else (unlikely in this model)
                state.graph.wires = state.graph.wires.filter((w) => w.id !== id);
                state.timeline.events.push({
                    type: 'REMOVE_WIRE',
                    wireId: id,
                    tick: state.simulation.tick,
                    seq: state.timeline.events.length,
                    source: 'user',
                    ts: Date.now()
                });
            })),

        recover: () =>
            set(produce((state: LabStoreState) => {
                if (state.lastGoodSnapshot) {
                    state.graph = JSON.parse(JSON.stringify(state.lastGoodSnapshot.graph));
                    state.simulation.pinStates = { ...state.lastGoodSnapshot.pinStates };
                    state.simulation.tick = state.lastGoodSnapshot.tick;
                    state.integrityError = null;
                    state.simulation.isRunning = false;
                    console.warn("System Recovered to Last Good Snapshot at Tick", state.lastGoodSnapshot.tick);
                } else {
                    // Hard Reset
                    state.graph = { nodes: [], wires: [], net: {} };
                    state.simulation.tick = 0;
                    state.integrityError = null;
                }
            })),

        reset: () =>
            set({
                graph: { nodes: [], wires: [], net: {} },
                timeline: { events: [], snapshots: [{ tick: 0, graph: { nodes: [], wires: [], net: {} }, pinStates: {} }] },
                simulation: { isRunning: false, tick: 0, pinStates: {}, playbackMode: 'live', replayScrubTick: 0 },
                integrityError: null,
                lastGoodSnapshot: { tick: 0, graph: { nodes: [], wires: [], net: {} }, pinStates: {} }
            }),
    }))
);

// --- HELPER: Deterministic State Derivation ---
function deriveStateAtTick(timeline: LabTimeline, targetTick: number): { derivedGraph: LabGraph, derivedPinStates: Record<string, number> } {
    const start = performance.now();

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
    if (duration > 16) {
        console.warn(`[Performance] deriveStateAtTick took ${duration.toFixed(2)}ms. Consider increasing snapshot frequency.`);
    }

    return { derivedGraph: graph, derivedPinStates: pinStates };
}
