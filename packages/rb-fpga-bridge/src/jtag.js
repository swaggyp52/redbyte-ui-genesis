import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const TOOL_NAME = "djtgcfg";

function getPathEntries() {
  const raw = process.env.PATH || "";
  return raw.split(path.delimiter).filter(Boolean);
}

function resolveExecutableName() {
  return os.platform() === "win32" ? `${TOOL_NAME}.exe` : TOOL_NAME;
}

function findExecutableOnPath() {
  const executable = resolveExecutableName();
  for (const entry of getPathEntries()) {
    const candidate = path.join(entry, executable);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function resolveDjtgcfgPath() {
  const override = process.env.RB_DJTGCFG_PATH || process.env.DJTGCFG_PATH;
  if (override && fs.existsSync(override)) {
    return override;
  }
  return findExecutableOnPath();
}

export function parseDjtgcfgEnum(output) {
  const devices = [];
  let current = null;
  let index = -1;
  const lines = (output || "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const deviceMatch = trimmed.match(/^Device:\s*(.+)$/i);
    if (deviceMatch) {
      index += 1;
      current = {
        product: deviceMatch[1].trim(),
        serial_number: null,
        index,
      };
      devices.push(current);
      continue;
    }
    const serialMatch = trimmed.match(/^Device Serial:\s*(.+)$/i);
    if (serialMatch) {
      if (!current) {
        current = { product: "Digilent JTAG", serial_number: null };
        devices.push(current);
      }
      current.serial_number = serialMatch[1].trim();
    }
  }

  return devices.map((device) => {
    const serial = device.serial_number || null;
    const endpoint = serial ? `djtgcfg:${serial}` : `djtgcfg:index:${device.index ?? 0}`;
    return {
      tool: TOOL_NAME,
      endpoint_id: endpoint,
      serial_number: serial,
      product: device.product || "Digilent JTAG",
      index: device.index ?? null,
    };
  });
}

function truncateRaw(raw, maxLines = 12) {
  if (!raw) return null;
  const lines = raw.split(/\r?\n/).filter(Boolean);
  return lines.slice(0, maxLines).join("\n");
}

export function enumerateJtagDevices(options = {}) {
  const timeoutMs = options.timeoutMs ?? 1200;
  const toolPath = options.toolPath || resolveDjtgcfgPath();

  if (!toolPath) {
    return {
      ok: false,
      tool: TOOL_NAME,
      toolPath: null,
      error: "missing_tool",
      raw: null,
      devices: [],
    };
  }

  const result = spawnSync(toolPath, ["enum"], {
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
  });

  const raw = `${result.stdout || ""}${result.stderr || ""}`.trim();
  const truncated = truncateRaw(raw);

  if (result.error) {
    return {
      ok: false,
      tool: TOOL_NAME,
      toolPath,
      error: result.error.message,
      raw: truncated,
      devices: [],
    };
  }

  if (typeof result.status === "number" && result.status !== 0) {
    return {
      ok: false,
      tool: TOOL_NAME,
      toolPath,
      error: `exit_code:${result.status}`,
      raw: truncated,
      devices: [],
    };
  }

  const devices = parseDjtgcfgEnum(raw);
  return {
    ok: true,
    tool: TOOL_NAME,
    toolPath,
    error: null,
    raw: truncated,
    devices,
  };
}

function parseEndpointIndex(endpointId) {
  if (!endpointId) return null;
  const match = endpointId.match(/djtgcfg:index:(\d+)/i);
  if (!match) return null;
  return Number(match[1]);
}

export function selectJtagTarget({ device, jtagDevices }) {
  if (!device) return null;
  const serial = device.programming?.serial_number || device.serial_number || null;
  if (serial) {
    const match = jtagDevices.find((entry) => entry.serial_number === serial);
    if (match) {
      return {
        device: match,
        selector: serial,
        selectorType: "serial",
      };
    }
  }

  const endpointId = device.programming?.endpoint_id || null;
  const endpointIndex = parseEndpointIndex(endpointId);
  if (endpointIndex !== null) {
    const match = jtagDevices.find((entry) => entry.index === endpointIndex);
    if (match) {
      return {
        device: match,
        selector: String(endpointIndex),
        selectorType: "index",
      };
    }
  }

  if (jtagDevices.length === 1) {
    const match = jtagDevices[0];
    const selector = match.serial_number || String(match.index ?? 0);
    return { device: match, selector, selectorType: "fallback_singleton" };
  }

  return null;
}

function runProgramCommand({ toolPath, args, timeoutMs, runner }) {
  if (runner) {
    return Promise.resolve(runner({ toolPath, args, timeoutMs }));
  }

  return new Promise((resolve) => {
    const started = Date.now();
    const proc = spawnSync(toolPath, args, {
      encoding: "utf8",
      timeout: timeoutMs,
      windowsHide: true,
    });
    const elapsedMs = Date.now() - started;
    resolve({
      ok: proc.status === 0,
      exitCode: typeof proc.status === "number" ? proc.status : -1,
      stdout: proc.stdout || "",
      stderr: proc.stderr || "",
      error: proc.error ? proc.error.message : null,
      elapsedMs,
    });
  });
}

export async function programJtagBitstream({
  toolPath,
  selector,
  selectorType,
  bitPath,
  timeoutMs = 120000,
  runner,
}) {
  if (!toolPath) {
    return {
      ok: false,
      error: "missing_tool",
      exitCode: null,
      stdout: "",
      stderr: "",
      elapsedMs: 0,
      command: null,
      selectorType,
    };
  }

  const args = ["prog", "-d", selector, "-i", "0", "-f", bitPath];
  const command = `${toolPath} ${args.join(" ")}`;
  const result = await runProgramCommand({ toolPath, args, timeoutMs, runner });
  return {
    ...result,
    command,
    selectorType,
  };
}
