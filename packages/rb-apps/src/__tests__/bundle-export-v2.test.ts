// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import JSZip from "jszip";
import { webcrypto } from "node:crypto";
import { exportV2Bundle } from "../utils/bundleExport";

vi.setConfig({ hookTimeout: 20000, testTimeout: 20000 });

describe("exportV2Bundle", () => {
  beforeEach(() => {
    if (!globalThis.crypto?.subtle) {
      Object.defineProperty(globalThis, "crypto", {
        value: webcrypto,
        configurable: true,
      });
    }
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    }
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports a v2 bundle with required files", async () => {
    const addedFiles: Array<{ path: string; data: unknown }> = [];
    const originalFile = JSZip.prototype.file;
    const fileSpy = vi
      .spyOn(JSZip.prototype, "file")
      .mockImplementation(function (...args: unknown[]) {
        const path = args[0];
        const data = args.length > 1 ? args[1] : undefined;
        if (typeof path === "string" && args.length > 1) {
          addedFiles.push({ path, data });
        }
        return originalFile.apply(this, args as any);
      });

    const traceEvent = {
      hw_tick: 0,
      mono_seq: 0,
      digital: 0,
      analog: [0, 0, 0, 0, 0, 0, 0, 0],
      ts_wall: 0,
    };

    const result = await exportV2Bundle({
      labId: "basys3_mvp_lab",
      labVersion: "1.0.0",
      board: "basys3",
      binSizeMs: 50,
      traceNdjson: JSON.stringify(traceEvent),
      traceEventCount: 1,
    });

    const paths = addedFiles.map((entry) => entry.path);
    expect(paths).toContain("manifest.json");
    expect(paths).toContain("trace/hw_trace.ndjson");
    expect(paths).toContain("meta/board_profile.json");
    expect(paths).toContain("integrity/capsule.json");

    const manifestEntry = addedFiles.find((entry) => entry.path === "manifest.json");
    const manifestBytes = manifestEntry?.data instanceof Uint8Array
      ? manifestEntry.data
      : new TextEncoder().encode(String(manifestEntry?.data ?? ""));
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    expect(manifest.schema_version).toBe("v2");
    expect(manifest.board).toBe("basys3");
    expect(manifest.trace_summary?.events).toBe(1);
    expect(result.hash).toBeTruthy();

    fileSpy.mockRestore();
  });
});
