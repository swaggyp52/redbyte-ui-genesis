
import express, { Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { SerialPort } from 'serialport';
import {
    BRIDGE_PROTOCOL_VERSION,
    BridgeMessage,
    BridgeMessageType,
    SetPinsPayload,
    LoadPresetPayload,
    ConnectPayload,
    UploadSketchPayload,
    UploadSketchResponsePayload
} from './protocol.js';
import { MockBasys3Backend } from './backends/mock-basys3.js';
import { ArduinoUnoBackend } from './backends/arduino-uno.js';
import { ArduinoCliUploader } from './uploader/arduino-cli.js';

const PORT = 4242;
const uploader = new ArduinoCliUploader();
const app = express();
app.use(cors());

// Health check
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', version: BRIDGE_PROTOCOL_VERSION });
});

const server = app.listen(PORT, () => {
    console.log(`[Bridge Agent] Listening on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server, path: '/ws' });

let activeBackend: any = new MockBasys3Backend();

wss.on('connection', (ws: WebSocket) => {
    console.log('[Bridge Agent] Client connected via WebSocket');

    ws.on('message', async (data: string) => {
        try {
            const msg: BridgeMessage = JSON.parse(data.toString());

            if (msg.v !== BRIDGE_PROTOCOL_VERSION) {
                console.warn(`[Bridge Agent] Protocol version mismatch: expected ${BRIDGE_PROTOCOL_VERSION}, got ${msg.v}`);
                return;
            }

            switch (msg.type) {
                case 'PING':
                    sendResponse(ws, msg.id, 'PONG');
                    break;

                case 'CONNECT': {
                    const payload = msg.payload as ConnectPayload;
                    console.log(`[Bridge Agent] Connect request for target: ${payload.target}`);

                    try {
                        if (activeBackend && typeof activeBackend.disconnect === 'function') {
                            await activeBackend.disconnect();
                        }

                        if (payload.target === 'arduino-uno' || payload.target === 'arduino-nano') {
                            activeBackend = new ArduinoUnoBackend({
                                port: payload.port || 'COM6',
                                baud: payload.baud || 115200
                            });
                            await activeBackend.connect();
                        } else {
                            activeBackend = new MockBasys3Backend();
                        }

                        sendResponse(ws, msg.id, 'CONNECT_OK', { target: payload.target });
                    } catch (err: any) {
                        sendResponse(ws, msg.id, 'CONNECT_ERR', { message: err.message });
                    }
                    break;
                }

                case 'SET_PINS':
                    if (activeBackend) {
                        activeBackend.setPins(msg.payload as SetPinsPayload);
                    }
                    break;

                case 'GET_PINS':
                    if (activeBackend) {
                        const pins = await activeBackend.getPins();
                        sendResponse(ws, msg.id, 'GET_PINS_OK', { pins });
                    }
                    break;

                case 'LOAD_PRESET':
                    if (activeBackend) {
                        const loadPayload = msg.payload as LoadPresetPayload;
                        activeBackend.loadPreset(loadPayload.nodeId, loadPayload.presetId);
                        sendResponse(ws, msg.id, 'LOAD_PRESET_OK');
                    }
                    break;

                case 'UPLOAD_SKETCH': {
                    const payload = msg.payload as UploadSketchPayload;
                    console.log(`[Bridge Agent] Upload request for ${payload.target} on ${payload.port}`);

                    const result = await uploader.upload(
                        payload.sketchText,
                        payload.port,
                        payload.fqbn,
                        payload.compileOnly
                    );

                    if (result.ok) {
                        const response: UploadSketchResponsePayload = {
                            ok: true,
                            artifact: {
                                sketchSha256: result.sketchSha256!,
                                fqbn: payload.fqbn,
                                port: payload.port
                            }
                        };
                        sendResponse(ws, msg.id, 'UPLOAD_SKETCH_OK', response);
                    } else {
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
                        const devices = ports.map(p => ({
                            target: p.productId === '0043' || p.manufacturer?.includes('Arduino') ? 'arduino-uno' : 'unknown',
                            port: p.path,
                            manufacturer: p.manufacturer
                        }));
                        sendResponse(ws, msg.id, 'LIST_DEVICES_OK', { devices });
                    } catch (err: any) {
                        sendResponse(ws, msg.id, 'ERROR', { message: err.message });
                    }
                    break;
                }

                case 'DISCONNECT':
                    console.log('[Bridge Agent] Client requested disconnect');
                    if (activeBackend && typeof activeBackend.disconnect === 'function') {
                        await activeBackend.disconnect();
                    }
                    sendResponse(ws, msg.id, 'PONG'); // Simple ACK
                    break;

                default:
                    console.warn(`[Bridge Agent] Unknown message type: ${msg.type}`);
                    sendResponse(ws, msg.id, 'ERROR', { message: `Unknown message type: ${msg.type}` });
            }
        } catch (err) {
            console.error('[Bridge Agent] Failed to parse message:', err);
        }
    });

    ws.on('close', () => {
        console.log('[Bridge Agent] Client disconnected');
    });
});

function sendResponse(ws: WebSocket, id: number, type: BridgeMessageType, payload?: any) {
    const response: BridgeMessage = {
        v: BRIDGE_PROTOCOL_VERSION,
        id,
        type,
        payload
    };
    ws.send(JSON.stringify(response));
}
