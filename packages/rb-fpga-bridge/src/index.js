import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
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
const MOCK_SEED = parseInt(process.env.RB_FPGA_SEED || "1");

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
const programJobs = new Map();
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
  for (const [id, job] of programJobs) {
    if (now - job.startedAt > JOB_TTL) {
      programJobs.delete(id);
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

// Program FPGA
app.post("/api/program", async (req, res) => {
  try {
    const { bitstream, method = "auto" } = req.body;

    if (!bitstream) {
      return res.status(400).json({ ok: false, error: "Missing bitstream (base64)" });
    }

    const capabilities = await getCachedToolchain();
    const tool = method === "auto"
      ? (capabilities.vivado?.canProgram ? "vivado" : capabilities.openFPGALoader ? "openFPGALoader" : null)
      : method;

    if (!tool) {
      return res.status(400).json({
        ok: false,
        error: "Vivado not found. Please install AMD Vivado WebPACK and ensure it is on your PATH, or install openFPGALoader for programming.",
      });
    }

    const jobId = randomUUID();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-program-"));
    const bitstreamPath = path.join(tempDir, "circuit.bit");

    // Write bitstream to temp file
    const buffer = Buffer.from(bitstream, "base64");
    fs.writeFileSync(bitstreamPath, buffer);

    const job = {
      jobId,
      status: "queued",
      progress: 0,
      logs: [],
      startedAt: Date.now(),
      tempDir,
    };
    programJobs.set(jobId, job);

    job.logs.push(`Programming with ${tool}...`);
    job.status = "connecting";
    job.progress = 10;

    broadcast(createEvent("program:start", { jobId, tool }));

    if (tool === "vivado") {
      // Generate Vivado programming script
      const tclFile = path.join(tempDir, "program.tcl");
      const tclScript = `
open_hw_manager
connect_hw_server
open_hw_target
current_hw_device [lindex [get_hw_devices] 0]
set_property PROGRAM.FILE {${bitstreamPath.replace(/\\/g, '/')}} [current_hw_device]
program_hw_devices [current_hw_device]
close_hw_manager
puts "Programming complete!"
exit
`;
      fs.writeFileSync(tclFile, tclScript);

      const vivadoPath = capabilities.vivado.path;
      const proc = spawn(`"${vivadoPath}"`, ["-mode", "batch", "-source", tclFile], {
        cwd: tempDir,
        shell: true,
      });

      proc.stdout?.on("data", (data) => {
        const text = data.toString();
        job.logs.push(text.trim());

        if (text.includes("connect_hw_server")) {
          job.progress = 20;
        } else if (text.includes("open_hw_target")) {
          job.status = "connecting";
          job.progress = 40;
        } else if (text.includes("program_hw_devices")) {
          job.status = "uploading";
          job.progress = 70;
        } else if (text.includes("Programming complete")) {
          job.status = "complete";
          job.progress = 100;
        }

        broadcast(createEvent("program:progress", { jobId, status: job.status, progress: job.progress }));
      });

      proc.stderr?.on("data", (data) => {
        job.logs.push(`[STDERR] ${data.toString().trim()}`);
      });

      proc.on("close", (code) => {
        if (code === 0) {
          job.status = "complete";
          job.progress = 100;
          job.completedAt = Date.now();
          job.logs.push("Programming complete!");
        } else {
          job.status = "failed";
          job.error = `Vivado exited with code ${code}`;
        }
        broadcast(createEvent("program:complete", { jobId, status: job.status, success: job.status === "complete" }));

        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      });

      proc.on("error", (err) => {
        job.status = "failed";
        job.error = err.message;
        broadcast(createEvent("program:error", { jobId, error: err.message }));
      });

    } else if (tool === "openFPGALoader") {
      const loaderPath = capabilities.openFPGALoader.path;
      const proc = spawn(loaderPath, ["-b", "basys3", bitstreamPath], { shell: true });

      proc.stdout?.on("data", (data) => {
        const text = data.toString();
        job.logs.push(text.trim());
        job.status = "uploading";
        job.progress = 50;
        broadcast(createEvent("program:progress", { jobId, status: job.status, progress: job.progress }));
      });

      proc.stderr?.on("data", (data) => {
        const text = data.toString();
        job.logs.push(text.trim());

        // Parse percentage
        const match = text.match(/(\d+)%/);
        if (match) {
          const percent = parseInt(match[1]);
          job.progress = Math.min(90, 30 + percent * 0.6);
          broadcast(createEvent("program:progress", { jobId, status: job.status, progress: job.progress }));
        }
      });

      proc.on("close", (code) => {
        if (code === 0) {
          job.status = "complete";
          job.progress = 100;
          job.completedAt = Date.now();
          job.logs.push("Programming complete!");
        } else {
          job.status = "failed";
          job.error = `openFPGALoader exited with code ${code}`;
        }
        broadcast(createEvent("program:complete", { jobId, status: job.status, success: job.status === "complete" }));

        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      });

      proc.on("error", (err) => {
        job.status = "failed";
        job.error = err.message;
        broadcast(createEvent("program:error", { jobId, error: err.message }));
      });
    }

    res.json({ ok: true, jobId, tool });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Get programming job status
app.get("/api/program/:jobId", (req, res) => {
  const job = programJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ ok: false, error: "Job not found" });
  }

  res.json({
    ok: true,
    job: {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      logs: job.logs.slice(-50),
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    },
  });
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
    console.log(`[fpga-bridge] ⚠️  MOCK MODE - simulating Basys3 board (seed=${MOCK_SEED})`);
    state.connected = true;
    state.port = "MOCK";
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
    console.log("[fpga-bridge] Or set RB_FPGA_MOCK=1 to run in simulation mode.");
  }
})();
