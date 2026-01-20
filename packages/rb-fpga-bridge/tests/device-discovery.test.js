#!/usr/bin/env node
/**
 * Device discovery synthesis tests (no hardware required).
 */

import assert from "assert/strict";
import { getPinmapHash, scorePortCandidate, synthesizeDevicesFromCandidates } from "../src/discovery.js";

function run() {
  const usbIds = {
    devices: [{ vid: "0403", pid: "6010", label: "FTDI FT2232 (Digilent-class)" }],
  };

  const port = {
    path: "COM7",
    manufacturer: "Digilent",
    vendorId: "0403",
    productId: "6010",
    serialNumber: "2100001234",
    pnpId: "VID_0403&PID_6010",
    friendlyName: "Digilent USB UART",
  };

  const scored = scorePortCandidate(port, usbIds);
  assert.equal(scored.isLikelyDigilent, true);
  assert.equal(scored.confidence, 1);
  assert.ok(scored.reasons.some((r) => r.includes("vid_pid:0403:6010")));
  assert.ok(scored.reasons.some((r) => r.includes("manufacturer:Digilent")));

  const devices = synthesizeDevicesFromCandidates(
    [
      {
        kind: "uart",
        path: port.path,
        manufacturer: port.manufacturer,
        vendorId: port.vendorId,
        productId: port.productId,
        serialNumber: port.serialNumber,
        pnpId: port.pnpId,
        locationId: null,
        friendlyName: port.friendlyName,
        confidence: scored.confidence,
        reasons: scored.reasons,
        isLikelyDigilent: scored.isLikelyDigilent,
        detectedVia: "vid_pid",
        runtimeStatus: "ready",
        runtimeDiagnostics: null,
      },
    ],
    { includeSim: true, baudDefault: 115200 }
  );

  assert.equal(devices.length, 2);
  const hardware = devices.find((d) => d.transport === "uart");
  assert.ok(hardware);
  assert.equal(hardware.model_id, "unknown-digilent");
  assert.equal(hardware.runtime.status, "ready");
  assert.equal(hardware.programming.status, "missing_driver");
  assert.equal(hardware.runtime.baud_default, 115200);

  const sim = devices.find((d) => d.transport === "sim");
  assert.ok(sim);
  assert.equal(sim.confidence, 1);
  assert.equal(sim.runtime.status, "ready");

  const basysHash = getPinmapHash("basys3");
  const identified = synthesizeDevicesFromCandidates(
    [
      {
        kind: "uart",
        path: "COM9",
        manufacturer: "Digilent",
        vendorId: "0403",
        productId: "6010",
        serialNumber: "ABC",
        pnpId: "VID_0403&PID_6010",
        locationId: null,
        friendlyName: "Digilent USB UART",
        confidence: 0.6,
        reasons: ["vid_pid:0403:6010"],
        isLikelyDigilent: true,
        detectedVia: "vid_pid",
        runtimeStatus: "ready",
        runtimeDiagnostics: null,
        identify: {
          ok: true,
          attempts: 1,
          rttMs: 12,
          payload: {
            kind: "identify",
            board_model_id: "basys3",
            bridge_proto: 1,
            wrapper_version: "0.1.0",
            pinmap_hash: basysHash,
            features: ["io_stream_v1"],
            design: {
              design_hash: "sha256:deadbeef",
              build_id: "spring26.0",
            },
          },
        },
      },
    ],
    { includeSim: false, baudDefault: 115200 }
  );

  assert.equal(identified.length, 1);
  assert.equal(identified[0].model_id, "basys3");
  assert.equal(identified[0].display_name, "Basys 3");
  assert.equal(identified[0].confidence >= 0.95, true);

  const mismatched = synthesizeDevicesFromCandidates(
    [
      {
        kind: "uart",
        path: "COM10",
        manufacturer: "Digilent",
        vendorId: "0403",
        productId: "6010",
        serialNumber: "XYZ",
        pnpId: "VID_0403&PID_6010",
        locationId: null,
        friendlyName: "Digilent USB UART",
        confidence: 0.6,
        reasons: ["vid_pid:0403:6010"],
        isLikelyDigilent: true,
        detectedVia: "vid_pid",
        runtimeStatus: "ready",
        runtimeDiagnostics: null,
        identify: {
          ok: true,
          attempts: 1,
          rttMs: 10,
          payload: {
            kind: "identify",
            board_model_id: "basys3",
            bridge_proto: 1,
            wrapper_version: "0.1.0",
            pinmap_hash: "sha256:deadbeef",
            features: ["io_stream_v1"],
            design: {
              design_hash: "sha256:deadbeef",
              build_id: "spring26.0",
            },
          },
        },
      },
    ],
    { includeSim: false, baudDefault: 115200 }
  );

  assert.equal(mismatched.length, 1);
  assert.equal(mismatched[0].runtime.status, "error");
  assert.equal(mismatched[0].reasons.includes("pinmap:mismatch"), true);

  const deniedDevices = synthesizeDevicesFromCandidates(
    [
      {
        kind: "uart",
        path: "COM4",
        manufacturer: "Digilent",
        vendorId: "0403",
        productId: "6010",
        serialNumber: "XYZ",
        pnpId: "VID_0403&PID_6010",
        locationId: null,
        friendlyName: "Digilent USB UART",
        confidence: 0.9,
        reasons: ["vid_pid:0403:6010"],
        isLikelyDigilent: true,
        detectedVia: "vid_pid",
        runtimeStatus: "permission_denied",
        runtimeDiagnostics: {
          error: "Access denied",
          fix: "Close other apps using the port.",
        },
      },
    ],
    { includeSim: false, baudDefault: 115200 }
  );

  assert.equal(deniedDevices.length, 1);
  assert.equal(deniedDevices[0].runtime.status, "permission_denied");
  assert.equal(deniedDevices[0].runtime.diagnostics.error, "Access denied");

  console.log("[TEST] device discovery synthesis passed");
}

try {
  run();
} catch (err) {
  console.error("[TEST] device discovery synthesis failed:", err);
  process.exit(1);
}
