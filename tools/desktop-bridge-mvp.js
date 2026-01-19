#!/usr/bin/env node
// Desktop Bridge MVP for Hardware Session
// Provides stable contract with deterministic mock I/O

const http = require('http');

const PORT = 3002;
const startTime = Date.now();

// Mock state
let boardConnected = true;
let boardModel = 'MOCK_BOARD';
let activeSessions = new Map(); // sessionId -> { deviceId, startTime }
let ioCounter = 0; // Deterministic IO state

// Deterministic mock IO (increments slowly, predictable)
function generateDeterministicIO() {
  ioCounter = (ioCounter + 1) % 256;
  const sw0 = (ioCounter >> 0) & 1;
  const sw1 = (ioCounter >> 1) & 1;
  const btn0 = (ioCounter >> 2) & 1;
  
  // Simple deterministic logic: LED0 = SW0, LED1 = SW1 XOR BTN0
  const led0 = sw0;
  const led1 = sw1 ^ btn0;
  
  return {
    timestamp: new Date().toISOString(),
    inputs: { SW0: sw0, SW1: sw1, BTN0: btn0 },
    outputs: { LED0: led0, LED1: led1 }
  };
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Health endpoint
  if (req.url === '/api/v1/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      version: '1.0.0',
      uptimeSec: Math.floor((Date.now() - startTime) / 1000),
      build: 'dev'
    }));
    return;
  }

  // Devices endpoint
  if (req.url === '/api/v1/devices' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(boardConnected ? [
      {
        deviceId: 'mock-0',
        boardModel: 'MOCK_BOARD',
        boardFamily: 'mock',
        serial: 'MOCK123',
        transport: 'mock',
        toolchain: 'mock',
        status: 'available',
        capabilities: {
          io: {
            canReadInputs: true,
            canReadOutputs: true,
            namedSignals: ['SW0', 'SW1', 'BTN0', 'LED0', 'LED1']
          },
          programming: { canProgramBitstream: false },
          timing: { maxPollHz: 50, supportsPush: false }
        }
      }
    ] : []));
    return;
  }

  // Session open
  if (req.url === '/api/v1/session/open' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { deviceId } = JSON.parse(body);
        if (!deviceId || deviceId !== 'mock-0') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, code: 'E_INVALID_DEVICE', message: 'Invalid deviceId' }));
          return;
        }
        const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        activeSessions.set(sessionId, { deviceId, startTime: Date.now() });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          sessionId,
          device: {
            deviceId: 'mock-0',
            boardModel: 'MOCK_BOARD',
            boardFamily: 'mock',
            serial: 'MOCK123',
            transport: 'mock',
            toolchain: 'mock',
            status: 'available'
          }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, code: 'E_INVALID_JSON', message: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // Session close
  if (req.url === '/api/v1/session/close' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { sessionId } = JSON.parse(body);
        activeSessions.delete(sessionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, code: 'E_INVALID_JSON', message: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // IO endpoint
  const ioMatch = req.url.match(/^\/api\/v1\/session\/([^/]+)\/io$/);
  if (ioMatch && req.method === 'GET') {
    const sessionId = ioMatch[1];
    if (!activeSessions.has(sessionId)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, code: 'E_NO_SESSION', message: 'Session not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(generateDeterministicIO()));
    return;
  }

  // Test run endpoint
  const testMatch = req.url.match(/^\/api\/v1\/session\/([^/]+)\/test\/run$/);
  if (testMatch && req.method === 'POST') {
    const sessionId = testMatch[1];
    if (!activeSessions.has(sessionId)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, code: 'E_NO_SESSION', message: 'Session not found' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { testId, vectors } = JSON.parse(body);
        if (!testId || !Array.isArray(vectors)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, code: 'E_INVALID_TEST', message: 'Invalid test payload' }));
          return;
        }
        
        // Run vectors and compare
        const results = vectors.map((vec, index) => {
          const observed = generateDeterministicIO();
          const mismatches = [];
          let pass = true;
          
          if (vec.expectedOutputs) {
            for (const [key, expected] of Object.entries(vec.expectedOutputs)) {
              if (observed.outputs[key] !== expected) {
                pass = false;
                mismatches.push({ signal: key, expected, observed: observed.outputs[key] });
              }
            }
          }
          
          return {
            index,
            pass,
            observedOutputs: observed.outputs,
            mismatches
          };
        });
        
        const summary = {
          total: results.length,
          passed: results.filter(r => r.pass).length,
          failed: results.filter(r => !r.pass).length,
          overallPass: results.every(r => r.pass)
        };
        
        const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const evidence = {
          runId,
          testId,
          timestamp: new Date().toISOString(),
          summary,
          results,
          hash: 'mock-hash-' + runId,
          signature: 'mock-sig-' + runId
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          runId,
          summary,
          results,
          evidence: { runId: evidence.runId, hash: evidence.hash, signature: evidence.signature }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, code: 'E_INVALID_JSON', message: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // Evidence endpoint
  const evidenceMatch = req.url.match(/^\/api\/v1\/evidence\/([^/]+)$/);
  if (evidenceMatch && req.method === 'GET') {
    const runId = evidenceMatch[1];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      runId,
      timestamp: new Date().toISOString(),
      hash: 'mock-hash-' + runId,
      signature: 'mock-sig-' + runId,
      payload: { note: 'Evidence capsule for ' + runId }
    }));
    return;
  }

  // 404 for unknown endpoints
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, code: 'E_NOT_FOUND', message: 'Endpoint not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Bridge MVP] Listening on http://127.0.0.1:${PORT}`);
  console.log(`[Bridge MVP] API v1 endpoints ready`);
  console.log(`[Bridge MVP] Board: ${boardModel} ${boardConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
});

server.on('error', (err) => {
  console.error(`[Bridge MVP] Server error:`, err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Bridge MVP] Shutting down gracefully...');
  server.close(() => {
    console.log('[Bridge MVP] Server closed');
    process.exit(0);
  });
});
