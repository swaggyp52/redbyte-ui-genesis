#!/usr/bin/env node

import { createHash } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..", "..");
const DEFAULT_BRIDGE_URL = "http://127.0.0.1:4242";
const GOLDEN_PRESET_ID = "basys3-switches-leds-7seg";
const GOLDEN_PRESET_PATH = path.join(
  REPO_ROOT,
  "packages",
  "rb-apps",
  "src",
  "fpga",
  "boards",
  "basys3",
  "presets",
  "basys3-switches-leds-7seg.xdc"
);

const GOLDEN_TOP_VERILOG = `
module top(
  input  wire        clk,
  input  wire [15:0] sw,
  input  wire [4:0]  btn,
  output wire [15:0] led,
  output wire [6:0]  seg,
  output wire [3:0]  an,
  output wire        dp
);
  assign led = sw;
  assign seg = 7'b1111111;
  assign an  = 4'b1111;
  assign dp  = 1'b1;
endmodule
`;

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function hashStringSha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function hashBufferSha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeText(value) {
  const normalized = String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
}

function normalizeBooleanFlag(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return fallback;
}

function normalizeTimeoutMs(value, fallback = 10 * 60 * 1000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function normalizeBridgeUrl(value) {
  const trimmed = String(value || DEFAULT_BRIDGE_URL).trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : DEFAULT_BRIDGE_URL;
}

function normalizeBuildpackZipInput(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (value.startsWith("file://")) {
    const fileUrl = new URL(value);
    let filePath = decodeURIComponent(fileUrl.pathname || "");
    if (/^\/[A-Za-z]:\//.test(filePath)) {
      filePath = filePath.slice(1);
    }
    if (fileUrl.host && fileUrl.host.trim().length > 0) {
      filePath = `//${fileUrl.host}${filePath}`;
    }
    const absolutePath = path.resolve(filePath);
    return {
      url: pathToFileURL(absolutePath).href,
      path: absolutePath,
    };
  }
  if (/^https?:\/\//i.test(value)) {
    return {
      url: value,
      path: null,
    };
  }
  const absolutePath = path.resolve(value);
  return {
    url: pathToFileURL(absolutePath).href,
    path: absolutePath,
  };
}

function deriveNameVersionFromZipPath(zipPath, platformKey) {
  const baseName = path.basename(zipPath, ".zip");
  const platformSuffix = `-${platformKey}`;
  const withoutPlatform = baseName.endsWith(platformSuffix)
    ? baseName.slice(0, -platformSuffix.length)
    : baseName;
  const match = withoutPlatform.match(/^(.*)-(\d+\.\d+\.\d+(?:-[A-Za-z0-9._-]+)?)$/);
  if (!match) return null;
  return {
    name: match[1],
    version: match[2],
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = Array.isArray(argv) ? [...argv] : [];
  const options = {
    bridgeUrl: DEFAULT_BRIDGE_URL,
    buildpackZip: "",
    buildpackName: "",
    buildpackVersion: "",
    board: "basys3",
    mode: "buildpack-open",
    program: true,
    detect: true,
    noUi: false,
    outputDir: path.join(REPO_ROOT, "artifacts", "golden-demo"),
    timeoutMs: 10 * 60 * 1000,
    pollIntervalMs: 500,
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = String(args[index]);
    if (token === "--bridge-url") {
      options.bridgeUrl = args[index + 1] ? String(args[index + 1]) : options.bridgeUrl;
      index += 1;
      continue;
    }
    if (token === "--buildpackZip") {
      options.buildpackZip = args[index + 1] ? String(args[index + 1]) : "";
      index += 1;
      continue;
    }
    if (token === "--buildpackName") {
      options.buildpackName = args[index + 1] ? String(args[index + 1]) : "";
      index += 1;
      continue;
    }
    if (token === "--buildpackVersion") {
      options.buildpackVersion = args[index + 1] ? String(args[index + 1]) : "";
      index += 1;
      continue;
    }
    if (token === "--board") {
      options.board = args[index + 1] ? String(args[index + 1]) : options.board;
      index += 1;
      continue;
    }
    if (token === "--mode") {
      options.mode = args[index + 1] ? String(args[index + 1]) : options.mode;
      index += 1;
      continue;
    }
    if (token === "--program") {
      options.program = normalizeBooleanFlag(args[index + 1], true);
      index += 1;
      continue;
    }
    if (token === "--detect") {
      options.detect = normalizeBooleanFlag(args[index + 1], true);
      index += 1;
      continue;
    }
    if (token === "--no-ui") {
      options.noUi = true;
      continue;
    }
    if (token === "--output-dir") {
      options.outputDir = args[index + 1] ? String(args[index + 1]) : options.outputDir;
      index += 1;
      continue;
    }
    if (token === "--timeout-ms") {
      options.timeoutMs = normalizeTimeoutMs(args[index + 1], options.timeoutMs);
      index += 1;
      continue;
    }
    if (token === "--poll-interval-ms") {
      options.pollIntervalMs = normalizeTimeoutMs(args[index + 1], options.pollIntervalMs);
      index += 1;
    }
  }

  options.bridgeUrl = normalizeBridgeUrl(options.bridgeUrl);
  options.outputDir = path.resolve(options.outputDir);
  options.timeoutMs = normalizeTimeoutMs(options.timeoutMs, 10 * 60 * 1000);
  options.pollIntervalMs = normalizeTimeoutMs(options.pollIntervalMs, 500);
  return options;
}

function getCurrentPlatformKey() {
  return `${os.platform()}-${os.arch()}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(method, url, body = null) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const err = new Error(`http_${response.status}: ${method} ${url}`);
    err.status = response.status;
    err.payload = data;
    err.body = rawText;
    throw err;
  }
  return data;
}

async function requestBinary(url) {
  const response = await fetch(url);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    const text = bytes.toString("utf8");
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const err = new Error(`http_${response.status}: GET ${url}`);
    err.status = response.status;
    err.payload = parsed;
    err.body = text;
    throw err;
  }
  return bytes;
}

function printNewLogs(prefix, logs, seenTsSet) {
  const entries = Array.isArray(logs) ? logs : [];
  for (const entry of entries) {
    const key = `${entry?.run_id || "run"}:${entry?.ts ?? -1}:${entry?.msg || ""}`;
    if (seenTsSet.has(key)) continue;
    seenTsSet.add(key);
    const level = typeof entry?.level === "string" ? entry.level : "info";
    const message = typeof entry?.msg === "string" ? entry.msg : "";
    console.log(`[golden:${prefix}] ${level}: ${message}`);
  }
}

async function waitForRunCompletion({
  label,
  statusUrlBase,
  runId,
  timeoutMs,
  pollIntervalMs,
}) {
  const startedAt = Date.now();
  let offset = 0;
  const seen = new Set();
  let latest = null;
  while (Date.now() - startedAt < timeoutMs) {
    const statusUrl = `${statusUrlBase}/${encodeURIComponent(runId)}?offset=${offset}`;
    const payload = await requestJson("GET", statusUrl);
    latest = payload;
    const logs = Array.isArray(payload?.logs) ? payload.logs : [];
    printNewLogs(label, logs, seen);
    offset = typeof payload?.nextOffset === "number" ? payload.nextOffset : offset + logs.length;
    const state = String(payload?.state || "");
    if (state && state !== "running") {
      return payload;
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(`${label}_timeout: run '${runId}' did not complete in ${timeoutMs}ms`);
}

export function createGoldenDemoProjectSnapshot(input = {}) {
  const topModule = typeof input.top === "string" && input.top.trim().length > 0 ? input.top.trim() : "top";
  const sourcePath = typeof input.sourcePath === "string" && input.sourcePath.trim().length > 0
    ? input.sourcePath.trim().replace(/\\/g, "/")
    : "top.v";
  const hdlText = normalizeText(input.hdlText || GOLDEN_TOP_VERILOG);
  const xdcText = normalizeText(input.xdcText || fs.readFileSync(GOLDEN_PRESET_PATH, "utf8"));
  return {
    hdl: {
      top: topModule,
      sources: [
        {
          path: sourcePath,
          language: "verilog",
          text: hdlText,
        },
      ],
    },
    fpga: {
      board: "basys3",
      top: topModule,
      preset: GOLDEN_PRESET_ID,
      constraints: {
        type: "xdc",
        text: xdcText,
      },
    },
  };
}

export function deriveGoldenBaselineId(input = {}) {
  const payload = {
    schema: "golden_demo_acceptance_v1",
    buildpack: {
      name: input?.buildpack?.name || null,
      version: input?.buildpack?.version || null,
      sha256: input?.buildpack?.sha256 || null,
    },
    plannerBackend: input?.plannerBackend || null,
    toolVersions: Array.isArray(input?.toolVersions)
      ? [...input.toolVersions]
          .map((entry) => ({
            name: entry?.name || null,
            version: entry?.version || null,
            source: entry?.source || null,
          }))
          .sort((left, right) => String(left.name).localeCompare(String(right.name)))
      : [],
    topVerilogSha256: hashStringSha256(normalizeText(input?.topVerilog || GOLDEN_TOP_VERILOG)),
    xdcSha256: hashStringSha256(normalizeText(input?.xdcText || "")),
  };
  return `golden-${hashStringSha256(stableStringify(payload)).slice(0, 16)}`;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function runGoldenDemoAcceptance(options) {
  const parsedZip = normalizeBuildpackZipInput(options.buildpackZip);
  if (!parsedZip) {
    throw new Error("buildpack_zip_required");
  }
  if (options.board !== "basys3") {
    throw new Error("unsupported_board");
  }
  if (options.mode !== "buildpack-open") {
    throw new Error("unsupported_mode");
  }

  const platformKey = getCurrentPlatformKey();
  const buildpackSha256 =
    parsedZip.path && fs.existsSync(parsedZip.path) ? hashBufferSha256(fs.readFileSync(parsedZip.path)) : null;
  const fallbackIdentity = parsedZip.path ? deriveNameVersionFromZipPath(parsedZip.path, platformKey) : null;
  const buildpackName =
    normalizeText(options.buildpackName || "").trim() ||
    normalizeText(fallbackIdentity?.name || "").trim();
  const buildpackVersion =
    normalizeText(options.buildpackVersion || "").trim() ||
    normalizeText(fallbackIdentity?.version || "").trim();
  if (!buildpackName || !buildpackVersion) {
    throw new Error("buildpack_name_version_required");
  }

  const project = createGoldenDemoProjectSnapshot();
  const xdcText = project.fpga.constraints.text;
  const topVerilog = project.hdl.sources[0].text;

  const baseEndpoint = options.bridgeUrl;
  const acceptanceLogs = [];

  const installPayload = {
    name: buildpackName,
    version: buildpackVersion,
    url: parsedZip.url,
    ...(buildpackSha256 ? { sha256: buildpackSha256 } : {}),
  };
  const installRun = await requestJson("POST", `${baseEndpoint}/api/toolchain/buildpack/install`, installPayload);
  acceptanceLogs.push({
    step: "buildpack_install",
    runId: installRun.runId,
    artifactId: installRun.artifactId,
  });
  const installStatus = await waitForRunCompletion({
    label: "buildpack-install",
    statusUrlBase: `${baseEndpoint}/api/toolchain/buildpack/runs`,
    runId: installRun.runId,
    timeoutMs: options.timeoutMs,
    pollIntervalMs: options.pollIntervalMs,
  });
  if (installStatus?.ok !== true) {
    throw new Error(`buildpack_install_failed: ${installStatus?.error || "unknown"}`);
  }
  const buildpackStatus = await requestJson("GET", `${baseEndpoint}/api/toolchain/buildpack/status`);

  const probe = await requestJson("GET", `${baseEndpoint}/api/toolchain/probe`);
  const toolVersions = Array.isArray(probe?.tools)
    ? probe.tools.map((tool) => ({
        name: tool?.name || "",
        version: typeof tool?.version === "string" ? tool.version : null,
        source: typeof tool?.source === "string" ? tool.source : null,
      }))
    : [];

  const implementPlan = await requestJson("POST", `${baseEndpoint}/api/toolchain/implement/plan`, {
    schema_version: "toolchain_implement_plan_request_v1",
    backend_id: "open",
    refresh_probe: false,
    project,
  });
  if (implementPlan?.backend !== "buildpack-open") {
    throw new Error(`unexpected_backend: ${implementPlan?.backend || "none"}`);
  }

  if (options.detect) {
    const detect = await requestJson("GET", `${baseEndpoint}/api/toolchain/boards/detect`);
    const detectedBoards = Array.isArray(detect?.boards) ? detect.boards : [];
    if (options.program && detectedBoards.length === 0) {
      throw new Error("board_detect_failed: basys3 not detected");
    }
  }

  const baselineId = deriveGoldenBaselineId({
    buildpack: { name: buildpackName, version: buildpackVersion, sha256: buildpackSha256 || "" },
    plannerBackend: implementPlan.backend,
    toolVersions,
    topVerilog,
    xdcText,
  });
  const outputDir = path.join(options.outputDir, baselineId);
  ensureDirectory(outputDir);
  writeJson(path.join(outputDir, "buildpack-status.json"), buildpackStatus);

  const implementRun = await requestJson("POST", `${baseEndpoint}/api/toolchain/implement/run`, {
    board: "basys3",
    project,
    buildPath: {
      planId: implementPlan.planId,
      backend: implementPlan.backend,
      ...(implementPlan.buildpack ? { buildpack: implementPlan.buildpack } : {}),
      requiredTools: implementPlan.requiredTools,
      commands: implementPlan.commands,
      outputs: implementPlan.outputs,
      warnings: implementPlan.warnings,
    },
  });
  acceptanceLogs.push({
    step: "implement",
    runId: implementRun.runId,
    artifactId: implementRun.artifactId,
  });
  const implementStatus = await waitForRunCompletion({
    label: "implement",
    statusUrlBase: `${baseEndpoint}/api/toolchain/implement/runs`,
    runId: implementRun.runId,
    timeoutMs: options.timeoutMs,
    pollIntervalMs: options.pollIntervalMs,
  });
  writeJson(path.join(outputDir, "implement-status.json"), implementStatus);

  const implementArtifacts = await requestBinary(
    `${baseEndpoint}/api/toolchain/implement/runs/${encodeURIComponent(implementRun.runId)}/artifacts.zip`
  );
  fs.writeFileSync(path.join(outputDir, "implement-artifacts.zip"), implementArtifacts);
  if (!implementArtifacts.includes(Buffer.from("outputs_manifest.json"))) {
    throw new Error("implement_artifacts_missing_outputs_manifest");
  }

  const bitstreamResponse = await requestJson(
    "GET",
    `${baseEndpoint}/api/toolchain/implement/runs/${encodeURIComponent(implementRun.runId)}/output/bitstream`
  );
  if (bitstreamResponse?.ok !== true || !bitstreamResponse?.bitstream?.data) {
    throw new Error("bitstream_not_available");
  }
  writeJson(path.join(outputDir, "implement-bitstream-ref.json"), {
    runId: bitstreamResponse.runId,
    artifactId: bitstreamResponse.artifactId,
    filename: bitstreamResponse.filename,
    output: bitstreamResponse.output,
    bytesBase64Length: bitstreamResponse.bitstream.data.length,
  });

  let programStatus = null;
  if (options.program) {
    const programRun = await requestJson("POST", `${baseEndpoint}/api/toolchain/program-bitstream`, {
      board: "basys3",
      mode: "sram",
      bitstream: bitstreamResponse.bitstream,
    });
    acceptanceLogs.push({
      step: "program",
      runId: programRun.runId,
      artifactId: programRun.artifactId,
    });
    programStatus = await waitForRunCompletion({
      label: "program",
      statusUrlBase: `${baseEndpoint}/api/toolchain/runs`,
      runId: programRun.runId,
      timeoutMs: options.timeoutMs,
      pollIntervalMs: options.pollIntervalMs,
    });
    if (programStatus?.ok !== true) {
      throw new Error(`program_failed: ${programStatus?.error || "unknown"}`);
    }
    writeJson(path.join(outputDir, "program-status.json"), programStatus);
  }

  const doctorReport = await requestJson("POST", `${baseEndpoint}/api/toolchain/doctor-report`, {
    backend_id: "open",
    refresh_probe: false,
    project,
    logs: [
      ...(Array.isArray(implementStatus?.logs) ? implementStatus.logs : []),
      ...(Array.isArray(programStatus?.logs) ? programStatus.logs : []),
    ],
  });
  writeJson(path.join(outputDir, "doctor-report.json"), doctorReport);

  const summary = {
    schema_version: "golden_demo_acceptance_v1",
    ok: true,
    baselineId,
    bridgeUrl: baseEndpoint,
    board: options.board,
    mode: options.mode,
    buildpack: {
      name: buildpackName,
      version: buildpackVersion,
      sha256: buildpackSha256,
      url: parsedZip.url,
    },
    planner: {
      backend: implementPlan.backend,
      planId: implementPlan.planId,
      buildpack: implementPlan.buildpack || null,
    },
    buildpackStatus: {
      ok: buildpackStatus?.ok === true,
      installed: Array.isArray(buildpackStatus?.installed)
        ? buildpackStatus.installed
            .filter((entry) => entry?.name === buildpackName && entry?.version === buildpackVersion)
            .map((entry) => ({
              name: entry.name,
              version: entry.version,
              platformKey: entry.platformKey || null,
              integrity: entry.integrity || null,
              tools: Array.isArray(entry.tools) ? entry.tools : [],
            }))
        : [],
    },
    runs: {
      installRunId: installRun.runId,
      implementRunId: implementRun.runId,
      programRunId: programStatus?.runId || null,
    },
    artifacts: {
      outputDir,
      implementArtifactsZip: path.join(outputDir, "implement-artifacts.zip"),
      doctorReport: path.join(outputDir, "doctor-report.json"),
    },
  };
  writeJson(path.join(outputDir, "acceptance-summary.json"), summary);
  fs.writeFileSync(path.join(outputDir, "buildpack.sha256.txt"), `${buildpackSha256 || ""}\n`, "utf8");
  writeJson(path.join(outputDir, "acceptance-runs.json"), acceptanceLogs);
  return summary;
}

export async function runGoldenDemoAcceptanceCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!options.buildpackZip) {
    throw new Error("buildpackZip_required");
  }
  return runGoldenDemoAcceptance(options);
}

const invokedScriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isDirectInvocation = invokedScriptPath ? pathToFileURL(invokedScriptPath).href === import.meta.url : false;
if (isDirectInvocation) {
  runGoldenDemoAcceptanceCli(process.argv.slice(2))
    .then((summary) => {
      console.log(`GOLDEN_DEMO_ACCEPTANCE: PASS (${summary.baselineId})`);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`GOLDEN_DEMO_ACCEPTANCE: FAIL (${message})`);
      process.exitCode = 1;
    });
}
