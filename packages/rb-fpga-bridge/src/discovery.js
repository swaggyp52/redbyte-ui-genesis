import { SerialPort } from "serialport";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { identifyPort } from "./proto/identify.js";

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

  const sorted = [...candidates].sort((a, b) => {
    return a.path.localeCompare(b.path, undefined, { sensitivity: "base" });
  });

  for (const candidate of sorted) {
    if (!candidate.isLikelyDigilent) continue;

    const vendor = candidate.manufacturer?.toLowerCase().includes("digilent")
      ? "Digilent"
      : candidate.manufacturer || "Unknown";

    let displayName = vendor === "Digilent"
      ? "Digilent FPGA board (unidentified)"
      : "Serial device (unidentified)";

    let modelId = vendor === "Digilent" ? "unknown-digilent" : "unknown-serial";
    let board = "Unknown";
    let confidence = candidate.confidence;
    const reasons = [...candidate.reasons];
    let runtimeStatus = candidate.runtimeStatus;
    let runtimeDiagnostics = candidate.runtimeDiagnostics;
    let identifyDiagnostics = null;

    if (candidate.identify?.ok && candidate.identify.payload?.board_model_id) {
      const boardModelId = candidate.identify.payload.board_model_id;
      const resolved = resolveBoardDisplay(boardModelId);
      if (resolved) {
        modelId = boardModelId;
        displayName = resolved.displayName;
        board = resolved.board;
        confidence = Math.max(confidence, 0.95);
        reasons.push(`identify:matched:${boardModelId}`);
      }

      const localHash = getPinmapHash(boardModelId);
      const reportedHash = candidate.identify.payload.pinmap_hash;
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
        attempts: candidate.identify.attempts,
        rtt_ms: candidate.identify.rttMs ?? null,
        payload: candidate.identify.payload,
      };
    } else if (candidate.identify) {
      reasons.push("identify:no_response");
      identifyDiagnostics = {
        ok: false,
        attempts: candidate.identify.attempts,
        error: candidate.identify.error || candidate.identify.lastError || "no_response",
      };
    }

    const vidPid = formatVidPid(candidate.vendorId, candidate.productId);
    const serial = candidate.serialNumber || null;
    const deviceId = `uart-${vidPid || "unknown"}-${serial || candidate.path}`;

    devices.push({
      id: deviceId,
      display_name: displayName,
      vendor,
      serial_number: serial,
      model_id: modelId,
      board,
      transport: "uart",
      port: candidate.path,
      serial,
      vid_pid: vidPid,
      detected_via: candidate.detectedVia,
      programming: {
        kind: "jtag",
        driver: "unknown",
        status: "missing_driver",
      },
      runtime: {
        kind: "uart",
        port: candidate.path,
        baud_default: baudDefault,
        status: runtimeStatus,
        diagnostics: runtimeDiagnostics,
      },
      confidence,
      reasons,
      diagnostics: {
        serial_port: {
          path: candidate.path,
          manufacturer: candidate.manufacturer || null,
          vendor_id: candidate.vendorId || null,
          product_id: candidate.productId || null,
          serial_number: candidate.serialNumber || null,
          pnp_id: candidate.pnpId || null,
          location_id: candidate.locationId || null,
          friendly_name: candidate.friendlyName || null,
        },
        runtime: candidate.runtimeDiagnostics || undefined,
        identify: identifyDiagnostics || undefined,
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

  return synthesizeDevicesFromCandidates(candidates, { includeSim, baudDefault });
}
