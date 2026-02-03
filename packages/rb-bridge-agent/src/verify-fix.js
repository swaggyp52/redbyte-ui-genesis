import { WebSocket } from 'ws';
const ws = new WebSocket('ws://localhost:4242/ws');
ws.on('open', () => {
    console.log('test-script: WS Connected');
    // 1. Connect first time (Mimicking correctly patched HardwareClient)
    const msg1 = {
        v: '1.0',
        id: 1,
        type: 'CONNECT',
        deviceId: 'basys3', // The specific slot
        payload: { target: 'basys3' } // The correct target
    };
    console.log('test-script: Sending 1st CONNECT...');
    ws.send(JSON.stringify(msg1));
});
ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('test-script: Received:', msg.type, msg.payload);
    if (msg.id === 1 && msg.type === 'CONNECT_OK') {
        console.log('test-script: First Connect OK. Waiting 2s to trigger De-Dupe...');
        setTimeout(() => {
            const msg2 = {
                v: '1.0',
                id: 2,
                type: 'CONNECT',
                deviceId: 'basys3',
                payload: { target: 'basys3' }
            };
            console.log('test-script: Sending 2nd CONNECT (Duplicate)...');
            ws.send(JSON.stringify(msg2));
        }, 2000);
    }
    else if (msg.id === 2) {
        console.log('test-script: Second Connect Response:', msg);
        if (msg.type === 'CONNECT_OK') {
            console.log('test-script: SUCCESS! Bridge accepted duplicate connection (Dedupe worked).');
        }
        else {
            console.log('test-script: FAILURE! Bridge rejected duplicate connection.');
        }
        ws.close();
        process.exit(0);
    }
});
ws.on('error', (err) => {
    console.error('test-script: WS Error:', err);
    process.exit(1);
});
