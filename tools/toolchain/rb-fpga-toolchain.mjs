#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import os from "os";
import { generateWrapperVerilog, WRAPPER_VERSION, hashText } from "../../packages/rb-fpga-toolchain/src/wrapper.js";
import { checkTopInterface, getRequiredInterface } from "../../packages/rb-fpga-toolchain/src/interface-checker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const BOARD_CONFIG = {
  basys3: {
    boardModelId: "basys3",
    part: "xc7a35tcpg236-1",
    pinmap: path.join(repoRoot, "packages", "board-models", "basys3", "pinmap.vivado.xdc"),
    toolchain: "vivado",
    constraintsExt: "xdc",
  },
  "spartan3e-starter": {
    boardModelId: "spartan3e-starter",
    part: "xc3s500e-4ft256",
    pinmap: path.join(repoRoot, "packages", "board-models", "spartan3e-starter", "pinmap.ise.ucf"),
    toolchain: "ise",
    constraintsExt: "ucf",
  },
};

// function usage() removed (duplicate)

function parseArgs(argv) {
  const args = {
    command: null,
    board: null,
    src: null,
    top: null,
    out: null,
    skipVivado: false,
    skipIse: false,
    lab: null,
  };
  const list = [...argv];
  args.command = list.shift() || null;
  while (list.length) {
    const next = list.shift();
    if (next === "--board") args.board = list.shift();
    else if (next === "--src") args.src = list.shift();
    else if (next === "--top") args.top = list.shift();
    else if (next === "--out") args.out = list.shift();
    else if (next === "--lab") args.lab = list.shift();
    else if (next === "--skip-vivado") args.skipVivado = true;
    else if (next === "--skip-ise") args.skipIse = true;
  }
  return args;
}

function hashBuffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return hashBuffer(data);
}

function listSourceFiles(srcDir) {
  const out = [];
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith(".v") || lower.endsWith(".sv")) {
        out.push(full);
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function resolveVivado() {
  const envPath = process.env.VIVADO_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return { path: envPath, version: null };
  }
  const exe = process.platform === "win32" ? "vivado.bat" : "vivado";
  const probe = spawnSync(exe, ["-version"], { encoding: "utf8" });
  if (probe.error) return null;
  const match = probe.stdout.match(/Vivado v?(\d+\.\d+(?:\.\d+)?)/i);
  return { path: exe, version: match ? match[1] : null };
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, "\n");
}

function writeTcl({ outputDir, wrapperPath, sources, pinmapPath, topModule, part }) {
  const lines = [];
  lines.push("# RedByte Vivado build script");
  lines.push("set output_dir \"" + outputDir.replace(/\\/g, "/") + "\"");
  lines.push(`create_project -in_memory -part ${part}`);
  lines.push(`read_verilog "${wrapperPath.replace(/\\/g, "/")}"`);
  for (const src of sources) {
    lines.push(`read_verilog "${src.replace(/\\/g, "/")}"`);
  }
  lines.push(`read_xdc "${pinmapPath.replace(/\\/g, "/")}"`);
  lines.push(`synth_design -top ${topModule} -part ${part}`);
  lines.push("opt_design");
  lines.push("place_design");
  lines.push("route_design");
  lines.push(`write_bitstream -force ${outputDir.replace(/\\/g, "/")}/bitstream.bit`);
  lines.push("exit");
  return normalizeNewlines(lines.join("\n") + "\n");
}

function writeLog(logPath, lines) {
  fs.writeFileSync(logPath, normalizeNewlines(lines.join("\n") + "\n"), "utf8");
}

function toProjectPath(projectDir, filePath) {
  const rel = path.relative(projectDir, filePath);
  return rel.split(path.sep).join("/");
}

function writeIseProject({ outDir, wrapperPath, sources, constraintsPath, part }) {
  const projectDir = path.join(outDir, "project");
  fs.mkdirSync(projectDir, { recursive: true });

  const prjLines = [];
  prjLines.push(`verilog work "${toProjectPath(projectDir, wrapperPath)}"`);
  for (const src of sources) {
    prjLines.push(`verilog work "${toProjectPath(projectDir, src)}"`);
  }

  const prjPath = path.join(projectDir, "files.prj");
  fs.writeFileSync(prjPath, normalizeNewlines(prjLines.join("\n") + "\n"), "utf8");

  const readmePath = path.join(projectDir, "README_ise_build.md");
  const readme = `# Spartan-3E ISE build (manual)\n\n` +
    `ISE build automation is not implemented yet. Use this project skeleton to build manually.\n\n` +
    `## Steps\n\n` +
    `1. Open ISE and create a new project for the Spartan-3E Starter Kit.\n` +
    `2. Select the correct device (e.g. ${part} or your kit's part).\n` +
    `3. Add sources:\n` +
    `   - ${toProjectPath(projectDir, wrapperPath)}\n` +
    sources.map((src) => `   - ${toProjectPath(projectDir, src)}`).join("\n") +
    `\n` +
    `4. Add constraints: ${toProjectPath(projectDir, constraintsPath)}\n` +
    `5. Run Synthesize → Implement → Generate Programming File.\n` +
    `6. Export the .bit file and use the RedByte bridge /program endpoint.\n`;
  fs.writeFileSync(readmePath, normalizeNewlines(readme), "utf8");

  return { projectDir, prjPath, readmePath };
}

// ... (Usage updated)
function usage() {
  console.log("rb-fpga-toolchain <command> [options]");
  console.log("Commands:");
  console.log("  build    Build a bitstream from sources");
  console.log("    --board <basys3|spartan3e-starter> --src <dir> --top <name> --out <dir>");
  console.log("    [--lab <lab.json>] [--skip-vivado] [--skip-ise]");
  console.log("  pack     Create a portable lab packet");
  console.log("    --src <dir> --out <dir> [--lab <lab.json>]");
  console.log("  verify   Verify a lab packet");
  console.log("    --packet <dir>");
}

// ... (existing helper functions) ...

async function runPack(args) {
  if (!args.src || !args.out) {
    usage();
    process.exit(1);
  }

  const srcDir = path.resolve(args.src);
  const outDir = path.resolve(args.out);

  // 1. Gather Sources
  if (!fs.existsSync(srcDir)) {
    console.error(`Source directory not found: ${srcDir}`);
    process.exit(1);
  }
  const sources = listSourceFiles(srcDir);
  if (sources.length === 0) {
    console.error("No Verilog sources found.");
    process.exit(1);
  }

  // 2. Hash Sources
  const sourceEntries = sources.map((filePath) => ({
    path: path.relative(srcDir, filePath).replace(/\\/g, "/"),
    hash: `sha256:${hashFile(filePath)}`
  }));

  // Sort for deterministic combined hash
  sourceEntries.sort((a, b) => a.path.localeCompare(b.path));
  const combinedHash = hashText(sourceEntries.map(s => `${s.path}:${s.hash}`).join("|"));

  // 3. Prepare Manifest
  let labId = "unknown";
  let boardId = null;

  if (args.lab) {
    try {
      const lab = JSON.parse(fs.readFileSync(args.lab, 'utf8'));
      labId = lab.lab_id || labId;
      boardId = lab.board_model_id || null;
    } catch {
      console.warn("Could not read lab.json");
    }
  }

  const manifest = {
    manifest_version: 1,
    created_at: new Date().toISOString(),
    lab_id: labId,
    board_id: boardId,
    sources: {
      hash: `sha256:${combinedHash}`,
      files: sourceEntries
    },
    toolchain: {
      name: "rb-fpga-toolchain",
      version: "1.0.0", // TODO: Get from package.json
      wrapper_version: WRAPPER_VERSION
    },
    metadata: {
      host: os.hostname(),
      user: os.userInfo().username
    }
  };

  // 4. Write Output
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, "src"));

  // Copy sources
  for (const entry of sourceEntries) {
    const srcPath = path.join(srcDir, entry.path);
    const destPath = path.join(outDir, "src", entry.path);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  }

  // Write manifest
  const manifestPath = path.join(outDir, "lab-manifest.v1.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`Packed lab to ${outDir}`);
  console.log(`Manifest: ${manifestPath}`);
}

async function runVerify(args) {
  // --packet <dir>
  // We treat 'args.board' as packet dir if --packet not parsed explicitly in parseArgs
  // Let's assume parseArgs needs a tiny update or we reuse fields.
  // Actually, create a --packet field in parseArgs first or repurpose one.
  // For now, let's reuse --src as input for verification if --packet missing, or just check args.

  const packetDir = args.packet ? path.resolve(args.packet) : null;
  if (!packetDir || !fs.existsSync(packetDir)) {
    console.error("Packet directory not specified or missing.");
    usage();
    process.exit(1);
  }

  const manifestPath = path.join(packetDir, "lab-manifest.v1.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("Missing lab-manifest.v1.json");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.manifest_version !== 1) {
    console.error(`Unsupported manifest version: ${manifest.manifest_version}`);
    process.exit(1);
  }

  console.log(`Verifying Lab: ${manifest.lab_id} (${manifest.created_at})`);

  // Check Source Integrity
  const srcDir = path.join(packetDir, "src");
  let allOk = true;
  const computedEntries = [];

  for (const file of manifest.sources.files) {
    const fullPath = path.join(srcDir, file.path);
    if (!fs.existsSync(fullPath)) {
      console.error(`[MISSING] ${file.path}`);
      allOk = false;
      continue;
    }
    const hash = `sha256:${hashFile(fullPath)}`;
    if (hash !== file.hash) {
      console.error(`[HASH FAIL] ${file.path} (Expected ${file.hash}, Got ${hash})`);
      allOk = false;
    } else {
      console.log(`[OK] ${file.path}`);
    }
    computedEntries.push({ path: file.path, hash });
  }

  // Verify Master Hash
  computedEntries.sort((a, b) => a.path.localeCompare(b.path));
  const combinedHash = hashText(computedEntries.map(s => `${s.path}:${s.hash}`).join("|"));
  const expectedMaster = manifest.sources.hash;

  if (`sha256:${combinedHash}` !== expectedMaster) {
    console.error(`[MASTER HASH FAIL] Expected ${expectedMaster}, Got sha256:${combinedHash}`);
    allOk = false;
  }

  if (allOk) {
    console.log("VERIFICATION SUCCESSFUL");
    process.exit(0);
  } else {
    console.error("VERIFICATION FAILED");
    process.exit(2);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Extend parseArgs to handle --packet
  const rawArgv = process.argv.slice(2);
  const packetIdx = rawArgv.indexOf("--packet");
  if (packetIdx !== -1 && rawArgv[packetIdx + 1]) {
    args.packet = rawArgv[packetIdx + 1];
  }

  if (args.command === "build") {
    await build(args);
  } else if (args.command === "pack") {
    await runPack(args);
  } else if (args.command === "verify") {
    await runVerify(args);
  } else {
    usage();
    process.exit(1);
  }
}

// Rename the original build function to avoid conflict/recursion issues
async function build(args) {
  // Use args passed in, logic adapted from original build()
  if (!args.board || !args.src || !args.top || !args.out) {
    usage();
    process.exit(1);
  }

  if (!BOARD_CONFIG[args.board]) {
    console.error(`Unsupported board: ${args.board}`);
    process.exit(1);
  }

  const cfg = BOARD_CONFIG[args.board];
  const pinmapOverride = process.env.RB_FPGA_PINMAP_PATH;
  const pinmapPath = pinmapOverride ? path.resolve(pinmapOverride) : cfg.pinmap;

  const srcDir = path.resolve(args.src);
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });

  const sources = listSourceFiles(srcDir);
  if (sources.length === 0) {
    console.error("No Verilog sources found in src directory.");
    process.exit(1);
  }

  const sourceHashes = sources.map((filePath) => ({
    path: path.relative(srcDir, filePath),
    sha256: `sha256:${hashFile(filePath)}`,
  }));
  const combinedHash = hashText(sourceHashes.map((s) => `${s.path}:${s.sha256}`).join("|"));
  const designHash = `sha256:${combinedHash}`;
  const buildId = `build-${combinedHash.slice(0, 12)}`;

  const requiredInterface = getRequiredInterface();
  const sourceContents = sources.map((filePath) => fs.readFileSync(filePath, "utf8"));
  const interfaceCheck = checkTopInterface({ sources: sourceContents, topName: args.top });

  let status = "missing_vivado";
  let errorCode = "missing_vivado";
  let bitstreamPath = null;
  let pinmapHash = null;
  let wrapperPath = null;
  let wrapperHash = null;
  let tclPath = null;
  let vivadoInfo = null;
  let constraintsPath = null;
  let projectInfo = null;
  let toolchainInfo = null;

  const logPath = path.join(outDir, "build.log");
  const logLines = [];
  logLines.push(`board=${args.board}`);
  logLines.push(`student_top=${args.top}`);
  logLines.push(`pinmap=${pinmapPath}`);
  logLines.push(`sources=${sources.length}`);

  let pkgWrapperVersion = WRAPPER_VERSION;
  try {
    // If WRAPPER_VERSION is undefined (import issue), fallback to 1
    if (typeof pkgWrapperVersion === 'undefined') pkgWrapperVersion = 1;
  } catch { pkgWrapperVersion = 1; }

  let labConfig = null;
  if (args.lab) {
    try {
      labConfig = JSON.parse(fs.readFileSync(path.resolve(args.lab), 'utf8'));
    } catch { }
  }

  if (!fs.existsSync(pinmapPath) || fs.statSync(pinmapPath).size === 0) {
    status = "failed";
    errorCode = "pinmap_missing";
    logLines.push("Pinmap missing or empty.");
  } else if (!interfaceCheck.ok) {
    status = "failed";
    errorCode = "student_top_interface_mismatch";
    if (!interfaceCheck.foundModule) {
      logLines.push(`Top module not found: ${args.top}`);
    }
    if (interfaceCheck.missing.length) {
      logLines.push(`Missing ports: ${interfaceCheck.missing.join(", ")}`);
    }
    if (interfaceCheck.invalid.length) {
      const invalid = interfaceCheck.invalid
        .map((entry) => `${entry.name} (expected ${entry.expected_direction}[${entry.expected_width}], got ${entry.actual_direction}[${entry.actual_width}])`)
        .join("; ");
      logLines.push(`Invalid ports: ${invalid}`);
    }
  } else {
    pinmapHash = `sha256:${hashFile(pinmapPath)}`;
    const wrapper = generateWrapperVerilog({
      boardModelId: cfg.boardModelId,
      studentTop: args.top,
      pinmapHash,
      designHash,
      buildId,
      wrapperVersion: pkgWrapperVersion,
    });

    wrapperPath = path.join(outDir, "rb_wrapper_top.v");
    fs.writeFileSync(wrapperPath, normalizeNewlines(wrapper), "utf8");
    wrapperHash = `sha256:${hashText(wrapper)}`;

    logLines.push(`wrapper=${wrapperPath}`);

    if (cfg.toolchain === "ise") {
      constraintsPath = path.join(outDir, `constraints.${cfg.constraintsExt}`);
      const pinmapRaw = fs.readFileSync(pinmapPath, "utf8");
      fs.writeFileSync(constraintsPath, normalizeNewlines(pinmapRaw), "utf8");

      projectInfo = writeIseProject({
        outDir,
        wrapperPath,
        sources,
        constraintsPath,
        part: cfg.part,
      });

      logLines.push("ISE build is not automated yet.");
      logLines.push(`constraints=${constraintsPath}`);
      logLines.push(`project=${projectInfo.projectDir}`);
      logLines.push(`project_readme=${projectInfo.readmePath}`);
      logLines.push(`project_files=${projectInfo.prjPath}`);

      status = "skipped";
      errorCode = null;
      toolchainInfo = { kind: "ise", status: "skipped", reason: "skip_ise" };
      if (!args.skipIse) {
        logLines.push("Use --skip-ise to acknowledge manual ISE build steps.");
      }
    } else {
      tclPath = path.join(outDir, "build_vivado.tcl");
      const tcl = writeTcl({
        outputDir: outDir,
        wrapperPath,
        sources,
        pinmapPath,
        topModule: "rb_wrapper_top",
        part: cfg.part,
      });
      fs.writeFileSync(tclPath, tcl, "utf8");

      logLines.push(`tcl=${tclPath}`);

      const vivado = resolveVivado();
      vivadoInfo = vivado ? { path: vivado.path, version: vivado.version || null } : null;
      const vivadoCmd = `${vivado?.path || "vivado"} -mode batch -source ${tclPath}`;

      if (args.skipVivado) {
        status = "skipped";
        errorCode = null;
        logLines.push("Vivado execution skipped by --skip-vivado.");
        logLines.push(`Vivado command: ${vivadoCmd}`);
      } else if (!vivado) {
        status = "missing_vivado";
        errorCode = "missing_vivado";
        logLines.push("Vivado not found. Set VIVADO_PATH or add vivado to PATH.");
        logLines.push(`Vivado command: ${vivadoCmd}`);
      } else {
        logLines.push(`Vivado: ${vivado.path}`);
        if (vivado.version) {
          logLines.push(`Vivado version: ${vivado.version}`);
        }
        logLines.push(`Vivado command: ${vivadoCmd}`);
        const proc = spawnSync(vivado.path, ["-mode", "batch", "-source", tclPath], {
          cwd: outDir,
          shell: true,
          encoding: "utf8",
        });
        logLines.push(proc.stdout || "");
        logLines.push(proc.stderr || "");
        if (proc.error || proc.status !== 0) {
          status = "build_failed";
          errorCode = "vivado_failed";
        } else {
          bitstreamPath = path.join(outDir, "bitstream.bit");
          if (fs.existsSync(bitstreamPath)) {
            status = "ok";
            errorCode = null;
          } else {
            status = "build_failed";
            errorCode = "bitstream_missing";
          }
        }
      }
      toolchainInfo = { vivado: vivadoInfo };
    }
  }

  const interfaceId = labConfig?.interface || "basys3_v1";

  const manifest = {
    schema_version: "rb_toolchain_build_v1",
    board_model_id: cfg.boardModelId,
    student_top: args.top,
    interface: interfaceId,
    interface_check: interfaceCheck,
    expected_interface: requiredInterface,
    lab: labConfig
      ? {
        board_model_id: labConfig.board_model_id || null,
        top_name: labConfig.top_name || null,
        interface: labConfig.interface || null,
        expected_stream_hz: labConfig.expected_stream_hz || null,
      }
      : null,
    wrapper_version: pkgWrapperVersion,
    pinmap_hash: pinmapHash,
    pinmap: pinmapHash
      ? { path: path.basename(pinmapPath), sha256: pinmapHash }
      : { path: path.basename(pinmapPath), sha256: null },
    design_hash: designHash,
    build_id: buildId,
    wrapper_hash: wrapperHash,
    sources: sourceHashes,
    artifacts: {
      wrapper: wrapperPath ? path.basename(wrapperPath) : null,
      tcl: tclPath ? path.basename(tclPath) : null,
      bitstream: bitstreamPath ? path.basename(bitstreamPath) : null,
      constraints: constraintsPath ? path.basename(constraintsPath) : null,
      project_readme: projectInfo ? path.relative(outDir, projectInfo.readmePath).split(path.sep).join("/") : null,
      project_files: projectInfo ? path.relative(outDir, projectInfo.prjPath).split(path.sep).join("/") : null,
      log: path.basename(logPath),
    },
    toolchain: toolchainInfo || { vivado: vivadoInfo },
    status,
    error_code: errorCode,
  };

  writeLog(logPath, logLines);
  const manifestText = normalizeNewlines(JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "manifest.json"), manifestText, "utf8");

  if (status !== "ok" && status !== "skipped") {
    console.error(`Build completed with status: ${status}`);
    process.exit(2);
  }

  if (status === "skipped") {
    console.log("Build generated wrapper and manifest (Vivado skipped).");
    process.exit(0);
  }

  console.log(`Build complete: ${bitstreamPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
