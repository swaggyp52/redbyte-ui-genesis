import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HTTP_PORT = Number(process.env.RB_FPGA_HTTP_PORT || 4242);
const WS_PORT = Number(process.env.RB_FPGA_WS_PORT || 4243);
const BRIDGE_SECRET = process.env.RB_FPGA_SECRET || "dev-secret-key";

// Load schemas for validation
const fpgaEventsSchema = JSON.parse(
  readFileSync(join(__dirname, "../schemas/fpga-events.schema.json"), "utf8")
);

// ============================================================================
// State
// ============================================================================

let state = {
  deviceConnected: false,
  sessionId: generateSessionId(),
  events: [],
  seq: 0,
};

function generateSessionId() {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const random = Math.random().toString(36).substr(2, 8);
  return `sess-${dateStr}-${random}`;
}

// ============================================================================
// Event Management
// ============================================================================

function createEvent(type, data = {}) {
  const event = {
    type,
    seq: state.seq++,
    timestamp: Date.now(),
    ...data,
  };
  return event;
}

function canonical(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function computeSignature(events) {
  const canonical_json = canonical(events);
  return (
    "hmac-sha256:" +
    crypto
      .createHmac("sha256", BRIDGE_SECRET)
      .update(canonical_json)
      .digest("hex")
  );
}

function broadcastEvent(event) {
  if (!event.type || typeof event.seq !== "number" || !event.timestamp) {
    console.error("[bridge] Invalid event structure:", event);
    return;
  }

  state.events.push(event);

  const msg = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

// ============================================================================
// HTTP API
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    version: "0.1.0",
    deviceConnected: state.deviceConnected,
    wsPort: WS_PORT,
  });
});

app.post("/api/export-proof", (_req, res) => {
  const proof = {
    session_id: state.sessionId,
    device: {
      id: "simulator-default",
      board: "Basys3",
      backend: "simulator",
      port: "sim://default",
    },
    created_at: Date.now(),
    start_time: state.events.length > 0 ? state.events[0].timestamp : Date.now(),
    end_time: Date.now(),
    duration_ms:
      state.events.length > 0
        ? Date.now() - state.events[0].timestamp
        : 0,
    event_count: state.events.length,
    events: state.events,
    signature: computeSignature(state.events),
    signature_alg: "hmac-sha256",
  };

  res.json({
    success: true,
    proof,
    bundle_url: `/api/proof/${state.sessionId}.json`,
  });
});

const server = app.listen(HTTP_PORT, () => {
  console.log(`[fpga-bridge] HTTP on http://localhost:${HTTP_PORT}`);
});

// ============================================================================
// WebSocket
// ============================================================================

const wss = new WebSocketServer({ port: WS_PORT });
console.log(`[fpga-bridge] WS on ws://localhost:${WS_PORT}`);

wss.on("connection", (ws) => {
  if (state.deviceConnected) {
    ws.send(
      JSON.stringify({
        type: "device:connected",
        seq: 0,
        timestamp: Date.now(),
        device: {
          id: "simulator-default",
          board: "Basys3",
          backend: "simulator",
          port: "sim://default",
          contract: {
            protocol: "UART",
            baudrate: 115200,
            format: "RB1",
            io: {
              inputs: { SW: { count: 16, type: "switch" }, BTN: { count: 5, type: "button" } },
              outputs: { LED: { count: 16, type: "led" } },
            },
          },
        },
      })
    );
  }
});

// ============================================================================
// Simulator
// ============================================================================

let simulatorRunning = false;
let simulatorInterval = null;

function startSimulator() {
  if (simulatorRunning) return;
  simulatorRunning = true;

  state.sessionId = generateSessionId();
  state.events = [];
  state.seq = 0;
  state.deviceConnected = true;

  const deviceConnected = createEvent("device:connected", {
    device: {
      id: "simulator-default",
      board: "Basys3",
      backend: "simulator",
      port: "sim://default",
      contract: {
        protocol: "UART",
        baudrate: 115200,
        format: "RB1",
        io: {
          inputs: { SW: { count: 16, type: "switch" }, BTN: { count: 5, type: "button" } },
          outputs: { LED: { count: 16, type: "led" } },
        },
      },
    },
  });
  broadcastEvent(deviceConnected);

  const pattern = [
    "0000000000000001",
    "0000000000000011",
    "0000000000000111",
    "0000000000001111",
    "0000000000011111",
    "0000000000111111",
    "0000000001111111",
    "0000000011111111",
  ];

  let patternIdx = 0;
  let eventCount = 0;
  const maxEvents = 50;

  simulatorInterval = setInterval(() => {
    if (eventCount >= maxEvents) {
      clearInterval(simulatorInterval);

      const proof = {
        session_id: state.sessionId,
        device: {
          id: "simulator-default",
          board: "Basys3",
          backend: "simulator",
          port: "sim://default",
        },
        created_at: Date.now(),
        start_time: state.events[0].timestamp,
        end_time: Date.now(),
        duration_ms: Date.now() - state.events[0].timestamp,
        event_count: state.events.length,
        events: state.events,
        signature: computeSignature(state.events),
        signature_alg: "hmac-sha256",
      };

      const proofEvent = createEvent("proof:capsule", {
        session_id: state.sessionId,
        signature: proof.signature,
        device_snapshot: proof.device,
        event_count: proof.event_count,
        start_time: proof.start_time,
        end_time: proof.end_time,
        duration_ms: proof.duration_ms,
        bundle_url: `/api/proof/${state.sessionId}.json`,
      });
      broadcastEvent(proofEvent);

      const deviceDisconnected = createEvent("device:disconnected", {
        reason: "simulator_finished",
      });
      broadcastEvent(deviceDisconnected);

      state.deviceConnected = false;
      simulatorRunning = false;

      console.log(
        `[fpga-bridge] Simulator finished. Generated ${state.events.length} events.`
      );
      console.log(`[fpga-bridge] Proof signature: ${proof.signature}`);
      
      // Note: Server continues running, ready to restart simulator or export proof
      return;
    }

    const sw = pattern[patternIdx % pattern.length];
    patternIdx++;

    const ioUpdate = createEvent("io:update", {
      source: "device",
      changes: {
        SW: sw,
        LED: sw,
      },
      tick: eventCount,
    });
    broadcastEvent(ioUpdate);
    eventCount++;
  }, 100);
}

// ============================================================================
// Startup
// ============================================================================

console.log(`[fpga-bridge] starting simulator backend...`);
startSimulator();
console.log(
  `[fpga-bridge] listening on http://localhost:${HTTP_PORT} and ws://localhost:${WS_PORT}`
);
