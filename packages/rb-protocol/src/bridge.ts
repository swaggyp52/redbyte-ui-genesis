// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.

export const BRIDGE_PROTOCOL_VERSION = 'rb-bridge.v1';

export type BridgeMessageType =
    | 'PING' | 'PONG'
    | 'ERROR'
    | 'CONNECT' | 'CONNECT_OK' | 'CONNECT_ERR'
    | 'DISCONNECT'
    | 'LIST_DEVICES' | 'LIST_DEVICES_OK'
    | 'SET_PINS' | 'GET_PINS' | 'GET_PINS_OK'
    | 'LOAD_PRESET' | 'LOAD_PRESET_OK'
    | 'UPLOAD_SKETCH' | 'UPLOAD_SKETCH_OK'
    | 'VERIFY_DEVICE' | 'VERIFY_DEVICE_OK'
    | 'status' // Async notifications
    | 'io:update'; // Async notifications

export interface BridgeMessage {
    v: string;
    id: number;
    type: BridgeMessageType;
    deviceId?: string; // Target device ID (e.g. 'uno', 'basys3')
    payload?: any;
    // Async notification fields (legacy/stream support)
    state?: string;
    hint?: string;
    error?: string;
    timestamp?: string;
    tick?: number;
    changes?: Record<string, number>;
    io?: Record<string, number>;
}

// Device Schema (Single Source of Truth)
export interface BridgeDevice {
    deviceId?: string; // 'uno', 'basys3', or undefined if unknown
    target: 'arduino-uno' | 'basys3' | 'unknown';
    port: string;
    manufacturer?: string;
    serialNumber?: string;
}

// Payloads
export interface ConnectPayload {
    target: string;
    port?: string;
    baud?: number;
}

export interface BridgeHealth {
    ok: boolean;
    status?: string;
    version: string;
    uptimeSec?: number;
    build?: string;
}

export interface SetPinsPayload {
    [key: string]: number | string;
}

export interface LoadPresetPayload {
    nodeId: string;
    presetId: string;
}

export interface UploadSketchPayload {
    sketchText: string;
    port: string;
    fqbn: string;
    compileOnly?: boolean;
}

export interface UploadSketchResponsePayload {
    ok: boolean;
    artifact?: {
        sketchSha256: string;
        fqbn: string;
        port: string;
    };
}
