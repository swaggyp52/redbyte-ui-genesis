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
import { buildStreamStartFrame, buildStreamStopFrame } from "./proto/stream.js";
import { createStreamParser } from "./stream-parser.js";
import { StreamRingBuffer } from "./stream-buffer.js";
import { exec, execFile } from "child_process";
import { promisify } from "util";
import * as fslib from "fs"; // Renamed to avoid conflict if fs is imported elsewhere or just use consistency
import * as path from "path";
import * as os from "os";

// Alias fs to match usage if needed, or check if 'fs' is imported elsewhere.
// Line 129 was: import * as fs from "fs";
// But wait, line 160 uses `fs.existsSync`.
// Let's check if `fs` was imported earlier?
// Line 1-15 didn't import fs.
// So I should keep `import * as fs from "fs"`.

import * as fs from "fs";
import RbBinV1Parser from "./parsers/rb-bin-v1.js";
import { RedByteIngestion } from "./ingestion.js";
import {
  createProgramExecutionRunId,
  createProgramRunRegistry,
  formatSseEvent,
  normalizeProgramRunOffset,
} from "./toolchain-program-runs.js";
import {
  parseOpenFPGALoaderDetectOutput,
  selectOpenFPGALoaderDetectCommands,
} from "./toolchain-board-detect.js";
import {
  buildYosysSynthScript,
  createSynthArtifactId,
  extractYosysStatText,
  normalizeSynthSources,
  normalizeSynthTop,
  resolveSelectedYosysPath,
  YOSYS_SYNTH_SCRIPT_VERSION,
} from "./toolchain-synth.js";
import {
  createSynthArtifactsZipBuffer,
  prepareSynthArtifactBundle,
} from "./toolchain-synth-artifacts.js";
import {
  classifyImplementOutputKind,
  createImplementArtifactsZipBuffer,
  readImplementBitstreamArtifact,
  prepareImplementArtifactBundle,
} from "./toolchain-implement-artifacts.js";
import {
  buildImplementPlan,
  isImplementPlanRequest,
} from "./toolchain-implement-plan.js";
import {
  cancelToolchainRun,
} from "./toolchain-run-cancel.js";
import {
  detectVivado,
} from "./toolchain-vivado-detect.js";
import {
  resolveManagedToolCandidates,
} from "./toolchain-tool-resolver.js";
import {
  getBuildpackPlatformKey,
  getBuildpackStoreRoot,
  installBuildpackPayload,
  listInstalledBuildpacks,
  removeBuildpackPayload,
} from "./toolchain-buildpack.js";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

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
const PROGRAM_LOG_TAIL_MAX = Number(process.env.RB_FPGA_PROGRAM_LOG_TAIL_MAX || 2000);
const PROGRAM_LOG_MAX_BYTES = Number(process.env.RB_FPGA_PROGRAM_LOG_MAX_BYTES || 262144);
const TOOLCHAIN_PROGRAM_RUN_LOG_LIMIT = Number(process.env.RB_FPGA_TOOLCHAIN_PROGRAM_RUN_LOG_LIMIT || 2000);
const TOOLCHAIN_PROGRAM_RUN_TTL_MS = Number(process.env.RB_FPGA_TOOLCHAIN_PROGRAM_RUN_TTL_MS || 600000);
const TOOLCHAIN_PROGRAM_RUN_CLEANUP_MS = Number(process.env.RB_FPGA_TOOLCHAIN_PROGRAM_RUN_CLEANUP_MS || 60000);
const TOOLCHAIN_SYNTH_RUN_LOG_LIMIT = Number(process.env.RB_FPGA_TOOLCHAIN_SYNTH_RUN_LOG_LIMIT || 2000);
const TOOLCHAIN_SYNTH_RUN_TTL_MS = Number(process.env.RB_FPGA_TOOLCHAIN_SYNTH_RUN_TTL_MS || 600000);
const TOOLCHAIN_SYNTH_RUN_CLEANUP_MS = Number(process.env.RB_FPGA_TOOLCHAIN_SYNTH_RUN_CLEANUP_MS || 60000);
const TOOLCHAIN_IMPLEMENT_RUN_LOG_LIMIT = Number(process.env.RB_FPGA_TOOLCHAIN_IMPLEMENT_RUN_LOG_LIMIT || 2000);
const TOOLCHAIN_IMPLEMENT_RUN_TTL_MS = Number(process.env.RB_FPGA_TOOLCHAIN_IMPLEMENT_RUN_TTL_MS || 600000);
const TOOLCHAIN_IMPLEMENT_RUN_CLEANUP_MS = Number(process.env.RB_FPGA_TOOLCHAIN_IMPLEMENT_RUN_CLEANUP_MS || 60000);
const TOOLCHAIN_BUILDPACK_RUN_LOG_LIMIT = Number(process.env.RB_FPGA_TOOLCHAIN_BUILDPACK_RUN_LOG_LIMIT || 2000);
const TOOLCHAIN_BUILDPACK_RUN_TTL_MS = Number(process.env.RB_FPGA_TOOLCHAIN_BUILDPACK_RUN_TTL_MS || 600000);
const TOOLCHAIN_BUILDPACK_RUN_CLEANUP_MS = Number(process.env.RB_FPGA_TOOLCHAIN_BUILDPACK_RUN_CLEANUP_MS || 60000);

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

function hashBufferSha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
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

function trimLogContent(content, maxBytes) {
  if (!content) return { content: "", truncated: false };
  const size = Buffer.byteLength(content, "utf8");
  if (size <= maxBytes) {
    return { content, truncated: false };
  }
  const slice = content.slice(-maxBytes);
  return { content: slice, truncated: true };
}

function normalizeProgramBitstreamPayload(rawBitstream) {
  const kind = rawBitstream?.kind === "base64" ? "base64" : null;
  const data = typeof rawBitstream?.data === "string" ? rawBitstream.data : null;
  if (!kind || !data) return null;
  const buffer = decodeBase64Payload(data);
  if (!buffer || buffer.length === 0) return null;
  return { kind, data, buffer };
}

function buildProgramBitstreamRunId({ board, mode, bitstreamHash }) {
  return deterministicId("program-bitstream", {
    board,
    mode,
    bitstream_sha256: bitstreamHash,
  });
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

function hashSeed(value) {
  const str = String(value || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
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
  })).sort((a, b) => b.score - a.score);
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
app.use(express.json({ limit: "50mb" }));

// ============================================================
// TOOLCHAIN DETECTION
// ============================================================

async function findVivado() {
  const result = await detectVivado({
    platform: os.platform(),
    execCommand: async (command, timeoutMs = 15000) => {
      const { stdout } = await execAsync(command, { timeout: timeoutMs });
      return stdout;
    },
    existsSync: (candidatePath) => fs.existsSync(candidatePath),
    readdirSync: (candidatePath) => fs.readdirSync(candidatePath),
  });
  if (!result) return null;
  return finalizeToolSelection([
    {
      ok: true,
      status: result.status === "found_not_in_path" ? "found_not_in_path" : "ok",
      source: result.status === "found_not_in_path" ? "found_not_in_path" : "system",
      integrity: "unknown",
      version: result.version,
      path: result.path,
      foundInPath: result.foundInPath !== false,
      suggestedFix: result.suggestedFix,
    },
  ]);
}

async function runToolVersionProbe(commandPath, args, timeoutMs = 5000) {
  try {
    const result = await execFileAsync(commandPath, args, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    return {
      ok: true,
      stdout: typeof result?.stdout === "string" ? result.stdout : "",
      stderr: typeof result?.stderr === "string" ? result.stderr : "",
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      stdout: typeof error?.stdout === "string" ? error.stdout : "",
      stderr: typeof error?.stderr === "string" ? error.stderr : "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseVersionOrNull(outputText, pattern) {
  const text = typeof outputText === "string" ? outputText : "";
  const match = text.match(pattern);
  return match ? match[1] : null;
}

function buildFoundOutsidePathFix(commandPath, toolLabel) {
  const directory = path.dirname(commandPath);
  return `${toolLabel} found outside PATH. Add "${directory}" to PATH and restart RedByte.`;
}

function buildBundledToolCorruptResult(toolLabel, bundledResult) {
  const errorCode = typeof bundledResult?.error === "string" ? bundledResult.error : "bundled_corrupt";
  const suggestion =
    `Bundled ${toolLabel} failed integrity verification (${errorCode}). ` +
    "Repair bundled tools by reinstalling RedByte or replacing the tools payload.";
  return {
    ok: false,
    status: "missing",
    source: "bundled",
    integrity: "corrupt",
    error: errorCode,
    suggestedFix: suggestion,
    ...(typeof bundledResult?.version === "string" && bundledResult.version.trim().length > 0
      ? { version: bundledResult.version.trim() }
      : {}),
  };
}

function normalizeToolCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const status =
    candidate.status === "found_not_in_path" ? "found_not_in_path" : candidate.status === "missing" ? "missing" : "ok";
  const source =
    candidate.source === "bundled" ||
    candidate.source === "buildpack" ||
    candidate.source === "system" ||
    candidate.source === "found_not_in_path" ||
    candidate.source === "not_found"
      ? candidate.source
      : status === "found_not_in_path"
        ? "found_not_in_path"
        : status === "missing"
          ? "not_found"
          : "system";
  const integrity =
    source === "bundled" || source === "buildpack"
      ? candidate.integrity === "verified" || candidate.integrity === "corrupt" ? candidate.integrity : "unknown"
      : "unknown";
  const ok = candidate.ok === true || status === "ok" || status === "found_not_in_path";
  return {
    ok,
    status,
    source,
    integrity,
    ...(typeof candidate.path === "string" ? { path: candidate.path } : {}),
    ...(typeof candidate.version === "string" ? { version: candidate.version } : {}),
    ...(typeof candidate.buildpackName === "string" ? { buildpackName: candidate.buildpackName } : {}),
    ...(typeof candidate.buildpackVersion === "string" ? { buildpackVersion: candidate.buildpackVersion } : {}),
    ...(typeof candidate.buildpackContractId === "string"
      ? { buildpackContractId: candidate.buildpackContractId }
      : {}),
    ...(typeof candidate.error === "string" ? { error: candidate.error } : {}),
    ...(typeof candidate.suggestedFix === "string" ? { suggestedFix: candidate.suggestedFix } : {}),
  };
}

function getToolCandidatePriority(candidate) {
  if (candidate.source === "bundled" && candidate.integrity === "corrupt") return 500;
  if (candidate.source === "buildpack" && candidate.integrity === "corrupt") return 480;
  if (candidate.source === "bundled" && candidate.status === "ok" && candidate.integrity === "verified") return 400;
  if (candidate.source === "buildpack" && candidate.status === "ok" && candidate.integrity === "verified") return 350;
  if (candidate.source === "system" && candidate.status === "ok") return 300;
  if (candidate.source === "found_not_in_path" && candidate.status === "found_not_in_path") return 200;
  if (candidate.source === "bundled" && candidate.status === "ok") return 150;
  if (candidate.status === "missing") return 50;
  return 0;
}

function toolCandidateSort(left, right) {
  const score = getToolCandidatePriority(right) - getToolCandidatePriority(left);
  if (score !== 0) return score;
  if (left.source !== right.source) return String(left.source).localeCompare(String(right.source));
  if (left.status !== right.status) return String(left.status).localeCompare(String(right.status));
  if (left.integrity !== right.integrity) return String(left.integrity).localeCompare(String(right.integrity));
  if (left.path !== right.path) return String(left.path || "").localeCompare(String(right.path || ""));
  if (left.version !== right.version) return String(left.version || "").localeCompare(String(right.version || ""));
  return String(left.error || "").localeCompare(String(right.error || ""));
}

function finalizeToolSelection(candidates) {
  const normalized = candidates
    .map((candidate) => normalizeToolCandidate(candidate))
    .filter(Boolean)
    .sort(toolCandidateSort);

  if (normalized.length === 0) return null;

  const selected = normalized[0];
  const alternates = normalized.slice(1).map((candidate) => ({
    source: candidate.source,
    status: candidate.status,
    integrity: candidate.integrity,
    ...(typeof candidate.version === "string" ? { version: candidate.version } : {}),
    ...(typeof candidate.buildpackName === "string" ? { buildpackName: candidate.buildpackName } : {}),
    ...(typeof candidate.buildpackVersion === "string" ? { buildpackVersion: candidate.buildpackVersion } : {}),
    ...(typeof candidate.buildpackContractId === "string"
      ? { buildpackContractId: candidate.buildpackContractId }
      : {}),
    ...(typeof candidate.path === "string" ? { path: candidate.path } : {}),
    ...(typeof candidate.error === "string" ? { error: candidate.error } : {}),
  }));

  return {
    ...selected,
    alternates,
  };
}

async function findYosys() {
  const platform = os.platform();
  const arch = os.arch();
  const yosysExe = platform === "win32" ? "yosys.exe" : "yosys";
  const repoRoot = getRepoRoot();
  const candidates = [];

  const managed = resolveManagedToolCandidates({
    repoRoot,
    platform,
    arch,
    toolId: "yosys",
    executableName: yosysExe,
    existsSync: (candidatePath) => fs.existsSync(candidatePath),
  });
  for (const managedCandidate of managed) {
    if (managedCandidate.source === "bundled") {
      if (managedCandidate.status === "ok" && managedCandidate.path) {
        candidates.push({
          ok: true,
          status: "ok",
          source: "bundled",
          integrity: managedCandidate.integrity || "unknown",
          path: managedCandidate.path,
          version: managedCandidate.version || "unknown",
        });
      } else {
        candidates.push(buildBundledToolCorruptResult("Yosys", managedCandidate));
      }
      continue;
    }
    if (managedCandidate.source === "buildpack") {
      candidates.push({
        ok: managedCandidate.ok === true,
        status: managedCandidate.status === "missing" ? "missing" : "ok",
        source: "buildpack",
        integrity: managedCandidate.integrity || "unknown",
        ...(typeof managedCandidate.path === "string" ? { path: managedCandidate.path } : {}),
        ...(typeof managedCandidate.version === "string" ? { version: managedCandidate.version } : {}),
        ...(typeof managedCandidate.buildpackName === "string" ? { buildpackName: managedCandidate.buildpackName } : {}),
        ...(typeof managedCandidate.buildpackVersion === "string" ? { buildpackVersion: managedCandidate.buildpackVersion } : {}),
        ...(typeof managedCandidate.buildpackContractId === "string"
          ? { buildpackContractId: managedCandidate.buildpackContractId }
          : {}),
        ...(typeof managedCandidate.error === "string" ? { error: managedCandidate.error } : {}),
        ...(typeof managedCandidate.suggestedFix === "string" ? { suggestedFix: managedCandidate.suggestedFix } : {}),
      });
    }
  }

  const systemProbe = await runToolVersionProbe(yosysExe, ["-V"]);
  const systemVersion = parseVersionOrNull(`${systemProbe.stdout}\n${systemProbe.stderr}`, /Yosys (\d+\.\d+(?:\+\d+)?)/i);
  if (systemProbe.ok || systemVersion) {
    candidates.push({
      ok: true,
      status: "ok",
      source: "system",
      integrity: "unknown",
      path: yosysExe,
      version: systemVersion || "unknown",
    });
  }

  // Check oss-cad-suite
  const ossCadPaths = platform === "win32"
    ? ["C:\\oss-cad-suite\\bin", "D:\\oss-cad-suite\\bin"]
    : ["/opt/oss-cad-suite/bin", path.join(os.homedir(), "oss-cad-suite/bin")];

  for (const binPath of ossCadPaths) {
    const yosysPath = path.join(binPath, yosysExe);
    if (fs.existsSync(yosysPath)) {
      const probe = await runToolVersionProbe(yosysPath, ["-V"]);
      const version = parseVersionOrNull(`${probe.stdout}\n${probe.stderr}`, /Yosys (\d+\.\d+(?:\+\d+)?)/i);
      if (probe.ok || version) {
        candidates.push({
          ok: true,
          status: "found_not_in_path",
          source: "found_not_in_path",
          integrity: "unknown",
          path: yosysPath,
          version: version || "unknown",
          suggestedFix: buildFoundOutsidePathFix(yosysPath, "Yosys"),
        });
      }
    }
  }

  return finalizeToolSelection(candidates);
}

async function findOpenFPGALoader() {
  const platform = os.platform();
  const arch = os.arch();
  const loaderExe = platform === "win32" ? "openFPGALoader.exe" : "openFPGALoader";
  const repoRoot = getRepoRoot();
  const candidates = [];

  const managed = resolveManagedToolCandidates({
    repoRoot,
    platform,
    arch,
    toolId: "openFPGALoader",
    executableName: loaderExe,
    existsSync: (candidatePath) => fs.existsSync(candidatePath),
  });
  for (const managedCandidate of managed) {
    if (managedCandidate.source === "bundled") {
      if (managedCandidate.status === "ok" && managedCandidate.path) {
        candidates.push({
          ok: true,
          status: "ok",
          source: "bundled",
          integrity: managedCandidate.integrity || "unknown",
          path: managedCandidate.path,
          version: managedCandidate.version || "unknown",
        });
      } else {
        candidates.push(buildBundledToolCorruptResult("openFPGALoader", managedCandidate));
      }
      continue;
    }
    if (managedCandidate.source === "buildpack") {
      candidates.push({
        ok: managedCandidate.ok === true,
        status: managedCandidate.status === "missing" ? "missing" : "ok",
        source: "buildpack",
        integrity: managedCandidate.integrity || "unknown",
        ...(typeof managedCandidate.path === "string" ? { path: managedCandidate.path } : {}),
        ...(typeof managedCandidate.version === "string" ? { version: managedCandidate.version } : {}),
        ...(typeof managedCandidate.buildpackName === "string" ? { buildpackName: managedCandidate.buildpackName } : {}),
        ...(typeof managedCandidate.buildpackVersion === "string" ? { buildpackVersion: managedCandidate.buildpackVersion } : {}),
        ...(typeof managedCandidate.buildpackContractId === "string"
          ? { buildpackContractId: managedCandidate.buildpackContractId }
          : {}),
        ...(typeof managedCandidate.error === "string" ? { error: managedCandidate.error } : {}),
        ...(typeof managedCandidate.suggestedFix === "string" ? { suggestedFix: managedCandidate.suggestedFix } : {}),
      });
    }
  }

  const probe = await runToolVersionProbe(loaderExe, ["--version"]);
  const version = parseVersionOrNull(`${probe.stdout}\n${probe.stderr}`, /openFPGALoader v?(\d+\.\d+(?:\.\d+)?)/i);
  if (probe.ok || version) {
    candidates.push({
      ok: true,
      status: "ok",
      source: "system",
      integrity: "unknown",
      path: loaderExe,
      version: version || "unknown",
    });
  }

  return finalizeToolSelection(candidates);
}

async function runCommandCollect(commandPath, args, timeoutMs = 8000) {
  try {
    const result = await execFileAsync(commandPath, args, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    return {
      ok: true,
      exitCode: 0,
      stdout: typeof result?.stdout === "string" ? result.stdout : "",
      stderr: typeof result?.stderr === "string" ? result.stderr : "",
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: typeof error?.code === "number" ? error.code : null,
      stdout: typeof error?.stdout === "string" ? error.stdout : "",
      stderr: typeof error?.stderr === "string" ? error.stderr : "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EPERM") return true;
    return false;
  }
}

async function terminateProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return { ok: false, error: "invalid_pid" };
  }

  if (process.platform === "win32") {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        shell: false,
        windowsHide: true,
      });
      let stderr = "";

      killer.stderr?.on("data", (chunk) => {
        stderr += String(chunk || "");
      });

      killer.on("error", (error) => {
        const message = error instanceof Error ? error.message : String(error);
        resolve({ ok: false, error: `taskkill_error:${message}` });
      });

      killer.on("close", (code) => {
        if (code === 0) {
          resolve({ ok: true, signal: "taskkill" });
          return;
        }
        const detail = stderr.trim();
        resolve({
          ok: false,
          error: detail ? `taskkill_exit_${code}:${detail}` : `taskkill_exit_${code}`,
        });
      });
    });
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ESRCH") {
      return { ok: true, signal: "already_exited" };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `sigterm_error:${message}` };
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await sleepMs(100);
    if (!isProcessRunning(pid)) {
      return { ok: true, signal: "SIGTERM" };
    }
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ESRCH") {
      return { ok: true, signal: "already_exited" };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `sigkill_error:${message}` };
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await sleepMs(100);
    if (!isProcessRunning(pid)) {
      return { ok: true, signal: "SIGKILL" };
    }
  }

  return { ok: false, error: "process_still_running" };
}

async function runOpenFpgaLoaderProgram({ loaderPath, board, bitPath, mode, pushLog, onSpawn, isCancelRequested }) {
  return new Promise((resolve) => {
    const args = ["-b", board];
    if (mode === "flash") {
      args.push("-f");
    }
    args.push(bitPath);

    pushLog("info", `[bridge] program: command: ${loaderPath} ${args.join(" ")}`);
    const proc = spawn(loaderPath, args, { shell: false });
    onSpawn?.(proc);

    let stdoutText = "";
    let stderrText = "";
    let stdoutRemainder = "";
    let stderrRemainder = "";

    const flushLines = (buffer, level) => {
      const lines = buffer.split(/\r?\n/);
      const remainder = lines.pop() || "";
      for (const lineRaw of lines) {
        const line = lineRaw.trim();
        if (!line) continue;
        pushLog(level, `[openFPGALoader] ${line}`);
      }
      return remainder;
    };

    proc.stdout?.on("data", (chunk) => {
      const text = String(chunk || "");
      stdoutText += text;
      stdoutRemainder = flushLines(`${stdoutRemainder}${text}`, "info");
    });

    proc.stderr?.on("data", (chunk) => {
      const text = String(chunk || "");
      stderrText += text;
      stderrRemainder = flushLines(`${stderrRemainder}${text}`, "warn");
    });

    proc.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (isCancelRequested?.()) {
        resolve({
          ok: false,
          canceled: true,
          exitCode: -1,
          stdout: stdoutText,
          stderr: stderrText,
          error: "canceled_by_user",
        });
        return;
      }
      pushLog("error", `[bridge] program: spawn_failed: ${message}`);
      resolve({ ok: false, exitCode: null, stdout: stdoutText, stderr: stderrText, error: message });
    });

    proc.on("close", (code) => {
      if (isCancelRequested?.()) {
        resolve({
          ok: false,
          canceled: true,
          exitCode: typeof code === "number" ? code : -1,
          stdout: stdoutText,
          stderr: stderrText,
          error: "canceled_by_user",
        });
        return;
      }

      const trailingStdout = stdoutRemainder.trim();
      if (trailingStdout) {
        pushLog("info", `[openFPGALoader] ${trailingStdout}`);
      }
      const trailingStderr = stderrRemainder.trim();
      if (trailingStderr) {
        pushLog("warn", `[openFPGALoader] ${trailingStderr}`);
      }
      const exitCode = typeof code === "number" ? code : null;
      if (exitCode === 0) {
        pushLog("info", "[bridge] program: openFPGALoader finished successfully");
        resolve({ ok: true, exitCode, stdout: stdoutText, stderr: stderrText, error: null });
      } else {
        const message = `openFPGALoader_exit_${exitCode ?? "unknown"}`;
        pushLog("error", `[bridge] program: ${message}`);
        resolve({ ok: false, exitCode, stdout: stdoutText, stderr: stderrText, error: message });
      }
    });
  });
}

async function findNextpnrXilinx() {
  const platform = os.platform();
  const arch = os.arch();
  const nextpnrExe = platform === "win32" ? "nextpnr-xilinx.exe" : "nextpnr-xilinx";
  const repoRoot = getRepoRoot();
  const candidates = [];

  const managed = resolveManagedToolCandidates({
    repoRoot,
    platform,
    arch,
    toolId: "nextpnr-xilinx",
    executableName: nextpnrExe,
    existsSync: (candidatePath) => fs.existsSync(candidatePath),
  });
  for (const managedCandidate of managed) {
    if (managedCandidate.source === "bundled") {
      if (managedCandidate.status === "ok" && managedCandidate.path) {
        candidates.push({
          ok: true,
          status: "ok",
          source: "bundled",
          integrity: managedCandidate.integrity || "unknown",
          path: managedCandidate.path,
          version: managedCandidate.version || "unknown",
        });
      } else {
        candidates.push(buildBundledToolCorruptResult("nextpnr-xilinx", managedCandidate));
      }
      continue;
    }
    if (managedCandidate.source === "buildpack") {
      candidates.push({
        ok: managedCandidate.ok === true,
        status: managedCandidate.status === "missing" ? "missing" : "ok",
        source: "buildpack",
        integrity: managedCandidate.integrity || "unknown",
        ...(typeof managedCandidate.path === "string" ? { path: managedCandidate.path } : {}),
        ...(typeof managedCandidate.version === "string" ? { version: managedCandidate.version } : {}),
        ...(typeof managedCandidate.buildpackName === "string" ? { buildpackName: managedCandidate.buildpackName } : {}),
        ...(typeof managedCandidate.buildpackVersion === "string" ? { buildpackVersion: managedCandidate.buildpackVersion } : {}),
        ...(typeof managedCandidate.buildpackContractId === "string"
          ? { buildpackContractId: managedCandidate.buildpackContractId }
          : {}),
        ...(typeof managedCandidate.error === "string" ? { error: managedCandidate.error } : {}),
        ...(typeof managedCandidate.suggestedFix === "string" ? { suggestedFix: managedCandidate.suggestedFix } : {}),
      });
    }
  }

  const probe = await runToolVersionProbe(nextpnrExe, ["--version"]);
  const combined = `${probe.stdout || ""}\n${probe.stderr || ""}`.trim();
  const firstLine = combined.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  if (firstLine) {
    candidates.push({
      ok: true,
      status: "ok",
      source: "system",
      integrity: "unknown",
      path: nextpnrExe,
      version: firstLine.trim(),
    });
  }

  return finalizeToolSelection(candidates);
}

async function findF4pga() {
  const platform = os.platform();
  const arch = os.arch();
  const f4pgaExe = platform === "win32" ? "f4pga.exe" : "f4pga";
  const repoRoot = getRepoRoot();
  const candidates = [];

  const managed = resolveManagedToolCandidates({
    repoRoot,
    platform,
    arch,
    toolId: "f4pga",
    executableName: f4pgaExe,
    existsSync: (candidatePath) => fs.existsSync(candidatePath),
  });
  for (const managedCandidate of managed) {
    if (managedCandidate.source === "bundled") {
      if (managedCandidate.status === "ok" && managedCandidate.path) {
        candidates.push({
          ok: true,
          status: "ok",
          source: "bundled",
          integrity: managedCandidate.integrity || "unknown",
          path: managedCandidate.path,
          version: managedCandidate.version || "unknown",
        });
      } else {
        candidates.push(buildBundledToolCorruptResult("f4pga", managedCandidate));
      }
      continue;
    }
    if (managedCandidate.source === "buildpack") {
      candidates.push({
        ok: managedCandidate.ok === true,
        status: managedCandidate.status === "missing" ? "missing" : "ok",
        source: "buildpack",
        integrity: managedCandidate.integrity || "unknown",
        ...(typeof managedCandidate.path === "string" ? { path: managedCandidate.path } : {}),
        ...(typeof managedCandidate.version === "string" ? { version: managedCandidate.version } : {}),
        ...(typeof managedCandidate.buildpackName === "string" ? { buildpackName: managedCandidate.buildpackName } : {}),
        ...(typeof managedCandidate.buildpackVersion === "string" ? { buildpackVersion: managedCandidate.buildpackVersion } : {}),
        ...(typeof managedCandidate.buildpackContractId === "string"
          ? { buildpackContractId: managedCandidate.buildpackContractId }
          : {}),
        ...(typeof managedCandidate.error === "string" ? { error: managedCandidate.error } : {}),
        ...(typeof managedCandidate.suggestedFix === "string" ? { suggestedFix: managedCandidate.suggestedFix } : {}),
      });
    }
  }

  const probe = await runToolVersionProbe(f4pgaExe, ["--version"]);
  const combined = `${probe.stdout || ""}\n${probe.stderr || ""}`.trim();
  const firstLine = combined.split(/\r?\n/).find((line) => line.trim().length > 0) || "";
  if (firstLine) {
    candidates.push({
      ok: true,
      status: "ok",
      source: "system",
      integrity: "unknown",
      path: f4pgaExe,
      version: firstLine.trim(),
    });
  }

  return finalizeToolSelection(candidates);
}

async function detectToolchain() {
  const capabilities = {};

  const [vivado, yosys, openFPGALoader, nextpnrXilinx, f4pga] = await Promise.all([
    findVivado().catch(() => null),
    findYosys().catch(() => null),
    findOpenFPGALoader().catch(() => null),
    findNextpnrXilinx().catch(() => null),
    findF4pga().catch(() => null),
  ]);

  const normalizeAlternates = (alternates) => {
    if (!Array.isArray(alternates)) return [];
    return alternates
      .map((alternate) => normalizeToolCandidate(alternate))
      .filter(Boolean)
      .map((alternate) => ({
        source: alternate.source,
        status: alternate.status,
        integrity: alternate.integrity,
        ...(typeof alternate.version === "string" ? { version: alternate.version } : {}),
        ...(typeof alternate.buildpackName === "string" ? { buildpackName: alternate.buildpackName } : {}),
        ...(typeof alternate.buildpackVersion === "string" ? { buildpackVersion: alternate.buildpackVersion } : {}),
        ...(typeof alternate.buildpackContractId === "string"
          ? { buildpackContractId: alternate.buildpackContractId }
          : {}),
        ...(typeof alternate.path === "string" ? { path: alternate.path } : {}),
        ...(typeof alternate.error === "string" ? { error: alternate.error } : {}),
      }))
      .sort(toolCandidateSort);
  };

  const mapCapability = (tool) => {
    if (!tool) return null;
    const status = tool.status === "found_not_in_path" ? "found_not_in_path" : tool.status === "missing" ? "missing" : "ok";
    const source =
      tool.source === "bundled" ||
      tool.source === "buildpack" ||
      tool.source === "system" ||
      tool.source === "found_not_in_path" ||
      tool.source === "not_found"
        ? tool.source
        : status === "found_not_in_path"
          ? "found_not_in_path"
          : status === "missing"
            ? "not_found"
            : "system";
    const integrity =
      source === "bundled" || source === "buildpack"
        ? (tool.integrity === "verified" || tool.integrity === "corrupt" ? tool.integrity : "unknown")
        : "unknown";
    return {
      ok: tool.ok !== false && status !== "missing",
      status,
      source,
      integrity,
      ...(typeof tool.version === "string" ? { version: tool.version } : {}),
      ...(typeof tool.buildpackName === "string" ? { buildpackName: tool.buildpackName } : {}),
      ...(typeof tool.buildpackVersion === "string" ? { buildpackVersion: tool.buildpackVersion } : {}),
      ...(typeof tool.buildpackContractId === "string" ? { buildpackContractId: tool.buildpackContractId } : {}),
      ...(typeof tool.path === "string" ? { path: tool.path } : {}),
      ...(typeof tool.error === "string" ? { error: tool.error } : {}),
      ...(typeof tool.suggestedFix === "string" ? { suggestedFix: tool.suggestedFix } : {}),
      alternates: normalizeAlternates(tool.alternates),
    };
  };

  if (vivado) {
    const mapped = mapCapability(vivado);
    if (mapped) {
      capabilities.vivado = {
        ...mapped,
        foundInPath: vivado.foundInPath !== false,
        canSynthesize: mapped.ok,
        canProgram: mapped.ok,
      };
    }
  }

  if (yosys) {
    const mapped = mapCapability(yosys);
    if (mapped) {
      capabilities.yosys = mapped;
    }
  }

  if (openFPGALoader) {
    const mapped = mapCapability(openFPGALoader);
    if (mapped) {
      capabilities.openFPGALoader = mapped;
    }
  }

  if (nextpnrXilinx) {
    const mapped = mapCapability(nextpnrXilinx);
    if (mapped) {
      capabilities.nextpnrXilinx = mapped;
    }
  }

  if (f4pga) {
    const mapped = mapCapability(f4pga);
    if (mapped) {
      capabilities.f4pga = mapped;
    }
  }

  if (vivado && !capabilities.vivado) {
    capabilities.vivado = {
      ok: true,
      status: "ok",
      source: "system",
      integrity: "unknown",
      ...(typeof vivado.version === "string" ? { version: vivado.version } : {}),
      ...(typeof vivado.path === "string" ? { path: vivado.path } : {}),
      foundInPath: vivado.foundInPath !== false,
      canSynthesize: true,
      canProgram: true,
      alternates: [],
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

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function deterministicId(prefix, payload) {
  const text = stableStringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(16).padStart(8, "0");
  return `${prefix}-${suffix}`;
}

const toolchainProgramRuns = createProgramRunRegistry({
  logLimit: TOOLCHAIN_PROGRAM_RUN_LOG_LIMIT,
  ttlMs: TOOLCHAIN_PROGRAM_RUN_TTL_MS,
  step: "program",
});
let toolchainProgramExecutionSeq = 0;

setInterval(() => {
  toolchainProgramRuns.cleanup(Date.now());
}, TOOLCHAIN_PROGRAM_RUN_CLEANUP_MS);

const toolchainSynthRuns = createProgramRunRegistry({
  logLimit: TOOLCHAIN_SYNTH_RUN_LOG_LIMIT,
  ttlMs: TOOLCHAIN_SYNTH_RUN_TTL_MS,
  step: "synth",
});
let toolchainSynthExecutionSeq = 0;

setInterval(() => {
  toolchainSynthRuns.cleanup(Date.now());
}, TOOLCHAIN_SYNTH_RUN_CLEANUP_MS);

const toolchainImplementRuns = createProgramRunRegistry({
  logLimit: TOOLCHAIN_IMPLEMENT_RUN_LOG_LIMIT,
  ttlMs: TOOLCHAIN_IMPLEMENT_RUN_TTL_MS,
  step: "implement",
});
let toolchainBuildpackExecutionSeq = 0;

setInterval(() => {
  toolchainImplementRuns.cleanup(Date.now());
}, TOOLCHAIN_IMPLEMENT_RUN_CLEANUP_MS);

const toolchainBuildpackRuns = createProgramRunRegistry({
  logLimit: TOOLCHAIN_BUILDPACK_RUN_LOG_LIMIT,
  ttlMs: TOOLCHAIN_BUILDPACK_RUN_TTL_MS,
  step: "buildpack",
});

setInterval(() => {
  toolchainBuildpackRuns.cleanup(Date.now());
}, TOOLCHAIN_BUILDPACK_RUN_CLEANUP_MS);

const TOOLCHAIN_RUN_REGISTRIES = [
  { kind: "program", registry: toolchainProgramRuns },
  { kind: "synth", registry: toolchainSynthRuns },
  { kind: "implement", registry: toolchainImplementRuns },
  { kind: "buildpack", registry: toolchainBuildpackRuns },
];

function normalizePreflightProject(rawProject) {
  const rawHdl = rawProject?.hdl && typeof rawProject.hdl === "object" ? rawProject.hdl : {};
  const rawFpga = rawProject?.fpga && typeof rawProject.fpga === "object" ? rawProject.fpga : {};

  const rawSources = Array.isArray(rawHdl.sources) ? rawHdl.sources : [];
  const sources = rawSources
    .map((source) => ({
      path: typeof source?.path === "string" ? source.path : "",
      language: source?.language === "vhdl" ? "vhdl" : "verilog",
      text: typeof source?.text === "string" ? source.text : "",
    }))
    .filter((source) => source.path.trim().length > 0)
    .sort((a, b) => a.path.localeCompare(b.path));

  const topRaw = typeof rawHdl.top === "string" && rawHdl.top.trim().length > 0
    ? rawHdl.top.trim()
    : typeof rawFpga.top === "string" && rawFpga.top.trim().length > 0
      ? rawFpga.top.trim()
      : null;

  const board = rawFpga.board === "basys3" ? "basys3" : "basys3";
  const preset = typeof rawFpga.preset === "string" && rawFpga.preset.trim().length > 0 ? rawFpga.preset.trim() : null;
  const constraintsText = rawFpga?.constraints?.type === "xdc" && typeof rawFpga?.constraints?.text === "string"
    ? rawFpga.constraints.text
    : "";

  return {
    hdl: {
      sources,
      top: topRaw,
    },
    fpga: {
      board,
      preset,
      constraints: constraintsText.trim().length > 0 ? { type: "xdc", text: constraintsText } : null,
      top: topRaw,
    },
  };
}

function stripVerilogComments(text) {
  return String(text || "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
}

function extractVerilogPortsFromTop(sources, topName) {
  const modulePattern = new RegExp(`module\\s+${topName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(([^;]*?)\\)\\s*;`, "ms");

  for (const source of sources.filter((entry) => entry.language === "verilog")) {
    const match = stripVerilogComments(source.text).match(modulePattern);
    if (!match) continue;
    const portBlock = match[1] || "";
    const ports = [];
    for (const tokenRaw of portBlock.split(",").map((part) => part.trim()).filter(Boolean)) {
      let token = tokenRaw.split("=")[0]?.trim() || "";
      token = token.replace(/\b(input|output|inout|wire|reg|logic|signed|unsigned)\b/g, " ").trim();
      if (!token) continue;
      const matchPort = token.match(/^(?:\[\s*\d+\s*:\s*\d+\s*\]\s*)?([A-Za-z_][A-Za-z0-9_]*)(?:\s*\[\s*\d+\s*:\s*\d+\s*\])?$/);
      if (!matchPort) continue;
      const name = matchPort[1];
      const leadingRange = token.match(/^(\[\s*\d+\s*:\s*\d+\s*\])/)?.[1] || null;
      const trailingRange = token.match(/\[\s*\d+\s*:\s*\d+\s*\]$/)?.[0] || null;
      const range = leadingRange || trailingRange;
      const rangeMatch = range?.match(/\[\s*(\d+)\s*:\s*(\d+)\s*\]/);
      if (!rangeMatch) {
        ports.push(name);
        continue;
      }
      const low = Math.min(Number(rangeMatch[1]), Number(rangeMatch[2]));
      const high = Math.max(Number(rangeMatch[1]), Number(rangeMatch[2]));
      for (let index = low; index <= high; index += 1) {
        ports.push(`${name}[${index}]`);
      }
    }
    return { found: true, ports: Array.from(new Set(ports)).sort((a, b) => a.localeCompare(b)) };
  }
  return { found: false, ports: [] };
}

function extractXdcPorts(text) {
  const ports = [];
  const pattern = /\[\s*get_ports\s+(?:\{([^}]+)\}|([^\]\s]+))\s*\]/g;
  let match = pattern.exec(text || "");
  while (match) {
    const port = (match[1] || match[2] || "").trim();
    if (port) ports.push(port);
    match = pattern.exec(text || "");
  }
  return Array.from(new Set(ports)).sort((a, b) => a.localeCompare(b));
}

function summarizePorts(portNames) {
  if (portNames.length <= 6) return portNames.join(", ");
  return `${portNames.slice(0, 6).join(", ")}, +${portNames.length - 6} more`;
}

function createPreflightEntries(runId, level, messages) {
  return messages
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .map((msg, index) => ({
      run_id: runId,
      ts: index,
      step: "preflight",
      level,
      msg,
    }));
}

function buildPreflightFromProject(project, toolList) {
  const topName = project.hdl.top || null;
  const xdcText = project.fpga?.constraints?.text || "";
  const hdlSources = project.hdl.sources || [];
  const hasHdl = hdlSources.some((source) => String(source.text || "").trim().length > 0);
  const hasXdc = xdcText.trim().length > 0;
  const lintErrors = [];
  const lintWarnings = [];

  if (!hasHdl) lintErrors.push("[preflight] project: missing_hdl_sources");
  if (!topName) lintErrors.push('[preflight] project: missing_top_module (expected "top")');
  if (!hasXdc) lintErrors.push("[preflight] project: missing_xdc_constraints");

  let topFound = false;
  let hdlPorts = [];
  let xdcPorts = [];
  if (hasHdl && topName && hasXdc) {
    const parsed = extractVerilogPortsFromTop(hdlSources, topName);
    topFound = parsed.found;
    hdlPorts = parsed.ports;
    xdcPorts = extractXdcPorts(xdcText);
    if (!topFound) {
      lintErrors.push(`[preflight] lint: top module "${topName}" not found`);
    } else {
      const hdlSet = new Set(hdlPorts);
      const xdcSet = new Set(xdcPorts);
      const requiredPorts = [
        "clk",
        "dp",
        ...Array.from({ length: 16 }, (_, index) => `sw[${index}]`),
        ...Array.from({ length: 5 }, (_, index) => `btn[${index}]`),
        ...Array.from({ length: 16 }, (_, index) => `led[${index}]`),
        ...Array.from({ length: 7 }, (_, index) => `seg[${index}]`),
        ...Array.from({ length: 4 }, (_, index) => `an[${index}]`),
      ];
      const missingInHdl = xdcPorts.filter((port) => !hdlSet.has(port));
      const missingInXdc = hdlPorts.filter((port) => !xdcSet.has(port));
      const missingContract = requiredPorts.filter((port) => !hdlSet.has(port));
      if (missingInHdl.length > 0) {
        lintErrors.push(`[preflight] lint: xdc_missing_in_hdl (${missingInHdl.length}): ${summarizePorts(missingInHdl)}`);
      }
      if (missingInXdc.length > 0) {
        lintWarnings.push(`[preflight] lint: hdl_unconstrained_in_xdc (${missingInXdc.length}): ${summarizePorts(missingInXdc)}`);
      }
      if (missingContract.length > 0) {
        lintWarnings.push(`[preflight] lint: missing_contract_ports (${missingContract.length}): ${summarizePorts(missingContract)}`);
      }
    }
  }

  const run_id = deterministicId("bridge-preflight", {
    project,
    tools: toolList.map((tool) => ({
      name: tool.name,
      ok: tool.ok,
      status: tool.status || null,
      source: tool.source || null,
      integrity: tool.integrity || null,
      version: tool.version || null,
      path: tool.path || null,
      error: tool.error || null,
      suggestedFix: tool.suggestedFix || null,
      alternates: Array.isArray(tool.alternates)
        ? tool.alternates.map((alternate) => ({
            source: alternate.source || null,
            status: alternate.status || null,
            integrity: alternate.integrity || null,
            version: alternate.version || null,
            path: alternate.path || null,
            error: alternate.error || null,
          }))
        : [],
    })),
    lintErrors,
    lintWarnings,
  });
  const errors = createPreflightEntries(run_id, "error", lintErrors);
  const warnings = createPreflightEntries(run_id, "warn", lintWarnings);
  return {
    schema_version: "toolchain_preflight_v1",
    run_id,
    ts: 0,
    project: {
      board: "basys3",
      hasHdl,
      top: topName,
      hasXdc,
      preset: project.fpga.preset || null,
    },
    lint: {
      ok: errors.length === 0,
      warnings,
      errors,
    },
    tools: toolList,
    overallOk: errors.length === 0,
  };
}

function buildToolListFromCapabilities(capabilities) {
  const normalizeAlternates = (rawAlternates) => {
    if (!Array.isArray(rawAlternates)) return [];
    return rawAlternates
      .map((alternate) => normalizeToolCandidate(alternate))
      .filter(Boolean)
      .map((alternate) => ({
        source: alternate.source,
        status: alternate.status,
        integrity: alternate.integrity,
        ...(typeof alternate.version === "string" ? { version: alternate.version } : {}),
        ...(typeof alternate.buildpackName === "string" ? { buildpackName: alternate.buildpackName } : {}),
        ...(typeof alternate.buildpackVersion === "string" ? { buildpackVersion: alternate.buildpackVersion } : {}),
        ...(typeof alternate.buildpackContractId === "string"
          ? { buildpackContractId: alternate.buildpackContractId }
          : {}),
        ...(typeof alternate.path === "string" ? { path: alternate.path } : {}),
        ...(typeof alternate.error === "string" ? { error: alternate.error } : {}),
      }))
      .sort(toolCandidateSort);
  };

  return [
    { name: "openFPGALoader", capKey: "openFPGALoader" },
    { name: "yosys", capKey: "yosys" },
    { name: "nextpnr-xilinx", capKey: "nextpnrXilinx" },
    { name: "f4pga", capKey: "f4pga" },
    { name: "vivado", capKey: "vivado" },
  ]
    .map((toolDef) => {
      const cap = capabilities?.[toolDef.capKey];
      if (!cap || cap.status === "missing" || cap.ok === false) {
        const source =
          cap?.source === "bundled" ||
          cap?.source === "buildpack" ||
          cap?.source === "system" ||
          cap?.source === "not_found" ||
          cap?.source === "found_not_in_path"
            ? cap.source
            : "not_found";
        const integrity =
          source === "bundled" || source === "buildpack"
            ? cap?.integrity === "verified" || cap?.integrity === "corrupt"
              ? cap.integrity
              : "unknown"
            : "unknown";
        return {
          name: toolDef.name,
          ok: false,
          status: "missing",
          source,
          integrity,
          error: typeof cap?.error === "string" ? cap.error : "not_found",
          ...(typeof cap?.suggestedFix === "string" && cap.suggestedFix.trim().length > 0
            ? { suggestedFix: cap.suggestedFix.trim() }
            : {}),
          alternates: normalizeAlternates(cap?.alternates),
        };
      }
      const status = cap?.status === "found_not_in_path" ? "found_not_in_path" : "ok";
      const source =
        cap?.source === "bundled" || cap?.source === "buildpack" || cap?.source === "system" || cap?.source === "found_not_in_path"
          ? cap.source
          : status === "found_not_in_path"
            ? "found_not_in_path"
            : "system";
      const integrity =
        source === "bundled" || source === "buildpack"
          ? cap?.integrity === "verified" || cap?.integrity === "corrupt"
            ? cap.integrity
            : "unknown"
          : "unknown";
      const tool = {
        name: toolDef.name,
        ok: true,
        status,
        source,
        integrity,
      };
      if (typeof cap.version === "string") tool.version = cap.version;
      if (typeof cap.buildpackName === "string") tool.buildpackName = cap.buildpackName;
      if (typeof cap.buildpackVersion === "string") tool.buildpackVersion = cap.buildpackVersion;
      if (typeof cap.buildpackContractId === "string") tool.buildpackContractId = cap.buildpackContractId;
      if (typeof cap.path === "string") tool.path = cap.path;
      if (typeof cap.error === "string") tool.error = cap.error;
      if (typeof cap.suggestedFix === "string" && cap.suggestedFix.trim().length > 0) {
        tool.suggestedFix = cap.suggestedFix.trim();
      }
      tool.alternates = normalizeAlternates(cap.alternates);
      return tool;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildProbeFromCapabilities(capabilities) {
  const env = {
    platform: os.platform(),
    arch: os.arch(),
    node: process.version,
  };
  const tools = buildToolListFromCapabilities(capabilities);
  const run_id = deterministicId("bridge-probe", {
    env,
    tools: tools.map((tool) => ({
      name: tool.name,
      ok: tool.ok,
      status: tool.status || null,
      source: tool.source || null,
      integrity: tool.integrity || null,
      version: tool.version || null,
      path: tool.path || null,
      error: tool.error || null,
      suggestedFix: tool.suggestedFix || null,
      alternates: Array.isArray(tool.alternates)
        ? tool.alternates.map((alternate) => ({
            source: alternate.source || null,
            status: alternate.status || null,
            integrity: alternate.integrity || null,
            version: alternate.version || null,
            path: alternate.path || null,
            error: alternate.error || null,
          }))
        : [],
    })),
  });
  const logs = [];
  let ts = 0;
  const push = (level, msg, data) => {
    const entry = { run_id, ts: ts++, step: "probe", level, msg };
    if (data && typeof data === "object") entry.data = data;
    logs.push(entry);
  };

  push("info", "[bridge] probe: starting");
  push("info", "[bridge] probe: env", env);
  for (const tool of tools) {
    if (tool.ok) {
      if (tool.status === "found_not_in_path") {
        push("warn", `[bridge] probe: ${tool.name}: found_not_in_path${tool.path ? ` (${tool.path})` : ""}`);
        if (tool.suggestedFix) {
          push("warn", `[bridge] probe: ${tool.name}: fix: ${tool.suggestedFix}`);
        }
        } else if (tool.source === "bundled" && tool.integrity === "verified") {
          push("info", `[bridge] probe: ${tool.name}: ok bundled_verified${tool.version ? ` (${tool.version})` : ""}`);
        } else if (tool.source === "buildpack" && tool.integrity === "verified") {
          push(
            "info",
            `[bridge] probe: ${tool.name}: ok buildpack_verified${tool.version ? ` (${tool.version})` : ""}${
              tool.buildpackName && tool.buildpackVersion ? ` [${tool.buildpackName}@${tool.buildpackVersion}]` : ""
            }`
          );
        } else {
          push("info", `[bridge] probe: ${tool.name}: ok${tool.version ? ` (${tool.version})` : ""}`);
        }
    } else {
      if (tool.source === "bundled" && tool.integrity === "corrupt") {
        push("error", `[bridge] probe: ${tool.name}: bundled_corrupt${tool.error ? ` (${tool.error})` : ""}`);
      } else if (tool.source === "buildpack" && tool.integrity === "corrupt") {
        push("error", `[bridge] probe: ${tool.name}: buildpack_corrupt${tool.error ? ` (${tool.error})` : ""}`);
      } else {
        push("warn", `[bridge] probe: ${tool.name}: missing${tool.error ? ` (${tool.error})` : ""}`);
      }
      if (tool.suggestedFix) {
        push("warn", `[bridge] probe: ${tool.name}: fix: ${tool.suggestedFix}`);
      }
    }
  }
  const ok = tools.some((tool) => tool.ok);
  push("info", "[bridge] probe: complete", { ok });
  return {
    schema_version: "toolchain_probe_v1",
    ok,
    run_id,
    env,
    tools,
    logs,
  };
}

function buildDoctorReportFromProject({ backendId, project, probe, preflight, buildPath, logs }) {
  const projectSummary = {
    board: "basys3",
    preset: project.fpga.preset || null,
    top: project.hdl.top || null,
    hdlFilesCount: Array.isArray(project.hdl.sources) ? project.hdl.sources.length : 0,
    hasXdc: Boolean(project.fpga?.constraints?.text && project.fpga.constraints.text.trim().length > 0),
  };
  const sortedLogs = (Array.isArray(logs) ? logs : [])
    .slice()
    .sort((a, b) => {
      if (a.step !== b.step) return String(a.step).localeCompare(String(b.step));
      if (a.msg !== b.msg) return String(a.msg).localeCompare(String(b.msg));
      return Number(a.ts || 0) - Number(b.ts || 0);
    })
    .slice(-200);

  const reportHashPayload = {
    backend_id: backendId,
    probe: {
      ok: probe.ok,
      env: probe.env || null,
      tools: probe.tools.map((tool) => ({
        name: tool.name,
        ok: tool.ok,
        status: tool.status || null,
        source: tool.source || null,
        integrity: tool.integrity || null,
        version: tool.version || null,
        path: tool.path || null,
        error: tool.error || null,
        suggestedFix: tool.suggestedFix || null,
        alternates: Array.isArray(tool.alternates)
          ? tool.alternates.map((alternate) => ({
              source: alternate.source || null,
              status: alternate.status || null,
              integrity: alternate.integrity || null,
              version: alternate.version || null,
              path: alternate.path || null,
              error: alternate.error || null,
            }))
          : [],
      })),
    },
    preflight: {
      project: preflight.project,
      lint: {
        ok: preflight.lint.ok,
        warnings: preflight.lint.warnings.map((entry) => entry.msg),
        errors: preflight.lint.errors.map((entry) => entry.msg),
      },
      overallOk: preflight.overallOk,
    },
    buildPath: buildPath
      ? {
          planId: buildPath.planId,
          backend: buildPath.backend,
          board: buildPath.board,
          top: buildPath.top,
          constraintsPreset: buildPath.constraintsPreset ?? null,
          buildpack:
            buildPath.buildpack &&
            typeof buildPath.buildpack.name === "string" &&
            typeof buildPath.buildpack.version === "string"
              ? {
                  name: buildPath.buildpack.name,
                  version: buildPath.buildpack.version,
                }
              : null,
          requiredTools: (Array.isArray(buildPath.requiredTools) ? buildPath.requiredTools : [])
            .map((tool) => ({
              name: tool.name,
              ok: tool.ok,
              version: tool.version || null,
              source: tool.source || null,
              integrity: tool.integrity || null,
            }))
            .sort((left, right) => String(left.name).localeCompare(String(right.name))),
          warnings: (Array.isArray(buildPath.warnings) ? buildPath.warnings : [])
            .map((entry) => String(entry.msg || ""))
            .sort((left, right) => left.localeCompare(right)),
        }
      : null,
    projectSummary,
    logs: sortedLogs.map((entry) => ({
      step: entry.step,
      level: entry.level,
      msg: entry.msg,
    })),
  };
  const reportId = deterministicId("bridge-doctor", reportHashPayload);

  return {
    schema_version: "rb_toolchain_doctor_v1",
    reportId,
    backend_id: backendId,
    bridge_url: "http://127.0.0.1:4242",
    probe,
    preflight,
    ...(buildPath ? { buildPath } : {}),
    projectSummary,
    logs: sortedLogs,
  };
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
let runCounter = 0;
const activeRuns = new Map();
const deviceRunIndex = new Map();

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

function createRunId() {
  runCounter += 1;
  return `run-${Date.now()}-${runCounter}`;
}

function buildMockIo(run) {
  const delta = Math.floor(run.rng.next() * 7) + 1;
  run.sw = (run.sw + delta) & 0xffff;
  run.btn = run.tick % 20 === 0 ? 1 : 0;
  const btnMask = run.btn ? 0xffff : 0;
  const led = run.sw ^ btnMask;
  return { sw: run.sw, btn: run.btn, led, seg: null };
}

function emitStatus(run, state, hint = null) {
  run.status = state;
  run.statusHint = hint;
  const payload = `event: status\ndata: ${JSON.stringify({
    run_id: run.id,
    state,
    hint: hint || undefined,
  })}\n\n`;
  for (const client of run.clients) {
    if (!client.writableEnded) {
      client.write(payload);
    }
  }
}

function emitSample(run, sample) {
  if (run.noDataTimer) {
    clearTimeout(run.noDataTimer);
    run.noDataTimer = null;
  }
  if (run.status !== "running") {
    emitStatus(run, "running");
  }
  run.sampleCount += 1;
  run.lastSampleAt = Date.now();
  const normalized = {
    t_ms: typeof sample.t_ms === "number" ? sample.t_ms : 0,
    device_id: run.deviceId,
    io: sample.io,
  };
  const payload = `event: sample\ndata: ${JSON.stringify(normalized)}\n\n`;
  for (const client of run.clients) {
    if (!client.writableEnded) {
      client.write(payload);
    }
  }
}

function scheduleNoData(run) {
  run.noDataTimer = setTimeout(() => {
    if (run.sampleCount === 0) {
      emitStatus(run, "running_no_data", "Design may not include RedByte stream wrapper.");
    }
  }, 500);
}

function startMockRun({ deviceId, hz, seed }) {
  const periodMs = Math.max(1, Math.round(1000 / hz));
  const runId = createRunId();
  const rng = new SeededRandom(seed);
  const run = {
    id: runId,
    deviceId,
    mode: "mock",
    startedAt: Date.now(),
    hz,
    periodMs,
    tick: 0,
    sw: 0,
    btn: 0,
    rng,
    clients: new Set(),
    status: "running",
    statusHint: null,
    sampleCount: 0,
    lastSampleAt: null,
    bytesRead: 0,
    framesParsed: 0,
    decodeErrors: 0,
    noDataTimer: null,
  };
  run.interval = setInterval(() => {
    const io = buildMockIo(run);
    emitSample(run, { t_ms: run.tick * run.periodMs, io });
    run.tick += 1;
  }, periodMs);
  scheduleNoData(run);
  activeRuns.set(runId, run);
  deviceRunIndex.set(deviceId, runId);
  return run;
}

async function stopRun(runId, options = {}) {
  const run = activeRuns.get(runId);
  if (!run) return null;
  if (run.noDataTimer) {
    clearTimeout(run.noDataTimer);
    run.noDataTimer = null;
  }
  emitStatus(run, "stopped");
  if (run.port && run.port.isOpen) {
    if (options.sendStopFrame !== false) {
      try {
        run.port.write(buildStreamStopFrame());
      } catch {
        // ignore
      }
    }
    await new Promise((resolve) => run.port.close(() => resolve()));
  }
  if (run.interval) {
    clearInterval(run.interval); // Mock interval
  }
  if (run.drainInterval) {
    clearInterval(run.drainInterval); // Hardware drain interval
    run.drainInterval = null;
  }
  for (const client of run.clients) {
    try {
      client.end();
    } catch {
      // ignore
    }
  }
  activeRuns.delete(runId);
  if (deviceRunIndex.get(run.deviceId) === runId) {
    deviceRunIndex.delete(run.deviceId);
  }
  if (run.ingestion) {
    // Save capsule on stop
    const filename = `capsule-${run.id}.json`;
    const outPath = path.join(ensureTmpDir(getRepoRoot()), "capsules", filename);
    try {
      run.ingestion.saveSync(outPath);
      console.log(`Saved Spartan-3E capsule to ${outPath}`);
    } catch (e) {
      console.error("Failed to save capsule:", e);
    }
  }
  return run;
}

// ... existing code ...

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>RedByte FPGA Bridge</title></head>
      <body style="font-family: monospace; padding: 2rem;">
        <h1>RedByte FPGA Bridge</h1>
        <p>Status: <strong>Running</strong></p>
        <p>Mode: <strong>${MOCK_MODE ? "MOCK" : "REAL"}</strong></p>
        <p>WebSocket: <strong>ws://localhost:${WS_PORT}</strong></p>
        <p><a href="/health">check health</a></p>
      </body>
    </html>
  `);
});

app.get("/health", (req, res) => {
  // Aggregate stats from active runs
  const runStats = Array.from(activeRuns.values()).map(r => ({
    id: r.id,
    mode: r.mode,
    startedAt: r.startedAt,
    samples: r.sampleCount,
    dropped: r.buffer ? r.buffer.getStats().dropped : 0,
    bufferSize: r.buffer ? r.buffer.getStats().count : 0,
    estMemBytes: r.buffer ? r.buffer.getEstimatedMemoryUsageBytes() : 0,
    decodeErrors: r.decodeErrors
  }));

  res.json({
    ok: true,
    mock: MOCK_MODE,
    version: "0.1.0",
    uptimeMs: process.uptime() * 1000,
    status: "ok", // Keep for backward compat if any
    wsPort: actualWsPort, // Actual WS port (may differ if fallback occurred)
    activeRunCount: activeRuns.size,
    totalMemory: process.memoryUsage().rss,
    runs: runStats
  });
});

async function startHardwareRun({ device, hz }) {
  const portPath = device.runtime?.port;
  const baudRate = device.runtime?.baud_default || BAUD;
  if (!portPath) {
    return { ok: false, error: "runtime_unavailable" };
  }

  const runId = createRunId();
  const run = {
    id: runId,
    deviceId: device.id,
    mode: "hardware",
    startedAt: Date.now(),
    hz,
    periodMs: Math.max(1, Math.round(1000 / hz)),
    tick: 0,
    sw: 0,
    btn: 0,
    rng: null,
    clients: new Set(),
    status: "running",
    statusHint: null,
    sampleCount: 0,
    lastSampleAt: null,
    bytesRead: 0,
    framesParsed: 0,
    decodeErrors: 0,
    noDataTimer: null,
    port: null,
    parser: null,
    buffer: new StreamRingBuffer(5000), // Milestone 1: Memory Bounded
    drainInterval: null,
  };

  const port = new SerialPort({ path: portPath, baudRate, autoOpen: false });
  const openPort = () =>
    new Promise((resolve, reject) => {
      port.open((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

  try {
    await openPort();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // Decoupled Parser: UART -> Buffer
  let parser;
  let ingestion = null;

  if (device.board === "Spartan-3E") {
    // Spartan-3E Specific Path
    const binParser = new RbBinV1Parser();

    // Setup Ingestion Recorder
    ingestion = new RedByteIngestion({
      board: "Spartan-3E",
      jtag_idcode: "unknown-mvp", // TODO: Fetch from JTAG
      bitstream_hash: "unknown",
      captured_at: new Date().toISOString(),
      bridge_version: "0.2.0",
      transport: { type: "uart", baud_rate: baudRate, latency_us_estimate: 5000, flow_control: "none" }
    }, {
      clock_domain_hz: 50000000,
      start_tick: 0,
      end_tick: 0,
      tick_decimation: 1
    });
    run.ingestion = ingestion;

    binParser.on('data', (evt) => {
      run.framesParsed++;
      // Record raw event
      if (ingestion) ingestion.recordEvent(evt);

      // Normalize for UI
      const io = evt.payload; // { sw, btn, led }
      // Add derived 'seg' if needed or leave null
      const sample = {
        t_ms: evt.tick / 50000, // 50MHz -> 50,000 cycles = 1ms
        io: io
      };
      run.buffer.push(sample);
    });

    binParser.on('error', (err) => {
      run.decodeErrors++;
      console.error("Spartan-3E Parser Error:", err.message);
    });

    parser = binParser; // Polymorphic use (write method needed)
  } else {
    // Default / Legacy Stream Parser
    parser = createStreamParser({
      onSample: (sample) => {
        run.framesParsed += 1;
        run.buffer.push(sample); // Push to ring buffer (drops oldest if full)
      },
      onError: () => {
        run.decodeErrors += 1;
      },
    });
  }

  // Decoupled Sender: Buffer -> Network
  // Drain at approx 60Hz (16ms) to batch writes if needed, or just keep up.
  // Using 10ms to be slightly faster than strict 60Hz.
  run.drainInterval = setInterval(() => {
    // Process a chunk of the buffer to avoid blocking the event loop too long
    // If we have 1000 items, sending all might choke. But let's try draining all first.
    let item = run.buffer.pop();
    while (item) {
      emitSample(run, item);
      item = run.buffer.pop();
    }
  }, 10);

  run.port = port;
  run.parser = parser;
  scheduleNoData(run);

  port.on("data", (chunk) => {
    run.bytesRead += chunk.length;
    parser.write(chunk);
  });

  port.on("error", (err) => {
    emitStatus(run, "error", err?.message || "uart_error");
    stopRun(run.id, { sendStopFrame: false }).catch(() => { });
  });

  port.on("close", () => {
    if (activeRuns.has(run.id)) {
      emitStatus(run, "stopped");
      activeRuns.delete(run.id);
      if (deviceRunIndex.get(run.deviceId) === run.id) {
        deviceRunIndex.delete(run.deviceId);
      }
    }
  });

  try {
    port.write(buildStreamStartFrame({ hz }));
  } catch {
    // ignore write errors; stream may still start
  }

  activeRuns.set(runId, run);
  deviceRunIndex.set(run.deviceId, runId);
  return { ok: true, run };
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
    simTraceRecorder.close().catch(() => { });
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

app.get("/diagnostics", async (_req, res) => {
  try {
    const capabilities = await getCachedToolchain();
    const programmer = capabilities?.openFPGALoader || null;
    const pathHash =
      typeof programmer?.path === "string" && programmer.path.trim().length > 0
        ? createHash("sha256").update(programmer.path).digest("hex")
        : undefined;

    return res.json({
      reachable: true,
      version: "0.1.0",
      uptimeMs: Math.round(process.uptime() * 1000),
      activeRunCount: activeRuns.size,
      lastErrorCode: typeof state.program_last_error === "string" ? state.program_last_error : null,
      programmer: {
        found: Boolean(programmer && programmer.status !== "missing"),
        ...(typeof programmer?.version === "string" ? { version: programmer.version } : {}),
        ...(pathHash ? { pathHash } : {}),
        capabilities: {
          program: Boolean(programmer && programmer.status !== "missing"),
          detect: Boolean(programmer && programmer.status !== "missing"),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      reachable: false,
      version: "0.1.0",
      uptimeMs: Math.round(process.uptime() * 1000),
      activeRunCount: activeRuns.size,
      lastErrorCode: typeof state.program_last_error === "string" ? state.program_last_error : "bridge_offline",
      programmer: {
        found: false,
        capabilities: {
          program: false,
          detect: false,
        },
      },
    });
  }
});

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
    return res.status(500).json({ ok: false, error: "log_read_failed" });
  }

  const lines = content.split(/\r?\n/);
  const requestedTail = Number(req.query?.tail || PROGRAM_LOG_TAIL);
  const tail = Math.max(1, Math.min(requestedTail, PROGRAM_LOG_TAIL_MAX));
  const slice = lines.slice(-tail);
  const joined = slice.join("\n");
  const trimmed = trimLogContent(joined, PROGRAM_LOG_MAX_BYTES);
  return res.json({
    ok: true,
    id: path.basename(resolved),
    lines: slice.length,
    truncated: trimmed.truncated,
    content: trimmed.content,
  });
});

app.get("/logs", (_req, res) => {
  const repoRoot = getRepoRoot();
  const tmpDir = ensureTmpDir(repoRoot);
  const limit = Math.max(1, Math.min(50, Number(_req.query?.limit || 10)));
  const logs = listProgramLogs(tmpDir)
    .slice(0, limit)
    .map((entry) => ({
      id: entry.name,
      mtime_ms: entry.mtimeMs,
    }));
  res.json({ ok: true, logs });
});

app.post("/run", async (req, res) => {
  const body = req.body || {};
  const schemaVersion = "bridge_v1";
  const deviceId = body.device_id || body.deviceId || null;
  let mode = body.mode || null;
  const hzRaw = Number(body.hz || body.rate_hz || 20);
  const hz = Number.isFinite(hzRaw) ? Math.min(Math.max(hzRaw, 1), 200) : 20;

  if (!deviceId) {
    return res.status(400).json({ schema_version: schemaVersion, ok: false, error: "device_id_required" });
  }

  if (deviceRunIndex.has(deviceId)) {
    return res.status(409).json({ schema_version: schemaVersion, ok: false, error: "device_busy" });
  }

  const devices = await discoverDevices({ includeSim: true, baudDefault: BAUD });
  const device = devices.find((entry) => entry.id === deviceId);
  if (!device) {
    return res.status(404).json({ schema_version: schemaVersion, ok: false, error: "invalid_device" });
  }

  if (!mode) {
    mode = device.transport === "sim" ? "mock" : "hardware";
  }

  if (!["mock", "sim", "hardware"].includes(mode)) {
    return res.status(400).json({ schema_version: schemaVersion, ok: false, error: "unsupported_mode" });
  }

  if (mode === "hardware") {
    if (device.transport === "sim") {
      return res.status(400).json({ schema_version: schemaVersion, ok: false, error: "invalid_device_mode" });
    }
    if (device.runtime?.status !== "ready") {
      return res.status(400).json({ schema_version: schemaVersion, ok: false, error: "runtime_not_ready" });
    }

    const started = await startHardwareRun({ device, hz });
    if (!started.ok) {
      return res.status(500).json({ schema_version: schemaVersion, ok: false, error: started.error || "run_failed" });
    }
    return res.json({
      schema_version: schemaVersion,
      ok: true,
      run_id: started.run.id,
      started_at_ms: started.run.startedAt,
    });
  }

  const seedRaw = body.seed;
  const seed = Number.isFinite(Number(seedRaw)) ? Number(seedRaw) : hashSeed(deviceId);
  const run = startMockRun({ deviceId, hz, seed });
  return res.json({
    schema_version: schemaVersion,
    ok: true,
    run_id: run.id,
    started_at_ms: run.startedAt,
  });
});

app.get("/stream", (req, res) => {
  const runId = req.query?.run_id || req.query?.runId;
  if (!runId) {
    return res.status(400).json({ ok: false, error: "run_id_required" });
  }

  const run = activeRuns.get(runId);
  if (!run) {
    return res.status(404).json({ ok: false, error: "run_not_found" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.write(
    `event: status\ndata: ${JSON.stringify({
      run_id: runId,
      state: run.status || "running",
      hint: run.statusHint || undefined,
    })}\n\n`
  );

  run.clients.add(res);
  req.on("close", () => {
    run.clients.delete(res);
  });
});

app.post("/stop", (req, res) => {
  const body = req.body || {};
  const schemaVersion = "bridge_v1";
  const runId = body.run_id || body.runId || null;
  if (!runId) {
    return res.status(400).json({ schema_version: schemaVersion, ok: false, error: "run_id_required" });
  }
  return stopRun(runId).then((run) => {
    if (!run) {
      return res.status(404).json({ schema_version: schemaVersion, ok: false, error: "run_not_found" });
    }
    return res.json({ schema_version: schemaVersion, ok: true, stopped_at_ms: Date.now() });
  });
});

// ============================================================
// TOOLCHAIN API ENDPOINTS
// ============================================================

app.get("/api/toolchain/probe", async (_req, res) => {
  try {
    const capabilities = await getCachedToolchain();
    return res.json(buildProbeFromCapabilities(capabilities));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const fallback = buildProbeFromCapabilities({});
    fallback.ok = false;
    fallback.tools = [{ name: "bridge", ok: false, error: "detect_failed" }];
    fallback.logs = [
      ...fallback.logs,
      {
        run_id: fallback.run_id,
        ts: fallback.logs.length,
        step: "probe",
        level: "error",
        msg: `[bridge] probe: failed: detect_failed: ${message}`,
      },
    ];
    return res.status(500).json({
      ...fallback,
    });
  }
});

app.get("/api/toolchain/boards/detect", async (_req, res) => {
  const schemaVersion = "toolchain_board_detect_v1";
  try {
    const capabilities = await getCachedToolchain();
    const loader = capabilities?.openFPGALoader || null;
    const loaderReady = Boolean(loader && loader.status !== "missing" && typeof loader.path === "string");
    const toolStatus = loader
      ? {
          ok: loaderReady,
          ...(typeof loader.status === "string" ? { status: loader.status } : {}),
          ...(typeof loader.version === "string" ? { version: loader.version } : {}),
          ...(typeof loader.path === "string" ? { path: loader.path } : {}),
          ...(typeof loader.error === "string" ? { error: loader.error } : {}),
          ...(typeof loader.source === "string" ? { source: loader.source } : {}),
          ...(typeof loader.suggestedFix === "string" ? { suggestedFix: loader.suggestedFix } : {}),
        }
      : { ok: false, error: "not_found" };
    const run_id = deterministicId("bridge-board-detect", {
      loader: {
        ok: toolStatus.ok,
        version: toolStatus.version || null,
        path: toolStatus.path || null,
      },
    });

    const logs = [];
    let ts = 0;
    const push = (level, msg, data) => {
      const entry = { run_id, ts: ts++, step: "probe", level, msg };
      if (data && typeof data === "object") entry.data = data;
      logs.push(entry);
    };

    push("info", "[bridge] board-detect: starting");
    const boards = [];

    if (!loaderReady) {
      push("warn", "[bridge] board-detect: openFPGALoader missing");
      return res.json({
        schema_version: schemaVersion,
        ok: true,
        run_id,
        boards,
        tools: { openFPGALoader: toolStatus },
        logs,
      });
    }

    const helpResult = await runCommandCollect(loader.path, ["--help"], 5000);
    const helpText = `${helpResult.stdout || ""}\n${helpResult.stderr || ""}`;
    const detectCommands = selectOpenFPGALoaderDetectCommands(helpText);
    if (!helpResult.ok) {
      push("warn", `[bridge] board-detect: help command failed (${helpResult.error || "unknown"})`);
    }

    for (const commandArgs of detectCommands) {
      push("info", `[bridge] board-detect: trying ${commandArgs.join(" ")}`);
      const result = await runCommandCollect(loader.path, commandArgs, 8000);
      const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
      const parsedBoards = parseOpenFPGALoaderDetectOutput(combinedOutput);

      if (result.ok) {
        push("info", `[bridge] board-detect: command succeeded (${commandArgs.join(" ")})`);
      } else {
        push(
          "warn",
          `[bridge] board-detect: command failed (${commandArgs.join(" ")}): ${result.error || `exit_${result.exitCode ?? "unknown"}`}`
        );
      }

      if (parsedBoards.length > 0) {
        for (const board of parsedBoards) {
          boards.push({
            type: board.type,
            transport: board.transport,
            detectedBy: board.detectedBy,
            details: {
              ...(board.details || {}),
              command: commandArgs.join(" "),
            },
          });
        }
        break;
      }
    }

    boards.sort((a, b) => {
      const left = String(a?.details?.raw || "");
      const right = String(b?.details?.raw || "");
      if (left !== right) return left.localeCompare(right);
      return String(a.detectedBy || "").localeCompare(String(b.detectedBy || ""));
    });

    if (boards.length === 0) {
      push(
        "warn",
        "[bridge] board-detect: openFPGALoader listing did not identify Basys3; tool present but no supported detection signal found."
      );
    } else {
      push("info", `[bridge] board-detect: detected ${boards.length} basys3 board(s)`);
    }

    return res.json({
      schema_version: schemaVersion,
      ok: true,
      run_id,
      boards,
      tools: { openFPGALoader: toolStatus },
      logs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const run_id = deterministicId("bridge-board-detect-error", { error: message || "unknown" });
    return res.status(500).json({
      schema_version: schemaVersion,
      ok: false,
      run_id,
      boards: [],
      tools: { openFPGALoader: { ok: false, error: "detect_failed" } },
      logs: [
        {
          run_id,
          ts: 0,
          step: "probe",
          level: "error",
          msg: `[bridge] board-detect: failed: ${message}`,
        },
      ],
    });
  }
});

app.post("/api/toolchain/preflight", async (req, res) => {
  try {
    const refreshProbe = req.body?.refresh_probe === true;
    const normalizedProject = normalizePreflightProject(req.body?.project ?? {});
    const capabilities = refreshProbe ? await detectToolchain() : await getCachedToolchain();
    if (refreshProbe) {
      toolchainCache = capabilities;
      toolchainCacheTime = Date.now();
    }

    const tools = buildToolListFromCapabilities(capabilities);

    const status = buildPreflightFromProject(normalizedProject, tools);
    return res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallbackProject = normalizePreflightProject(req.body?.project ?? {});
    const tools = [{ name: "bridge", ok: false, error: "preflight_failed" }];
    const status = buildPreflightFromProject(fallbackProject, tools);
    const mergedErrors = [
      ...status.lint.errors,
      {
        run_id: status.run_id,
        ts: status.lint.errors.length,
        step: "preflight",
        level: "error",
        msg: `[preflight] bridge: failed: ${message}`,
      },
    ]
      .sort((a, b) => a.msg.localeCompare(b.msg))
      .map((entry, index) => ({ ...entry, ts: index }));
    status.lint.errors = mergedErrors;
    status.lint.ok = false;
    status.overallOk = false;
    return res.status(500).json(status);
  }
});

app.post("/api/toolchain/implement/plan", async (req, res) => {
  try {
    const refreshProbe = req.body?.refresh_probe === true;
    const requestPayload = isImplementPlanRequest(req.body)
      ? req.body
      : {
          schema_version: "toolchain_implement_plan_request_v1",
          backend_id: "vivado",
          refresh_probe: refreshProbe,
          project: req.body?.project ?? {},
        };
    const normalizedProject = normalizePreflightProject(requestPayload.project ?? {});
    const capabilities = refreshProbe ? await detectToolchain() : await getCachedToolchain();
    if (refreshProbe) {
      toolchainCache = capabilities;
      toolchainCacheTime = Date.now();
    }

    const plan = buildImplementPlan({
      backendId: requestPayload.backend_id,
      project: normalizedProject,
      capabilities,
      platform: os.platform(),
    });
    return res.json(plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallbackProject = normalizePreflightProject(req.body?.project ?? {});
    const fallbackPlan = buildImplementPlan({
      backendId: req.body?.backend_id === "open" ? "open" : "vivado",
      project: fallbackProject,
      capabilities: {},
      platform: os.platform(),
    });
    fallbackPlan.ok = false;
    fallbackPlan.warnings = [
      ...fallbackPlan.warnings,
      {
        run_id: fallbackPlan.run_id,
        ts: fallbackPlan.warnings.length,
        step: "pnr",
        level: "warn",
        msg: `[implement-plan] bridge_fallback: ${message}`,
      },
    ]
      .sort((left, right) => left.msg.localeCompare(right.msg))
      .map((entry, index) => ({ ...entry, ts: index }));
    fallbackPlan.logs = [
      ...fallbackPlan.logs,
      {
        run_id: fallbackPlan.run_id,
        ts: fallbackPlan.logs.length,
        step: "pnr",
        level: "error",
        msg: `[implement-plan] bridge: failed: ${message}`,
      },
    ];
    return res.status(500).json(fallbackPlan);
  }
});

app.post("/api/toolchain/doctor-report", async (req, res) => {
  try {
    const refreshProbe = req.body?.refresh_probe === true;
    const backendId = typeof req.body?.backend_id === "string" ? req.body.backend_id : "vivado";
    const normalizedProject = normalizePreflightProject(req.body?.project ?? {});
    const capabilities = refreshProbe ? await detectToolchain() : await getCachedToolchain();
    if (refreshProbe) {
      toolchainCache = capabilities;
      toolchainCacheTime = Date.now();
    }

    const probe = buildProbeFromCapabilities(capabilities);
    const preflight = buildPreflightFromProject(normalizedProject, probe.tools);
    const buildPathPlan = buildImplementPlan({
      backendId,
      project: normalizedProject,
      capabilities,
      platform: os.platform(),
    });
    const buildPath = {
      schema_version: "toolchain_build_path_v1",
      plannerVersion: "toolchain_planner_v1",
      planId: buildPathPlan.planId,
      backend: buildPathPlan.backend,
      board: normalizedProject.fpga.board,
      top: normalizedProject.hdl.top || "top",
      constraintsPreset: normalizedProject.fpga.preset || null,
      requiredTools: buildPathPlan.requiredTools,
      commands: buildPathPlan.commands,
      outputs: buildPathPlan.outputs,
      warnings: buildPathPlan.warnings,
    };
    const logs = Array.isArray(req.body?.logs) ? req.body.logs : [];
    const report = buildDoctorReportFromProject({
      backendId,
      project: normalizedProject,
      probe,
      preflight,
      buildPath,
      logs,
    });
    return res.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const normalizedProject = normalizePreflightProject(req.body?.project ?? {});
    const probe = buildProbeFromCapabilities({});
    const preflight = buildPreflightFromProject(normalizedProject, [{ name: "bridge", ok: false, error: "doctor_report_failed" }]);
    preflight.lint.errors = [
      ...preflight.lint.errors,
      {
        run_id: preflight.run_id,
        ts: preflight.lint.errors.length,
        step: "preflight",
        level: "error",
        msg: `[preflight] bridge: doctor report failed: ${message}`,
      },
    ];
    preflight.lint.ok = false;
    preflight.overallOk = false;
    const report = buildDoctorReportFromProject({
      backendId: "vivado",
      project: normalizedProject,
      probe,
      preflight,
      buildPath: null,
      logs: [],
    });
    return res.status(500).json(report);
  }
});

function normalizeSynthRequestPayload(body) {
  const rawBuildPath = body?.buildPath && typeof body.buildPath === "object" ? body.buildPath : null;
  const buildPathPlanId =
    typeof rawBuildPath?.planId === "string" && rawBuildPath.planId.trim().length > 0
      ? rawBuildPath.planId.trim()
      : null;
  const buildPathBackend = (
    rawBuildPath?.backend === "buildpack-open" ||
    rawBuildPath?.backend === "nextpnr-xilinx" ||
    rawBuildPath?.backend === "f4pga" ||
    rawBuildPath?.backend === "vivado-fallback" ||
    rawBuildPath?.backend === "none"
  )
    ? rawBuildPath.backend
    : null;
  const board = body?.board === "basys3" ? "basys3" : null;
  const top = normalizeSynthTop(body?.top);
  const sourceInfo = normalizeSynthSources(body?.sources);
  return {
    board,
    top,
    sources: sourceInfo.sources,
    nonVerilogCount: sourceInfo.nonVerilogCount,
    invalidCount: sourceInfo.invalidCount,
    buildPath:
      buildPathPlanId && buildPathBackend
        ? {
            planId: buildPathPlanId,
            backend: buildPathBackend,
          }
        : null,
  };
}

function writeSynthSources(workDir, sources) {
  const sourceRoot = path.join(workDir, "src");
  fs.mkdirSync(sourceRoot, { recursive: true });
  const sourceEntries = [];
  for (const source of sources) {
    const relativePath = source.path.replace(/\\/g, "/");
    const absolutePath = path.join(sourceRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source.text, "utf8");
    sourceEntries.push({
      sourcePath: relativePath,
      runRelativePath: path.relative(workDir, absolutePath).replace(/\\/g, "/"),
      absolutePath,
    });
  }
  sourceEntries.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  return sourceEntries;
}

function normalizeImplementBackend(value) {
  if (value === "buildpack-open" || value === "nextpnr-xilinx" || value === "f4pga" || value === "vivado-fallback" || value === "none") {
    return value;
  }
  return null;
}

function normalizeImplementCommandStep(step) {
  return step === "synth" || step === "pnr" || step === "bitgen" ? step : null;
}

function normalizeImplementSourcePath(pathValue) {
  if (typeof pathValue !== "string") return null;
  let value = pathValue.trim().replace(/\\/g, "/");
  if (!value) return null;
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) return null;
  while (value.startsWith("./")) value = value.slice(2);
  const segments = value
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) return null;
  if (segments.some((segment) => segment === "." || segment === "..")) return null;
  return segments
    .map((segment) => {
      const sanitized = segment.replace(/[^a-zA-Z0-9._-]/g, "_");
      return sanitized.length > 0 ? sanitized : "_";
    })
    .join("/");
}

function normalizeImplementPathHint(pathHint) {
  if (typeof pathHint !== "string") return null;
  let value = pathHint.trim().replace(/\\/g, "/");
  if (!value) return null;
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) return null;
  while (value.startsWith("./")) value = value.slice(2);
  const segments = value
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) return null;
  return segments.join("/");
}

function normalizeImplementBuildPathPayload(rawBuildPath) {
  if (!rawBuildPath || typeof rawBuildPath !== "object") return null;
  const backend = normalizeImplementBackend(rawBuildPath.backend);
  const planId =
    typeof rawBuildPath.planId === "string" && rawBuildPath.planId.trim().length > 0
      ? rawBuildPath.planId.trim()
      : null;
  if (!backend || !planId) return null;
  const buildpack =
    rawBuildPath?.buildpack &&
    typeof rawBuildPath.buildpack === "object" &&
    typeof rawBuildPath.buildpack.name === "string" &&
    rawBuildPath.buildpack.name.trim().length > 0 &&
    typeof rawBuildPath.buildpack.version === "string" &&
    rawBuildPath.buildpack.version.trim().length > 0
      ? {
          name: rawBuildPath.buildpack.name.trim(),
          version: rawBuildPath.buildpack.version.trim(),
        }
      : null;

  const requiredTools = Array.isArray(rawBuildPath.requiredTools)
    ? rawBuildPath.requiredTools
        .map((tool) => {
          if (!tool || typeof tool !== "object") return null;
          const name = typeof tool.name === "string" ? tool.name.trim() : "";
          const why = typeof tool.why === "string" ? tool.why.trim() : "";
          if (!name || !why) return null;
          const source =
            tool.source === "bundled" ||
            tool.source === "buildpack" ||
            tool.source === "system" ||
            tool.source === "not_found" ||
            tool.source === "found_not_in_path"
              ? tool.source
              : null;
          const integrity =
            tool.integrity === "verified" || tool.integrity === "corrupt" || tool.integrity === "unknown"
              ? tool.integrity
              : null;
          return {
            name,
            ok: tool.ok === true,
            ...(typeof tool.version === "string" && tool.version.trim().length > 0 ? { version: tool.version.trim() } : {}),
            ...(source ? { source } : {}),
            ...(integrity ? { integrity } : {}),
            why,
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.name.localeCompare(right.name))
    : [];

  const commands = Array.isArray(rawBuildPath.commands)
    ? rawBuildPath.commands
        .map((command) => {
          if (!command || typeof command !== "object") return null;
          const step = normalizeImplementCommandStep(command.step);
          if (!step) return null;
          const argv = Array.isArray(command.argv)
            ? command.argv.map((arg) => String(arg)).filter((arg) => arg.trim().length > 0)
            : [];
          if (argv.length === 0) return null;
          const envKeysUsed = Array.isArray(command.envKeysUsed)
            ? command.envKeysUsed
                .map((key) => String(key).trim())
                .filter((key) => key.length > 0)
                .sort((a, b) => a.localeCompare(b))
            : [];
          return {
            step,
            argv,
            envKeysUsed,
          };
        })
        .filter(Boolean)
        .sort((left, right) => `${left.step}\u0000${left.argv.join("\u0001")}`.localeCompare(`${right.step}\u0000${right.argv.join("\u0001")}`))
    : [];

  const outputs = Array.isArray(rawBuildPath.outputs)
    ? rawBuildPath.outputs
        .map((output) => {
          if (!output || typeof output !== "object") return null;
          const name = typeof output.name === "string" ? output.name.trim() : "";
          const pathHint = normalizeImplementPathHint(output.pathHint);
          if (!name || !pathHint) return null;
          return { name, pathHint };
        })
        .filter(Boolean)
        .sort((left, right) => `${left.name}\u0000${left.pathHint}`.localeCompare(`${right.name}\u0000${right.pathHint}`))
    : [];

  const warnings = Array.isArray(rawBuildPath.warnings)
    ? rawBuildPath.warnings
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") return null;
          const msg = typeof entry.msg === "string" ? entry.msg : "";
          if (!msg) return null;
          return {
            run_id: typeof entry.run_id === "string" ? entry.run_id : `build-path-${planId}`,
            ts: typeof entry.ts === "number" ? entry.ts : index,
            step: normalizeImplementCommandStep(entry.step) || "pnr",
            level: entry.level === "error" || entry.level === "warn" || entry.level === "info" ? entry.level : "warn",
            msg,
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.msg.localeCompare(right.msg))
    : [];

  return {
    planId,
    backend,
    ...(buildpack ? { buildpack } : {}),
    requiredTools,
    commands,
    outputs,
    warnings,
  };
}

function normalizeImplementRunPayload(body) {
  const project = normalizePreflightProject(body?.project || {});
  const board = body?.board === "basys3" ? "basys3" : project.fpga.board;
  const clientRunId = typeof body?.clientIds?.runId === "string" && body.clientIds.runId.trim().length > 0
    ? body.clientIds.runId.trim()
    : null;
  const clientArtifactId = typeof body?.clientIds?.artifactId === "string" && body.clientIds.artifactId.trim().length > 0
    ? body.clientIds.artifactId.trim()
    : null;
  return {
    board,
    project: {
      ...project,
      fpga: {
        ...project.fpga,
        board,
      },
    },
    buildPath: normalizeImplementBuildPathPayload(body?.buildPath),
    clientIds: {
      runId: clientRunId,
      artifactId: clientArtifactId,
    },
  };
}

function deriveImplementSourceHash(project) {
  return deterministicId("implement-src", {
    sources: project.hdl.sources.map((source) => ({
      path: source.path,
      language: source.language,
      text: source.text,
    })),
  });
}

function deriveImplementConstraintsHash(project) {
  return deterministicId("implement-xdc", project.fpga.constraints?.text || "");
}

function deriveImplementRunIdentity({ project, buildPath }) {
  const top = project.hdl.top || project.fpga.top || "top";
  const sourceHash = deriveImplementSourceHash(project);
  const constraintsHash = deriveImplementConstraintsHash(project);
  const identityPayload = {
    board: project.fpga.board,
    top,
    backend: buildPath.backend,
    buildpack:
      buildPath.buildpack && typeof buildPath.buildpack === "object"
        ? {
            name: buildPath.buildpack.name || null,
            version: buildPath.buildpack.version || null,
          }
        : null,
    planId: buildPath.planId,
    sourceHash,
    constraintsHash,
  };
  return {
    runId: deterministicId("toolchain-implement-run", identityPayload),
    artifactId: deterministicId("toolchain-implement-artifact", identityPayload),
    sourceHash,
    constraintsHash,
    top,
  };
}

function writeImplementSources(workDir, sources) {
  const sourceRoot = path.join(workDir, "src");
  fs.mkdirSync(sourceRoot, { recursive: true });
  const sourceEntries = [];
  for (const source of Array.isArray(sources) ? sources : []) {
    const relativePath = normalizeImplementSourcePath(source?.path);
    if (!relativePath) continue;
    const absolutePath = path.join(sourceRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, typeof source?.text === "string" ? source.text : "", "utf8");
    sourceEntries.push({
      sourcePath: relativePath,
      language: source?.language === "vhdl" ? "vhdl" : "verilog",
      runRelativePath: path.relative(workDir, absolutePath).replace(/\\/g, "/"),
      absolutePath,
    });
  }
  sourceEntries.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  return sourceEntries;
}

function writeImplementConstraints(workDir, constraints) {
  const text = typeof constraints?.text === "string" ? constraints.text : "";
  if (!text.trim()) return null;
  const constraintsPath = path.join(workDir, "constraints.xdc");
  fs.writeFileSync(constraintsPath, text, "utf8");
  return {
    runRelativePath: path.relative(workDir, constraintsPath).replace(/\\/g, "/"),
    absolutePath: constraintsPath,
  };
}

function buildImplementExecutionContext({ top, sourceEntries, constraintsEntry }) {
  const sourcePaths = sourceEntries.map((entry) => entry.runRelativePath);
  const escapedSources = sourcePaths.map((entry) => (entry.includes(" ") ? `"${entry}"` : entry)).join(" ");
  return {
    top,
    sourcePaths,
    sourceArgs: escapedSources,
    constraintsPath: constraintsEntry?.runRelativePath || "constraints.xdc",
  };
}

function resolveImplementCommandArg(arg, context) {
  return String(arg)
    .split("<top>")
    .join(context.top)
    .split("<sources>")
    .join(context.sourceArgs)
    .split("<constraints>")
    .join(context.constraintsPath);
}

function materializeImplementCommands(commands, context) {
  return (Array.isArray(commands) ? commands : [])
    .map((command) => ({
      step: normalizeImplementCommandStep(command?.step) || "pnr",
      argv: Array.isArray(command?.argv) ? command.argv.map((arg) => resolveImplementCommandArg(arg, context)) : [],
      envKeysUsed: Array.isArray(command?.envKeysUsed)
        ? command.envKeysUsed.map((key) => String(key)).sort((a, b) => a.localeCompare(b))
        : [],
    }))
    .filter((command) => command.argv.length > 0);
}

function collectFilesRecursive(rootDir, maxDepth = 8) {
  const results = [];
  const stack = [{ dir: rootDir, depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || current.depth > maxDepth) continue;
    const entries = fs.existsSync(current.dir) ? fs.readdirSync(current.dir, { withFileTypes: true }) : [];
    for (const entry of entries) {
      const fullPath = path.join(current.dir, entry.name);
      if (entry.isDirectory()) {
        stack.push({ dir: fullPath, depth: current.depth + 1 });
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function collectImplementArtifactOutputs({ repoRoot, runWorkDir, plannedOutputs }) {
  const outputMap = new Map();
  const registerOutput = (name, pathHint, kindHint) => {
    const normalizedPathHint = normalizeImplementPathHint(pathHint);
    if (!normalizedPathHint) return;
    const absolutePath = path.resolve(runWorkDir, normalizedPathHint);
    const resolvedRunRoot = path.resolve(runWorkDir);
    if (absolutePath !== resolvedRunRoot && !absolutePath.startsWith(`${resolvedRunRoot}${path.sep}`)) return;
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return;
    const storedPath = path.relative(repoRoot, absolutePath).replace(/\\/g, "/");
    const kind = classifyImplementOutputKind({
      kind: kindHint,
      name,
      pathHint: normalizedPathHint,
      storedPath,
    });
    outputMap.set(storedPath, {
      name,
      kind,
      pathHint: normalizedPathHint,
      storedPath,
    });
  };

  for (const output of Array.isArray(plannedOutputs) ? plannedOutputs : []) {
    if (!output || typeof output !== "object") continue;
    const name = typeof output.name === "string" && output.name.trim().length > 0 ? output.name.trim() : "output";
    registerOutput(name, output.pathHint, output.kind);
  }

  for (const candidateDir of ["out", "build"]) {
    const absoluteDir = path.join(runWorkDir, candidateDir);
    for (const filePath of collectFilesRecursive(absoluteDir, 8)) {
      const relativePath = path.relative(runWorkDir, filePath).replace(/\\/g, "/");
      if (outputMap.has(path.relative(repoRoot, filePath).replace(/\\/g, "/"))) continue;
      const baseName = path.basename(relativePath, path.extname(relativePath)) || "output";
      registerOutput(`auto-${baseName}`, relativePath);
    }
  }

  return Array.from(outputMap.values()).sort((left, right) =>
    `${left.kind}\u0000${left.name}\u0000${left.pathHint}`.localeCompare(
      `${right.kind}\u0000${right.name}\u0000${right.pathHint}`
    )
  );
}

async function executeImplementCommand({ runId, workDir, command }) {
  return new Promise((resolve) => {
    const commandName = command.argv[0];
    const args = command.argv.slice(1);
    if (!commandName) {
      resolve({
        ok: false,
        exitCode: null,
        error: "invalid_command",
      });
      return;
    }

    let stdoutRemainder = "";
    let stderrRemainder = "";
    const flushLines = (buffer, level) => {
      const lines = buffer.split(/\r?\n/);
      const remainder = lines.pop() || "";
      for (const lineRaw of lines) {
        const line = lineRaw.trim();
        if (!line) continue;
        toolchainImplementRuns.appendLog(
          runId,
          level,
          `[${command.step}] ${line}`,
          undefined,
          command.step === "synth" ? "implement" : command.step
        );
      }
      return remainder;
    };

    toolchainImplementRuns.appendLog(
      runId,
      "info",
      `[bridge] implement: command (${command.step}): ${command.argv.join(" ")}`,
      { argv: command.argv, envKeysUsed: command.envKeysUsed },
      command.step === "synth" ? "implement" : command.step
    );

    const proc = spawn(commandName, args, {
      cwd: workDir,
      shell: false,
      windowsHide: true,
      env: process.env,
    });
    toolchainImplementRuns.attachProcess(runId, proc);

    proc.stdout?.on("data", (chunk) => {
      const text = String(chunk || "");
      stdoutRemainder = flushLines(`${stdoutRemainder}${text}`, "info");
    });

    proc.stderr?.on("data", (chunk) => {
      const text = String(chunk || "");
      stderrRemainder = flushLines(`${stderrRemainder}${text}`, "warn");
    });

    proc.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      resolve({
        ok: false,
        exitCode: null,
        error: `spawn_failed:${message}`,
      });
    });

    proc.on("close", (code) => {
      const trailingStdout = stdoutRemainder.trim();
      if (trailingStdout) {
        toolchainImplementRuns.appendLog(
          runId,
          "info",
          `[${command.step}] ${trailingStdout}`,
          undefined,
          command.step === "synth" ? "implement" : command.step
        );
      }
      const trailingStderr = stderrRemainder.trim();
      if (trailingStderr) {
        toolchainImplementRuns.appendLog(
          runId,
          "warn",
          `[${command.step}] ${trailingStderr}`,
          undefined,
          command.step === "synth" ? "implement" : command.step
        );
      }

      const exitCode = typeof code === "number" ? code : null;
      resolve({
        ok: exitCode === 0,
        exitCode,
        error: exitCode === 0 ? null : `${command.step}_exit_${exitCode ?? "unknown"}`,
      });
    });
  });
}

async function runYosysSynthesis({ runId, yosysPath, workDir, scriptPath }) {
  return new Promise((resolve) => {
    const args = ["-s", scriptPath];
    const proc = spawn(yosysPath, args, {
      cwd: workDir,
      shell: false,
      windowsHide: true,
    });
    toolchainSynthRuns.attachProcess(runId, proc);

    let stdoutText = "";
    let stderrText = "";
    let stdoutRemainder = "";
    let stderrRemainder = "";

    const flushLines = (buffer, level) => {
      const lines = buffer.split(/\r?\n/);
      const remainder = lines.pop() || "";
      for (const lineRaw of lines) {
        const line = lineRaw.trim();
        if (!line) continue;
        toolchainSynthRuns.appendLog(runId, level, `[yosys] ${line}`);
      }
      return remainder;
    };

    toolchainSynthRuns.appendLog(runId, "info", `[bridge] synth: command: ${yosysPath} ${args.join(" ")}`);

    proc.stdout?.on("data", (chunk) => {
      const text = String(chunk || "");
      stdoutText += text;
      stdoutRemainder = flushLines(`${stdoutRemainder}${text}`, "info");
    });

    proc.stderr?.on("data", (chunk) => {
      const text = String(chunk || "");
      stderrText += text;
      stderrRemainder = flushLines(`${stderrRemainder}${text}`, "warn");
    });

    proc.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      resolve({
        ok: false,
        exitCode: null,
        stdout: stdoutText,
        stderr: stderrText,
        error: `spawn_failed:${message}`,
      });
    });

    proc.on("close", (code) => {
      const trailingStdout = stdoutRemainder.trim();
      if (trailingStdout) {
        toolchainSynthRuns.appendLog(runId, "info", `[yosys] ${trailingStdout}`);
      }
      const trailingStderr = stderrRemainder.trim();
      if (trailingStderr) {
        toolchainSynthRuns.appendLog(runId, "warn", `[yosys] ${trailingStderr}`);
      }
      const exitCode = typeof code === "number" ? code : null;
      resolve({
        ok: exitCode === 0,
        exitCode,
        stdout: stdoutText,
        stderr: stderrText,
        error: exitCode === 0 ? null : `yosys_exit_${exitCode ?? "unknown"}`,
      });
    });
  });
}

async function executeToolchainSynthRun({
  runId,
  artifactId,
  board,
  top,
  sources,
  yosysPath,
  yosysVersion,
  buildPath,
}) {
  try {
    const repoRoot = getRepoRoot();
    const tmpDir = ensureTmpDir(repoRoot);
    const runWorkDir = path.join(tmpDir, runId);
    fs.rmSync(runWorkDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(runWorkDir, "out"), { recursive: true });

    const sourceEntries = writeSynthSources(runWorkDir, sources);
    const sourcePaths = sourceEntries.map((entry) => entry.runRelativePath);
    const scriptText = buildYosysSynthScript({ top, sourcePaths });
    const scriptPath = path.join(runWorkDir, "run.ys");
    fs.writeFileSync(scriptPath, scriptText, "utf8");
    const scriptSha256 = hashBufferSha256(Buffer.from(scriptText, "utf8"));
    const outDir = path.join(runWorkDir, "out");
    const artifactSources = sourceEntries.map((entry) => ({
      path: entry.sourcePath,
      storedPath: path.relative(repoRoot, entry.absolutePath).replace(/\\/g, "/"),
    }));
    const artifactBase = {
      artifactId,
      board,
      top,
      yosysVersion: yosysVersion || null,
      scriptVersion: YOSYS_SYNTH_SCRIPT_VERSION,
      ...(buildPath ? { buildPath } : {}),
      scriptSha256,
      sources: artifactSources,
      outputs: {
        runScript: path.relative(repoRoot, scriptPath).replace(/\\/g, "/"),
        outputDir: path.relative(repoRoot, outDir).replace(/\\/g, "/"),
      },
    };

    const buildArtifact = (extraOutputs = {}) => ({
      ...artifactBase,
      outputs: {
        ...artifactBase.outputs,
        ...extraOutputs,
      },
    });

    toolchainSynthRuns.appendLog(runId, "info", "[bridge] synth: prepared run workspace", {
      artifact_id: artifactId,
      board,
      top,
      source_count: sourcePaths.length,
      script_version: YOSYS_SYNTH_SCRIPT_VERSION,
      script_sha256: scriptSha256,
      ...(buildPath
        ? {
            build_path_plan_id: buildPath.planId,
            build_path_backend: buildPath.backend,
          }
        : {}),
    });

    const result = await runYosysSynthesis({
      runId,
      yosysPath,
      workDir: runWorkDir,
      scriptPath,
    });
    toolchainSynthRuns.clearProcess(runId);

    if (!result.ok) {
      toolchainSynthRuns.appendLog(runId, "error", `[bridge] synth: failed: ${result.error || "synth_failed"}`);
      toolchainSynthRuns.finishRun(runId, {
        ok: false,
        exitCode: result.exitCode,
        error: result.error || "synth_failed",
        artifact: buildArtifact(),
      });
      return;
    }

    const netlistPath = path.join(runWorkDir, "out", "netlist.v");
    if (!fs.existsSync(netlistPath)) {
      toolchainSynthRuns.appendLog(runId, "error", "[bridge] synth: missing output out/netlist.v");
      toolchainSynthRuns.finishRun(runId, {
        ok: false,
        exitCode: result.exitCode,
        error: "missing_netlist",
        artifact: buildArtifact(),
      });
      return;
    }

    const statText = extractYosysStatText(result.stdout);
    const statPath = path.join(runWorkDir, "out", "stat.txt");
    fs.writeFileSync(statPath, statText, "utf8");

    const statsJsonPath = path.join(runWorkDir, "out", "stats.json");
    const statsPayload = {
      schema_version: "toolchain_synth_stats_v1",
      top,
      board,
      scriptVersion: YOSYS_SYNTH_SCRIPT_VERSION,
      scriptSha256,
      yosysVersion: yosysVersion || null,
      statText,
    };
    fs.writeFileSync(statsJsonPath, stableStringify(statsPayload), "utf8");

    const artifact = buildArtifact({
      netlistVerilog: path.relative(repoRoot, netlistPath).replace(/\\/g, "/"),
      statText: path.relative(repoRoot, statPath).replace(/\\/g, "/"),
      statsJson: path.relative(repoRoot, statsJsonPath).replace(/\\/g, "/"),
    });

    toolchainSynthRuns.appendLog(runId, "info", "[bridge] synth: completed", {
      artifact_id: artifactId,
      netlist: artifact.outputs.netlistVerilog,
      stat: artifact.outputs.statText,
    });
    toolchainSynthRuns.finishRun(runId, {
      ok: true,
      exitCode: result.exitCode,
      artifact,
    });
  } catch (error) {
    toolchainSynthRuns.clearProcess(runId);
    const message = error instanceof Error ? error.message : String(error);
    toolchainSynthRuns.appendLog(runId, "error", `[bridge] synth: failed: ${message}`);
    toolchainSynthRuns.finishRun(runId, {
      ok: false,
      exitCode: null,
      error: "synth_failed",
      artifact: {
        artifactId,
        board,
        top,
        yosysVersion: yosysVersion || null,
        scriptVersion: YOSYS_SYNTH_SCRIPT_VERSION,
        ...(buildPath ? { buildPath } : {}),
      },
    });
  }
}

function normalizeBuildpackInstallPayload(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const name = typeof value.name === "string" && value.name.trim().length > 0 ? value.name.trim() : null;
  const version = typeof value.version === "string" && value.version.trim().length > 0 ? value.version.trim() : null;
  const url = typeof value.url === "string" && value.url.trim().length > 0 ? value.url.trim() : null;
  const sha256 = typeof value.sha256 === "string" && value.sha256.trim().length > 0 ? value.sha256.trim().toLowerCase() : null;
  return {
    name,
    version,
    url,
    sha256,
  };
}

function normalizeBuildpackRemovePayload(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const name = typeof value.name === "string" && value.name.trim().length > 0 ? value.name.trim() : null;
  const version = typeof value.version === "string" && value.version.trim().length > 0 ? value.version.trim() : null;
  return { name, version };
}

function buildBuildpackStatusPayload(capabilities, runId = null) {
  const platform = os.platform();
  const arch = os.arch();
  const platformKey = getBuildpackPlatformKey({ platform, arch });
  const storeRoot = getBuildpackStoreRoot({ platform, arch });
  const installed = listInstalledBuildpacks({ platform, arch }).map((pack) => ({
    name: pack.name,
    version: pack.version,
    platformKey: pack.manifest?.platformKey || null,
    installDir: pack.installDir,
    ok: pack.ok === true,
    integrity: pack.integrity === "corrupt" ? "corrupt" : "verified",
    tools: Array.isArray(pack.tools)
      ? pack.tools.map((tool) => ({
          name: tool.name,
          relPath: tool.relPath,
          version: tool.version || null,
        }))
      : [],
    ...(typeof pack.error === "string" ? { error: pack.error } : {}),
    ...(typeof pack.details === "string" ? { details: pack.details } : {}),
  }));
  const logs = [];
  let ts = 0;
  const push = (level, msg, data) => {
    logs.push({
      run_id: runId || "toolchain-buildpack-status",
      ts: ts++,
      step: "buildpack",
      level,
      msg,
      ...(data && typeof data === "object" ? { data } : {}),
    });
  };
  push("info", "[bridge] buildpack: status collected", {
    platformKey,
    storeRoot,
    installedCount: installed.length,
  });
  const buildpackTools = ["yosys", "nextpnr-xilinx", "f4pga", "openFPGALoader"];
  const tools = {};
  for (const toolName of buildpackTools) {
    const capability = capabilities?.[
      toolName === "nextpnr-xilinx" ? "nextpnrXilinx" : toolName
    ];
    tools[toolName] = {
      ok: capability?.ok === true,
      source:
        capability?.source === "buildpack" ||
        capability?.source === "bundled" ||
        capability?.source === "system" ||
        capability?.source === "found_not_in_path" ||
        capability?.source === "not_found"
          ? capability.source
          : "not_found",
      status: capability?.status === "found_not_in_path" || capability?.status === "missing" ? capability.status : "ok",
      integrity:
        capability?.integrity === "verified" || capability?.integrity === "corrupt" || capability?.integrity === "unknown"
          ? capability.integrity
          : "unknown",
      ...(typeof capability?.version === "string" ? { version: capability.version } : {}),
      ...(typeof capability?.path === "string" ? { path: capability.path } : {}),
      ...(typeof capability?.error === "string" ? { error: capability.error } : {}),
      ...(typeof capability?.suggestedFix === "string" ? { suggestedFix: capability.suggestedFix } : {}),
    };
  }
  return {
    schema_version: "toolchain_buildpack_status_v1",
    ok: installed.some((pack) => pack.ok),
    run_id: runId || deterministicId("buildpack-status", { platformKey, installed }),
    platformKey,
    storeRoot,
    installed,
    tools,
    logs,
  };
}

async function executeBuildpackInstallRun({
  runId,
  artifactId,
  payload,
}) {
  const log = (level, msg, data) => {
    toolchainBuildpackRuns.appendLog(runId, level, msg, data, "buildpack");
  };
  try {
    const result = await installBuildpackPayload({
      name: payload.name,
      version: payload.version,
      url: payload.url,
      sha256: payload.sha256,
      runId,
      platform: os.platform(),
      arch: os.arch(),
      env: process.env,
      homedir: os.homedir(),
      log,
    });
    toolchainCache = null;
    toolchainCacheTime = 0;
    log("info", "[bridge] buildpack: install complete", {
      name: result.manifest.name,
      version: result.manifest.version,
      platformKey: result.manifest.platformKey,
      installDir: result.installDir,
    });
    toolchainBuildpackRuns.finishRun(runId, {
      ok: true,
      exitCode: 0,
      artifact: {
        artifactId,
        name: result.manifest.name,
        version: result.manifest.version,
        platformKey: result.manifest.platformKey,
        installDir: result.installDir,
        tools: result.manifest.tools,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", `[bridge] buildpack: install failed: ${message}`);
    toolchainBuildpackRuns.finishRun(runId, {
      ok: false,
      exitCode: null,
      error: message || "buildpack_install_failed",
      artifact: {
        artifactId,
        name: payload.name,
        version: payload.version,
      },
    });
  }
}

app.get("/api/toolchain/buildpack/status", async (_req, res) => {
  const capabilities = await getCachedToolchain();
  return res.json(buildBuildpackStatusPayload(capabilities));
});

app.post("/api/toolchain/buildpack/install", async (req, res) => {
  const schemaVersion = "toolchain_buildpack_run_v1";
  const payload = normalizeBuildpackInstallPayload(req.body);
  if (!payload.name || !payload.version || !payload.url) {
    return res.status(400).json({
      schema_version: schemaVersion,
      ok: false,
      error: "buildpack_name_version_url_required",
      logs: [],
      nextOffset: 0,
    });
  }

  const artifactId = deterministicId("toolchain-buildpack-artifact", {
    name: payload.name,
    version: payload.version,
    url: payload.url,
    sha256: payload.sha256 || null,
  });
  const runId = createProgramExecutionRunId(artifactId, toolchainBuildpackExecutionSeq++);
  const started = toolchainBuildpackRuns.startRun({
    runId,
    artifactId,
    board: "basys3",
  });
  if (!started.ok) {
    const existing = toolchainBuildpackRuns.getStatus(runId, 0);
    return res.status(409).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      artifactId,
      state: existing?.state || "running",
      error: "run_already_running",
      logs: existing?.logs ?? [],
      nextOffset: existing?.nextOffset ?? 0,
    });
  }

  toolchainBuildpackRuns.appendLog(runId, "info", "[bridge] buildpack: install requested", {
    artifact_id: artifactId,
    name: payload.name,
    version: payload.version,
  });
  void executeBuildpackInstallRun({
    runId,
    artifactId,
    payload,
  });

  const status = toolchainBuildpackRuns.getStatus(runId, 0);
  return res.status(202).json({
    schema_version: schemaVersion,
    ok: true,
    runId,
    artifactId,
    state: status?.state || "running",
    logs: status?.logs ?? [],
    nextOffset: status?.nextOffset ?? 0,
    ...(status?.artifact ? { artifact: status.artifact } : {}),
  });
});

app.get("/api/toolchain/buildpack/runs/:runId", (req, res) => {
  const schemaVersion = "toolchain_buildpack_run_status_v1";
  const runId = typeof req.params?.runId === "string" ? req.params.runId : "";
  const offset = normalizeProgramRunOffset(req.query?.offset);
  const status = toolchainBuildpackRuns.getStatus(runId, offset);
  if (!status) {
    return res.status(404).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      error: "run_not_found",
      logs: [],
      nextOffset: offset,
    });
  }
  return res.json({
    schema_version: schemaVersion,
    ...status,
  });
});

app.get("/api/toolchain/buildpack/runs/:runId/stream", (req, res) => {
  const runId = typeof req.params?.runId === "string" ? req.params.runId : "";
  const offset = normalizeProgramRunOffset(req.query?.offset);
  const status = toolchainBuildpackRuns.getStatus(runId, offset);
  if (!status) {
    return res.status(404).json({ ok: false, error: "run_not_found" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  for (const entry of status.logs) {
    res.write(formatSseEvent("log", entry));
  }

  if (status.state !== "running") {
    res.write(formatSseEvent("done", {
      runId: status.runId,
      artifactId: status.artifactId,
      state: status.state,
      ok: status.ok === true,
      exitCode: status.exitCode,
      nextOffset: status.nextOffset,
      ...(status.error ? { error: status.error } : {}),
      ...(status.artifact ? { artifact: status.artifact } : {}),
    }));
    res.end();
    return;
  }

  const unsubscribe = toolchainBuildpackRuns.subscribe(runId, {
    onLog(entry) {
      if (!res.writableEnded) {
        res.write(formatSseEvent("log", entry));
      }
    },
    onDone(summary) {
      if (!res.writableEnded) {
        res.write(formatSseEvent("done", summary));
        res.end();
      }
    },
  });

  if (!unsubscribe) {
    res.end();
    return;
  }

  req.on("close", () => {
    unsubscribe();
  });
});

app.post("/api/toolchain/buildpack/remove", async (req, res) => {
  const payload = normalizeBuildpackRemovePayload(req.body);
  const runId = deterministicId("toolchain-buildpack-remove", payload);
  let ts = 0;
  const logs = [];
  const push = (level, msg, data) => {
    logs.push({
      run_id: runId,
      ts: ts++,
      step: "buildpack",
      level,
      msg,
      ...(data && typeof data === "object" ? { data } : {}),
    });
  };

  if (!payload.name || !payload.version) {
    push("error", "[bridge] buildpack: remove failed: buildpack_name_version_required");
    return res.status(400).json({
      schema_version: "toolchain_buildpack_remove_v1",
      ok: false,
      run_id: runId,
      removed: false,
      logs,
      error: "buildpack_name_version_required",
    });
  }

  const removed = removeBuildpackPayload({
    name: payload.name,
    version: payload.version,
    env: process.env,
    platform: os.platform(),
    homedir: os.homedir(),
  });
  if (!removed.ok) {
    push("error", `[bridge] buildpack: remove failed: ${removed.error || "remove_failed"}`);
    return res.status(500).json({
      schema_version: "toolchain_buildpack_remove_v1",
      ok: false,
      run_id: runId,
      removed: false,
      logs,
      error: removed.error || "remove_failed",
    });
  }
  toolchainCache = null;
  toolchainCacheTime = 0;
  push("info", `[bridge] buildpack: remove ${removed.removed ? "complete" : "no-op"}`, {
    name: payload.name,
    version: payload.version,
    storeRoot: removed.storeRoot,
  });
  return res.json({
    schema_version: "toolchain_buildpack_remove_v1",
    ok: true,
    run_id: runId,
    removed: removed.removed === true,
    logs,
  });
});

app.post("/api/toolchain/synth", async (req, res) => {
  const schemaVersion = "toolchain_synth_run_v1";
  const normalized = normalizeSynthRequestPayload(req.body || {});
  if (!normalized.board) {
    return res.status(400).json({
      schema_version: schemaVersion,
      ok: false,
      error: "unsupported_board",
      logs: [],
      nextOffset: 0,
    });
  }
  if (!normalized.top) {
    return res.status(400).json({
      schema_version: schemaVersion,
      ok: false,
      error: "top_required",
      logs: [],
      nextOffset: 0,
    });
  }
  if (normalized.nonVerilogCount > 0) {
    return res.status(400).json({
      schema_version: schemaVersion,
      ok: false,
      error: "verilog_only_for_now",
      logs: [],
      nextOffset: 0,
    });
  }
  if (normalized.invalidCount > 0 || normalized.sources.length === 0) {
    return res.status(400).json({
      schema_version: schemaVersion,
      ok: false,
      error: "invalid_sources",
      logs: [],
      nextOffset: 0,
    });
  }

  const capabilities = await getCachedToolchain();
  const yosys = capabilities?.yosys || null;
  const yosysPath = resolveSelectedYosysPath(capabilities);
  const artifactId = createSynthArtifactId({
    board: normalized.board,
    top: normalized.top,
    sources: normalized.sources,
    yosysVersion: yosys?.version || null,
    scriptVersion: YOSYS_SYNTH_SCRIPT_VERSION,
  });
  const runId = createProgramExecutionRunId(artifactId, toolchainSynthExecutionSeq++);

  if (!yosysPath) {
    const logs = [
      {
        run_id: runId,
        ts: 0,
        step: "synth",
        level: "error",
        msg: "[bridge] synth: yosys_missing",
      },
    ];
    return res.status(400).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      artifactId,
      state: "error",
      error: "yosys_missing",
      logs,
      nextOffset: logs.length,
    });
  }

  const started = toolchainSynthRuns.startRun({
    runId,
    artifactId,
    board: normalized.board,
  });
  if (!started.ok) {
    const existing = toolchainSynthRuns.getStatus(runId, 0);
    return res.status(409).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      artifactId,
      state: existing?.state || "running",
      error: "run_already_running",
      logs: existing?.logs ?? [],
      nextOffset: existing?.nextOffset ?? 0,
      ...(existing?.artifact ? { artifact: existing.artifact } : {}),
    });
  }

  if (started.ok && started.run && normalized.buildPath) {
    started.run.artifact = {
      artifactId,
      board: normalized.board,
      top: normalized.top,
      scriptVersion: YOSYS_SYNTH_SCRIPT_VERSION,
      buildPath: normalized.buildPath,
      outputs: {
        netlistVerilog: "",
        statText: "",
      },
    };
  }

  toolchainSynthRuns.appendLog(runId, "info", "[bridge] synth: started", {
    artifact_id: artifactId,
    board: normalized.board,
    top: normalized.top,
    source_count: normalized.sources.length,
    yosys_version: yosys.version || null,
    yosys_source: yosys?.source || null,
    yosys_integrity: yosys?.integrity || null,
    script_version: YOSYS_SYNTH_SCRIPT_VERSION,
    ...(normalized.buildPath
      ? {
          build_path_plan_id: normalized.buildPath.planId,
          build_path_backend: normalized.buildPath.backend,
        }
      : {}),
  });

  void executeToolchainSynthRun({
    runId,
    artifactId,
    board: normalized.board,
    top: normalized.top,
    sources: normalized.sources,
    yosysPath,
    yosysVersion: yosys.version || null,
    buildPath: normalized.buildPath,
  });

  const status = toolchainSynthRuns.getStatus(runId, 0);
  return res.status(202).json({
    schema_version: schemaVersion,
    ok: true,
    runId,
    artifactId,
    state: status?.state || "running",
    logs: status?.logs ?? [],
    nextOffset: status?.nextOffset ?? 0,
    ...(status?.artifact ? { artifact: status.artifact } : {}),
  });
});

app.get("/api/toolchain/synth/runs/:runId", (req, res) => {
  const schemaVersion = "toolchain_synth_run_status_v1";
  const runId = typeof req.params?.runId === "string" ? req.params.runId : "";
  const offset = normalizeProgramRunOffset(req.query?.offset);
  const status = toolchainSynthRuns.getStatus(runId, offset);
  if (!status) {
    return res.status(404).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      error: "run_not_found",
      logs: [],
      nextOffset: offset,
    });
  }
  return res.json({
    schema_version: schemaVersion,
    ...status,
  });
});

app.get("/api/toolchain/synth/runs/:runId/stream", (req, res) => {
  const runId = typeof req.params?.runId === "string" ? req.params.runId : "";
  const offset = normalizeProgramRunOffset(req.query?.offset);
  const status = toolchainSynthRuns.getStatus(runId, offset);
  if (!status) {
    return res.status(404).json({ ok: false, error: "run_not_found" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  for (const entry of status.logs) {
    res.write(formatSseEvent("log", entry));
  }

  if (status.state !== "running") {
    res.write(
      formatSseEvent("done", {
        runId: status.runId,
        artifactId: status.artifactId,
        state: status.state,
        ok: status.ok === true,
        exitCode: status.exitCode,
        nextOffset: status.nextOffset,
        ...(status.artifact ? { artifact: status.artifact } : {}),
        ...(status.error ? { error: status.error } : {}),
      })
    );
    res.end();
    return;
  }

  const unsubscribe = toolchainSynthRuns.subscribe(runId, {
    onLog(entry) {
      if (!res.writableEnded) {
        res.write(formatSseEvent("log", entry));
      }
    },
    onDone(summary) {
      if (!res.writableEnded) {
        res.write(formatSseEvent("done", summary));
        res.end();
      }
    },
  });

  if (!unsubscribe) {
    res.end();
    return;
  }

  req.on("close", () => {
    unsubscribe();
  });
});

app.get("/api/toolchain/synth/runs/:runId/artifacts.zip", async (req, res) => {
  const schemaVersion = "toolchain_synth_artifacts_v1";
  const runId = typeof req.params?.runId === "string" ? req.params.runId : "";
  const status = toolchainSynthRuns.getStatus(runId, 0);
  if (!status) {
    return res.status(404).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      error: "run_not_found",
    });
  }

  if (status.state === "running") {
    return res.status(409).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      artifactId: status.artifactId,
      state: status.state,
      error: "run_not_ready",
      msg: "synth run artifacts are not ready yet",
    });
  }

  try {
    const includeSourcesRaw =
      typeof req.query?.includeSources === "string" ? req.query.includeSources : undefined;
    if (
      includeSourcesRaw !== undefined &&
      includeSourcesRaw !== "0" &&
      includeSourcesRaw !== "1"
    ) {
      return res.status(400).json({
        schema_version: schemaVersion,
        ok: false,
        runId,
        artifactId: status.artifactId,
        state: status.state,
        error: "invalid_include_sources",
        msg: "includeSources must be 0 or 1",
      });
    }
    const includeSources = includeSourcesRaw === "1";
    const bundle = prepareSynthArtifactBundle({
      repoRoot: getRepoRoot(),
      runId,
      status,
      includeSources,
    });
    const zipBuffer = await createSynthArtifactsZipBuffer(bundle);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${bundle.filename}"`);
    res.setHeader("Content-Length", String(zipBuffer.length));
    return res.status(200).send(zipBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      artifactId: status.artifactId,
      state: status.state,
      error: "artifact_bundle_failed",
      msg: message,
    });
  }
});

async function executeToolchainImplementRun({ runId, artifactId, project, buildPath }) {
  const repoRoot = getRepoRoot();
  const push = (level, msg, data, step = "implement") => {
    toolchainImplementRuns.appendLog(runId, level, msg, data, step);
  };
  const top = project.hdl.top || project.fpga.top || "top";
  const constraintsHash = deriveImplementConstraintsHash(project);
  const fallbackArtifact = {
    artifactId,
    board: project.fpga.board,
    top,
    planId: buildPath.planId,
    backend: buildPath.backend,
    constraintsHash,
    commands: [],
    requiredTools: buildPath.requiredTools,
    sources: [],
    outputs: [],
  };

  if (buildPath.backend === "none") {
    push("error", "[bridge] implement: no viable backend selected; run Plan Implementation and install required tools.");
    toolchainImplementRuns.finishRun(runId, {
      state: "error",
      ok: false,
      exitCode: null,
      error: "no_viable_backend",
      artifact: fallbackArtifact,
    });
    return;
  }

  try {
    const tmpDir = ensureTmpDir(repoRoot);
    const runWorkDir = path.join(tmpDir, runId);
    fs.rmSync(runWorkDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(runWorkDir, "out"), { recursive: true });

    const sourceEntries = writeImplementSources(runWorkDir, project.hdl.sources);
    const constraintsEntry = writeImplementConstraints(runWorkDir, project.fpga.constraints);
    const context = buildImplementExecutionContext({ top, sourceEntries, constraintsEntry });
    const resolvedCommands = materializeImplementCommands(buildPath.commands, context);
    const sourceRefs = sourceEntries.map((entry) => ({
      path: entry.sourcePath,
      storedPath: path.relative(repoRoot, entry.absolutePath).replace(/\\/g, "/"),
    }));

    push("info", "[bridge] implement: started", {
      artifact_id: artifactId,
      board: project.fpga.board,
      top,
      backend: buildPath.backend,
      plan_id: buildPath.planId,
      source_count: sourceEntries.length,
      command_count: resolvedCommands.length,
    });

    if (constraintsEntry) {
      push("info", "[bridge] implement: constraints loaded", {
        constraints: constraintsEntry.runRelativePath,
      });
    } else {
      push("warn", "[bridge] implement: constraints missing; implementation is expected to fail.");
    }

    let lastExitCode = 0;
    let runError = null;
    for (const command of resolvedCommands) {
      const result = await executeImplementCommand({
        runId,
        workDir: runWorkDir,
        command,
      });
      toolchainImplementRuns.clearProcess(runId);
      if (!result.ok) {
        lastExitCode = typeof result.exitCode === "number" ? result.exitCode : null;
        runError = result.error || "implement_command_failed";
        push("error", `[bridge] implement: command failed (${command.step}): ${runError}`, undefined, command.step === "synth" ? "implement" : command.step);
        break;
      }
      lastExitCode = typeof result.exitCode === "number" ? result.exitCode : 0;
    }

    const outputs = collectImplementArtifactOutputs({
      repoRoot,
      runWorkDir,
      plannedOutputs: buildPath.outputs,
    });
    const artifact = {
      artifactId,
      board: project.fpga.board,
      top,
      planId: buildPath.planId,
      backend: buildPath.backend,
      constraintsHash,
      commands: resolvedCommands,
      requiredTools: buildPath.requiredTools,
      sources: sourceRefs,
      outputs,
    };

    if (runError) {
      toolchainImplementRuns.finishRun(runId, {
        state: "error",
        ok: false,
        exitCode: lastExitCode,
        error: runError,
        artifact,
      });
      return;
    }

    push("info", "[bridge] implement: completed", {
      artifact_id: artifactId,
      outputs: outputs.map((output) => output.pathHint),
    });
    toolchainImplementRuns.finishRun(runId, {
      state: "done",
      ok: true,
      exitCode: lastExitCode,
      artifact,
    });
  } catch (error) {
    toolchainImplementRuns.clearProcess(runId);
    const message = error instanceof Error ? error.message : String(error);
    push("error", `[bridge] implement: failed: ${message}`);
    toolchainImplementRuns.finishRun(runId, {
      state: "error",
      ok: false,
      exitCode: null,
      error: "implement_failed",
      artifact: fallbackArtifact,
    });
  }
}

app.post("/api/toolchain/implement/run", async (req, res) => {
  const schemaVersion = "toolchain_implement_run_v1";
  const normalized = normalizeImplementRunPayload(req.body || {});
  if (normalized.board !== "basys3") {
    return res.status(400).json({
      schema_version: schemaVersion,
      ok: false,
      error: "unsupported_board",
      logs: [],
      nextOffset: 0,
    });
  }

  const capabilities = await getCachedToolchain();
  const planned = buildImplementPlan({
    backendId: "vivado",
    project: normalized.project,
    capabilities,
    platform: os.platform(),
  });
  const effectiveBuildPath = normalized.buildPath
    ? {
        planId: normalized.buildPath.planId,
        backend: normalized.buildPath.backend,
        ...(normalized.buildPath.buildpack ? { buildpack: normalized.buildPath.buildpack } : {}),
        requiredTools:
          normalized.buildPath.requiredTools.length > 0
            ? normalized.buildPath.requiredTools
            : planned.requiredTools,
        commands: normalized.buildPath.commands.length > 0 ? normalized.buildPath.commands : planned.commands,
        outputs: normalized.buildPath.outputs.length > 0 ? normalized.buildPath.outputs : planned.outputs,
        warnings: normalized.buildPath.warnings.length > 0 ? normalized.buildPath.warnings : planned.warnings,
      }
    : {
        planId: planned.planId,
        backend: planned.backend,
        ...(planned.buildpack ? { buildpack: planned.buildpack } : {}),
        requiredTools: planned.requiredTools,
        commands: planned.commands,
        outputs: planned.outputs,
        warnings: planned.warnings,
      };

  const identity = deriveImplementRunIdentity({
    project: normalized.project,
    buildPath: effectiveBuildPath,
  });
  const runId = identity.runId;
  const artifactId = identity.artifactId;
  const started = toolchainImplementRuns.startRun({
    runId,
    artifactId,
    board: normalized.board,
  });
  if (!started.ok) {
    const existing = toolchainImplementRuns.getStatus(runId, 0);
    return res.status(409).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      artifactId,
      state: existing?.state || "running",
      error: "run_already_running",
      logs: existing?.logs ?? [],
      nextOffset: existing?.nextOffset ?? 0,
      ...(existing?.artifact ? { artifact: existing.artifact } : {}),
    });
  }

  if (started.ok && started.run) {
    started.run.artifact = {
      artifactId,
      board: normalized.board,
      top: identity.top,
      planId: effectiveBuildPath.planId,
      backend: effectiveBuildPath.backend,
      constraintsHash: identity.constraintsHash,
      commands: [],
      requiredTools: effectiveBuildPath.requiredTools,
      sources: [],
      outputs: [],
    };
  }

  toolchainImplementRuns.appendLog(
    runId,
    "info",
    `[bridge] implement: queued backend=${effectiveBuildPath.backend} plan=${effectiveBuildPath.planId}`,
    {
      artifact_id: artifactId,
      board: normalized.board,
      source_hash: identity.sourceHash,
      constraints_hash: identity.constraintsHash,
      ...(effectiveBuildPath.buildpack
        ? {
            buildpack_name: effectiveBuildPath.buildpack.name,
            buildpack_version: effectiveBuildPath.buildpack.version,
          }
        : {}),
    }
  );

  void executeToolchainImplementRun({
    runId,
    artifactId,
    project: normalized.project,
    buildPath: effectiveBuildPath,
  });

  const status = toolchainImplementRuns.getStatus(runId, 0);
  return res.status(202).json({
    schema_version: schemaVersion,
    ok: true,
    runId,
    artifactId,
    state: status?.state || "running",
    logs: status?.logs ?? [],
    nextOffset: status?.nextOffset ?? 0,
    ...(status?.artifact ? { artifact: status.artifact } : {}),
  });
});

app.get("/api/toolchain/implement/runs/:runId", (req, res) => {
  const schemaVersion = "toolchain_implement_run_status_v1";
  const runId = typeof req.params?.runId === "string" ? req.params.runId : "";
  const offset = normalizeProgramRunOffset(req.query?.offset);
  const status = toolchainImplementRuns.getStatus(runId, offset);
  if (!status) {
    return res.status(404).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      error: "run_not_found",
      logs: [],
      nextOffset: offset,
    });
  }
  return res.json({
    schema_version: schemaVersion,
    ...status,
  });
});

app.get("/api/toolchain/implement/runs/:runId/stream", (req, res) => {
  const runId = typeof req.params?.runId === "string" ? req.params.runId : "";
  const offset = normalizeProgramRunOffset(req.query?.offset);
  const status = toolchainImplementRuns.getStatus(runId, offset);
  if (!status) {
    return res.status(404).json({ ok: false, error: "run_not_found" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  for (const entry of status.logs) {
    res.write(formatSseEvent("log", entry));
  }

  if (status.state !== "running") {
    res.write(
      formatSseEvent("done", {
        runId: status.runId,
        artifactId: status.artifactId,
        state: status.state,
        ok: status.ok === true,
        exitCode: status.exitCode,
        nextOffset: status.nextOffset,
        ...(status.artifact ? { artifact: status.artifact } : {}),
        ...(status.error ? { error: status.error } : {}),
      })
    );
    res.end();
    return;
  }

  const unsubscribe = toolchainImplementRuns.subscribe(runId, {
    onLog(entry) {
      if (!res.writableEnded) {
        res.write(formatSseEvent("log", entry));
      }
    },
    onDone(summary) {
      if (!res.writableEnded) {
        res.write(formatSseEvent("done", summary));
        res.end();
      }
    },
  });

  if (!unsubscribe) {
    res.end();
    return;
  }

  req.on("close", () => {
    unsubscribe();
  });
});

app.get("/api/toolchain/implement/runs/:runId/artifacts.zip", async (req, res) => {
  const schemaVersion = "toolchain_implement_artifacts_v1";
  const runId = typeof req.params?.runId === "string" ? req.params.runId : "";
  const status = toolchainImplementRuns.getStatus(runId, 0);
  if (!status) {
    return res.status(404).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      error: "run_not_found",
    });
  }

  if (status.state === "running") {
    return res.status(409).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      artifactId: status.artifactId,
      state: status.state,
      error: "run_not_ready",
      msg: "implement run artifacts are not ready yet",
    });
  }

  try {
    const includeSourcesRaw =
      typeof req.query?.includeSources === "string" ? req.query.includeSources : undefined;
    if (
      includeSourcesRaw !== undefined &&
      includeSourcesRaw !== "0" &&
      includeSourcesRaw !== "1"
    ) {
      return res.status(400).json({
        schema_version: schemaVersion,
        ok: false,
        runId,
        artifactId: status.artifactId,
        state: status.state,
        error: "invalid_include_sources",
        msg: "includeSources must be 0 or 1",
      });
    }
    const includeSources = includeSourcesRaw === "1";
    const bundle = prepareImplementArtifactBundle({
      repoRoot: getRepoRoot(),
      runId,
      status,
      includeSources,
    });
    const zipBuffer = await createImplementArtifactsZipBuffer(bundle);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${bundle.filename}"`);
    res.setHeader("Content-Length", String(zipBuffer.length));
    return res.status(200).send(zipBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      artifactId: status.artifactId,
      state: status.state,
      error: "artifact_bundle_failed",
      msg: message,
    });
  }
});

app.get("/api/toolchain/implement/runs/:runId/output/bitstream", (req, res) => {
  const schemaVersion = "toolchain_implement_output_bitstream_v1";
  const runId = typeof req.params?.runId === "string" ? req.params.runId : "";
  const status = toolchainImplementRuns.getStatus(runId, 0);
  if (!status) {
    return res.status(404).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      error: "run_not_found",
      logs: [
        {
          run_id: runId,
          ts: 0,
          step: "implement",
          level: "error",
          msg: "[bridge] implement: run not found",
        },
      ],
    });
  }

  if (status.state === "running") {
    return res.status(409).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      artifactId: status.artifactId,
      state: status.state,
      error: "run_not_ready",
      logs: [
        {
          run_id: runId,
          ts: 0,
          step: "implement",
          level: "warn",
          msg: "[bridge] implement: bitstream not ready; run is still active",
        },
      ],
    });
  }

  try {
    const bitstream = readImplementBitstreamArtifact({
      repoRoot: getRepoRoot(),
      artifact: status.artifact,
    });
    if (!bitstream) {
      return res.status(404).json({
        schema_version: schemaVersion,
        ok: false,
        runId,
        artifactId: status.artifactId,
        state: status.state,
        error: "bitstream_not_found",
        logs: [
          {
            run_id: runId,
            ts: 0,
            step: "bitgen",
            level: "error",
            msg: "[bridge] implement: no generated bitstream output found",
          },
        ],
      });
    }
    return res.status(200).json({
      schema_version: schemaVersion,
      ok: true,
      runId,
      artifactId: status.artifactId,
      filename: bitstream.filename,
      bitstream: {
        kind: "base64",
        data: bitstream.dataBase64,
      },
      output: {
        kind: bitstream.kind,
        name: bitstream.name,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      artifactId: status.artifactId,
      state: status.state,
      error: "bitstream_read_failed",
      logs: [
        {
          run_id: runId,
          ts: 0,
          step: "bitgen",
          level: "error",
          msg: `[bridge] implement: failed to read bitstream: ${message}`,
        },
      ],
    });
  }
});

async function executeProgramBitstreamRun({ runId, artifactId, board, mode, normalizedBitstream, bitstreamHash }) {
  const push = (level, msg, data) => {
    toolchainProgramRuns.appendLog(runId, level, msg, data);
  };

  try {
    const capabilities = await getCachedToolchain();
    const loader = capabilities?.openFPGALoader;
    if (!loader?.path) {
      push("error", "[bridge] program: openFPGALoader not found");
      toolchainProgramRuns.finishRun(runId, { ok: false, exitCode: null, error: "openfpgaloader_missing" });
      return;
    }

    const repoRoot = getRepoRoot();
    const tmpDir = ensureTmpDir(repoRoot);
    const bitPath = path.join(tmpDir, `${runId}.bit`);
    fs.writeFileSync(bitPath, normalizedBitstream.buffer);
    push("info", `[bridge] program: wrote bitstream: ${bitPath}`, {
      artifact_id: artifactId,
      bytes: normalizedBitstream.buffer.length,
      bitstream_sha256: bitstreamHash,
    });

    const result = await runOpenFpgaLoaderProgram({
      loaderPath: loader.path,
      board,
      bitPath,
      mode,
      pushLog: push,
      onSpawn(proc) {
        toolchainProgramRuns.attachProcess(runId, proc);
      },
      isCancelRequested() {
        return toolchainProgramRuns.isCancelRequested(runId);
      },
    });
    toolchainProgramRuns.clearProcess(runId);

    if (result.canceled) {
      toolchainProgramRuns.finishRun(runId, {
        state: "canceled",
        ok: false,
        exitCode: -1,
        error: "canceled_by_user",
      });
      return;
    }

    if (!result.ok) {
      push(
        "warn",
        "[bridge] program: hint: if device not found, verify Basys3 USB cable/drivers, close Vivado Hardware Manager, and retry another USB port/cable."
      );
      toolchainProgramRuns.finishRun(runId, {
        ok: false,
        exitCode: result.exitCode,
        error: result.error || "program_failed",
      });
      return;
    }

    toolchainProgramRuns.finishRun(runId, {
      ok: true,
      exitCode: result.exitCode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toolchainProgramRuns.clearProcess(runId);
    push("error", `[bridge] program: failed: ${message}`);
    push(
      "warn",
      "[bridge] program: hint: if device not found, verify Basys3 USB cable/drivers, close Vivado Hardware Manager, and retry another USB port/cable."
    );
    toolchainProgramRuns.finishRun(runId, { ok: false, exitCode: null, error: "program_failed" });
  }
}

app.post("/api/toolchain/program-bitstream", async (req, res) => {
  const schemaVersion = "toolchain_program_bitstream_v1";
  const body = req.body || {};
  const board = body.board === "basys3" ? "basys3" : null;
  const mode = body.mode === "sram" ? "sram" : null;

  if (!board) {
    return res.status(400).json({
      schema_version: schemaVersion,
      ok: false,
      error: "unsupported_board",
      logs: [],
      nextOffset: 0,
    });
  }
  if (!mode) {
    return res.status(400).json({
      schema_version: schemaVersion,
      ok: false,
      error: "unsupported_mode",
      logs: [],
      nextOffset: 0,
    });
  }

  const activeRun = toolchainProgramRuns.getActiveRunByBoard(board);
  if (activeRun) {
    const logs = [
      {
        run_id: activeRun.runId,
        ts: 0,
        step: "program",
        level: "warn",
        msg: `[bridge] program: board busy: another program run is active (runId=${activeRun.runId}). Cancel it or wait.`,
      },
    ];
    return res.status(409).json({
      schema_version: schemaVersion,
      ok: false,
      error: "BOARD_BUSY",
      board,
      activeRunId: activeRun.runId,
      logs,
      nextOffset: logs.length,
    });
  }

  const normalizedBitstream = normalizeProgramBitstreamPayload(body.bitstream);
  if (!normalizedBitstream) {
    return res.status(400).json({
      schema_version: schemaVersion,
      ok: false,
      error: "invalid_bitstream_payload",
      logs: [],
      nextOffset: 0,
    });
  }

  const bitstreamHash = hashBufferSha256(normalizedBitstream.buffer);
  const artifactId = buildProgramBitstreamRunId({ board, mode, bitstreamHash });
  const runId = createProgramExecutionRunId(artifactId, toolchainProgramExecutionSeq++);
  const started = toolchainProgramRuns.startRun({ runId, artifactId, board });
  if (!started.ok) {
    const existing = toolchainProgramRuns.getStatus(runId, 0);
    return res.status(409).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      artifactId,
      state: existing?.state || "running",
      error: "run_already_running",
      logs: existing?.logs ?? [],
      nextOffset: existing?.nextOffset ?? 0,
    });
  }

  toolchainProgramRuns.appendLog(runId, "info", "[bridge] program: started", {
    artifact_id: artifactId,
    board,
    mode,
    bitstream_sha256: bitstreamHash,
  });
  void executeProgramBitstreamRun({ runId, artifactId, board, mode, normalizedBitstream, bitstreamHash });

  const status = toolchainProgramRuns.getStatus(runId, 0);
  return res.status(202).json({
    schema_version: schemaVersion,
    ok: true,
    runId,
    artifactId,
    state: status?.state || "running",
    logs: status?.logs ?? [],
    nextOffset: status?.nextOffset ?? 0,
  });
});

app.get("/api/toolchain/runs/:runId", (req, res) => {
  const schemaVersion = "toolchain_program_run_v1";
  const runId = typeof req.params?.runId === "string" ? req.params.runId : "";
  const offset = normalizeProgramRunOffset(req.query?.offset);
  const status = toolchainProgramRuns.getStatus(runId, offset);
  if (!status) {
    return res.status(404).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      error: "run_not_found",
      logs: [],
      nextOffset: offset,
    });
  }
  return res.json({
    schema_version: schemaVersion,
    ...status,
  });
});

app.post("/api/toolchain/runs/:runId/cancel", async (req, res) => {
  const schemaVersion = "toolchain_run_cancel_v1";
  const runId = typeof req.params?.runId === "string" ? req.params.runId : "";
  const cancellation = await cancelToolchainRun({
    runId,
    registries: TOOLCHAIN_RUN_REGISTRIES,
    terminateProcessTree,
  });

  if (!cancellation.ok && cancellation.error === "run_not_found") {
    return res.status(404).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      error: "run_not_found",
      logs: [],
      nextOffset: 0,
    });
  }

  if (!cancellation.ok && cancellation.error === "cancel_failed") {
    return res.status(500).json({
      schema_version: schemaVersion,
      ...(cancellation.status || {
        runId,
        artifactId: runId,
        state: "error",
        ok: false,
        exitCode: null,
        logs: [],
        nextOffset: 0,
      }),
      kind: cancellation.kind,
      error: "cancel_failed",
    });
  }

  if (!cancellation.status) {
    return res.status(500).json({
      schema_version: schemaVersion,
      ok: false,
      runId,
      error: "cancel_failed",
      logs: [],
      nextOffset: 0,
    });
  }

  if (cancellation.status.state !== "running" && cancellation.canceled !== true) {
    return res.json({
      schema_version: schemaVersion,
      ...cancellation.status,
      kind: cancellation.kind,
    });
  }

  return res.json({
    schema_version: schemaVersion,
    ...cancellation.status,
    kind: cancellation.kind,
  });
});

app.get("/api/toolchain/runs/:runId/stream", (req, res) => {
  const runId = typeof req.params?.runId === "string" ? req.params.runId : "";
  const offset = normalizeProgramRunOffset(req.query?.offset);
  const status = toolchainProgramRuns.getStatus(runId, offset);
  if (!status) {
    return res.status(404).json({ ok: false, error: "run_not_found" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  for (const entry of status.logs) {
    res.write(formatSseEvent("log", entry));
  }

  if (status.state !== "running") {
    res.write(
      formatSseEvent("done", {
        runId: status.runId,
        artifactId: status.artifactId,
        state: status.state,
        ok: status.ok === true,
        exitCode: status.exitCode,
        nextOffset: status.nextOffset,
        ...(status.error ? { error: status.error } : {}),
      })
    );
    res.end();
    return;
  }

  const unsubscribe = toolchainProgramRuns.subscribe(runId, {
    onLog(entry) {
      if (!res.writableEnded) {
        res.write(formatSseEvent("log", entry));
      }
    },
    onDone(summary) {
      if (!res.writableEnded) {
        res.write(formatSseEvent("done", summary));
        res.end();
      }
    },
  });

  if (!unsubscribe) {
    res.end();
    return;
  }

  req.on("close", () => {
    unsubscribe();
  });
});

app.get("/api/toolchain", async (_req, res) => {
  try {
    const capabilities = await getCachedToolchain();
    const canSynthesize = Boolean(
      capabilities.vivado?.canSynthesize || (capabilities.yosys && capabilities.yosys.status !== "missing")
    );
    const canProgram = Boolean(
      capabilities.vivado?.canProgram ||
        (capabilities.openFPGALoader && capabilities.openFPGALoader.status !== "missing")
    );

    res.json({
      ok: true,
      capabilities,
      canSynthesize,
      canProgram,
      preferredSynthesisTool: capabilities.vivado ? "vivado" : capabilities.yosys ? "yosys" : null,
      preferredProgrammingTool:
        capabilities.vivado?.canProgram
          ? "vivado"
          : capabilities.openFPGALoader && capabilities.openFPGALoader.status !== "missing"
            ? "openFPGALoader"
            : null,
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
import { createHash, randomUUID } from "crypto";

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


const server = app.listen(HTTP_PORT, "0.0.0.0", () => {
  console.log(`HTTP listening on http://localhost:${HTTP_PORT}`);
  console.log(`Mode: ${MOCK_MODE ? "MOCK" : "REAL"}`);
});

server.on("error", (err) => {
  console.error(`[fpga-bridge] Failed to start HTTP server on ${HTTP_PORT}: ${err.message}`);
  process.exit(1);
});

// WebSocket with port fallback on EADDRINUSE
let wss = null;
let actualWsPort = WS_PORT;

function startWebSocket(port, attempt = 1) {
  const maxAttempts = 3;
  const server = new WebSocketServer({ port }, () => {
    actualWsPort = port;
    console.log(`[fpga-bridge] WS listening on ws://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < maxAttempts) {
      const nextPort = port + 1;
      console.warn(`[fpga-bridge] Port ${port} in use, trying ${nextPort}...`);
      startWebSocket(nextPort, attempt + 1);
    } else {
      console.error(`[fpga-bridge] Failed to start WebSocket: ${err.message}`);
      console.error(`[fpga-bridge] To kill process on port ${port}:`);
      console.error(`  PowerShell: Get-NetTCPConnection -LocalPort ${port} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
      console.error(`  Or simply: taskkill /F /PID <pid>`);
      process.exit(1);
    }
  });

  wss = server;
}

startWebSocket(WS_PORT);

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
      traceRecorder.close().catch(() => { });
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
