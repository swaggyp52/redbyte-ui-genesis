import { describe, it, expect, beforeEach } from 'vitest';
import { useLabStore } from '../store';
import { PART_DEFINITIONS } from '../parts';
import { validateLabGraph, validateTimeline, repairLabGraph, repairTimeline } from '../validators';
const createRng = (seed) => {
    let state = seed;
    const next = () => {
        state = (state * 9301 + 49297) % 233280;
        return state / 233280;
    };
    return {
        next,
        int: (max) => Math.floor(next() * max),
        pick: (items) => (items.length ? items[Math.floor(next() * items.length)] : undefined)
    };
};
const cloneGraph = (graph) => JSON.parse(JSON.stringify(graph));
const normalizeQuaternion = (rng) => {
    let x = rng.next() * 2 - 1;
    let y = rng.next() * 2 - 1;
    let z = rng.next() * 2 - 1;
    let w = rng.next() * 2 - 1;
    const len = Math.sqrt(x * x + y * y + z * z + w * w);
    if (len < 0.0001) {
        return { x: 0, y: 0, z: 0, w: 1 };
    }
    x /= len;
    y /= len;
    z /= len;
    w /= len;
    return { x, y, z, w };
};
const buildNode = (rng, type, idSuffix) => ({
    id: `${type}-${idSuffix}`,
    type,
    pose: {
        position: { x: (rng.next() - 0.5) * 20, y: (rng.next() - 0.5) * 20, z: 0 },
        rotation: normalizeQuaternion(rng)
    },
    properties: {}
});
const buildWire = (rng, sourceId, sourceType, targetId, targetType, idSuffix) => {
    const sourcePins = PART_DEFINITIONS[sourceType].pins;
    const targetPins = PART_DEFINITIONS[targetType].pins;
    const sourcePinId = sourcePins[rng.int(sourcePins.length)].id;
    const targetPinId = targetPins[rng.int(targetPins.length)].id;
    return {
        id: `w-${idSuffix}`,
        sourceNodeId: sourceId,
        sourcePinId,
        targetNodeId: targetId,
        targetPinId,
        color: 'green'
    };
};
const applyEvent = (graph, pinStates, event) => {
    switch (event.type) {
        case 'PLACE_PART':
            graph.nodes.push(event.part);
            break;
        case 'MOVE_PART': {
            const node = graph.nodes.find((n) => n.id === event.nodeId);
            if (node) {
                node.pose.position = event.position;
                node.pose.rotation = event.rotation;
            }
            break;
        }
        case 'ADD_WIRE':
            graph.wires.push(event.wire);
            break;
        case 'REMOVE_WIRE':
            graph.wires = graph.wires.filter((w) => w.id !== event.wireId);
            break;
        case 'SIM_PIN_DIFF':
            Object.entries(event.pinDiffs).forEach(([key, val]) => {
                pinStates[key] = val;
            });
            break;
        default:
            break;
    }
};
const deriveFromScratch = (timeline, targetTick) => {
    const baseSnapshot = timeline.snapshots[0] ?? { tick: 0, graph: { nodes: [], wires: [], net: {} }, pinStates: {} };
    const graph = cloneGraph(baseSnapshot.graph);
    const pinStates = { ...baseSnapshot.pinStates };
    const events = timeline.events
        .filter((event) => event.tick <= targetTick)
        .sort((a, b) => a.seq - b.seq);
    events.forEach((event) => applyEvent(graph, pinStates, event));
    return { graph, pinStates };
};
const runFuzz = (seed, iterations, mode) => {
    const store = useLabStore;
    store.getState().reset();
    const rng = createRng(seed);
    const partTypes = Object.keys(PART_DEFINITIONS);
    const nodeIds = [];
    const nodeTypes = new Map();
    const wireIds = [];
    for (let i = 0; i < iterations; i++) {
        const action = rng.int(100);
        const state = store.getState();
        try {
            if (action < 15) {
                const type = partTypes[rng.int(partTypes.length)];
                const node = buildNode(rng, type, i);
                const before = state.graph.nodes.length;
                state.addNode(node);
                const after = store.getState().graph.nodes.length;
                if (after > before) {
                    nodeIds.push(node.id);
                    nodeTypes.set(node.id, type);
                }
            }
            else if (action < 35) {
                const id = rng.pick(nodeIds);
                if (id) {
                    state.updateNodePose(id, { x: (rng.next() - 0.5) * 20, y: (rng.next() - 0.5) * 20, z: 0 }, normalizeQuaternion(rng));
                }
            }
            else if (action < 55) {
                if (nodeIds.length >= 2) {
                    const sourceId = rng.pick(nodeIds);
                    const targetId = rng.pick(nodeIds);
                    const sourceType = nodeTypes.get(sourceId);
                    const targetType = nodeTypes.get(targetId);
                    if (!sourceType || !targetType) {
                        continue;
                    }
                    const sourcePins = PART_DEFINITIONS[sourceType].pins;
                    const targetPins = PART_DEFINITIONS[targetType].pins;
                    if (sourcePins.length === 0 || targetPins.length === 0) {
                        continue;
                    }
                    const wire = buildWire(rng, sourceId, sourceType, targetId, targetType, i);
                    const before = state.graph.wires.length;
                    state.addWire(wire);
                    const after = store.getState().graph.wires.length;
                    if (after > before) {
                        wireIds.push(wire.id);
                    }
                }
            }
            else if (action < 65) {
                const wireId = rng.pick(wireIds);
                if (wireId) {
                    state.removeWire(wireId);
                    const index = wireIds.indexOf(wireId);
                    if (index >= 0)
                        wireIds.splice(index, 1);
                }
            }
            else if (action < 90) {
                state.toggleSimulation(true);
                state.runSimulationStep();
                state.toggleSimulation(false);
            }
            else if (mode === 'mode-switch') {
                if (state.simulation.isRunning) {
                    state.toggleSimulation(false);
                }
                const nextMode = state.simulation.playbackMode === 'live' ? 'replay' : 'live';
                state.setPlaybackMode(nextMode);
                if (nextMode === 'replay') {
                    const t = rng.int(Math.max(1, state.simulation.tick));
                    state.scrub(t);
                }
            }
        }
        catch (err) {
            const recentEvents = store.getState().timeline.events.slice(-200);
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Fuzz ${mode} failed at step ${i} (seed ${seed}). Error: ${message}\n${JSON.stringify(recentEvents, null, 2)}`);
        }
    }
    const graphValid = validateLabGraph(store.getState().graph);
    const timelineValid = validateTimeline(store.getState().timeline);
    expect(graphValid.valid).toBe(true);
    expect(timelineValid.valid).toBe(true);
    expect(store.getState().integrityError).toBeNull();
};
beforeEach(() => {
    useLabStore.getState().reset();
});
describe('Virtual Lab fuzz suite', () => {
    it('basic fuzz is stable', () => {
        runFuzz(1337, 300, 'basic');
    }, 30000);
    it('mode switching is stable', () => {
        runFuzz(4242, 600, 'mode-switch');
    }, 30000);
    it('stress run stays consistent', () => {
        const store = useLabStore.getState();
        store.reset();
        const node = buildNode(createRng(11), 'arduino-nano', 0);
        store.addNode(node);
        store.toggleSimulation(true);
        for (let i = 0; i < 10000; i++) {
            store.runSimulationStep();
        }
        store.toggleSimulation(false);
        const graphValid = validateLabGraph(store.graph);
        const timelineValid = validateTimeline(store.timeline);
        expect(graphValid.valid).toBe(true);
        expect(timelineValid.valid).toBe(true);
        expect(store.integrityError).toBeNull();
    }, 30000);
    it('derive is idempotent at the same tick', () => {
        runFuzz(2024, 200, 'basic');
        const store = useLabStore.getState();
        store.setPlaybackMode('replay');
        const targetTick = Math.max(0, Math.floor(store.simulation.tick / 2));
        store.scrub(targetTick);
        const firstGraph = cloneGraph(store.graph);
        const firstPins = { ...store.simulation.pinStates };
        store.scrub(targetTick);
        expect(store.graph).toEqual(firstGraph);
        expect(store.simulation.pinStates).toEqual(firstPins);
    });
    it('snapshot consistency matches replay from scratch', () => {
        const store = useLabStore.getState();
        store.reset();
        const node = buildNode(createRng(7), 'arduino-nano', 1);
        store.addNode(node);
        store.toggleSimulation(true);
        for (let i = 0; i < 260; i++) {
            store.runSimulationStep();
        }
        store.toggleSimulation(false);
        const targetTick = store.simulation.tick;
        store.setPlaybackMode('replay');
        store.scrub(targetTick);
        const manual = deriveFromScratch(store.timeline, targetTick);
        expect(store.graph).toEqual(manual.graph);
        expect(store.simulation.pinStates).toEqual(manual.pinStates);
    });
    it('repairs corrupted inputs without throwing', () => {
        const corruptedGraph = {
            nodes: [{ id: 'dup', type: 'unknown-part', pose: { position: { x: NaN, y: Infinity, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 0 } }, properties: {} }],
            wires: [{ id: 'w1', sourceNodeId: 'missing', sourcePinId: 'X', targetNodeId: 'dup', targetPinId: 'Y', color: 'red' }],
            net: {}
        };
        const corruptedTimeline = {
            events: [
                { type: 'SIM_PIN_DIFF', tick: 2, seq: 2, source: 'engine', pinDiffs: { 'a:b': 1 } },
                { type: 'SIM_PIN_DIFF', tick: 1, seq: 1, source: 'engine', pinDiffs: { 'a:b': 0 } }
            ],
            snapshots: [{ tick: 5, graph: { nodes: [], wires: [], net: {} }, pinStates: {}, traceHash: 'deadbeef' }]
        };
        expect(() => repairLabGraph(corruptedGraph)).not.toThrow();
        expect(() => repairTimeline(corruptedTimeline)).not.toThrow();
    });
});
