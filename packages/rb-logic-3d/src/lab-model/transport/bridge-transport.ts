import { LabTransport, TransportStatus } from './types';
import {
    BridgeMessage,
    BRIDGE_PROTOCOL_VERSION,
    BridgeMessageType,
    GetPinsResponsePayload
} from './bridge-protocol';

export class BridgeTransport implements LabTransport {
    public readonly type = 'bridge';
    private ws: WebSocket | null = null;
    private connected: boolean = false;
    private isVerified: boolean = false;
    private msgId: number = 0;
    private pendingResponses: Map<number, (payload: any) => void> = new Map();
    private lastPollOutputs: Record<string, number> = {};
    private currentNodeId: string | null = null;
    private pollInterval: any = null;
    private reconnectTimeout: any = null;
    private error: string | undefined = undefined;
    private url: string;
    private options: any = { target: 'basys3' };
    private reconnectAttempts: number = 0;
    private deviceId: string;

    constructor(baseUrl: string = 'http://localhost:4242', deviceId: string = 'default') {
        const wsBase = baseUrl.replace(/^http/, 'ws');
        this.url = `${wsBase}/ws`;
        this.deviceId = deviceId;
    }

    async connect(options?: { target: 'basys3' | 'arduino-uno', port?: string, baud?: number }): Promise<void> {
        const isTestEnv = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
            !!import.meta.env.VITEST;
        const shouldLog = !isTestEnv;
        if (options) this.options = options;
        if (this.connected && this.ws?.readyState === WebSocket.OPEN) return;
        return new Promise((resolve) => {
            if (shouldLog) {
                console.log(`[Bridge] Connecting to ${this.url} (target: ${this.options.target})...`);
            }
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                if (shouldLog) {
                    console.log('[Bridge] WebSocket Connected');
                }
                this.connected = true;
                this.error = undefined;

                // Send initial CONNECT with target/options
                this.sendRequest('CONNECT', this.options).then((payload) => {
                    if (shouldLog) {
                        console.log('[Bridge] Handshake OK:', payload);
                    }
                    this.reconnectAttempts = 0; // Reset on success
                    // Start polling
                    this.startPolling();
                    resolve();
                });
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg: BridgeMessage = JSON.parse(event.data);
                    if (this.pendingResponses.has(msg.id)) {
                        const handler = this.pendingResponses.get(msg.id)!;
                        this.pendingResponses.delete(msg.id);
                        handler(msg.payload);
                    } else if (msg.type === 'GET_PINS_OK') {
                        const payload = msg.payload as GetPinsResponsePayload;
                        // Map local pin IDs to "nodeId:pinId"
                        if (this.currentNodeId) {
                            const mapped: Record<string, number> = {};
                            Object.entries(payload.pins).forEach(([pinId, val]) => {
                                mapped[`${this.currentNodeId}:${pinId}`] = val;
                            });
                            this.lastPollOutputs = mapped;
                        }
                    }
                } catch (e) {
                    if (shouldLog) {
                        console.error('[Bridge] Failed to parse message:', e);
                    }
                }
            };

            this.ws.onclose = () => {
                if (shouldLog) {
                    console.log('[Bridge] WebSocket Closed');
                }
                this.handleDisconnect();
            };

            this.ws.onerror = (err) => {
                if (shouldLog) {
                    console.error('[Bridge] WebSocket Error:', err);
                }
                this.error = 'Failed to connect to Bridge Agent';
                this.handleDisconnect();
                resolve(); // Resolve anyway to avoid hanging store
            };
        });
    }

    private handleDisconnect() {
        const isTestEnv = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
            !!import.meta.env.VITEST;
        this.connected = false;
        this.isVerified = false;
        this.stopPolling();
        if (this.reconnectTimeout) return; // Already scheduled
        if (isTestEnv) return;

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;

        console.log(`[Bridge] Disconnected. Reconnecting in ${delay}ms...`);
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect(this.options);
        }, delay);
    }

    private startPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => {
            if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
                this.sendMessage('GET_PINS');
            }
        }, 50); // Match store tick rate
    }

    private stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    async disconnect(): Promise<void> {
        console.log('[Bridge] Disconnecting...');
        this.stopPolling();
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.connected = false;
        this.isVerified = false;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    getStatus(): TransportStatus {
        return {
            type: 'bridge',
            connected: this.connected,
            deviceVerified: this.isVerified,
            error: this.error
        };
    }

    pushInteraction(nodeId: string, pinId: string, value: number): void {
        this.currentNodeId = nodeId;
        if (!this.connected) return;
        this.sendMessage('SET_PINS', {
            nodeId,
            pins: { [pinId]: value }
        });
    }

    loadPreset(nodeId: string, presetId: string): void {
        this.currentNodeId = nodeId;
        if (!this.connected) return;
        this.sendMessage('LOAD_PRESET', { nodeId, presetId });
    }

    async uploadSketch(payload: any): Promise<any> {
        if (!this.connected) return { ok: false, message: 'Not connected to bridge agent' };
        return this.sendRequest('UPLOAD_SKETCH', payload);
    }

    async listDevices(): Promise<any> {
        try {
            const httpUrl = this.url.replace('/ws', '').replace(/^ws/, 'http');
            const res = await fetch(`${httpUrl}/devices`);
            if (res.ok) {
                const data = await res.json();
                return data.devices || [];
            }
        } catch (e) {
            console.warn('[Bridge] HTTP device discovery failed, falling back to WS', e);
        }

        if (!this.connected) return [];
        const res = await this.sendRequest('LIST_DEVICES');
        return res?.devices || [];
    }

    async verifyDevice(): Promise<any> {
        if (!this.connected) return { verified: false, error: 'Not connected to bridge agent' };
        const result = await this.sendRequest('VERIFY_DEVICE');
        if (result?.verified) {
            this.isVerified = true;
        }
        return result;
    }

    poll(): Record<string, number> {
        return this.lastPollOutputs;
    }

    private sendMessage(type: BridgeMessageType, payload?: any) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg: BridgeMessage = {
            v: BRIDGE_PROTOCOL_VERSION,
            id: ++this.msgId,
            type,
            deviceId: this.deviceId,
            payload
        };
        this.ws.send(JSON.stringify(msg));
    }

    private sendRequest(type: BridgeMessageType, payload?: any): Promise<any> {
        return new Promise((resolve) => {
            const id = ++this.msgId;
            this.pendingResponses.set(id, resolve);
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                this.pendingResponses.delete(id);
                resolve(null);
                return;
            }
            const msg: BridgeMessage = {
                v: BRIDGE_PROTOCOL_VERSION,
                id,
                type,
                deviceId: this.deviceId,
                payload
            };
            this.ws.send(JSON.stringify(msg));
        });
    }
}

