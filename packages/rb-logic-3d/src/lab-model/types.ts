export type Vector3 = { x: number; y: number; z: number };
export type Quaternion = { x: number; y: number; z: number; w: number };
export type Color = string; // Hex

export interface LabPin {
    id: string; // "A0", "D13", "VCC", "GND", "row-1-a"
    type: 'digital' | 'analog' | 'power' | 'ground' | 'nc';
    direction?: 'input' | 'output' | 'io';
    position: Vector3; // Relative to part origin
}

export interface LabPartDefinition {
    type: string; // "arduino-nano", "led-5mm", "breadboard-half"
    name: string;
    pins: LabPin[];
    dimensions: Vector3; // Bounding box
}

export interface LabNode {
    id: string;
    type: string;
    pose: {
        position: Vector3;
        rotation: Quaternion;
    };
    properties: Record<string, any>; // value: "10k", color: "red"
}

export interface LabWire {
    id: string;
    sourceNodeId: string;
    sourcePinId: string;
    targetNodeId: string;
    targetPinId: string;
    color: Color;
    path?: Vector3[]; // Control points for 3D bezier
}

export interface LabNet {
    id: string;
    pins: { nodeId: string; pinId: string }[];
    state: PinState;
}

export interface LabGraph {
    nodes: LabNode[];
    wires: LabWire[];
    net: Record<string, LabNet>; // Add strict netlist tracking
}

// Sim State
export type PinState = 'HIGH' | 'LOW' | 'Z' | number; // 0-1023 for analog
export interface LabSimulationState {
    tick: number;
    pinStates: Record<string, PinState>; // "nodeId:pinId" -> state
    partStates: Record<string, any>; // "nodeId" -> { internalRegister: 0xFF }
}

// --- TIMELINE & SIMULATION EVENTS ---

export type LabEventSource = 'user' | 'engine' | 'import';

export interface BaseLabEvent {
    tick: number;
    seq: number;
    source: LabEventSource;
    ts?: number; // Wall time, optional
}

export type LabEvent =
    | { type: 'PLACE_PART'; part: LabNode } & BaseLabEvent
    | { type: 'MOVE_PART'; nodeId: string; position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } } & BaseLabEvent
    | { type: 'ADD_WIRE'; wire: LabWire } & BaseLabEvent
    | { type: 'REMOVE_WIRE'; wireId: string } & BaseLabEvent
    | { type: 'SIMULATION_START' } & BaseLabEvent
    | { type: 'SIMULATION_STOP' } & BaseLabEvent
    | { type: 'SIM_PIN_DIFF'; pinDiffs: Record<string, number> } & BaseLabEvent
    | { type: 'SERIAL_OUTPUT'; text: string } & BaseLabEvent
    | { type: 'SKETCH_LOADED'; sketchHash: string } & BaseLabEvent
    | { type: 'SKETCH_ERROR'; message: string } & BaseLabEvent
    | { type: 'INTEGRITY_RECOVERY'; reason: string } & BaseLabEvent;

export interface LabSnapshot {
    tick: number;
    graph: LabGraph; // Deep copy at that tick
    pinStates: Record<string, number>;
    traceHash?: string; // Fast checksum of canonical state
    fingerprint?: string; // SHA-256 of canonical state
}

export interface LabTimeline {
    events: LabEvent[];
    snapshots: LabSnapshot[];
}

// --- CAPSULE EXPORT ---

export interface LabCapsuleMeta {
    capsuleVersion: string; // "labcapsule.v1"
    engineVersion: string;
    appVersion: string;
    createdAt: string; // ISO
    seed?: number;
    capsuleHash?: string;
    deterministicHash?: string;
    sketchHash?: string;
    labTemplateId?: string;
    labTemplateHash?: string;
    labSessionId?: string;
}

export interface LabCapsule {
    meta: LabCapsuleMeta;
    graph: LabGraph; // The initial or canonical state
    history: LabTimeline;
    // Artifacts could go here (code, etc)
    artifacts?: {
        sketchSource?: string;
    };
}

export interface LabSession {
    sessionId: string;
    templateId: string;
    templateHash: string;
    startedAtTick: number;
    status: 'idle' | 'active';
}
