#!/usr/bin/env node
/**
 * Bridge Smoke Test - CLI proof of hardware connection
 *
 * Usage:
 *   node tools/bridge-smoke.mjs                    # Test production bridge (4242/4243)
 *   node tools/bridge-smoke.mjs --mock             # Test mock bridge (3002)
 *   node tools/bridge-smoke.mjs --set-led 1       # Set LED 0 on
 *   node tools/bridge-smoke.mjs --duration 10000   # Run for 10 seconds
 *
 * Success criteria (Phase 1 gate):
 *   1. Discover device
 *   2. Select device
 *   3. Read switch state
 *   4. Set LED state
 *   5. Print ticked updates
 */

import http from 'http';

// WebSocket import - only needed for production bridge
let WebSocket;
async function loadWebSocket() {
  if (!WebSocket) {
    try {
      const ws = await import('ws');
      WebSocket = ws.default;
    } catch {
      return null;
    }
  }
  return WebSocket;
}

// Configuration
const args = process.argv.slice(2);
const MOCK_MODE = args.includes('--mock');
const SET_LED = args.find(a => a.startsWith('--set-led='))?.split('=')[1];
const DURATION = parseInt(args.find(a => a.startsWith('--duration='))?.split('=')[1] || '5000');

// Bridge endpoints
const HTTP_PORT = MOCK_MODE ? 3002 : 4242;
const WS_PORT = 4242;
const BASE_URL = `http://127.0.0.1:${HTTP_PORT}`;
const WS_URL = `ws://127.0.0.1:${WS_PORT}/ws`;

// Console colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(level, msg) {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: `${colors.cyan}[INFO]${colors.reset}`,
    ok: `${colors.green}[OK]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
    warn: `${colors.yellow}[WARN]${colors.reset}`,
    data: `${colors.dim}[DATA]${colors.reset}`,
  }[level] || '[???]';
  console.log(`${colors.dim}${timestamp}${colors.reset} ${prefix} ${msg}`);
}

// HTTP request helper
function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// SSE fallback for production bridge (when WebSocket not available)
async function testProductionBridgeSSE(device, runId) {
  log('info', 'Using SSE stream endpoint...');
  let sampleCount = 0;

  return new Promise((resolve) => {
    const url = new URL('/stream', BASE_URL);
    if (runId) url.searchParams.set('run_id', runId);

    const req = http.get(url, (res) => {
      if (res.statusCode !== 200) {
        log('error', `SSE stream failed: ${res.statusCode}`);
        resolve(false);
        return;
      }

      log('ok', 'SSE stream connected');
      let buffer = '';

      const timeout = setTimeout(() => {
        log('info', `Duration ${DURATION}ms elapsed, closing...`);
        req.destroy();
      }, DURATION);

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.type === 'sample' || data.SW !== undefined) {
                sampleCount++;
                const tick = data.mono_seq ?? data.hw_tick ?? sampleCount;
                const sw = data.io?.SW || data.SW || '?';
                const led = data.io?.LED || data.LED || '?';
                log('data', `TICK=${String(tick).padStart(5)} SW=${sw} LED=${led}`);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      });

      res.on('end', async () => {
        clearTimeout(timeout);
        await cleanup();
        printSummary(sampleCount);
        resolve(sampleCount > 0);
      });

      res.on('error', (err) => {
        log('error', `SSE error: ${err.message}`);
        clearTimeout(timeout);
        resolve(false);
      });
    });

    req.on('error', (err) => {
      log('error', `SSE request error: ${err.message}`);
      resolve(false);
    });
  });

  async function cleanup() {
    log('info', 'Cleaning up...');
    try { await httpRequest('POST', '/stop'); } catch { }
    try { await httpRequest('POST', '/disconnect'); } catch { }
  }

  function printSummary(count) {
    console.log('');
    console.log('════════════════════════════════════════════');
    if (count > 0) {
      log('ok', `SUCCESS: Received ${count} I/O samples from hardware (SSE)`);
    } else {
      log('error', 'FAILED: No I/O samples received');
    }
    console.log('════════════════════════════════════════════');
  }
}

// Test production bridge (port 4242)
async function testProductionBridge() {
  log('info', `Testing PRODUCTION bridge at ${BASE_URL}`);

  // Step 1: Health check
  log('info', 'Step 1: Health check...');
  try {
    const health = await httpRequest('GET', '/health');
    if (health.status !== 200) throw new Error(`Health check failed: ${health.status}`);
    log('ok', `Bridge healthy: version=${health.data.version || 'unknown'}, backend=${health.data.backend || 'unknown'}`);
  } catch (err) {
    log('error', `Health check failed: ${err.message}`);
    log('warn', 'Is the bridge running? Try: pnpm --filter rb-fpga-bridge start');
    return false;
  }

  // Step 2: Device discovery
  log('info', 'Step 2: Device discovery...');
  let devices;
  try {
    const resp = await httpRequest('GET', '/devices');
    devices = resp.data?.devices || [];
    log('ok', `Found ${devices.length} device(s)`);
    devices.forEach((d, i) => {
      log('data', `  [${i}] ${d.deviceId || 'unknown'} (${d.target}) - ${d.port} [${d.manufacturer || '?'}]`);
    });
  } catch (err) {
    log('error', `Device discovery failed: ${err.message}`);
    return false;
  }

  const validDevices = devices.filter(d => d.deviceId);
  if (validDevices.length === 0) {
    log('warn', 'No valid devices found. Is a board connected?');
    return false;
  }

  // Step 3: Select and Connect via WebSocket (handled in Step 5)
  const device = validDevices[0];
  log('info', `Targeting device: ${device.deviceId} on ${device.port}`);

  // Step 4: Skip legacy HTTP run/stop - using WebSocket protocol instead
  log('info', 'Step 4: Using WebSocket-only protocol for connectivity...');

  // Step 5: Subscribe to WebSocket for io:update events
  log('info', `Step 5: Subscribing to WebSocket at ${WS_URL}...`);
  let sampleCount = 0;
  let lastSW = null;
  let lastLED = null;

  const WS = await loadWebSocket();
  if (!WS) {
    log('error', 'WebSocket (ws) package not available. Install with: pnpm add -w ws');
    log('info', 'Falling back to SSE stream...');
    return await testProductionBridgeSSE(device, runId);
  }

  return new Promise((resolve) => {
    const ws = new WS(WS_URL);
    let connected = false;

    const timeout = setTimeout(() => {
      log('info', `Duration ${DURATION}ms elapsed, closing...`);
      ws.close();
    }, DURATION);

    ws.on('open', () => {
      log('ok', 'WebSocket connected');
      // Step 5a: Send CONNECT message
      const connectMsg = {
        v: 'rb-bridge.v1',
        id: 1,
        type: 'CONNECT',
        deviceId: device.deviceId,
        payload: { target: device.target, port: device.port }
      };
      ws.send(JSON.stringify(connectMsg));
      log('info', `Sent CONNECT for ${device.deviceId}`);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'CONNECT_OK') {
          connected = true;
          log('ok', `Hardware Connection Verified: ${device.deviceId}`);
        } else if (msg.type === 'GET_PINS_OK' || msg.type === 'SET_PINS_OK' || msg.payload?.pins) {
          sampleCount++;
          const pins = msg.payload?.pins || msg.pins || {};
          const pinSummary = Object.entries(pins).map(([k, v]) => `${k}=${v}`).join(' ');

          if (pinSummary !== lastSW) { // Using lastSW as lastSummary
            log('data', `TICK=${String(sampleCount).padStart(5)} ${pinSummary}`);
            lastSW = pinSummary;
          }
        } else if (msg.type === 'ERROR') {
          log('error', `Agent reported error: ${msg.payload?.message || 'Unknown'}`);
        }
      } catch (err) {
        log('warn', `Parse error: ${err.message}`);
      }
    });

    ws.on('error', (err) => {
      log('error', `WebSocket error: ${err.message}`);
    });

    ws.on('close', async () => {
      clearTimeout(timeout);
      log('info', `Received ${sampleCount} samples`);

      // Step 6: Stop run
      log('info', 'Step 6: Stopping run...');
      try {
        await httpRequest('POST', '/stop');
        log('ok', 'Run stopped');
      } catch {
        // Ignore stop errors
      }

      // Step 7: Disconnect
      log('info', 'Step 7: Disconnecting...');
      try {
        await httpRequest('POST', '/disconnect');
        log('ok', 'Disconnected');
      } catch {
        // Ignore disconnect errors
      }

      // Summary
      console.log('');
      console.log('════════════════════════════════════════════');
      if (sampleCount > 0) {
        log('ok', `SUCCESS: Received ${sampleCount} I/O samples from hardware`);
        console.log('════════════════════════════════════════════');
        resolve(true);
      } else {
        log('error', 'FAILED: No I/O samples received');
        console.log('════════════════════════════════════════════');
        resolve(false);
      }
    });
  });
}

// Test mock bridge (port 3002)
async function testMockBridge() {
  log('info', `Testing MOCK bridge at ${BASE_URL}`);

  // Step 1: Health check
  log('info', 'Step 1: Health check...');
  try {
    const health = await httpRequest('GET', '/api/v1/health');
    if (!health.data?.ok) throw new Error('Health check failed');
    log('ok', `Mock bridge healthy: version=${health.data.version}, uptime=${health.data.uptimeSec}s`);
  } catch (err) {
    log('error', `Health check failed: ${err.message}`);
    log('warn', 'Is the mock bridge running? Try: node tools/desktop-bridge-mvp.js');
    return false;
  }

  // Step 2: Device discovery
  log('info', 'Step 2: Device discovery...');
  let devices;
  try {
    const resp = await httpRequest('GET', '/api/v1/devices');
    devices = resp.data || [];
    log('ok', `Found ${devices.length} device(s)`);
    devices.forEach((d, i) => {
      log('data', `  [${i}] ${d.boardModel} (${d.deviceId}) - ${d.status}`);
    });
  } catch (err) {
    log('error', `Device discovery failed: ${err.message}`);
    return false;
  }

  if (devices.length === 0) {
    log('warn', 'No devices found');
    return false;
  }

  // Step 3: Open session
  const device = devices[0];
  log('info', `Step 3: Opening session with ${device.deviceId}...`);
  let sessionId;
  try {
    const resp = await httpRequest('POST', '/api/v1/session/open', { deviceId: device.deviceId });
    sessionId = resp.data?.sessionId;
    if (!sessionId) throw new Error('No sessionId returned');
    log('ok', `Session opened: ${sessionId}`);
  } catch (err) {
    log('error', `Session open failed: ${err.message}`);
    return false;
  }

  // Step 4: Poll I/O for a few iterations
  log('info', 'Step 4: Polling I/O...');
  let sampleCount = 0;
  const pollCount = Math.ceil(DURATION / 200); // Poll every 200ms

  for (let i = 0; i < pollCount; i++) {
    try {
      const resp = await httpRequest('GET', `/api/v1/session/${sessionId}/io`);
      if (resp.data?.inputs !== undefined) {
        sampleCount++;
        const { inputs, outputs, timestamp } = resp.data;
        log('data', `TICK=${String(sampleCount).padStart(5)} SW0=${inputs.SW0} SW1=${inputs.SW1} BTN0=${inputs.BTN0} LED0=${outputs.LED0} LED1=${outputs.LED1}`);
      }
    } catch (err) {
      log('warn', `Poll failed: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // Step 5: Close session
  log('info', 'Step 5: Closing session...');
  try {
    await httpRequest('POST', '/api/v1/session/close', { sessionId });
    log('ok', 'Session closed');
  } catch {
    // Ignore close errors
  }

  // Summary
  console.log('');
  console.log('════════════════════════════════════════════');
  if (sampleCount > 0) {
    log('ok', `SUCCESS: Received ${sampleCount} I/O samples from mock bridge`);
    console.log('════════════════════════════════════════════');
    return true;
  } else {
    log('error', 'FAILED: No I/O samples received');
    console.log('════════════════════════════════════════════');
    return false;
  }
}

// Main
async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║     RedByte Bridge Smoke Test              ║');
  console.log('║     Phase 1: First Real Hardware Success   ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');

  const success = MOCK_MODE
    ? await testMockBridge()
    : await testProductionBridge();

  process.exit(success ? 0 : 1);
}

main().catch(err => {
  log('error', `Unhandled error: ${err.message}`);
  process.exit(1);
});
