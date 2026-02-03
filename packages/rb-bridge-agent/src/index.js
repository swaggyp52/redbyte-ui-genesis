import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { SerialPort } from 'serialport';
import { BRIDGE_PROTOCOL_VERSION } from '@redbyte/rb-protocol';
import { MockBasys3Backend } from './backends/mock-basys3.js';
import { ArduinoUnoBackend } from './backends/arduino-uno.js';
import { Basys3Backend } from './backends/basys3.js';
import { ArduinoCliUploader } from './uploader/arduino-cli.js';
const PORT = 4242;
const uploader = new ArduinoCliUploader();
const app = express();
app.use(cors());
// Health check
app.get('/health', (req, res) => {
    const health = {
        ok: true,
        version: BRIDGE_PROTOCOL_VERSION,
        status: 'ok'
    };
    res.json(health);
});
// Device discovery
app.get('/devices', async (req, res) => {
    try {
        const ports = await SerialPort.list();
        const devices = ports.map(p => {
            let target = 'unknown';
            if (p.productId === '0043' || (p.manufacturer && p.manufacturer.includes('Arduino'))) {
                target = 'arduino-uno';
            }
            else if (p.manufacturer && (p.manufacturer.includes('FTDI') || p.manufacturer.includes('Digilent'))) {
                target = 'basys3';
            }
            return {
                target,
                port: p.path,
                manufacturer: p.manufacturer || 'unknown',
                serialNumber: p.serialNumber,
                deviceId: target === 'unknown' ? undefined : (target === 'arduino-uno' ? 'uno' : 'basys3')
            };
        });
        res.json({ devices });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
const server = app.listen(PORT, () => {
    console.log(`[Bridge Agent] Listening on http://localhost:${PORT}`);
});
const wss = new WebSocketServer({ server, path: '/ws' });
const backends = new Map();
const connecting = new Set();
/** Tracks which COM port paths are currently open or being opened. Prevents double-open. */
const lockedPorts = new Map(); // portPath → deviceId
wss.on('connection', (ws) => {
    console.log('[Bridge Agent] Client connected via WebSocket');
    ws.on('message', async (data) => {
        console.log('[Bridge DEBUG] Raw message received:', data.toString());
        try {
            const msg = JSON.parse(data.toString());
            if (msg.v !== BRIDGE_PROTOCOL_VERSION) {
                console.warn(`[Bridge Agent] Protocol version mismatch: expected ${BRIDGE_PROTOCOL_VERSION}, got ${msg.v}`);
                return;
            }
            const deviceId = msg.deviceId || 'default';
            const activeBackend = backends.get(deviceId);
            console.log(`[Bridge DEBUG] Processing ${msg.type} for ${deviceId} (ID: ${msg.id})`);
            switch (msg.type) {
                case 'PING':
                    sendResponse(ws, msg.id, 'PONG');
                    break;
                case 'CONNECT': {
                    const payload = msg.payload;
                    console.log(`[Bridge Agent] Connect request for target: ${payload.target} on ${deviceId}`);
                    if (connecting.has(deviceId)) {
                        console.warn(`[Bridge Agent] Connection to ${deviceId} already in progress.`);
                        sendResponse(ws, msg.id, 'CONNECT_ERR', { message: 'Connection in progress' });
                        break;
                    }
                    try {
                        const existing = backends.get(deviceId);
                        // DE-DUPE: If already connected to the same port/target, return OK immediately
                        if (existing) {
                            console.log(`[Bridge Agent] Device ${deviceId} already active, reusing connection.`);
                            sendResponse(ws, msg.id, 'CONNECT_OK', { target: payload.target, reused: true });
                            break;
                        }
                        // COM port mutex: prevent double-open of the same physical port
                        const portPath = payload.port || (payload.target === 'basys3' ? 'COM7' : 'COM6');
                        const portOwner = lockedPorts.get(portPath);
                        if (portOwner && portOwner !== deviceId) {
                            console.warn(`[Bridge Agent] Port ${portPath} already locked by ${portOwner}, rejecting ${deviceId}`);
                            sendResponse(ws, msg.id, 'CONNECT_ERR', {
                                message: `Port ${portPath} is already in use by device "${portOwner}"`
                            });
                            break;
                        }
                        connecting.add(deviceId);
                        lockedPorts.set(portPath, deviceId);
                        let backend;
                        if (payload.target === 'arduino-uno' || payload.target === 'arduino-nano') {
                            backend = new ArduinoUnoBackend({
                                port: portPath,
                                baud: payload.baud || 115200
                            });
                            await backend.connect();
                        }
                        else if (payload.target === 'basys3') {
                            backend = new Basys3Backend({
                                port: portPath,
                                baud: payload.baud || 115200
                            });
                            await backend.connect();
                        }
                        else {
                            backend = new MockBasys3Backend();
                        }
                        backends.set(deviceId, backend);
                        sendResponse(ws, msg.id, 'CONNECT_OK', { target: payload.target });
                    }
                    catch (err) {
                        // Release port lock on connection failure
                        const portPath = payload.port || (payload.target === 'basys3' ? 'COM7' : 'COM6');
                        lockedPorts.delete(portPath);
                        sendResponse(ws, msg.id, 'CONNECT_ERR', { message: err.message });
                    }
                    finally {
                        connecting.delete(deviceId);
                    }
                    break;
                }
                case 'SET_PINS':
                    if (activeBackend) {
                        activeBackend.setPins(msg.payload);
                    }
                    break;
                case 'GET_PINS':
                    if (activeBackend) {
                        const pins = await activeBackend.getPins();
                        sendResponse(ws, msg.id, 'GET_PINS_OK', { deviceId, pins });
                    }
                    break;
                case 'LOAD_PRESET':
                    if (activeBackend) {
                        const loadPayload = msg.payload;
                        activeBackend.loadPreset(loadPayload.nodeId, loadPayload.presetId);
                        sendResponse(ws, msg.id, 'LOAD_PRESET_OK');
                    }
                    break;
                case 'UPLOAD_SKETCH': {
                    const payload = msg.payload;
                    console.log(`[Bridge Agent] Upload request for ${payload.target} on ${payload.port}`);
                    const result = await uploader.upload(payload.sketchText, payload.port, payload.fqbn, payload.compileOnly);
                    if (result.ok) {
                        const response = {
                            ok: true,
                            artifact: {
                                sketchSha256: result.sketchSha256,
                                fqbn: payload.fqbn,
                                port: payload.port
                            }
                        };
                        sendResponse(ws, msg.id, 'UPLOAD_SKETCH_OK', response);
                    }
                    else {
                        sendResponse(ws, msg.id, 'ERROR', {
                            errorCode: result.error,
                            message: result.message || 'Upload failed'
                        });
                    }
                    break;
                }
                case 'LIST_DEVICES': {
                    try {
                        const ports = await SerialPort.list();
                        const devices = ports.map(p => {
                            let target = 'unknown';
                            if (p.productId === '0043' || (p.manufacturer && p.manufacturer.includes('Arduino'))) {
                                target = 'arduino-uno';
                            }
                            else if (p.manufacturer && (p.manufacturer.includes('FTDI') || p.manufacturer.includes('Digilent'))) {
                                target = 'basys3';
                            }
                            return {
                                target,
                                port: p.path,
                                manufacturer: p.manufacturer || 'unknown',
                                serialNumber: p.serialNumber,
                                deviceId: target === 'unknown' ? undefined : (target === 'arduino-uno' ? 'uno' : 'basys3')
                            };
                        });
                        sendResponse(ws, msg.id, 'LIST_DEVICES_OK', { devices });
                    }
                    catch (err) {
                        sendResponse(ws, msg.id, 'ERROR', { message: err.message });
                    }
                    break;
                }
                case 'VERIFY_DEVICE': {
                    if (activeBackend && typeof activeBackend.verify === 'function') {
                        const result = await activeBackend.verify();
                        sendResponse(ws, msg.id, 'VERIFY_DEVICE_OK', result);
                    }
                    else {
                        sendResponse(ws, msg.id, 'ERROR', { message: 'Active backend does not support verification' });
                    }
                    break;
                }
                case 'DISCONNECT':
                    console.log(`[Bridge Agent] Client requested disconnect for ${deviceId}`);
                    if (activeBackend && typeof activeBackend.disconnect === 'function') {
                        await activeBackend.disconnect();
                    }
                    backends.delete(deviceId);
                    // Release COM port lock for this device
                    for (const [port, owner] of lockedPorts) {
                        if (owner === deviceId) {
                            lockedPorts.delete(port);
                            console.log(`[Bridge Agent] Released port lock ${port} for ${deviceId}`);
                        }
                    }
                    sendResponse(ws, msg.id, 'PONG'); // Simple ACK
                    break;
                default:
                    console.warn(`[Bridge Agent] Unknown message type: ${msg.type}`);
                    sendResponse(ws, msg.id, 'ERROR', { message: `Unknown message type: ${msg.type}` });
            }
        }
        catch (err) {
            console.error('[Bridge Agent] Failed to parse message:', err);
        }
    });
    ws.on('close', () => {
        console.log('[Bridge Agent] Client disconnected');
    });
});
function sendResponse(ws, id, type, payload) {
    const response = {
        v: BRIDGE_PROTOCOL_VERSION,
        id,
        type,
        payload
    };
    ws.send(JSON.stringify(response));
}
