import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { WebSocketServer, WebSocket as NodeWS } from 'ws';
import { BridgeTransport } from '../transport/bridge-transport';
import { BRIDGE_PROTOCOL_VERSION } from '../transport/bridge-protocol';
describe('Phase 6: BridgeTransport Contract (v1)', () => {
    let wss;
    let receivedMessages = [];
    const PORT = 4243;
    const originalWebSocket = global.WebSocket;
    beforeAll(() => {
        console.log(`[MockServer] Starting on port ${PORT}...`);
        wss = new WebSocketServer({ port: PORT });
        wss.on('connection', (ws) => {
            console.log('[MockServer] Client connected');
            ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                console.log(`[MockServer] Received message: ${msg.type}`);
                receivedMessages.push(msg);
                // Auto-respond to some messages to keep the state machine moving
                if (msg.type === 'CONNECT') {
                    ws.send(JSON.stringify({
                        v: BRIDGE_PROTOCOL_VERSION,
                        id: msg.id,
                        type: 'CONNECT_OK',
                        payload: { deviceId: 'test-device' }
                    }));
                }
                else if (msg.type === 'GET_PINS') {
                    ws.send(JSON.stringify({
                        v: BRIDGE_PROTOCOL_VERSION,
                        id: msg.id,
                        type: 'GET_PINS_OK',
                        payload: { pins: { 'LED0': 1 } }
                    }));
                }
                else if (msg.type === 'LOAD_PRESET') {
                    ws.send(JSON.stringify({
                        v: BRIDGE_PROTOCOL_VERSION,
                        id: msg.id,
                        type: 'LOAD_PRESET_OK'
                    }));
                }
            });
        });
    });
    afterAll(() => {
        wss.close();
    });
    afterEach(() => {
        global.WebSocket = originalWebSocket;
    });
    it('should connect, handshake, and handle interactions', async () => {
        global.WebSocket = NodeWS;
        const transport = new BridgeTransport(`ws://localhost:${PORT}`);
        await transport.connect();
        expect(transport.getStatus().connected).toBe(true);
        // 1. SET_PINS
        transport.pushInteraction('fpga-1', 'SW0', 1);
        // Wait a bit for WS message to propagate
        await new Promise(r => setTimeout(r, 150));
        const setPinsMsg = receivedMessages.find(m => m.type === 'SET_PINS');
        expect(setPinsMsg).toBeDefined();
        expect(setPinsMsg?.payload.pins['SW0']).toBe(1);
        // 2. LOAD_PRESET
        transport.loadPreset('fpga-1', 'blink');
        await new Promise(r => setTimeout(r, 150));
        const loadPresetMsg = receivedMessages.find(m => m.type === 'LOAD_PRESET');
        expect(loadPresetMsg).toBeDefined();
        expect(loadPresetMsg?.payload.presetId).toBe('blink');
        // 3. POLLING
        const getPinsMsg = receivedMessages.find(m => m.type === 'GET_PINS');
        expect(getPinsMsg).toBeDefined();
        const outputs = transport.poll();
        expect(outputs['fpga-1:LED0']).toBe(1);
        await transport.disconnect();
        expect(transport.getStatus().connected).toBe(false);
    });
    it('should connect to Arduino UNO on specified port', async () => {
        global.WebSocket = NodeWS;
        receivedMessages = [];
        const transport = new BridgeTransport(`ws://localhost:${PORT}`);
        await transport.connect({ target: 'arduino-uno', port: 'COM6' });
        expect(transport.getStatus().connected).toBe(true);
        const connectMsg = receivedMessages.find(m => m.type === 'CONNECT');
        expect(connectMsg?.payload.target).toBe('arduino-uno');
        expect(connectMsg?.payload.port).toBe('COM6');
        await transport.disconnect();
    });
});
