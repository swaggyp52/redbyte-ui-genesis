#!/usr/bin/env node
// Desktop Bridge Mock for Hardware Session v1 Testing
// This provides mock FPGA board detection and I/O snapshots for development

const http = require('http');

const PORT = 3002;

// Mock board state
let boardConnected = true;
let boardModel = 'Basys3';

// Mock I/O state (changes on each snapshot request)
function generateMockSnapshot() {
  const randomBit = Math.random() > 0.5 ? 1 : 0;
  return {
    connected: boardConnected,
    model: boardModel,
    inputs: {
      SW: Math.floor(Math.random() * 16),  // 4-bit switch value
      BTN: randomBit,
    },
    outputs: {
      LED: Math.floor(Math.random() * 16), // 4-bit LED value
    },
    timestamp: new Date().toISOString(),
  };
}

const server = http.createServer((req, res) => {
  // Enable CORS for browser requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/board/status' && req.method === 'GET') {
    // Return board connection status
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      connected: boardConnected,
      model: boardModel,
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  if (req.url === '/board/snapshot' && req.method === 'GET') {
    // Return current board I/O snapshot
    const snapshot = generateMockSnapshot();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(snapshot));
    return;
  }

  // 404 for unknown endpoints
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Desktop Bridge] Mock FPGA bridge listening on http://127.0.0.1:${PORT}`);
  console.log(`[Desktop Bridge] Endpoints:`);
  console.log(`  GET /board/status   - Board connection status`);
  console.log(`  GET /board/snapshot - Current I/O state snapshot`);
  console.log(`[Desktop Bridge] Board: ${boardModel} ${boardConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
  console.log(`[Desktop Bridge] Press Ctrl+C to stop`);
});
