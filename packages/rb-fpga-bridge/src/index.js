import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

const HTTP_PORT = Number(process.env.RB_FPGA_HTTP_PORT || 4242);
const WS_PORT = Number(process.env.RB_FPGA_WS_PORT || 4243);
const BAUD = Number(process.env.RB_FPGA_BAUD || 115200);
const OVERRIDE_PORT = process.env.REDBYTE_FPGA_PORT || ""; // e.g. "COM5"
const MOCK_MODE = process.env.RB_FPGA_MOCK === "1" || process.env.RB_FPGA_MOCK === "true";

function scorePort(p) {
  const name = (p.friendlyName || p.manufacturer || p.path || "").toLowerCase();
  const pnp = (p.pnpId || "").toLowerCase();

  // FTDI VID is commonly 0403. Basys3 UART is often FTDI-based.
  let score = 0;
  if (name.includes("ftdi")) score += 50;
  if (name.includes("usb serial")) score += 25;
  if (pnp.includes("vid_0403")) score += 40;
  if (pnp.includes("ftdi")) score += 20;
  if (p.path?.toLowerCase().startsWith("com")) score += 5;
  return score;
}

async function listPorts() {
  const ports = await SerialPort.list();
  return ports.map((p) => ({
    path: p.path,
    friendlyName: p.friendlyName,
    manufacturer: p.manufacturer,
    serialNumber: p.serialNumber,
    vendorId: p.vendorId,
    productId: p.productId,
    pnpId: p.pnpId,
    score: scorePort(p),
  })).sort((a,b) => b.score - a.score);
}

async function selectPort() {
  const ports = await listPorts();
  if (OVERRIDE_PORT) {
    const hit = ports.find((p) => p.path?.toLowerCase() === OVERRIDE_PORT.toLowerCase());
    if (hit) return { selected: hit, ports };
    return { selected: { path: OVERRIDE_PORT, note: "override (not found in list yet)" }, ports };
  }
  const best = ports[0];
  if (!best || best.score < 10) return { selected: null, ports };
  return { selected: best, ports };
}

// Simple line protocol:
// RB1 SW=0011... LED=... BTN=... TICK=1234
function parseLine(line) {
  const raw = line.trim();
  if (!raw) return null;

  // Pass through if not in our format, but still loggable
  const obj = { raw, ts: Date.now(), type: "uart" };

  // Try key=value parsing
  const parts = raw.split(/\s+/);
  for (const part of parts) {
    const m = part.match(/^([A-Z0-9_]+)=(.+)$/i);
    if (!m) continue;
    const k = m[1].toUpperCase();
    const v = m[2];
    obj[k] = v;
  }
  return obj;
}

const app = express();
app.use(cors());
app.use(express.json());

let state = {
  connected: false,
  port: null,
  baud: BAUD,
  lastMsgTs: null,
  lastMsg: null,
};

let eventSeq = 0;

function createEvent(type, data = {}) {
  return {
    type,
    seq: eventSeq++,
    timestamp: Date.now(),
    ...data,
  };
}

// Main API endpoint
app.get("/api/health", (_req, res) => res.json({ ok: true, ...state }));

// Backward compat
app.get("/health", (_req, res) => res.json({ ok: true, ...state }));

app.get("/ports", async (_req, res) => {
  const ports = await listPorts();
  res.json({ ports });
});

app.post("/connect", async (req, res) => {
  // optionally allow selecting a port from UI
  const { port } = req.body || {};
  try {
    await connectToFpga(port || null);
    res.json({ ok: true, ...state });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

const server = app.listen(HTTP_PORT, () => {
  console.log(`[fpga-bridge] HTTP on http://localhost:${HTTP_PORT}`);
});

const wss = new WebSocketServer({ port: WS_PORT });
console.log(`[fpga-bridge] WS on ws://localhost:${WS_PORT}`);

function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(s);
  }
}

async function connectToFpga(forcedPortPath) {
  const { selected, ports } = await selectPort();
  const portPath = forcedPortPath || selected?.path;

  if (!portPath) {
    console.log("[fpga-bridge] No suitable serial port found. Ports:");
    console.table(ports.map(p => ({ path: p.path, score: p.score, name: p.friendlyName || p.manufacturer })));
    throw new Error("No suitable FPGA serial port found. Plug in board or select port via /ports and /connect.");
  }

  console.log(`[fpga-bridge] Connecting to ${portPath} @ ${BAUD}...`);

  const sp = new SerialPort({ path: portPath, baudRate: BAUD, autoOpen: false });
  await new Promise((resolve, reject) => sp.open((err) => err ? reject(err) : resolve()));

  const parser = sp.pipe(new ReadlineParser({ delimiter: "\n" }));

  state.connected = true;
  state.port = portPath;

  sp.on("close", () => {
    state.connected = false;
    console.log("[fpga-bridge] Serial port closed");
    broadcast(createEvent("status", { ...state }));
  });
  sp.on("error", (err) => {
    console.log("[fpga-bridge] Serial error:", err);
    broadcast(createEvent("error", { error: String(err) }));
  });

  parser.on("data", (line) => {
    const msg = parseLine(line);
    if (!msg) return;
    state.lastMsgTs = msg.ts;
    state.lastMsg = msg;
    broadcast(createEvent("uart:rx", msg));
  });

  broadcast(createEvent("status", { ...state }));
  console.log("[fpga-bridge] Connected.");
}

wss.on("connection", (ws) => {
  const statusEvent = createEvent("status", { ...state });
  ws.send(JSON.stringify(statusEvent));
});

(async () => {
  if (MOCK_MODE) {
    console.log("[fpga-bridge] ⚠️  MOCK MODE - simulating Basys3 board");
    state.connected = true;
    state.port = "MOCK";
    broadcast(createEvent("device:connected"));
    
    // Simulate hardware updates
    let tick = 0;
    let sw = 0;
    let led = 0;
    
    setInterval(() => {
      // Simulate switch changes and LED mirrors
      sw = Math.floor(Math.random() * 0xFFFF);
      led = sw; // Mirror switches to LEDs
      const btn = Math.floor(Math.random() * 0b11111);
      
      const msg = createEvent("io:update", {
        source: "device",
        SW: sw.toString(2).padStart(16, "0"),
        BTN: btn.toString(2).padStart(5, "0"),
        LED: led.toString(2).padStart(16, "0"),
        TICK: String(tick),
      });
      
      state.lastMsgTs = msg.timestamp;
      state.lastMsg = msg;
      broadcast(msg);
      tick++;
    }, 100); // 10Hz updates
    
    return;
  }
  
  try {
    await connectToFpga(null);
  } catch (e) {
    console.log("[fpga-bridge] Auto-connect failed:", String(e));
    console.log("[fpga-bridge] Run: curl http://localhost:4242/ports then POST /connect with a chosen port.");
    console.log("[fpga-bridge] Or set RB_FPGA_MOCK=1 to run in simulation mode.");
  }
})();
