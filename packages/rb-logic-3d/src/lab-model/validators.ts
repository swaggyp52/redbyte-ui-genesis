import { LabGraph, LabTimeline, LabNode, LabWire, LabEvent, LabSnapshot } from './types';
import { PART_DEFINITIONS } from './parts';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export interface RepairResult<T> {
    repaired: T;
    warnings: string[];
}

// --- VALIDATORS ---

export function validateLabGraph(graph: LabGraph): ValidationResult {
    const errors: string[] = [];
    const nodeIds = new Set<string>();
    const nodeById = new Map<string, LabNode>();

    // Validate Nodes
    for (const node of graph.nodes) {
        if (nodeIds.has(node.id)) {
            errors.push(`Duplicate node ID: ${node.id}`);
        }
        nodeIds.add(node.id);
        nodeById.set(node.id, node);

        if (!PART_DEFINITIONS[node.type]) {
            errors.push(`Unknown part type: ${node.type} (node: ${node.id})`);
        }

        // Pose validation
        const { position, rotation } = node.pose;
        if (!isFinite(position.x) || !isFinite(position.y) || !isFinite(position.z)) {
            errors.push(`Invalid position (NaN/Inf) for node ${node.id}`);
        }
        if (!isFinite(rotation.x) || !isFinite(rotation.y) || !isFinite(rotation.z) || !isFinite(rotation.w)) {
            errors.push(`Invalid rotation (NaN/Inf) for node ${node.id}`);
        } else {
            // Check normalization (allow small epsilon)
            const sumSq = rotation.x * rotation.x + rotation.y * rotation.y + rotation.z * rotation.z + rotation.w * rotation.w;
            if (Math.abs(sumSq - 1.0) > 0.01) {
                errors.push(`Non-normalized quaternion for node ${node.id} (lenSq=${sumSq.toFixed(4)})`);
            }
        }
    }

    // Validate Wires
    const wireIds = new Set<string>();
    for (const wire of graph.wires) {
        if (wireIds.has(wire.id)) {
            errors.push(`Duplicate wire ID: ${wire.id}`);
        }
        wireIds.add(wire.id);

        const sourceNode = nodeById.get(wire.sourceNodeId);
        const targetNode = nodeById.get(wire.targetNodeId);

        if (!sourceNode) {
            errors.push(`Wire ${wire.id} source node ${wire.sourceNodeId} does not exist`);
        }
        if (!targetNode) {
            errors.push(`Wire ${wire.id} target node ${wire.targetNodeId} does not exist`);
        }

        // Validate Pins Exists (if node exists)
        if (sourceNode) {
            const def = PART_DEFINITIONS[sourceNode.type];
            if (!def?.pins.some(p => p.id === wire.sourcePinId)) {
                errors.push(`Wire ${wire.id} source pin ${wire.sourcePinId} invalid on ${sourceNode.type}`);
            }
        }
        if (targetNode) {
            const def = PART_DEFINITIONS[targetNode.type];
            if (!def?.pins.some(p => p.id === wire.targetPinId)) {
                errors.push(`Wire ${wire.id} target pin ${wire.targetPinId} invalid on ${targetNode.type}`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

// ... validateTimeline ...
export function validateTimeline(timeline: LabTimeline): ValidationResult {
    const errors: string[] = [];
    let prevSeq = -1;
    let prevTick = 0;

    for (let index = 0; index < timeline.events.length; index++) {
        const event = timeline.events[index];
        if (event.seq <= prevSeq) {
            errors.push(`Non-increasing seq at index ${index}: ${event.seq} <= ${prevSeq}`);
        }
        if (event.tick < prevTick) {
            errors.push(`Time travel detected at seq ${event.seq}: tick ${event.tick} < ${prevTick}`);
        }

        prevSeq = event.seq;
        prevTick = event.tick;

        if (event.type === 'SIM_PIN_DIFF' && event.source !== 'engine') {
            errors.push(`SIM_PIN_DIFF event at seq ${event.seq} must come from 'engine'`);
        }
        if ((event.type === 'SERIAL_OUTPUT' || event.type === 'SKETCH_LOADED' || event.type === 'SKETCH_ERROR') && event.source === 'user') {
            errors.push(`${event.type} event at seq ${event.seq} must come from 'engine' or 'import'`);
        }
    }

    // Validate Snapshots monotonicity
    let lastSnapTick = -1;
    for (const snap of timeline.snapshots) {
        if (snap.tick <= lastSnapTick) {
            errors.push(`Snapshot tick non-monotonic: ${snap.tick} <= ${lastSnapTick}`);
        }
        lastSnapTick = snap.tick;
    }

    return { valid: errors.length === 0, errors };
}

// --- REPAIR ---

export function repairLabGraph(graph: LabGraph): RepairResult<LabGraph> {
    const warnings: string[] = [];
    const safeNodes: LabNode[] = [];
    const validNodeIds = new Set<string>();
    const validPinsByNodeId = new Map<string, Set<string>>();

    // 1. Repair Nodes
    for (const node of graph.nodes) {
        // Clamp floats & Normalize Quaternion
        let rx = isFinite(node.pose.rotation.x) ? node.pose.rotation.x : 0;
        let ry = isFinite(node.pose.rotation.y) ? node.pose.rotation.y : 0;
        let rz = isFinite(node.pose.rotation.z) ? node.pose.rotation.z : 0;
        let rw = isFinite(node.pose.rotation.w) ? node.pose.rotation.w : 1;

        const len = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw);
        if (len < 0.0001) {
            // Degenerate -> Reset to identity
            rx = 0; ry = 0; rz = 0; rw = 1;
            warnings.push(`Reset degenerate rotation for node ${node.id}`);
        } else if (Math.abs(len - 1.0) > 0.001) {
            // Renormalize
            rx /= len; ry /= len; rz /= len; rw /= len;
            // warnings.push(`Renormalized rotation for node ${node.id}`); // noisy?
        }

        const safePose = {
            position: {
                x: isFinite(node.pose.position.x) ? node.pose.position.x : 0,
                y: isFinite(node.pose.position.y) ? node.pose.position.y : 0,
                z: isFinite(node.pose.position.z) ? node.pose.position.z : 0,
            },
            rotation: { x: rx, y: ry, z: rz, w: rw }
        };

        if (validNodeIds.has(node.id)) {
            warnings.push(`Dropping duplicate node: ${node.id}`);
            continue;
        }

        if (PART_DEFINITIONS[node.type]) {
            validNodeIds.add(node.id);
            validPinsByNodeId.set(node.id, new Set(PART_DEFINITIONS[node.type].pins.map(p => p.id)));
            safeNodes.push({ ...node, pose: safePose });
        } else {
            warnings.push(`Dropping unknown part type: ${node.type}`);
        }
    }

    // 2. Repair Wires
    const safeWires: LabWire[] = [];
    for (const wire of graph.wires) {
        if (!validNodeIds.has(wire.sourceNodeId) || !validNodeIds.has(wire.targetNodeId)) {
            warnings.push(`Dropping dangling wire ${wire.id}`);
            continue;
        }
        const sourcePins = validPinsByNodeId.get(wire.sourceNodeId);
        const targetPins = validPinsByNodeId.get(wire.targetNodeId);
        if (!sourcePins?.has(wire.sourcePinId) || !targetPins?.has(wire.targetPinId)) {
            warnings.push(`Dropping wire ${wire.id} with invalid pin reference`);
            continue;
        }
        // Self-wire check
        if (wire.sourceNodeId === wire.targetNodeId && wire.sourcePinId === wire.targetPinId) {
            warnings.push(`Dropping self-loop wire ${wire.id}`);
            continue;
        }
        safeWires.push(wire);
    }

    return {
        repaired: { nodes: safeNodes, wires: safeWires, net: {} },
        warnings
    };
}

export function repairTimeline(timeline: LabTimeline): RepairResult<LabTimeline> {
    const warnings: string[] = [];
    const safeEvents: LabEvent[] = [];
    const safeSnapshots: LabSnapshot[] = [];

    let lastSeq = -1;
    let lastTick = 0;

    const sortedEvents = [...timeline.events].sort((a, b) => a.seq - b.seq);
    for (const event of sortedEvents) {
        let fixedEvent = { ...event };

        // 1. Fix Seq
        if (fixedEvent.seq <= lastSeq) {
            fixedEvent.seq = lastSeq + 1;
            warnings.push(`Fixed non-increasing seq for event at tick ${fixedEvent.tick}`);
        }

        // 2. Fix Tick (clamp to monotonic)
        if (fixedEvent.tick < lastTick) {
            fixedEvent.tick = lastTick;
            warnings.push(`Clamped tick for event seq ${fixedEvent.seq}`);
        }

        safeEvents.push(fixedEvent as LabEvent);
        lastSeq = fixedEvent.seq;
        lastTick = fixedEvent.tick;
    }

    const sortedSnapshots = [...timeline.snapshots].sort((a, b) => a.tick - b.tick);
    let lastSnapTick = -1;
    for (const snap of sortedSnapshots) {
        if (snap.tick <= lastSnapTick) {
            warnings.push(`Dropped non-monotonic snapshot at tick ${snap.tick}`);
            continue;
        }
        safeSnapshots.push(snap);
        lastSnapTick = snap.tick;
    }

    return {
        repaired: { events: safeEvents, snapshots: safeSnapshots },
        warnings
    };
}


// --- FINGERPRINTING ---

const FLOAT_PRECISION = 3;

function normalizeNumber(value: number): number {
    if (!Number.isFinite(value)) return value;
    return Number(value.toFixed(FLOAT_PRECISION));
}

function canonicalizeValue(value: unknown): unknown {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'number') return normalizeNumber(value);
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) {
        const result: unknown[] = [];
        for (const item of value) {
            const normalized = canonicalizeValue(item);
            if (normalized !== undefined) {
                result.push(normalized);
            }
        }
        return result;
    }
    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of entries) {
        const normalized = canonicalizeValue(entryValue);
        if (normalized !== undefined) {
            result[key] = normalized;
        }
    }
    return result;
}

function stringifyCanonical(value: unknown): string {
    return JSON.stringify(canonicalizeValue(value));
}

// FNV-1a 32-bit Hash (Fast, Non-Cryptographic)
function stableHash32(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0; // Force unsigned 32-bit
}

// Canonicalize and Hash Synchronously (for Snapshots)
export function fingerprintStateSync(state: { graph: LabGraph, pinStates: Record<string, number>, tick: number }): string {
    const canonical = {
        tick: state.tick,
        // Graph: Sort Nodes/Wires by ID
        graph: {
            nodes: [...state.graph.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(n => ({
                id: n.id,
                type: n.type,
                pose: n.pose,
                properties: n.properties
            })),
            wires: [...state.graph.wires].sort((a, b) => a.id.localeCompare(b.id)).map(w => ({
                id: w.id,
                source: `${w.sourceNodeId}:${w.sourcePinId}`,
                target: `${w.targetNodeId}:${w.targetPinId}`,
            }))
        },
        // PinStates: Sort keys
        pinStates: Object.keys(state.pinStates).sort().reduce((acc, key) => {
            acc[key] = state.pinStates[key];
            return acc;
        }, {} as Record<string, number>)
    };

    return stableHash32(stringifyCanonical(canonical)).toString(16);
}

export async function fingerprintState(state: { graph: LabGraph, pinStates: Record<string, number>, tick: number }): Promise<string> {

    // Canonical content
    const canonical = {
        tick: state.tick,
        // Graph: Sort Nodes/Wires by ID
        graph: {
            nodes: [...state.graph.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(n => ({
                id: n.id,
                type: n.type,
                // Normalize floats to 3 decimals to avoid arch diffs? 
                // "cannot break" -> strict. If floats drift, we WANT to know.
                // But JS floats are double standard (IEEE 754).
                // Let's keep raw numbers for now. If drift happens across browsers, we reconsider.
                pose: n.pose,
                properties: n.properties
            })),
            wires: [...state.graph.wires].sort((a, b) => a.id.localeCompare(b.id)).map(w => ({
                id: w.id,
                source: `${w.sourceNodeId}:${w.sourcePinId}`,
                target: `${w.targetNodeId}:${w.targetPinId}`,
                // color? path?
            }))
        },
        // PinStates: Sort keys
        pinStates: Object.keys(state.pinStates).sort().reduce((acc, key) => {
            acc[key] = state.pinStates[key];
            return acc;
        }, {} as Record<string, number>)
    };

    const CanonicalString = stringifyCanonical(canonical);

    const encoder = new TextEncoder();
    const data = encoder.encode(CanonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintCapsuleContent(content: { meta: any, graph: LabGraph, history: LabTimeline, artifacts?: any }): Promise<string> {
    // Canonicalize
    // Meta: exclude deterministicHash. exclude createdAt? No, createdAt is part of the record.
    // Spec says: "excluding hash field itself"

    // We reuse the canonical structure logic:
    const canonical = {
        meta: Object.keys(content.meta).sort().reduce((acc: any, key) => {
            if (key !== 'deterministicHash' && key !== 'capsuleHash') {
                acc[key] = content.meta[key];
            }
            return acc;
        }, {}),
        graph: {
            nodes: [...content.graph.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(n => ({
                id: n.id,
                type: n.type,
                pose: n.pose,
                properties: n.properties
            })),
            wires: [...content.graph.wires].sort((a, b) => a.id.localeCompare(b.id)).map(w => ({
                id: w.id,
                source: `${w.sourceNodeId}:${w.sourcePinId}`,
                target: `${w.targetNodeId}:${w.targetPinId}`,
            }))
        },
        history: {
            // Events: Keep order (seq) !
            events: content.history.events.map(e => ({
                type: e.type,
                tick: e.tick,
                seq: e.seq,
                source: e.source,
                // Flatten discriminant fields
                ...('part' in e ? { part: e.part } : {}),
                ...('nodeId' in e ? { nodeId: e.nodeId, position: e.position, rotation: e.rotation } : {}),
                ...('wire' in e ? { wire: e.wire } : {}),
                ...('wireId' in e ? { wireId: e.wireId } : {}),
                ...('pinDiffs' in e ? {
                    pinDiffs: Object.keys(e.pinDiffs).sort().reduce((acc: any, k) => {
                        acc[k] = e.pinDiffs[k];
                        return acc;
                    }, {})
                } : {})
            })),
            // Snapshots: exclude from hash? Ideally yes, they are derived.
            // But if we export them, we might want to sign them?
            // "Cannot break" -> Verify what we accidentally load. 
            // If we load snapshots, we should hash them. 
            // But strict determinism says only events matter. 
            // Let's exclude snapshots from the "Canonical Truth Hash".
            snapshots: []
        },
        artifacts: content.artifacts ?? {}
    };

    const CanonicalString = stringifyCanonical(canonical);

    const encoder = new TextEncoder();
    const data = encoder.encode(CanonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
