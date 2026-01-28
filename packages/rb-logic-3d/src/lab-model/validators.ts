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

    // Validate Nodes
    for (const node of graph.nodes) {
        if (nodeIds.has(node.id)) {
            errors.push(`Duplicate node ID: ${node.id}`);
        }
        nodeIds.add(node.id);

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

        if (!nodeIds.has(wire.sourceNodeId)) {
            errors.push(`Wire ${wire.id} source node ${wire.sourceNodeId} does not exist`);
        }
        if (!nodeIds.has(wire.targetNodeId)) {
            errors.push(`Wire ${wire.id} target node ${wire.targetNodeId} does not exist`);
        }

        // Validate Pins Exists (if node exists)
        if (nodeIds.has(wire.sourceNodeId)) {
            const node = graph.nodes.find(n => n.id === wire.sourceNodeId);
            const def = PART_DEFINITIONS[node!.type];
            if (wire.sourcePinId !== 'center' && !def?.pins.some(p => p.id === wire.sourcePinId)) {
                // Note: 'center' usually not a pin, but check if we allow virtual pins? No, strict.
                errors.push(`Wire ${wire.id} source pin ${wire.sourcePinId} invalid on ${node!.type}`);
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

    for (const event of timeline.events) {
        if (event.seq <= prevSeq) {
            errors.push(`Non-increasing seq at index ${timeline.events.indexOf(event)}: ${event.seq} <= ${prevSeq}`);
        }
        if (event.tick < prevTick) {
            errors.push(`Time travel detected at seq ${event.seq}: tick ${event.tick} < ${prevTick}`);
        }

        prevSeq = event.seq;
        prevTick = event.tick;

        if (event.type === 'SIM_PIN_DIFF' && event.source !== 'engine') {
            errors.push(`SIM_PIN_DIFF event at seq ${event.seq} must come from 'engine'`);
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

    let lastSeq = -1;
    let lastTick = 0;

    for (const event of timeline.events) {
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

    return {
        repaired: { events: safeEvents, snapshots: timeline.snapshots }, // Snapshots are just optimization, pass through or clear if paranoid
        warnings
    };
}


// --- FINGERPRINTING ---

// --- FINGERPRINTING ---

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

    return stableHash32(JSON.stringify(canonical)).toString(16);
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

    const CanonicalString = JSON.stringify(canonical);

    const encoder = new TextEncoder();
    const data = encoder.encode(CanonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintCapsuleContent(content: { meta: any, graph: LabGraph, history: LabTimeline }): Promise<string> {
    // Canonicalize
    // Meta: exclude deterministicHash. exclude createdAt? No, createdAt is part of the record.
    // Spec says: "excluding hash field itself"

    // We reuse the canonical structure logic:
    const canonical = {
        meta: Object.keys(content.meta).sort().reduce((acc: any, key) => {
            if (key !== 'deterministicHash') {
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
        }
    };

    const CanonicalString = JSON.stringify(canonical);

    const encoder = new TextEncoder();
    const data = encoder.encode(CanonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
