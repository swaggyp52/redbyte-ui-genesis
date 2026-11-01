import { BRIDGE_PROTOCOL_VERSION } from '@redbyte/rb-protocol';
import type {
    BridgeMessageType, BridgeDevice, GetPinsResponsePayload, UploadSketchResponsePayload,
} from '@redbyte/rb-protocol';
import type { DeviceVerificationResult, TransportConnectOptions } from './types';

export { BRIDGE_PROTOCOL_VERSION };
export type {
    BridgeMessageType, BridgeDevice, ConnectPayload, SetPinsPayload, GetPinsResponsePayload,
    LoadPresetPayload, UploadSketchPayload, UploadSketchResponsePayload,
} from '@redbyte/rb-protocol';

/** Incoming JSON stays unknown until the particular operation validates its payload. */
export interface BridgeMessage {
    v: typeof BRIDGE_PROTOCOL_VERSION;
    id: number;
    type: BridgeMessageType;
    deviceId?: string;
    payload?: unknown;
}

export type BridgeRequest =
    | { type: 'AUTH'; payload: { token: string } }
    | { type: 'CONNECT'; payload: TransportConnectOptions }
    // Historical pushInteraction accepts numbers and sends those same numbers on the wire.
    | { type: 'SET_PINS'; payload: { nodeId: string; pins: Record<string, number> } }
    | { type: 'LOAD_PRESET'; payload: { nodeId: string; presetId: string } }
    | { type: 'UPLOAD_SKETCH'; payload: import('@redbyte/rb-protocol').UploadSketchPayload }
    | { type: 'GET_PINS' | 'LIST_DEVICES' | 'VERIFY_DEVICE' };

const messageTypes: ReadonlySet<string> = new Set<BridgeMessageType>([
    'PING', 'PONG', 'ERROR', 'AUTH', 'AUTH_OK', 'AUTH_ERR', 'CONNECT', 'CONNECT_OK', 'CONNECT_ERR',
    'DISCONNECT', 'LIST_DEVICES', 'LIST_DEVICES_OK', 'SET_PINS', 'SET_PINS_OK', 'GET_PINS', 'GET_PINS_OK',
    'LOAD_PRESET', 'LOAD_PRESET_OK', 'UPLOAD_SKETCH', 'UPLOAD_SKETCH_OK', 'VERIFY_DEVICE',
    'VERIFY_DEVICE_OK', 'status', 'io:update',
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isBridgeMessage(value: unknown): value is BridgeMessage {
    return isRecord(value) && value.v === BRIDGE_PROTOCOL_VERSION &&
        typeof value.id === 'number' && Number.isSafeInteger(value.id) && value.id >= 0 &&
        typeof value.type === 'string' && messageTypes.has(value.type) &&
        (value.deviceId === undefined || typeof value.deviceId === 'string');
}

export function isGetPinsResponse(value: unknown): value is GetPinsResponsePayload {
    return isRecord(value) && (value.deviceId === undefined || typeof value.deviceId === 'string') &&
        isRecord(value.pins) && Object.values(value.pins).every(pin => typeof pin === 'number' && Number.isFinite(pin));
}

function isBridgeDevice(value: unknown): value is BridgeDevice {
    return isRecord(value) && (value.target === 'basys3' || value.target === 'arduino-uno' || value.target === 'unknown') &&
        typeof value.port === 'string' &&
        (value.deviceId === undefined || typeof value.deviceId === 'string') &&
        (value.manufacturer === undefined || typeof value.manufacturer === 'string') &&
        (value.serialNumber === undefined || typeof value.serialNumber === 'string');
}

export function isDevicesResponse(value: unknown): value is { devices: BridgeDevice[] } {
    return isRecord(value) && Array.isArray(value.devices) && value.devices.every(isBridgeDevice);
}

export function isSketchUploadResponse(value: unknown): value is UploadSketchResponsePayload {
    if (!isRecord(value) || typeof value.ok !== 'boolean' ||
        (value.error !== undefined && typeof value.error !== 'string') ||
        (value.message !== undefined && typeof value.message !== 'string')) return false;
    return value.artifact === undefined || (isRecord(value.artifact) &&
        typeof value.artifact.sketchSha256 === 'string' && typeof value.artifact.fqbn === 'string' &&
        typeof value.artifact.port === 'string');
}

export function isDeviceVerificationResponse(value: unknown): value is DeviceVerificationResult {
    if (!isRecord(value) || typeof value.verified !== 'boolean' ||
        (value.details !== undefined && typeof value.details !== 'string') ||
        (value.message !== undefined && typeof value.message !== 'string')) return false;
    if (value.verified === false && typeof value.error === 'string') return true;
    return typeof value.board === 'string' && typeof value.port === 'string' &&
        typeof value.agent === 'string' && typeof value.timestamp === 'string';
}

export function responseError(value: unknown, fallback: string): string {
    if (isRecord(value)) {
        if (typeof value.message === 'string') return value.message;
        if (typeof value.error === 'string') return value.error;
    }
    return fallback;
}
