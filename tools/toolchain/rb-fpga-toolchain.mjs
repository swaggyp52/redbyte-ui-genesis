#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { generateWrapperVerilog, WRAPPER_VERSION, hashText } from "../../packages/rb-fpga-toolchain/src/wrapper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const BOARD_CONFIG = {
  basys3: {
    boardModelId: "basys3",
    part: "xc7a35tcpg236-1",
    pinmap: path.join(repoRoot, "packages", "board-models", "basys3", "pinmap.vivado.xdc"),
  },
};

function usage() {
  console.log("rb-fpga-toolchain build --board basys3 --src <dir> --top <name> --out <dir>");
  console.log("Optional: --skip-vivado");
}

function parseArgs(argv) {
  const args = { command: null, board: null, src: null, top: null, out: null, skipVivado: false };
  const list = [...argv];
  args.command = list.shift() || null;
  while (list.length) {
    const next = list.shift();
    if (next === "--board") args.board = list.shift();
    else if (next === "--src") args.src = list.shift();
    else if (next === "--top") args.top = list.shift();
    else if (next === "--out") args.out = list.shift();
    else if (next === "--skip-vivado") args.skipVivado = true;
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
  return lines.join("\n") + "\n";
}

function writeLog(logPath, lines) {
  fs.writeFileSync(logPath, lines.join("\n") + "\n", "utf8");
}

async function build() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== "build") {
    usage();
    process.exit(1);
  }

  if (!args.board || !args.src || !args.top || !args.out) {
    usage();
    process.exit(1);
  }

  if (!BOARD_CONFIG[args.board]) {
    console.error(`Unsupported board: ${args.board}`);
    process.exit(1);
  }

  const cfg = BOARD_CONFIG[args.board];
  if (!fs.existsSync(cfg.pinmap)) {
    console.error(`Pinmap not found: ${cfg.pinmap}`);
    process.exit(1);
  }

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

  const pinmapHash = `sha256:${hashFile(cfg.pinmap)}`;
  const wrapper = generateWrapperVerilog({
    boardModelId: cfg.boardModelId,
    studentTop: args.top,
    pinmapHash,
    designHash,
    buildId,
    wrapperVersion: WRAPPER_VERSION,
  });

  const wrapperPath = path.join(outDir, "rb_wrapper_top.v");
  fs.writeFileSync(wrapperPath, wrapper, "utf8");
  const wrapperHash = `sha256:${hashText(wrapper)}`;

  const tclPath = path.join(outDir, "build_vivado.tcl");
  const tcl = writeTcl({
    outputDir: outDir,
    wrapperPath,
    sources,
    pinmapPath: cfg.pinmap,
    topModule: "rb_wrapper_top",
    part: cfg.part,
  });
  fs.writeFileSync(tclPath, tcl, "utf8");

  const logPath = path.join(outDir, "build.log");
  const logLines = [];
  logLines.push(`board=${args.board}`);
  logLines.push(`wrapper=${wrapperPath}`);
  logLines.push(`pinmap=${cfg.pinmap}`);
  logLines.push(`sources=${sources.length}`);
  logLines.push(`tcl=${tclPath}`);

  let status = "missing_vivado";
  let errorCode = "missing_vivado";
  let bitstreamPath = null;
  const vivado = resolveVivado();

  if (args.skipVivado) {
    status = "skipped";
    errorCode = "skip_vivado";
    logLines.push("Vivado execution skipped by --skip-vivado.");
  } else if (!vivado) {
    status = "missing_vivado";
    errorCode = "missing_vivado";
    logLines.push("Vivado not found. Set VIVADO_PATH or add vivado to PATH.");
  } else {
    logLines.push(`Vivado: ${vivado.path}`);
    if (vivado.version) {
      logLines.push(`Vivado version: ${vivado.version}`);
    }
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

  const manifest = {
    schema_version: "rb_toolchain_build_v1",
    board_model_id: cfg.boardModelId,
    student_top: args.top,
    wrapper_version: WRAPPER_VERSION,
    pinmap_hash: pinmapHash,
    design_hash: designHash,
    build_id: buildId,
    wrapper_hash: wrapperHash,
    sources: sourceHashes,
    artifacts: {
      wrapper: wrapperPath,
      tcl: tclPath,
      bitstream: bitstreamPath,
      log: logPath,
    },
    toolchain: vivado
      ? { vivado: { path: vivado.path, version: vivado.version || null } }
      : { vivado: null },
    status,
    error_code: errorCode,
  };

  writeLog(logPath, logLines);
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

  if (status !== "ok") {
    console.error(`Build completed with status: ${status}`);
    process.exit(2);
  }

  console.log(`Build complete: ${bitstreamPath}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
