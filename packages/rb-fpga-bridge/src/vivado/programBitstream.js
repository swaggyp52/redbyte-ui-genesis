import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { findRepoRoot } from "../path-utils.js";
import { findVivado } from "./findVivado.js";

const TMP_DIR_NAME = path.join(".redbyte", "tmp");
const TCL_FILENAME = "program.tcl";
const LOG_FILENAME = "vivado-program.log";

function getRepoRoot() {
  try {
    return findRepoRoot();
  } catch {
    return process.cwd();
  }
}

function ensureTmpDir(repoRoot) {
  const tmpDir = path.join(repoRoot, TMP_DIR_NAME);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

function resolveBitPath(bitPath, repoRoot) {
  if (!bitPath || typeof bitPath !== "string") {
    throw new Error("bitPath is required.");
  }

  const trimmed = bitPath.trim();
  if (!trimmed) {
    throw new Error("bitPath is required.");
  }

  if (path.isAbsolute(trimmed) || /^[A-Za-z]:/.test(trimmed)) {
    return path.resolve(trimmed);
  }

  return path.resolve(repoRoot, trimmed);
}

function buildProgramTcl() {
  return `set bitfile [lindex $argv 0]
if {$bitfile eq ""} {
  puts "ERROR: Missing bitstream argument"
  exit 1
}

open_hw
connect_hw_server

if {[info exists ::env(RB_FPGA_CABLE)] && $::env(RB_FPGA_CABLE) ne ""} {
  set cableId $::env(RB_FPGA_CABLE)
  set cableFilter [format {NAME =~ "*%s*"} $cableId]
  set targets [get_hw_targets -filter $cableFilter]
  if {[llength $targets] == 0} {
    puts "ERROR: Cable not found: $cableId"
    close_hw
    exit 2
  }
  open_hw_target [lindex $targets 0]
} else {
  open_hw_target
}

set devices [get_hw_devices]
if {[llength $devices] == 0} {
  puts "ERROR: No hardware devices detected"
  close_hw
  exit 3
}

if {[info exists ::env(RB_FPGA_DEVICE)] && $::env(RB_FPGA_DEVICE) ne ""} {
  set deviceId $::env(RB_FPGA_DEVICE)
  set deviceFilter [format {NAME =~ "*%s*"} $deviceId]
  set matches [get_hw_devices -filter $deviceFilter]
  if {[llength $matches] == 0} {
    puts "ERROR: Device not found: $deviceId"
    close_hw
    exit 4
  }
  current_hw_device [lindex $matches 0]
} else {
  current_hw_device [lindex $devices 0]
}

set_property PROGRAM.FILE $bitfile [current_hw_device]
program_hw_devices [current_hw_device]
close_hw
puts "PROGRAM OK"
exit
`;
}

function isDryRun() {
  const raw = process.env.RB_FPGA_DRYRUN;
  return raw === "1" || raw === "true";
}

function classifyError(logText, exitCode) {
  const lower = logText.toLowerCase();
  if (lower.includes("error: cable not found")) {
    return "Cable not found. Check RB_FPGA_CABLE and USB connection.";
  }
  if (lower.includes("error: no hardware devices detected") || lower.includes("no hardware targets")) {
    return "Board not detected. Check Basys 3 connection.";
  }
  if (lower.includes("error: device not found")) {
    return "FPGA device not found. Check RB_FPGA_DEVICE.";
  }
  if (lower.includes("error: missing bitstream")) {
    return "Bit file missing or invalid.";
  }
  if (exitCode !== 0) {
    return `Programming failed (Vivado exit code ${exitCode}).`;
  }
  if (lower.includes("error:")) {
    return "Programming failed. See log for details.";
  }
  return null;
}

export async function programBitstream(bitPath, onProgress) {
  const repoRoot = getRepoRoot();
  const tmpDir = ensureTmpDir(repoRoot);
  const tclPath = path.join(tmpDir, TCL_FILENAME);
  const logPath = path.join(tmpDir, LOG_FILENAME);

  const logStream = fs.createWriteStream(logPath, { flags: "w", encoding: "utf8" });
  let logBuffer = "";
  const writeLog = (text) => {
    logBuffer += text;
    logStream.write(text);
  };
  const writeLine = (line) => writeLog(`${line}\n`);
  const finishLog = (result) =>
    new Promise((resolve) => {
      logStream.end(() => resolve(result));
    });

  // PHASE 1: Progress Callback Support
  const reportPhase = (phase, message) => {
    if (typeof onProgress === 'function') {
      try {
        onProgress({ phase, message, timestamp: new Date().toISOString() });
      } catch (err) {
        console.warn('[programBitstream] Progress callback error:', err.message);
      }
    }
  };

  let resolvedBitPath;
  try {
    resolvedBitPath = resolveBitPath(bitPath, repoRoot);
  } catch (err) {
    writeLine(`[rb-fpga] ERROR: ${err.message}`);
    reportPhase('error', err.message);
    return finishLog({ ok: false, logPath, error: err.message });
  }

  if (path.extname(resolvedBitPath).toLowerCase() !== ".bit") {
    const error = `Bit file must have .bit extension: ${resolvedBitPath}`;
    writeLine(`[rb-fpga] ERROR: ${error}`);
    reportPhase('error', error);
    return finishLog({ ok: false, logPath, error });
  }

  if (!fs.existsSync(resolvedBitPath)) {
    const error = `Bit file not found: ${resolvedBitPath}`;
    writeLine(`[rb-fpga] ERROR: ${error}`);
    reportPhase('error', error);
    return finishLog({ ok: false, logPath, error });
  }

  fs.writeFileSync(tclPath, buildProgramTcl(), "utf8");
  writeLine(`[rb-fpga] bitstream: ${resolvedBitPath}`);
  writeLine(`[rb-fpga] tcl: ${tclPath}`);
  if (process.env.RB_FPGA_CABLE) {
    writeLine(`[rb-fpga] cable: ${process.env.RB_FPGA_CABLE}`);
  }
  if (process.env.RB_FPGA_DEVICE) {
    writeLine(`[rb-fpga] device: ${process.env.RB_FPGA_DEVICE}`);
  }

  if (isDryRun()) {
    writeLine("[rb-fpga] DRY RUN - Vivado not invoked.");
    reportPhase('success', 'Dry run completed');
    return finishLog({ ok: true, logPath });
  }

  let vivadoPath;
  try {
    vivadoPath = findVivado();
  } catch (err) {
    writeLine(`[rb-fpga] ERROR: ${err.message}`);
    reportPhase('error', err.message);
    return finishLog({ ok: false, logPath, error: err.message });
  }

  const quotedVivado = `"${vivadoPath}"`;
  const quotedTcl = `"${tclPath}"`;
  const quotedBit = `"${resolvedBitPath}"`;
  const args = [
    "/c",
    quotedVivado,
    "-mode",
    "batch",
    "-source",
    quotedTcl,
    "-tclargs",
    quotedBit,
  ];
  writeLine(`[rb-fpga] command: cmd.exe ${args.join(" ")}`);
  
  // Report that we're starting Vivado
  reportPhase('synthesizing', 'Starting Vivado...');

  return new Promise((resolve) => {
    const proc = spawn("cmd.exe", args, { cwd: tmpDir, windowsHide: true });
    let lastPhaseUpdate = 0;
    const PHASE_UPDATE_INTERVAL_MS = 500; // Rate-limit phase updates

    proc.stdout?.on("data", (data) => {
      const text = data.toString();
      writeLog(text);
      
      // PHASE 1: Detect phase transitions from Vivado output
      const now = Date.now();
      if (now - lastPhaseUpdate >= PHASE_UPDATE_INTERVAL_MS) {
        if (text.includes('open_hw')) {
          reportPhase('synthesizing', 'Connecting to hardware...');
          lastPhaseUpdate = now;
        } else if (text.includes('program_hw_devices')) {
          reportPhase('programming', 'Programming FPGA...');
          lastPhaseUpdate = now;
        } else if (text.includes('PROGRAM OK')) {
          reportPhase('success', 'FPGA programmed successfully');
          lastPhaseUpdate = now;
        }
      }
    });

    proc.stderr?.on("data", (data) => {
      const text = data.toString();
      writeLog(`[STDERR] ${text}`);
      
      // Detect errors in stderr
      const lower = text.toLowerCase();
      if (lower.includes('error') || lower.includes('failed')) {
        reportPhase('error', text.split('\n')[0]); // Report first line of error
      }
    });

    proc.on("error", (err) => {
      const error = `Vivado launch failed: ${err.message}`;
      writeLine(`[rb-fpga] ERROR: ${error}`);
      reportPhase('error', error);
      finishLog({ ok: false, logPath, error }).then(resolve);
    });

    proc.on("close", (code) => {
      const exitCode = typeof code === "number" ? code : -1;
      const classified = classifyError(logBuffer, exitCode);
      if (classified) {
        reportPhase('error', classified);
        finishLog({ ok: false, logPath, error: classified }).then(resolve);
        return;
      }
      reportPhase('success', 'Programming complete');
      finishLog({ ok: true, logPath }).then(resolve);
    });
  });
}
