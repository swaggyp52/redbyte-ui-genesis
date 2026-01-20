import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { BinaryPacketParser } from "./parsers/binary-packet.js";
import { crc16_ccitt_false } from "./parsers/crc16.js";
import { TraceRecorder } from "./trace/recorder.js";
import { createTimeBinner } from "./trace/binning.js";
import { discoverDevices, getPinmapHash } from "./discovery.js";
import { enumerateJtagDevices, programJtagBitstream, resolveDjtgcfgPath, selectJtagTarget } from "./jtag.js";
import { identifyPort } from "./proto/identify.js";
import { findRepoRoot, resolveRepoPath } from "./path-utils.js";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

const HTTP_PORT = Number(process.env.RB_FPGA_HTTP_PORT || 4242);
const WS_PORT = Number(process.env.RB_FPGA_WS_PORT || 4243);
const BAUD = Number(process.env.RB_FPGA_BAUD || 115200);
const OVERRIDE_PORT = process.env.REDBYTE_FPGA_PORT || ""; // e.g. "COM5"
const MOCK_MODE = process.env.RB_FPGA_MOCK === "1" || process.env.RB_FPGA_MOCK === "true";
const SIM_MODE = process.env.RB_FPGA_SIM === "1" || process.env.RB_FPGA_SIM === "true";
const MOCK_SEED = parseInt(process.env.RB_FPGA_SEED || "1");
const BIN_SIZE_MS = Number(process.env.RB_FPGA_BIN_MS || 20);
const TRACE_ENABLED = process.env.RB_FPGA_TRACE === "1" || process.env.RB_FPGA_TRACE === "true";
const TRACE_PATH = process.env.RB_FPGA_TRACE_PATH || path.join(process.cwd(), "trace", "hw_trace.ndjson");
const PACKET_RATE_WINDOW_MS = 1000;
const PROGRAM_TIMEOUT_MS = Number(process.env.RB_FPGA_PROGRAM_TIMEOUT_MS || 120000);
const PROGRAM_LOG_KEEP = Number(process.env.RB_FPGA_PROGRAM_LOG_KEEP || 50);
const PROGRAM_LOG_TAIL = Number(process.env.RB_FPGA_PROGRAM_LOG_TAIL || 200);

function getRepoRoot() {
  try {
    return findRepoRoot();
  } catch {
    return process.cwd();
  }
}

function ensureTmpDir(repoRoot) {
  const tmpDir = path.join(repoRoot, ".redbyte", "tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

function sanitizePathSegment(value) {
  if (!value) return "unknown";
  return String(value).replace(/[^a-z0-9_-]/gi, "_");
}

function decodeBase64Payload(payload) {
  if (!payload) return null;
  const trimmed = payload.trim();
  const cleaned = trimmed.replace(/^data:.*;base64,/, "");
  return Buffer.from(cleaned, "base64");
}

function resolveBitstreamPath({ bitstreamPath, bitstreamBase64, deviceId }) {
  const repoRoot = getRepoRoot();
  const tmpDir = ensureTmpDir(repoRoot);

  if (bitstreamBase64) {
    const buffer = decodeBase64Payload(bitstreamBase64);
    if (!buffer || !buffer.length) {
      throw new Error("bitstream_base64 is empty or invalid.");
    }
    const safeId = sanitizePathSegment(deviceId);
    const outPath = path.join(tmpDir, `program-${safeId}.bit`);
    fs.writeFileSync(outPath, buffer);
    return outPath;
  }

  if (bitstreamPath) {
    return resolveRepoPath(bitstreamPath);
  }

  throw new Error("Missing bitstream_path or bitstream_base64.");
}

function createProgramLogger(logPath) {
  const logStream = fs.createWriteStream(logPath, { flags: "w", encoding: "utf8" });
  const writeLine = (line) => {
    logStream.write(`${line}\n`);
  };
  const close = () =>
    new Promise((resolve) => {
      logStream.end(() => resolve());
    });
  return { writeLine, close };
}

function listProgramLogs(tmpDir) {
  try {
    const entries = fs.readdirSync(tmpDir);
    return entries
      .filter((entry) => entry.startsWith("program-") && entry.endsWith(".log"))
      .map((entry) => {
        const fullPath = path.join(tmpDir, entry);
        let stat = null;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          return null;
        }
        return {
          name: entry,
          path: fullPath,
          mtimeMs: stat?.mtimeMs || 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

function pruneProgramLogs(tmpDir, keep = PROGRAM_LOG_KEEP) {
  if (keep <= 0) return;
  const logs = listProgramLogs(tmpDir);
  const excess = logs.slice(keep);
  for (const entry of excess) {
    try {
      fs.unlinkSync(entry.path);
    } catch {
      // ignore cleanup failures
    }
  }
}

function resolveLogPath(tmpDir, inputPath) {
  if (!inputPath) return null;
  const clean = String(inputPath).trim();
  if (!clean) return null;
  const resolved = path.isAbsolute(clean) ? clean : path.join(tmpDir, clean);
  const normalized = path.resolve(resolved);
  const normalizedTmp = path.resolve(tmpDir) + path.sep;
  if (!normalized.startsWith(normalizedTmp)) {
    return null;
  }
  return normalized;
}

// Deterministic seeded PRNG (simple LCG)
class SeededRandom {
  constructor(seed) {
    this.state = seed;
  }
  next() {
    // Linear congruential generator
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
}

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

async function listPortsWithScores() {
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

async function listPortsForApi() {
  const ports = await SerialPort.list();
  return ports
    .map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer || null,
      vendorId: p.vendorId || null,
      productId: p.productId || null,
    }))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: "base" }));
}

async function selectPort() {
  const ports = await listPortsWithScores();
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

// ============================================================
// TOOLCHAIN DETECTION
// ============================================================

const VIVADO_SEARCH_PATHS = {
  win32: [
    "C:\\Xilinx\\Vivado",
    "D:\\Xilinx\\Vivado",
    "C:\\Program Files\\Xilinx\\Vivado",
  ],
  linux: ["/opt/Xilinx/Vivado", "/tools/Xilinx/Vivado"],
  darwin: ["/Applications/Xilinx/Vivado", "/opt/Xilinx/Vivado"],
};

async function findVivado() {
  const platform = os.platform();
  const vivadoExe = platform === "win32" ? "vivado.bat" : "vivado";

  // Check PATH first
  try {
    const { stdout } = await execAsync(`${vivadoExe} -version`, { timeout: 15000 });
    const versionMatch = stdout.match(/Vivado v?(\d+\.\d+(?:\.\d+)?)/i);
    if (versionMatch) {
      const whichCmd = platform === "win32" ? "where" : "which";
      try {
        const { stdout: pathOut } = await execAsync(`${whichCmd} ${vivadoExe}`);
        return { path: pathOut.trim().split("\n")[0], version: versionMatch[1] };
      } catch {
        return { path: vivadoExe, version: versionMatch[1] };
      }
    }
  } catch {
    // Not in PATH
  }

  // Search common locations
  const searchPaths = VIVADO_SEARCH_PATHS[platform] || [];
  for (const basePath of searchPaths) {
    if (!fs.existsSync(basePath)) continue;
    try {
      const versions = fs.readdirSync(basePath).filter((d) => /^\d+\.\d+/.test(d));
      versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      for (const version of versions) {
        const binPath = path.join(basePath, version, "bin", vivadoExe);
        if (fs.existsSync(binPath)) {
          return { path: binPath, version };
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function findYosys() {
  const platform = os.platform();
  const yosysExe = platform === "win32" ? "yosys.exe" : "yosys";

  try {
    const { stdout } = await execAsync(`${yosysExe} -V`, { timeout: 5000 });
    const versionMatch = stdout.match(/Yosys (\d+\.\d+(?:\+\d+)?)/i);
    if (versionMatch) {
      return { path: yosysExe, version: versionMatch[1] };
    }
  } catch {
    // Not found
  }

  // Check oss-cad-suite
  const ossCadPaths = platform === "win32"
    ? ["C:\\oss-cad-suite\\bin", "D:\\oss-cad-suite\\bin"]
    : ["/opt/oss-cad-suite/bin", path.join(os.homedir(), "oss-cad-suite/bin")];

  for (const binPath of ossCadPaths) {
    const yosysPath = path.join(binPath, yosysExe);
    if (fs.existsSync(yosysPath)) {
      try {
        const { stdout } = await execAsync(`"${yosysPath}" -V`, { timeout: 5000 });
        const versionMatch = stdout.match(/Yosys (\d+\.\d+(?:\+\d+)?)/i);
        if (versionMatch) {
          return { path: yosysPath, version: versionMatch[1] };
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function findOpenFPGALoader() {
  const platform = os.platform();
  const loaderExe = platform === "win32" ? "openFPGALoader.exe" : "openFPGALoader";

  try {
    const { stdout } = await execAsync(`${loaderExe} --version`, { timeout: 5000 });
    const versionMatch = stdout.match(/openFPGALoader v?(\d+\.\d+(?:\.\d+)?)/i);
    if (versionMatch) {
      return { path: loaderExe, version: versionMatch[1] };
    }
  } catch {
    // Not found
  }
  return null;
}

async function detectToolchain() {
  const capabilities = {};

  const [vivado, yosys, openFPGALoader] = await Promise.all([
    findVivado().catch(() => null),
    findYosys().catch(() => null),
    findOpenFPGALoader().catch(() => null),
  ]);

  if (vivado) {
    capabilities.vivado = {
      version: vivado.version,
      path: vivado.path,
      canSynthesize: true,
      canProgram: true,
    };
  }

  if (yosys) {
    capabilities.yosys = {
      version: yosys.version,
      path: yosys.path,
    };
  }

  if (openFPGALoader) {
    capabilities.openFPGALoader = {
      version: openFPGALoader.version,
      path: openFPGALoader.path,
    };
  }

  return capabilities;
}

// Cache toolchain detection (expensive operation)
let toolchainCache = null;
let toolchainCacheTime = 0;
const TOOLCHAIN_CACHE_TTL = 60000; // 1 minute

async function getCachedToolchain() {
  const now = Date.now();
  if (!toolchainCache || now - toolchainCacheTime > TOOLCHAIN_CACHE_TTL) {
    toolchainCache = await detectToolchain();
    toolchainCacheTime = now;
  }
  return toolchainCache;
}

let state = {
  connected: false,
  port: null,
  baud: BAUD,
  lastMsgTs: null,
  lastMsg: null,
  last_packet_ts: null,
  crc_fail_count: 0,
  resync_count: 0,
  frames_ok_count: 0,
  program_status: "idle",
  program_last_error: null,
  program_last_log_path: null,
  trace_recording_enabled: false,
  conn_state: "disconnected",
  conn_port: null,
  conn_baud: BAUD,
  last_error: null,
  last_transition_ts_wall: Date.now(),
};

let eventSeq = 0;
let programInFlight = false;
let activePort = null;
let packetTimestamps = [];
let vivadoPathCache = null;
let vivadoPathCacheTime = 0;
const VIVADO_PATH_CACHE_TTL = 60000;
let simInterval = null;
let simParser = null;
let simTraceRecorder = null;

function createEvent(type, data = {}) {
  return {
    type,
    seq: eventSeq++,
    timestamp: Date.now(),
    ...data,
  };
}

function setConnState(nextState, options = {}) {
  state.conn_state = nextState;
  state.last_transition_ts_wall = Date.now();
  if (options.error !== undefined) {
    state.last_error = options.error;
  }
  if (options.port !== undefined) {
    state.conn_port = options.port;
  }
  if (options.baud !== undefined) {
    state.conn_baud = options.baud;
  }
  state.connected = nextState === "connected";
  state.port = state.conn_port;
  state.baud = state.conn_baud;
}

function recordPacket(ts) {
  state.last_packet_ts = ts;
  packetTimestamps.push(ts);
  const cutoff = ts - PACKET_RATE_WINDOW_MS;
  while (packetTimestamps.length > 0 && packetTimestamps[0] < cutoff) {
    packetTimestamps.shift();
  }
}

function getPacketsPerSec(now) {
  const cutoff = now - PACKET_RATE_WINDOW_MS;
  while (packetTimestamps.length > 0 && packetTimestamps[0] < cutoff) {
    packetTimestamps.shift();
  }
  return packetTimestamps.length;
}

function getLastPacketAgeMs(now) {
  if (!state.last_packet_ts) return null;
  return Math.max(0, now - state.last_packet_ts);
}

function buildBinaryPacket({ sequence, flags, digital, analog }) {
  const buf = Buffer.alloc(28);
  buf[0] = 0x52;
  buf[1] = 0x42;
  buf[2] = 0x01;
  buf[3] = flags & 0xff;
  buf.writeUInt32BE(sequence >>> 0, 4);
  buf.writeUInt16BE(digital & 0xffff, 8);
  for (let i = 0; i < 8; i += 1) {
    buf.writeUInt16BE((analog[i] ?? 0) & 0xffff, 10 + i * 2);
  }
  const crc = crc16_ccitt_false(buf.subarray(0, 26));
  buf.writeUInt16BE(crc, 26);
  return buf;
}

function createBinaryPipeline() {
  const parser = new BinaryPacketParser();
  const timeBinner = createTimeBinner({ binSizeMs: BIN_SIZE_MS, nowFn: () => Date.now() });
  let traceRecorder = null;

  if (TRACE_ENABLED) {
    traceRecorder = new TraceRecorder({ outPath: TRACE_PATH, fs });
    state.trace_recording_enabled = true;
  }

  parser.on("crc_fail", (count = 1) => {
    state.crc_fail_count += count;
  });
  parser.on("resync", (count = 1) => {
    state.resync_count += count;
  });
  parser.on("frame_ok", (count = 1) => {
    state.frames_ok_count += count;
  });
  parser.on("data", (packet) => {
    const tsWall = timeBinner.now();
    const hwTick = timeBinner.compute(tsWall);
    const event = {
      hw_tick: hwTick,
      mono_seq: packet.sequence,
      digital: packet.digital,
      analog: packet.analog,
      ts_wall: tsWall,
    };
    state.lastMsgTs = tsWall;
    state.lastMsg = event;
    recordPacket(tsWall);
    broadcast(createEvent("uart:rx", event));
    if (traceRecorder) {
      traceRecorder.writeEvent(event);
    }
  });

  return { parser, traceRecorder };
}

function stopSimStream() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
  if (simParser) {
    simParser.end();
    simParser = null;
  }
  if (simTraceRecorder) {
    simTraceRecorder.close().catch(() => {});
    simTraceRecorder = null;
  }
  state.trace_recording_enabled = false;
}

function startSimStream() {
  if (simInterval) return;
  const { parser, traceRecorder } = createBinaryPipeline();
  simParser = parser;
  simTraceRecorder = traceRecorder;
  state.trace_recording_enabled = TRACE_ENABLED;
  setConnState("connected", { port: "SIM", baud: BAUD, error: null });

  let seq = 0;
  let tick = 0;
  simInterval = setInterval(() => {
    const digital = 1 << (tick % 16);
    const analog = Array.from({ length: 8 }, (_, i) => (tick * (i + 1) * 17) % 65535);
    const packet = buildBinaryPacket({
      sequence: seq,
      flags: 0,
      digital,
      analog,
    });
    parser.write(packet);
    seq += 1;
    tick += 1;
  }, 100);
}

async function getVivadoPath() {
  const now = Date.now();
  if (vivadoPathCache && now - vivadoPathCacheTime < VIVADO_PATH_CACHE_TTL) {
    return vivadoPathCache;
  }
  try {
    const capabilities = await getCachedToolchain();
    vivadoPathCache = capabilities.vivado?.path || null;
    vivadoPathCacheTime = now;
    return vivadoPathCache;
  } catch {
    return null;
  }
}

async function buildHealthPayload() {
  const now = Date.now();
  const vivadoPath = await getVivadoPath();
  const packetsPerSec = getPacketsPerSec(now);
  return {
    ok: true,
    ...state,
    connected_port: state.port || null,
    packets_per_sec: packetsPerSec,
    last_packet_age_ms: getLastPacketAgeMs(now),
    trace_recording_enabled: state.trace_recording_enabled,
    trace_path: state.trace_recording_enabled ? TRACE_PATH : null,
    vivado_path: vivadoPath,
    sim_mode: SIM_MODE,
  };
}

// Main API endpoint
app.get("/api/health", async (_req, res) => res.json(await buildHealthPayload()));

// Backward compat
app.get("/health", async (_req, res) => res.json(await buildHealthPayload()));

app.get("/ports", async (_req, res) => {
  const ports = await listPortsForApi();
  res.json({ ports });
});

app.get("/devices", async (_req, res) => {
  try {
    const devices = await discoverDevices({ includeSim: true, baudDefault: BAUD });
    res.json({ schema_version: "bridge_v1", devices });
  } catch (e) {
    console.error("[fpga-bridge] /devices error:", e);
    res.status(500).json({ schema_version: "bridge_v1", devices: [] });
  }
});

app.get("/api/devices", async (_req, res) => {
  try {
    const devices = await discoverDevices({ includeSim: true, baudDefault: BAUD });
    res.json({ schema_version: "bridge_v1", devices });
  } catch (e) {
    console.error("[fpga-bridge] /api/devices error:", e);
    res.status(500).json({ schema_version: "bridge_v1", devices: [] });
  }
});

app.post("/connect", async (req, res) => {
  // optionally allow selecting a port from UI
  const { port, portPath, baud } = req.body || {};
  try {
    if (SIM_MODE) {
      startSimStream();
      return res.json({ ...(await buildHealthPayload()), message: "SIM MODE" });
    }
    await connectToFpga(portPath || port || null, baud);
    res.json(await buildHealthPayload());
  } catch (e) {
    setConnState("error", { error: String(e) });
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post("/disconnect", async (_req, res) => {
  try {
    if (SIM_MODE) {
      stopSimStream();
      setConnState("disconnected", { port: null, baud: BAUD, error: null });
      return res.json(await buildHealthPayload());
    }
    await closeActivePort();
    setConnState("disconnected", { port: null, baud: BAUD, error: null });
    state.trace_recording_enabled = false;
    res.json(await buildHealthPayload());
  } catch (e) {
    setConnState("error", { error: String(e) });
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post("/program", async (req, res) => {
  const body = req.body || {};
  const schemaVersion = "bridge_v1";
  const deviceId = body.device_id || body.deviceId || null;
  const boardModelId = body.board_model_id || body.boardModelId || null;
  const bitstreamPath = body.bitstream_path || body.bitstreamPath || body.bitPath || null;
  const bitstreamBase64 = body.bitstream_base64 || body.bitstreamBase64 || body.bitstream?.data || null;

  if (!deviceId) {
    return res.status(400).json({
      schema_version: schemaVersion,
      ok: false,
      error: "device_id is required.",
    });
  }

  if (programInFlight) {
    return res.status(409).json({
      schema_version: schemaVersion,
      ok: false,
      error: "program_in_progress",
      log_path: state.program_last_log_path,
    });
  }

  programInFlight = true;
  state.program_status = "running";
  state.program_last_error = null;
  state.program_last_log_path = null;
  broadcast(createEvent("program:status", { status: state.program_status }));

  const repoRoot = getRepoRoot();
  const tmpDir = ensureTmpDir(repoRoot);
  const logPath = path.join(tmpDir, `program-${sanitizePathSegment(deviceId)}.log`);
  const logger = createProgramLogger(logPath);

  const finish = async (ok, error) => {
    await logger.close();
    state.program_status = ok ? "success" : "failed";
    state.program_last_error = ok ? null : error || "Programming failed.";
    state.program_last_log_path = logPath;
    programInFlight = false;
    pruneProgramLogs(tmpDir, PROGRAM_LOG_KEEP);
    broadcast(
      createEvent("program:status", {
        status: state.program_status,
        error: state.program_last_error,
        logPath: state.program_last_log_path,
      })
    );
    if (ok) {
      return res.json({ schema_version: schemaVersion, ok: true, log_path: logPath });
    }
    return res.status(500).json({ schema_version: schemaVersion, ok: false, error: state.program_last_error, log_path: logPath });
  };

  try {
    const bitPath = resolveBitstreamPath({
      bitstreamPath,
      bitstreamBase64,
      deviceId,
    });
    if (path.extname(bitPath).toLowerCase() !== ".bit") {
      return finish(false, `invalid_bitstream: ${bitPath}`);
    }
    if (!fs.existsSync(bitPath)) {
      return finish(false, `bitstream_not_found: ${bitPath}`);
    }

    const devices = await discoverDevices({ includeSim: false, baudDefault: BAUD });
    const device = devices.find((d) => d.id === deviceId);
    if (!device) {
      return finish(false, "invalid_device");
    }

    if (boardModelId && device.model_id !== "unknown-digilent" && device.model_id !== boardModelId) {
      return finish(false, "invalid_device:board_model_mismatch");
    }

    if (!device.programming || device.programming.status !== "ready" || device.programming.driver !== "djtgcfg") {
      const status = device.programming?.status || "missing_driver";
      return finish(false, status === "missing_driver" ? "missing_driver" : "programmer_unavailable");
    }

    const jtagResult = enumerateJtagDevices({ timeoutMs: 2000 });
    if (!jtagResult.ok) {
      const status = jtagResult.error === "missing_tool" ? "missing_tool" : "program_failed";
      logger.writeLine(`[rb-fpga] jtag_enumeration_failed: ${jtagResult.error || "unknown"}`);
      return finish(false, status);
    }

    const target = selectJtagTarget({ device, jtagDevices: jtagResult.devices });
    if (!target) {
      logger.writeLine("[rb-fpga] jtag_target_missing");
      return finish(false, "invalid_device");
    }

    const toolPath = jtagResult.toolPath || resolveDjtgcfgPath();
    logger.writeLine(JSON.stringify({
      type: "program",
      device_id: deviceId,
      board_model_id: boardModelId,
      selector: target.selector,
      selector_type: target.selectorType,
      tool: jtagResult.tool,
      tool_path: toolPath,
      bitstream: bitPath,
      started_at_ms: Date.now(),
    }));

    const programResult = await programJtagBitstream({
      toolPath,
      selector: target.selector,
      selectorType: target.selectorType,
      bitPath,
      timeoutMs: PROGRAM_TIMEOUT_MS,
    });

    logger.writeLine(`[rb-fpga] command: ${programResult.command || "unknown"}`);
    if (programResult.stdout) logger.writeLine(programResult.stdout.trim());
    if (programResult.stderr) logger.writeLine(`[STDERR] ${programResult.stderr.trim()}`);
    logger.writeLine(JSON.stringify({
      type: "program_result",
      ok: programResult.ok,
      exit_code: programResult.exitCode,
      error: programResult.error,
      elapsed_ms: programResult.elapsedMs,
    }));

    if (!programResult.ok) {
      const status = programResult.error === "missing_tool" ? "missing_tool" : "program_failed";
      return finish(false, status);
    }

    if (device.runtime?.status === "ready" && device.runtime?.port) {
      const identifyResult = await identifyPort({
        port: device.runtime.port,
        baud: device.runtime.baud_default || BAUD,
        timeoutMs: 250,
        retries: 2,
        backoffMs: [100, 200],
        maxTotalMs: 800,
      });
      logger.writeLine(JSON.stringify({
        type: "identify_after_program",
        ok: identifyResult.ok,
        attempts: identifyResult.attempts,
        rtt_ms: identifyResult.rttMs ?? null,
        error: identifyResult.error || identifyResult.lastError || null,
      }));

      if (identifyResult.ok && identifyResult.payload?.pinmap_hash) {
        const expected = getPinmapHash(identifyResult.payload.board_model_id);
        if (expected && identifyResult.payload.pinmap_hash !== expected) {
          return finish(false, "pinmap_mismatch");
        }
      }
    }

    return finish(true, null);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.writeLine(`[rb-fpga] ERROR: ${error}`);
    return finish(false, error);
  }
});

app.get("/log", (req, res) => {
  const repoRoot = getRepoRoot();
  const tmpDir = ensureTmpDir(repoRoot);
  const requested = req.query?.path || req.query?.id || null;
  const resolved = resolveLogPath(tmpDir, requested);
  if (!resolved) {
    return res.status(400).json({ ok: false, error: "invalid_log_path" });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ ok: false, error: "log_not_found" });
  }

  let content = "";
  try {
    content = fs.readFileSync(resolved, "utf8");
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "log_read_failed" });
  }

  const lines = content.split(/\r?\n/);
  const tail = Math.max(1, Number(req.query?.tail || PROGRAM_LOG_TAIL));
  const slice = lines.slice(-tail);
  return res.json({
    ok: true,
    path: resolved,
    lines: slice.length,
    content: slice.join("\n"),
  });
});

// ============================================================
// TOOLCHAIN API ENDPOINTS
// ============================================================

app.get("/api/toolchain", async (_req, res) => {
  try {
    const capabilities = await getCachedToolchain();
    const canSynthesize = !!(capabilities.vivado?.canSynthesize || capabilities.yosys);
    const canProgram = !!(capabilities.vivado?.canProgram || capabilities.openFPGALoader);

    res.json({
      ok: true,
      capabilities,
      canSynthesize,
      canProgram,
      preferredSynthesisTool: capabilities.vivado ? "vivado" : capabilities.yosys ? "yosys" : null,
      preferredProgrammingTool: capabilities.vivado?.canProgram ? "vivado" : capabilities.openFPGALoader ? "openFPGALoader" : null,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Force refresh toolchain cache
app.post("/api/toolchain/refresh", async (_req, res) => {
  try {
    toolchainCache = null;
    toolchainCacheTime = 0;
    const capabilities = await getCachedToolchain();
    res.json({ ok: true, capabilities });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ============================================================
// SYNTHESIS AND PROGRAMMING API
// ============================================================

import { spawn } from "child_process";
import { randomUUID } from "crypto";

// Job storage
const synthesisJobs = new Map();
const JOB_TTL = 3600000; // 1 hour

// Cleanup old jobs periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of synthesisJobs) {
    if (now - job.startedAt > JOB_TTL) {
      // Clean up temp files
      if (job.tempDir && fs.existsSync(job.tempDir)) {
        fs.rmSync(job.tempDir, { recursive: true, force: true });
      }
      synthesisJobs.delete(id);
    }
  }
}, 300000); // Every 5 minutes

// Generate Vivado Tcl script
function generateVivadoTcl(verilogFile, constraintsFile, outputDir, topModule, part) {
  return `# RedByte Vivado Synthesis Script
set output_dir "${outputDir.replace(/\\/g, '/')}"
create_project -in_memory -part ${part}
read_verilog "${verilogFile.replace(/\\/g, '/')}"
read_xdc "${constraintsFile.replace(/\\/g, '/')}"
synth_design -top ${topModule} -part ${part}
write_checkpoint -force \${output_dir}/post_synth.dcp
report_utilization -file \${output_dir}/post_synth_util.rpt
opt_design
place_design
write_checkpoint -force \${output_dir}/post_place.dcp
report_timing_summary -file \${output_dir}/post_place_timing.rpt
route_design
write_checkpoint -force \${output_dir}/post_route.dcp
report_timing_summary -file \${output_dir}/post_route_timing.rpt
report_utilization -file \${output_dir}/post_route_util.rpt
write_bitstream -force \${output_dir}/output.bit
puts "Synthesis complete!"
exit
`;
}

// Start synthesis job
app.post("/api/synthesize", async (req, res) => {
  try {
    const { verilog, primitivesLibrary, constraints, topModule = "top", board = "basys3" } = req.body;

    if (!verilog) {
      return res.status(400).json({ ok: false, error: "Missing verilog source" });
    }
    if (!constraints) {
      return res.status(400).json({ ok: false, error: "Missing constraints" });
    }

    const capabilities = await getCachedToolchain();
    if (!capabilities.vivado?.canSynthesize) {
      return res.status(400).json({
        ok: false,
        error: "Vivado not found. Please install AMD Vivado WebPACK and ensure it is on your PATH.",
      });
    }

    const jobId = randomUUID();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-synthesis-"));

    const job = {
      jobId,
      status: "queued",
      progress: 0,
      logs: [],
      startedAt: Date.now(),
      tempDir,
    };
    synthesisJobs.set(jobId, job);

    // Write source files
    const topFile = path.join(tempDir, "top.v");
    const constraintsFile = path.join(tempDir, "constraints.xdc");
    const tclFile = path.join(tempDir, "synthesis.tcl");

    const combinedVerilog = primitivesLibrary
      ? `${primitivesLibrary}\n\n${verilog}`
      : verilog;
    fs.writeFileSync(topFile, combinedVerilog);
    fs.writeFileSync(constraintsFile, constraints);

    const part = board === "basys3" ? "xc7a35tcpg236-1" : "xc7a35tcpg236-1";
    const tclScript = generateVivadoTcl(topFile, constraintsFile, tempDir, topModule, part);
    fs.writeFileSync(tclFile, tclScript);

    job.logs.push(`Created temp directory: ${tempDir}`);
    job.logs.push("Starting Vivado synthesis...");
    job.status = "synthesizing";
    job.progress = 10;

    // Broadcast job start
    broadcast(createEvent("synthesis:start", { jobId }));

    // Run Vivado asynchronously
    const vivadoPath = capabilities.vivado.path;
    const platform = os.platform();
    const vivadoCmd = platform === "win32" ? `"${vivadoPath}"` : vivadoPath;

    const proc = spawn(vivadoCmd, ["-mode", "batch", "-source", tclFile], {
      cwd: tempDir,
      shell: true,
    });

    proc.stdout?.on("data", (data) => {
      const text = data.toString();
      job.logs.push(text.trim());

      // Parse progress
      if (text.includes("synth_design")) {
        job.status = "synthesizing";
        job.progress = 30;
      } else if (text.includes("opt_design")) {
        job.progress = 50;
      } else if (text.includes("place_design")) {
        job.status = "routing";
        job.progress = 60;
      } else if (text.includes("route_design")) {
        job.progress = 70;
      } else if (text.includes("write_bitstream")) {
        job.status = "generating";
        job.progress = 90;
      }

      broadcast(createEvent("synthesis:progress", { jobId, status: job.status, progress: job.progress }));
    });

    proc.stderr?.on("data", (data) => {
      job.logs.push(`[STDERR] ${data.toString().trim()}`);
    });

    proc.on("close", (code) => {
      if (code === 0) {
        const bitstreamPath = path.join(tempDir, "output.bit");
        if (fs.existsSync(bitstreamPath)) {
          const bitstream = fs.readFileSync(bitstreamPath);
          job.artifacts = {
            bitstream: bitstream.toString("base64"),
          };

          // Parse reports
          const timingPath = path.join(tempDir, "post_route_timing.rpt");
          const utilPath = path.join(tempDir, "post_route_util.rpt");

          if (fs.existsSync(timingPath)) {
            const content = fs.readFileSync(timingPath, "utf-8");
            const wnsMatch = content.match(/WNS\s*\(ns\)\s*:\s*([-\d.]+)/i);
            const tnsMatch = content.match(/TNS\s*\(ns\)\s*:\s*([-\d.]+)/i);
            job.artifacts.timing = {
              wns: wnsMatch ? parseFloat(wnsMatch[1]) : 0,
              tns: tnsMatch ? parseFloat(tnsMatch[1]) : 0,
              met: wnsMatch ? parseFloat(wnsMatch[1]) >= 0 : true,
            };
          }

          job.status = "complete";
          job.progress = 100;
          job.completedAt = Date.now();
          job.logs.push("Synthesis complete!");
        } else {
          job.status = "failed";
          job.error = "Bitstream was not generated";
          job.logs.push("ERROR: Bitstream was not generated");
        }
      } else {
        job.status = "failed";
        job.error = `Vivado exited with code ${code}`;
        job.logs.push(`ERROR: Vivado exited with code ${code}`);
      }

      broadcast(createEvent("synthesis:complete", { jobId, status: job.status, success: job.status === "complete" }));
    });

    proc.on("error", (err) => {
      job.status = "failed";
      job.error = err.message;
      job.logs.push(`ERROR: ${err.message}`);
      broadcast(createEvent("synthesis:error", { jobId, error: err.message }));
    });

    res.json({ ok: true, jobId });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Get synthesis job status
app.get("/api/synthesize/:jobId", (req, res) => {
  const job = synthesisJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ ok: false, error: "Job not found" });
  }

  res.json({
    ok: true,
    job: {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      logs: job.logs.slice(-50), // Last 50 log lines
      artifacts: job.artifacts,
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    },
  });
});

// Download bitstream
app.get("/api/synthesize/:jobId/bitstream", (req, res) => {
  const job = synthesisJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ ok: false, error: "Job not found" });
  }
  if (!job.artifacts?.bitstream) {
    return res.status(400).json({ ok: false, error: "Bitstream not available" });
  }

  const buffer = Buffer.from(job.artifacts.bitstream, "base64");
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="circuit.bit"`);
  res.send(buffer);
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

async function closeActivePort() {
  if (!activePort) return;
  if (!activePort.isOpen) {
    activePort = null;
    return;
  }
  await new Promise((resolve) => activePort.close(() => resolve()));
  activePort = null;
}

async function connectToFpga(forcedPortPath, baudOverride) {
  await closeActivePort();
  const { selected, ports } = await selectPort();
  const portPath = forcedPortPath || selected?.path;

  if (!portPath) {
    console.log("[fpga-bridge] No suitable serial port found. Ports:");
    console.table(ports.map(p => ({ path: p.path, score: p.score, name: p.friendlyName || p.manufacturer })));
    setConnState("error", { error: "No suitable FPGA serial port found. Plug in board or select port via /ports and /connect.", port: null });
    throw new Error("No suitable FPGA serial port found. Plug in board or select port via /ports and /connect.");
  }

  const baudRate = Number(baudOverride || BAUD);
  setConnState("connecting", { port: portPath, baud: baudRate, error: null });
  console.log(`[fpga-bridge] Connecting to ${portPath} @ ${baudRate}...`);

  const sp = new SerialPort({ path: portPath, baudRate: baudRate, autoOpen: false });
  try {
    await new Promise((resolve, reject) => sp.open((err) => err ? reject(err) : resolve()));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setConnState("error", { error: msg, port: portPath, baud: baudRate });
    throw err;
  }
  activePort = sp;

  state.crc_fail_count = 0;
  state.resync_count = 0;
  state.frames_ok_count = 0;
  state.baud = baudRate;
  state.last_packet_ts = null;
  state.trace_recording_enabled = false;
  packetTimestamps = [];

  let parser = null;
  let traceRecorder = null;
  let decided = false;
  let pending = Buffer.alloc(0);

  const attachTextParser = () => {
    state.trace_recording_enabled = false;
    parser = new ReadlineParser({ delimiter: "\n" });
    parser.on("data", (line) => {
      const msg = parseLine(line);
      if (!msg) return;
      state.lastMsgTs = msg.ts;
      state.lastMsg = msg;
      recordPacket(msg.ts);
      broadcast(createEvent("uart:rx", msg));
    });
  };

  const attachBinaryParser = () => {
    const pipeline = createBinaryPipeline();
    parser = pipeline.parser;
    traceRecorder = pipeline.traceRecorder;
  };

  setConnState("connected", { port: portPath, baud: baudRate, error: null });

  sp.on("close", () => {
    state.last_packet_ts = null;
    state.trace_recording_enabled = false;
    packetTimestamps = [];
    setConnState("disconnected", { port: null, error: null });
    console.log("[fpga-bridge] Serial port closed");
    broadcast(createEvent("status", { ...state }));
    if (parser) parser.end();
    if (traceRecorder) {
      traceRecorder.close().catch(() => {});
      traceRecorder = null;
    }
  });
  sp.on("error", (err) => {
    console.log("[fpga-bridge] Serial error:", err);
    setConnState("error", { error: String(err) });
    broadcast(createEvent("error", { error: String(err) }));
  });

  sp.on("data", (chunk) => {
    if (!decided) {
      pending = Buffer.concat([pending, chunk]);
      if (pending.length < 2) return;
      if (pending[0] === 0x52 && pending[1] === 0x42) {
        attachBinaryParser();
      } else {
        attachTextParser();
      }
      decided = true;
      parser.write(pending);
      pending = Buffer.alloc(0);
      return;
    }
    parser.write(chunk);
  });

  broadcast(createEvent("status", { ...state }));
  console.log("[fpga-bridge] Connected.");
}

wss.on("connection", (ws) => {
  const statusEvent = createEvent("status", { ...state });
  ws.send(JSON.stringify(statusEvent));
});

(async () => {
  if (SIM_MODE) {
    console.log("[fpga-bridge] SIM MODE - generating RB binary packets internally.");
    startSimStream();
    return;
  }
  if (MOCK_MODE) {
    console.log(`[fpga-bridge] MOCK MODE - simulating Basys3 board (seed=${MOCK_SEED})`);
    setConnState("connected", { port: "MOCK", baud: BAUD, error: null });
    broadcast(createEvent("device:connected"));
    
    // Deterministic simulation using seeded RNG
    const rng = new SeededRandom(MOCK_SEED);
    let tick = 0;
    let sw = Math.floor(rng.next() * 0xFFFF);
    let led = sw;
    
    setInterval(() => {
      // Deterministic state changes based on seed
      sw = Math.floor(rng.next() * 0xFFFF);
      led = sw; // Mirror switches to LEDs
      const btn = Math.floor(rng.next() * 0b11111);
      
      const msg = createEvent("io:update", {
        source: "device",
        SW: sw.toString(2).padStart(16, "0"),
        BTN: btn.toString(2).padStart(5, "0"),
        LED: led.toString(2).padStart(16, "0"),
        TICK: String(tick),
        ts_offset_ms: 100, // Relative time since last event
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
    console.log("[fpga-bridge] Or set RB_FPGA_SIM=1 for hardware-free simulation.");
    console.log("[fpga-bridge] RB_FPGA_MOCK=1 keeps the legacy text mock mode.");
  }
})();
