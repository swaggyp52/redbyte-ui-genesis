import { WebSocket } from 'ws';
import * as fs from 'fs';

// Polyfill global WebSocket
// @ts-ignore
global.WebSocket = WebSocket;

// Polyfill window/localStorage for the client
// @ts-ignore
global.window = {
    localStorage: {
        getItem: () => null,
        setItem: () => { },
    }
};

// Mock import.meta (handled by tsx but env needs to be safe)
// @ts-ignore
if (!import.meta.env) {
    // @ts-ignore
    import.meta.env = { DEV: true };
}

import { hardwareClient } from '../packages/rb-apps/src/services/hardwareClient';

// Capture console errors
let lastConsoleError: string | null = null;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
console.error = (...args) => {
    lastConsoleError = args.map(a => String(a)).join(' ');
    originalConsoleError(...args);
};
console.warn = (...args) => {
    lastConsoleError = args.map(a => String(a)).join(' ');
    originalConsoleWarn(...args);
};

async function main() {
    console.log('--- STARTING CLIENT VERIFICATION (IDEMPOTENCY) ---');

    let connected = false;

    const unsubscribe = hardwareClient.subscribe(async (state) => {
        // IMPORTANT: Wait for BOTH connected status AND the WebSocket to be ready
        // This avoids the race condition where status is connected (via HTTP) but WS is not yet open
        if (state.status === 'connected' && state.ws) {
            if (!connected) {
                connected = true;
                console.log('--- CONNECTED (HTTP + WS) ---');

                const uno = state.devices.find(d => d.deviceId === 'uno');
                const basys3 = state.devices.find(d => d.deviceId === 'basys3');

                const results = {
                    timestamp: new Date().toISOString(),
                    uno_found: !!uno,
                    basys3_found: !!basys3,
                    uno_connect: false,
                    uno_reconnect: false,
                    basys3_connect: false,
                    error: null as string | null,
                    last_console_error: null as string | null
                };

                if (uno && basys3) {
                    try {
                        // Test Connection to Uno
                        console.log('[1/3] Connecting to Uno...');
                        results.uno_connect = await hardwareClient.selectDevice(uno.deviceId);
                        if (!results.uno_connect) results.last_console_error = lastConsoleError;

                        // Test Idempotency (Uno again)
                        console.log('[2/3] Re-connecting to Uno...');
                        results.uno_reconnect = await hardwareClient.selectDevice(uno.deviceId);
                        if (!results.uno_reconnect && !results.last_console_error) results.last_console_error = lastConsoleError;

                        // Test Connection to Basys3
                        console.log('[3/3] Connecting to Basys3...');
                        results.basys3_connect = await hardwareClient.selectDevice(basys3.deviceId);
                        if (!results.basys3_connect && !results.last_console_error) results.last_console_error = lastConsoleError;

                    } catch (err: any) {
                        results.error = err.message;
                    }
                } else {
                    results.error = "Devices not found";
                }

                fs.writeFileSync('verify_result.json', JSON.stringify(results, null, 2));
                console.log('Results written to verify_result.json');
                process.exit(0);
            }
        }
    });

    // Force connect just in case
    hardwareClient.connect();

    // Timeout
    setTimeout(() => {
        fs.writeFileSync('verify_result.json', JSON.stringify({ error: "TIMEOUT" }));
        process.exit(1);
    }, 10000);
}

main().catch(err => {
    fs.writeFileSync('verify_result.json', JSON.stringify({ error: err.message }));
    process.exit(1);
});
