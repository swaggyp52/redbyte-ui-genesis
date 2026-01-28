export const BRIDGE_PROTOCOL_VERSION = 'rb-bridge.v1';

export type BridgeMessageType =
    | 'PING'
    | 'PONG'
    | 'CONNECT'
    | 'CONNECT_OK'
    | 'CONNECT_ERR'
    | 'DISCONNECT'
    | 'SET_PINS'
    | 'GET_PINS'
    | 'GET_PINS_OK'
    | 'LOAD_PRESET'
    | 'LOAD_PRESET_OK'
    | 'ERROR'
    | 'LIST_DEVICES'
    | 'LIST_DEVICES_OK'
    | 'UPLOAD_SKETCH'
    | 'UPLOAD_SKETCH_OK';

export interface ConnectPayload {
    target: 'basys3' | 'arduino-uno';
    port?: string;
    baud?: number;
}

export interface BridgeMessage {
    v: typeof BRIDGE_PROTOCOL_VERSION;
    id: number;
    type: BridgeMessageType;
    payload?: any;
}

export interface SetPinsPayload {
    nodeId: string;
    pins: Record<string, 0 | 1>;
}

export interface GetPinsResponsePayload {
    pins: Record<string, number>; // "pinId" -> value
}

export interface LoadPresetPayload {
    nodeId: string;
    presetId: string;
}

export interface UploadSketchPayload {
    target: 'arduino-uno' | 'arduino-nano';
    port: string;
    fqbn: string;
    sketchText: string;
    compileOnly?: boolean;
}

export interface UploadSketchResponsePayload {
    ok: boolean;
    artifact?: {
        sketchSha256: string;
        fqbn: string;
        port: string;
    };
    error?: string;
}
