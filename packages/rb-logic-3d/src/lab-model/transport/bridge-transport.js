import { BRIDGE_PROTOCOL_VERSION } from './bridge-protocol';
export class BridgeTransport {
    type = 'bridge';
    ws = null;
    connected = false;
    isVerified = false;
    msgId = 0;
    pendingResponses = new Map();
    lastPollOutputs = {};
    currentNodeId = null;
    pollInterval = null;
    reconnectTimeout = null;
    error = undefined;
    url;
    options = { target: 'basys3' };
    reconnectAttempts = 0;
    deviceId;
    constructor(baseUrl = 'http://localhost:4242', deviceId = 'default') {
        const wsBase = baseUrl.replace(/^http/, 'ws');
        this.url = `${wsBase}/ws`;
        this.deviceId = deviceId;
    }
    async connect(options) {
        const isTestEnv = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
            (typeof import.meta !== 'undefined' && import.meta.env?.VITEST);
        const shouldLog = !isTestEnv;
        if (options)
            this.options = options;
        if (this.connected && this.ws?.readyState === WebSocket.OPEN)
            return;
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
                    const msg = JSON.parse(event.data);
                    if (this.pendingResponses.has(msg.id)) {
                        const handler = this.pendingResponses.get(msg.id);
                        this.pendingResponses.delete(msg.id);
                        handler(msg.payload);
                    }
                    else if (msg.type === 'GET_PINS_OK') {
                        const payload = msg.payload;
                        // Map local pin IDs to "nodeId:pinId"
                        if (this.currentNodeId) {
                            const mapped = {};
                            Object.entries(payload.pins).forEach(([pinId, val]) => {
                                mapped[`${this.currentNodeId}:${pinId}`] = val;
                            });
                            this.lastPollOutputs = mapped;
                        }
                    }
                }
                catch (e) {
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
    handleDisconnect() {
        const isTestEnv = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
            (typeof import.meta !== 'undefined' && import.meta.env?.VITEST);
        this.connected = false;
        this.isVerified = false;
        this.stopPolling();
        if (this.reconnectTimeout)
            return; // Already scheduled
        if (isTestEnv)
            return;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        console.log(`[Bridge] Disconnected. Reconnecting in ${delay}ms...`);
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect(this.options);
        }, delay);
    }
    startPolling() {
        if (this.pollInterval)
            clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => {
            if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
                this.sendMessage('GET_PINS');
            }
        }, 50); // Match store tick rate
    }
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    async disconnect() {
        console.log('[Bridge] Disconnecting...');
        this.stopPolling();
        if (this.reconnectTimeout)
            clearTimeout(this.reconnectTimeout);
        this.connected = false;
        this.isVerified = false;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    getStatus() {
        return {
            type: 'bridge',
            connected: this.connected,
            deviceVerified: this.isVerified,
            error: this.error
        };
    }
    pushInteraction(nodeId, pinId, value) {
        this.currentNodeId = nodeId;
        if (!this.connected)
            return;
        this.sendMessage('SET_PINS', {
            nodeId,
            pins: { [pinId]: value }
        });
    }
    loadPreset(nodeId, presetId) {
        this.currentNodeId = nodeId;
        if (!this.connected)
            return;
        this.sendMessage('LOAD_PRESET', { nodeId, presetId });
    }
    async uploadSketch(payload) {
        if (!this.connected)
            return { ok: false, message: 'Not connected to bridge agent' };
        return this.sendRequest('UPLOAD_SKETCH', payload);
    }
    async listDevices() {
        try {
            const httpUrl = this.url.replace('/ws', '').replace(/^ws/, 'http');
            const res = await fetch(`${httpUrl}/devices`);
            if (res.ok) {
                const data = await res.json();
                return data.devices || [];
            }
        }
        catch (e) {
            console.warn('[Bridge] HTTP device discovery failed, falling back to WS', e);
        }
        if (!this.connected)
            return [];
        const res = await this.sendRequest('LIST_DEVICES');
        return res?.devices || [];
    }
    async verifyDevice() {
        if (!this.connected)
            return { verified: false, error: 'Not connected to bridge agent' };
        const result = await this.sendRequest('VERIFY_DEVICE');
        if (result?.verified) {
            this.isVerified = true;
        }
        return result;
    }
    poll() {
        return this.lastPollOutputs;
    }
    sendMessage(type, payload) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            return;
        const msg = {
            v: BRIDGE_PROTOCOL_VERSION,
            id: ++this.msgId,
            type,
            deviceId: this.deviceId,
            payload
        };
        this.ws.send(JSON.stringify(msg));
    }
    sendRequest(type, payload) {
        return new Promise((resolve) => {
            const id = ++this.msgId;
            this.pendingResponses.set(id, resolve);
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                this.pendingResponses.delete(id);
                resolve(null);
                return;
            }
            const msg = {
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
