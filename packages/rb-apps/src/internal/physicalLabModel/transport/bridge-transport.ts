import type {
    LabTransport, TransportStatus, TransportConnectOptions, DeviceVerificationResult,
} from './types';
import type { BridgeDevice, UploadSketchPayload, UploadSketchResponsePayload } from '@redbyte/rb-protocol';
import {
    BRIDGE_PROTOCOL_VERSION, isBridgeMessage, isGetPinsResponse, isDevicesResponse,
    isSketchUploadResponse, isDeviceVerificationResponse, responseError,
} from './bridge-protocol';
import type { BridgeMessage, BridgeRequest } from './bridge-protocol';

export class BridgeTransport implements LabTransport {
    public readonly type = 'bridge';
    private ws: WebSocket | null = null;
    private connected = false;
    private isVerified = false;
    private msgId = 0;
    private pendingResponses = new Map<number, (message: BridgeMessage | null) => void>();
    private lastPollOutputs: Record<string, number> = {};
    private currentNodeId: string | null = null;
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private error: string | undefined;
    private url: string;
    private options: TransportConnectOptions = { target: 'basys3' };
    private reconnectAttempts = 0;
    private deviceId: string;
    private token: string;
    private wantsReconnect = false;
    private connectInFlight: Promise<void> | null = null;
    private settleConnection: (() => void) | null = null;

    constructor(baseUrl = 'http://localhost:4242', deviceId = 'default', token?: string) {
        this.url = `${baseUrl.replace(/^http/, 'ws')}/ws`;
        this.deviceId = deviceId;
        this.token = token || (typeof process !== 'undefined' ? process.env.RB_BRIDGE_TOKEN : undefined) || 'default-dev-token';
    }

    private isTestEnvironment(): boolean {
        return (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') || !!import.meta.env.VITEST;
    }

    async connect(options?: TransportConnectOptions): Promise<void> {
        if (options) this.options = options;
        this.wantsReconnect = true;
        if (this.connected && this.ws?.readyState === WebSocket.OPEN) return;
        if (this.connectInFlight) return this.connectInFlight;
        const connection = new Promise<void>((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                if (this.settleConnection === finish) this.settleConnection = null;
                resolve();
            };
            this.settleConnection = finish;
            const socket = new WebSocket(this.url);
            this.ws = socket;
            socket.onopen = () => {
                if (this.ws !== socket || !this.wantsReconnect) return;
                // An open socket is not yet an authenticated device connection.
                this.error = undefined;
                this.sendRequest({ type: 'AUTH', payload: { token: this.token } }).then((auth) => {
                    if (auth?.type !== 'AUTH_OK') throw new Error(responseError(auth?.payload, 'Bridge authentication failed'));
                    if (this.ws !== socket || !this.wantsReconnect) return null;
                    return this.sendRequest({ type: 'CONNECT', payload: this.options });
                }).then((ack) => {
                    if (this.ws !== socket || !this.wantsReconnect) return;
                    if (ack?.type !== 'CONNECT_OK') throw new Error(responseError(ack?.payload, 'Bridge connection failed'));
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this.startPolling();
                    finish();
                }).catch((err: unknown) => {
                    if (this.ws !== socket) return;
                    this.error = err instanceof Error ? err.message : 'Failed to authenticate with Bridge Agent';
                    this.handleDisconnect(socket);
                    socket.close();
                });
            };
            socket.onmessage = (event: MessageEvent<unknown>) => {
                if (this.ws !== socket || typeof event.data !== 'string') return;
                try {
                    const value: unknown = JSON.parse(event.data);
                    if (!isBridgeMessage(value)) return;
                    const handler = this.pendingResponses.get(value.id);
                    if (handler) {
                        handler(value);
                    } else if (value.type === 'GET_PINS_OK' && isGetPinsResponse(value.payload) && this.currentNodeId) {
                        const mapped: Record<string, number> = {};
                        for (const [pinId, pinValue] of Object.entries(value.payload.pins)) {
                            mapped[`${this.currentNodeId}:${pinId}`] = pinValue;
                        }
                        this.lastPollOutputs = mapped;
                    }
                } catch (error: unknown) {
                    if (!this.isTestEnvironment()) console.error('[Bridge] Failed to parse message:', error);
                }
            };
            socket.onclose = () => this.handleDisconnect(socket);
            socket.onerror = () => {
                if (this.ws !== socket) return;
                this.error = 'Failed to connect to Bridge Agent';
                this.handleDisconnect(socket);
                socket.close();
            };
        });
        this.connectInFlight = connection;
        try {
            await connection;
        } finally {
            if (this.connectInFlight === connection) this.connectInFlight = null;
        }
    }

    private settlePendingRequests(): void {
        // Each handler owns and clears its request timeout before resolving.
        for (const handler of [...this.pendingResponses.values()]) handler(null);
    }

    private handleDisconnect(socket: WebSocket): void {
        if (this.ws !== socket) return;
        this.ws = null;
        this.connected = false;
        this.isVerified = false;
        this.stopPolling();
        this.settlePendingRequests();
        this.settleConnection?.();
        if (!this.wantsReconnect || this.reconnectTimeout !== null || this.isTestEnvironment()) return;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            if (this.wantsReconnect) void this.connect(this.options);
        }, delay);
    }

    private startPolling(): void {
        this.stopPolling();
        this.pollInterval = setInterval(() => {
            if (this.connected && this.ws?.readyState === WebSocket.OPEN) this.sendMessage({ type: 'GET_PINS' });
        }, 50);
    }

    private stopPolling(): void {
        if (this.pollInterval !== null) clearInterval(this.pollInterval);
        this.pollInterval = null;
    }

    async disconnect(): Promise<void> {
        this.wantsReconnect = false;
        this.stopPolling();
        if (this.reconnectTimeout !== null) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
        this.connected = false;
        this.isVerified = false;
        this.settlePendingRequests();
        this.settleConnection?.();
        const socket = this.ws;
        this.ws = null;
        if (socket) socket.close();
    }

    getStatus(): TransportStatus {
        return { type: 'bridge', connected: this.connected, deviceVerified: this.isVerified, error: this.error };
    }

    pushInteraction(nodeId: string, pinId: string, value: number): void {
        this.currentNodeId = nodeId;
        if (!this.connected) return;
        this.sendMessage({ type: 'SET_PINS', payload: { nodeId, pins: { [pinId]: value } } });
    }

    loadPreset(nodeId: string, presetId: string): void {
        this.currentNodeId = nodeId;
        if (!this.connected) return;
        this.sendMessage({ type: 'LOAD_PRESET', payload: { nodeId, presetId } });
    }

    async uploadSketch(payload: UploadSketchPayload): Promise<UploadSketchResponsePayload> {
        if (!this.connected) return { ok: false, message: 'Not connected to bridge agent' };
        const response = await this.sendRequest({ type: 'UPLOAD_SKETCH', payload });
        if (response?.type === 'UPLOAD_SKETCH_OK' && isSketchUploadResponse(response.payload)) return response.payload;
        return { ok: false, message: responseError(response?.payload, 'Invalid or missing bridge upload response') };
    }

    async listDevices(): Promise<BridgeDevice[]> {
        try {
            const httpUrl = this.url.replace('/ws', '').replace(/^ws/, 'http');
            const response = await fetch(`${httpUrl}/devices`);
            if (response.ok) {
                const value: unknown = await response.json();
                if (isDevicesResponse(value)) return value.devices;
            }
        } catch (error: unknown) {
            if (!this.isTestEnvironment()) console.warn('[Bridge] HTTP device discovery failed, falling back to WS', error);
        }
        if (!this.connected) return [];
        const response = await this.sendRequest({ type: 'LIST_DEVICES' });
        return response?.type === 'LIST_DEVICES_OK' && isDevicesResponse(response.payload) ? response.payload.devices : [];
    }

    async verifyDevice(): Promise<DeviceVerificationResult> {
        if (!this.connected) return { verified: false, error: 'Not connected to bridge agent' };
        const response = await this.sendRequest({ type: 'VERIFY_DEVICE' });
        if (response?.type === 'VERIFY_DEVICE_OK' && isDeviceVerificationResponse(response.payload)) {
            this.isVerified = response.payload.verified;
            return response.payload;
        }
        this.isVerified = false;
        return { verified: false, error: responseError(response?.payload, 'Invalid or missing bridge verification response') };
    }

    poll(): Record<string, number> {
        return this.lastPollOutputs;
    }

    private makeMessage(request: BridgeRequest, id: number): BridgeMessage {
        return {
            v: BRIDGE_PROTOCOL_VERSION, id, type: request.type, deviceId: this.deviceId,
            payload: 'payload' in request ? request.payload : undefined,
        };
    }

    private sendMessage(request: BridgeRequest): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify(this.makeMessage(request, ++this.msgId)));
    }

    private sendRequest(request: BridgeRequest): Promise<BridgeMessage | null> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.resolve(null);
        const socket = this.ws;
        return new Promise((resolve) => {
            const id = ++this.msgId;
            const timeout = setTimeout(() => {
                this.pendingResponses.delete(id);
                resolve(null);
            }, 5000);
            const handler = (response: BridgeMessage | null) => {
                clearTimeout(timeout);
                this.pendingResponses.delete(id);
                resolve(response);
            };
            this.pendingResponses.set(id, handler);
            try {
                socket.send(JSON.stringify(this.makeMessage(request, id)));
            } catch {
                handler(null);
            }
        });
    }
}
