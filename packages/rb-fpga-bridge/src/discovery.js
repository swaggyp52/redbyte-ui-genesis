import { SerialPort } from "serialport";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { identifyPort } from "./proto/identify.js";
import { enumerateJtagDevices } from "./jtag.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USB_ID_PATH = path.resolve(__dirname, "..", "boards", "usb-ids.json");
const BOARD_MODELS = {
  basys3: {
    name: "Basys 3",
    board: "Basys3",
    pinmap: path.resolve(__dirname, "..", "..", "board-models", "basys3", "pinmap.vivado.xdc"),
  },
  "spartan3e-starter": {
    name: "Spartan-3E Starter Kit",
    board: "Spartan-3E",
    pinmap: path.resolve(__dirname, "..", "..", "board-models", "spartan3e-starter", "pinmap.ise.ucf"),
  },
};

const DEFAULT_USB_IDS = { devices: [] };

function normalizeHex(value) {
  if (!value) return null;
  return value.toLowerCase().replace(/^0x/, "");
}

function normalizeString(value) {
  return (value || "").toLowerCase();
}

export function loadUsbIdTable() {
  try {
    const raw = fs.readFileSync(USB_ID_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.devices)) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return DEFAULT_USB_IDS;
}

export function getPinmapHash(boardModelId) {
  const entry = BOARD_MODELS[boardModelId];
  if (!entry || !entry.pinmap) return null;
  if (!fs.existsSync(entry.pinmap)) return null;
  const raw = fs.readFileSync(entry.pinmap);
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return `sha256:${hash}`;
}

function resolveBoardDisplay(boardModelId) {
  const entry = BOARD_MODELS[boardModelId];
  if (!entry) return null;
  return { displayName: entry.name, board: entry.board };
}

function formatVidPid(vendorId, productId) {
  if (!vendorId || !productId) return null;
  return `${normalizeHex(vendorId)}:${normalizeHex(productId)}`;
}

function findUsbIdMatch(port, usbIds) {
  const vid = normalizeHex(port.vendorId);
  const pid = normalizeHex(port.productId);
  if (!vid || !pid) return null;
  return usbIds.devices.find((entry) => entry.vid === vid && entry.pid === pid) || null;
}

export function scorePortCandidate(port, usbIds) {
  const reasons = [];
  let confidence = 0;

  const match = findUsbIdMatch(port, usbIds);
  if (match) {
    confidence += 0.6;
    const vidPid = formatVidPid(port.vendorId, port.productId);
    reasons.push(`vid_pid:${vidPid}${match.label ? ` (${match.label})` : ""}`);
  }

  const manufacturer = normalizeString(port.manufacturer);
  if (manufacturer.includes("digilent")) {
    confidence += 0.2;
    reasons.push("manufacturer:Digilent");
  }

  const friendly = normalizeString(port.friendlyName || port.pnpId);
  if (friendly.includes("uart") || friendly.includes("jtag")) {
    confidence += 0.1;
    reasons.push("friendly_name:UART/JTAG");
  }

  if (port.serialNumber) {
    confidence += 0.1;
    reasons.push("serial_number:present");
  }

  if (confidence > 1) confidence = 1;

  const isLikelyDigilent = !!match || manufacturer.includes("digilent") || friendly.includes("digilent") || friendly.includes("ftdi");

  return { confidence, reasons, isLikelyDigilent };
}

function scoreJtagCandidate(jtag) {
  const reasons = ["jtag:enumerated"];
  let confidence = 0.5;

  if (jtag.serialNumber) {
    confidence += 0.25;
    reasons.push("jtag:serial_number:present");
  }

  if (jtag.product) {
    confidence += 0.1;
    reasons.push("jtag:product:present");
  }

  if (confidence > 1) confidence = 1;
  return { confidence, reasons };
}

function buildProgrammingSummary(jtagResult) {
  const summary = {
    tool: "djtgcfg",
    status: "missing_driver",
    error: null,
    enumeration_raw: null,
  };

  if (!jtagResult) {
    summary.error = "missing_tool:djtgcfg";
    return summary;
  }

  summary.tool = jtagResult.tool || "djtgcfg";
  summary.enumeration_raw = jtagResult.raw || null;

  if (!jtagResult.ok) {
    summary.status = jtagResult.error === "missing_tool" ? "missing_driver" : "error";
    summary.error = jtagResult.error || "jtag_enum_failed";
    return summary;
  }

  if (!jtagResult.devices || jtagResult.devices.length === 0) {
    summary.status = "missing_driver";
    summary.error = "no_jtag_devices";
    return summary;
  }

  summary.status = "ready";
  return summary;
}

function mergeCandidates(uartCandidates, jtagCandidates) {
  const merged = [];
  const usedUart = new Set();
  const usedJtag = new Set();

  const sortedUart = [...uartCandidates].sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { sensitivity: "base" })
  );
  const sortedJtag = [...jtagCandidates].sort((a, b) => {
    const left = a.serialNumber || a.endpointId || "";
    const right = b.serialNumber || b.endpointId || "";
    return left.localeCompare(right, undefined, { sensitivity: "base" });
  });

  for (const uart of sortedUart) {
    if (!uart.serialNumber) continue;
    const match = sortedJtag.find(
      (jtag) => !usedJtag.has(jtag) && jtag.serialNumber && jtag.serialNumber === uart.serialNumber
    );
    if (match) {
      usedUart.add(uart);
      usedJtag.add(match);
      merged.push({
        uart,
        jtag: match,
        merge: { status: "merged", reason: "serial_match", confidence: Math.max(uart.confidence, 0.9) },
      });
    }
  }

  let remainingUart = sortedUart.filter((u) => !usedUart.has(u));
  let remainingJtag = sortedJtag.filter((j) => !usedJtag.has(j));

  if (remainingUart.length === 1 && remainingJtag.length === 1) {
    const [uart] = remainingUart;
    const [jtag] = remainingJtag;
    usedUart.add(uart);
    usedJtag.add(jtag);
    merged.push({
      uart,
      jtag,
      merge: {
        status: "merged",
        reason: "fallback:singletons",
        confidence: Math.min(uart.confidence, 0.75),
      },
    });
  }

  remainingUart = sortedUart.filter((u) => !usedUart.has(u));
  remainingJtag = sortedJtag.filter((j) => !usedJtag.has(j));

  const ambiguous = remainingUart.length > 0 && remainingJtag.length > 0;
  for (const uart of remainingUart) {
    merged.push({
      uart,
      jtag: null,
      merge: {
        status: ambiguous ? "ambiguous" : "uart_only",
        reason: ambiguous ? "ambiguous" : "no_jtag_match",
        confidence: uart.confidence,
      },
    });
  }

  for (const jtag of remainingJtag) {
    merged.push({
      uart: null,
      jtag,
      merge: {
        status: ambiguous ? "ambiguous" : "jtag_only",
        reason: ambiguous ? "ambiguous" : "no_uart_match",
        confidence: jtag.confidence,
      },
    });
  }

  return merged;
}

function mapRuntimeError(err) {
  const message = normalizeString(err?.message || "");
  const code = normalizeString(err?.code || "");
  const platform = os.platform();

  const permission =
    message.includes("permission") ||
    message.includes("access denied") ||
    code === "eacces" ||
    code === "eperm";

  const busy =
    message.includes("busy") ||
    message.includes("in use") ||
    message.includes("resource busy") ||
    code === "ebusy";

  const missing = message.includes("no such file") || code === "enoent";

  if (permission) {
    const fix =
      platform === "linux"
        ? "Add user to dialout group and re-login: sudo usermod -a -G dialout $USER"
        : platform === "darwin"
          ? "Close other apps using the port and replug the board."
          : "Close other apps using the port or reinstall Digilent USB drivers.";
    return { status: "permission_denied", error: err?.message || "Permission denied", fix };
  }

  if (busy) {
    return { status: "busy", error: err?.message || "Port busy", fix: "Close any app using the port and retry." };
  }

  if (missing) {
    return { status: "not_present", error: err?.message || "Port not present", fix: "Replug the device or select another port." };
  }

  return { status: "error", error: err?.message || "Unknown error", fix: "Check cabling and OS driver status." };
}

export async function probeSerialPort(pathValue, baudDefault = 115200) {
  const port = new SerialPort({ path: pathValue, baudRate: baudDefault, autoOpen: false });

  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ status: "busy", diagnostics: { error: "Probe timeout", fix: "Close other apps using the port and retry." } });
    }, 1500);

    port.open((err) => {
      if (settled) return;
      if (err) {
        clearTimeout(timeout);
        settled = true;
        const mapped = mapRuntimeError(err);
        resolve({ status: mapped.status, diagnostics: { error: mapped.error, fix: mapped.fix } });
        return;
      }
      port.close(() => {
        if (settled) return;
        clearTimeout(timeout);
        settled = true;
        resolve({ status: "ready", diagnostics: null });
      });
    });
  });
}

export function synthesizeDevicesFromCandidates(candidates, options = {}) {
  const devices = [];
  const baudDefault = options.baudDefault ?? 115200;
  const uartCandidates = candidates.filter(
    (candidate) => candidate.kind === "uart" && candidate.isLikelyDigilent
  );
  const jtagCandidates = candidates.filter((candidate) => candidate.kind === "jtag");
  const jtagSummary = buildProgrammingSummary(options.jtagSummary);

  for (const candidate of jtagCandidates) {
    if (candidate.confidence == null || !candidate.reasons) {
      const scored = scoreJtagCandidate(candidate);
      candidate.confidence = scored.confidence;
      candidate.reasons = scored.reasons;
    }
  }

  const mergedEntries = mergeCandidates(uartCandidates, jtagCandidates);

  for (const entry of mergedEntries) {
    const uart = entry.uart;
    const jtag = entry.jtag;
    const merge = entry.merge;

    let vendor = "Digilent";
    let displayName = "Digilent FPGA board (unidentified)";
    let modelId = "unknown-digilent";
    let board = "Unknown";
    let confidence = 0.6;
    let reasons = [];
    let runtimeStatus = "not_present";
    let runtimeDiagnostics = null;
    let identifyDiagnostics = null;
    let detectedVia = null;
    let port = null;
    let vidPid = null;
    let serial = null;

    if (uart) {
      vendor = uart.manufacturer?.toLowerCase().includes("digilent")
        ? "Digilent"
        : uart.manufacturer || "Unknown";

      displayName = vendor === "Digilent"
        ? "Digilent FPGA board (unidentified)"
        : "Serial device (unidentified)";

      modelId = vendor === "Digilent" ? "unknown-digilent" : "unknown-serial";
      board = "Unknown";
      confidence = uart.confidence;
      reasons = [...uart.reasons];
      runtimeStatus = uart.runtimeStatus;
      runtimeDiagnostics = uart.runtimeDiagnostics;
      detectedVia = uart.detectedVia;
      port = uart.path;
      vidPid = formatVidPid(uart.vendorId, uart.productId);
      serial = uart.serialNumber || null;

      if (uart.identify?.ok && uart.identify.payload?.board_model_id) {
        const boardModelId = uart.identify.payload.board_model_id;
        const resolved = resolveBoardDisplay(boardModelId);
        if (resolved) {
          modelId = boardModelId;
          displayName = resolved.displayName;
          board = resolved.board;
          confidence = Math.max(confidence, 0.95);
          reasons.push(`identify:matched:${boardModelId}`);
        }

        const localHash = getPinmapHash(boardModelId);
        const reportedHash = uart.identify.payload.pinmap_hash;
        if (localHash && reportedHash && localHash !== reportedHash) {
          runtimeStatus = "error";
          runtimeDiagnostics = {
            error: "Pinmap hash mismatch",
            fix: "Update RedByte OS or board pack to match the board firmware.",
          };
          reasons.push("pinmap:mismatch");
        } else if (localHash && reportedHash) {
          reasons.push("pinmap:match");
        }

        identifyDiagnostics = {
          ok: true,
          attempts: uart.identify.attempts,
          rtt_ms: uart.identify.rttMs ?? null,
          payload: uart.identify.payload,
        };
      } else if (uart.identify) {
        reasons.push("identify:no_response");
        identifyDiagnostics = {
          ok: false,
          attempts: uart.identify.attempts,
          error: uart.identify.error || uart.identify.lastError || "no_response",
        };
      }
    } else if (jtag) {
      const scored = scoreJtagCandidate(jtag);
      confidence = jtag.confidence ?? scored.confidence;
      reasons = jtag.reasons ?? scored.reasons;
      serial = jtag.serialNumber || null;
      runtimeStatus = "not_present";
      runtimeDiagnostics = {
        error: "UART not detected",
        fix: "Connect the UART interface or program a RedByte bitstream.",
      };
      detectedVia = "jtag";
    }

    if (jtag) {
      reasons.push("jtag:present");
    }

    if (merge?.reason) {
      reasons.push(`merge:${merge.reason}`);
    }

    if (merge?.status === "merged" && merge.reason === "serial_match") {
      confidence = Math.max(confidence, 0.9);
    } else if (merge?.status === "merged" && merge.reason === "fallback:singletons") {
      confidence = Math.min(confidence, 0.75);
    }

    const deviceSerial = serial || (jtag?.serialNumber ?? null);
    const deviceId = deviceSerial
      ? `board-${deviceSerial}`
      : uart
        ? `uart-${vidPid || "unknown"}-${serial || uart.path}`
        : `jtag-${jtag?.endpointId || "unknown"}`;

    const programming = {
      kind: "jtag",
      driver: jtag?.driver || jtagSummary.tool || "djtgcfg",
      status: jtag ? "ready" : jtagSummary.status,
      tool: jtag?.tool || jtagSummary.tool || "djtgcfg",
      endpoint_id: jtag?.endpointId || null,
      serial_number: jtag?.serialNumber || null,
    };

    const programmingDiagnostics = {
      tool: jtagSummary.tool || "djtgcfg",
      enumeration_raw: jtagSummary.enumeration_raw || null,
      error: jtagSummary.error || null,
    };

    const mergeDiagnostics = merge
      ? {
        status: merge.status,
        reason: merge.reason || null,
        confidence: merge.confidence ?? null,
      }
      : null;

    devices.push({
      id: deviceId,
      display_name: displayName,
      vendor,
      serial_number: deviceSerial,
      model_id: modelId,
      board,
      transport: uart ? "uart" : "jtag",
      port,
      serial: deviceSerial,
      vid_pid: vidPid,
      detected_via: detectedVia,
      programming,
      runtime: {
        kind: "uart",
        port,
        baud_default: baudDefault,
        status: runtimeStatus,
        diagnostics: runtimeDiagnostics,
      },
      confidence,
      reasons,
      diagnostics: {
        serial_port: uart
          ? {
            path: uart.path,
            manufacturer: uart.manufacturer || null,
            vendor_id: uart.vendorId || null,
            product_id: uart.productId || null,
            serial_number: uart.serialNumber || null,
            pnp_id: uart.pnpId || null,
            location_id: uart.locationId || null,
            friendly_name: uart.friendlyName || null,
          }
          : undefined,
        runtime: uart?.runtimeDiagnostics || undefined,
        identify: identifyDiagnostics || undefined,
        programming: programmingDiagnostics,
        merge: mergeDiagnostics || undefined,
      },
    });
  }

  if (options.includeSim) {
    devices.push({
      id: "sim",
      display_name: "Basys 3 (SIM)",
      vendor: "RedByte",
      serial_number: null,
      model_id: "basys3",
      board: "Basys3",
      transport: "sim",
      port: null,
      serial: null,
      vid_pid: null,
      detected_via: "env",
      programming: {
        kind: "sim",
        driver: "sim",
        status: "ready",
      },
      runtime: {
        kind: "sim",
        port: null,
        baud_default: baudDefault,
        status: "ready",
      },
      confidence: 1,
      reasons: ["simulation_device"],
    });
  }

  return devices;
}

export async function discoverDevices(options = {}) {
  const usbIds = options.usbIds ?? loadUsbIdTable();
  const baudDefault = options.baudDefault ?? 115200;
  const includeSim = options.includeSim ?? true;
  const identifyEnabled = options.identify ?? true;
  const identifyTimeoutMs = options.identifyTimeoutMs ?? 250;
  const identifyRetries = options.identifyRetries ?? 3;
  const identifyBackoffMs = options.identifyBackoffMs ?? [100, 200, 400];
  const identifyBudgetMs = options.identifyBudgetMs ?? 1500;
  const identifyPortBudgetMs = options.identifyPortBudgetMs ?? 800;
  const identifyStart = Date.now();
  const jtagTimeoutMs = options.jtagTimeoutMs ?? 1200;

  let jtagResult = null;
  try {
    jtagResult = enumerateJtagDevices({ timeoutMs: jtagTimeoutMs });
  } catch (err) {
    jtagResult = {
      ok: false,
      tool: "djtgcfg",
      toolPath: null,
      error: err?.message || "jtag_enum_failed",
      raw: null,
      devices: [],
    };
  }

  const ports = await SerialPort.list();
  const candidates = [];

  for (const port of ports) {
    const { confidence, reasons, isLikelyDigilent } = scorePortCandidate(port, usbIds);
    if (!isLikelyDigilent) continue;

    let detectedVia = null;
    if (findUsbIdMatch(port, usbIds)) {
      detectedVia = "vid_pid";
    } else if (normalizeString(port.manufacturer).includes("digilent")) {
      detectedVia = "manufacturer";
    } else if (normalizeString(port.friendlyName).includes("digilent")) {
      detectedVia = "friendly_name";
    } else if (normalizeString(port.pnpId).includes("digilent")) {
      detectedVia = "pnp_id";
    }

    const probe = await probeSerialPort(port.path, baudDefault);
    const runtimeDiagnostics = probe.diagnostics
      ? { error: probe.diagnostics.error, fix: probe.diagnostics.fix }
      : null;

    let identifyResult = null;
    if (identifyEnabled && probe.status === "ready") {
      const elapsed = Date.now() - identifyStart;
      const remaining = identifyBudgetMs - elapsed;
      const perPortBudget = Math.min(identifyPortBudgetMs, remaining);

      if (perPortBudget >= identifyTimeoutMs) {
        identifyResult = await identifyPort({
          port: port.path,
          baud: baudDefault,
          timeoutMs: identifyTimeoutMs,
          retries: identifyRetries,
          backoffMs: identifyBackoffMs,
          maxTotalMs: perPortBudget,
        });
      } else {
        identifyResult = {
          ok: false,
          attempts: 0,
          error: "identify_skipped_budget",
          lastError: null,
        };
      }
    }

    candidates.push({
      kind: "uart",
      path: port.path,
      manufacturer: port.manufacturer || null,
      vendorId: normalizeHex(port.vendorId),
      productId: normalizeHex(port.productId),
      serialNumber: port.serialNumber || null,
      pnpId: port.pnpId || null,
      locationId: port.locationId || null,
      friendlyName: port.friendlyName || null,
      confidence,
      reasons,
      isLikelyDigilent,
      detectedVia,
      runtimeStatus: probe.status,
      runtimeDiagnostics,
      identify: identifyResult,
    });
  }

  if (jtagResult?.devices?.length) {
    for (const device of jtagResult.devices) {
      candidates.push({
        kind: "jtag",
        tool: device.tool || jtagResult.tool || "djtgcfg",
        driver: device.tool || jtagResult.tool || "djtgcfg",
        endpointId: device.endpoint_id || null,
        serialNumber: device.serial_number || null,
        product: device.product || null,
        confidence: null,
        reasons: null,
      });
    }
  }

  return synthesizeDevicesFromCandidates(candidates, {
    includeSim,
    baudDefault,
    jtagSummary: jtagResult,
  });
}
