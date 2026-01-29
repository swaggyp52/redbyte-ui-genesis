
import { WebSocket } from 'ws';

const WS_URL = 'ws://localhost:4242/ws';
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('[Test] Connected');
    ws.send(JSON.stringify({ v: 'rb-bridge.v1', id: 1, type: 'CONNECT', payload: { target: 'arduino-uno' } }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`[Test] Received ${msg.type} (id: ${msg.id})`);

    if (msg.type === 'CONNECT_OK') {
        console.log('[Test] Handshake OK, listing devices...');
        ws.send(JSON.stringify({ v: 'rb-bridge.v1', id: 2, type: 'LIST_DEVICES' }));
    } else if (msg.type === 'LIST_DEVICES_OK') {
        console.log('[Test] Devices found, starting upload...');
        ws.send(JSON.stringify({
            v: 'rb-bridge.v1',
            id: 3,
            type: 'UPLOAD_SKETCH',
            payload: {
                sketchText: 'void setup() {} void loop() {}',
                port: 'COM6',
                fqbn: 'arduino:avr:uno'
            }
        }));
    } else if (msg.id === 3) {
        console.log('[Test] Upload Response:', JSON.stringify(msg.payload, null, 2));
        process.exit(0);
    }
});

ws.on('error', (e) => console.error('[Test] Error:', e));
setTimeout(() => { console.log('[Test] Timeout'); process.exit(1); }, 15000);
