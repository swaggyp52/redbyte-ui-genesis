// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, expect, it, vi } from "vitest";
import { buildTraceEvent, parseNumeric } from "../apps/hardwarePanelUtils";

vi.setConfig({ hookTimeout: 20000, testTimeout: 20000 });

describe("hardwarePanelUtils", () => {
  it("parses numeric values including hex strings", () => {
    expect(parseNumeric("12")).toBe(12);
    expect(parseNumeric("0x10")).toBe(16);
    expect(parseNumeric("ff")).toBe(255);
    expect(parseNumeric("")).toBeNull();
    expect(parseNumeric(null)).toBeNull();
  });

  it("builds trace events with deterministic ticks and digital mapping", () => {
    const event = buildTraceEvent(
      { t_ms: 50, io: { SW: 3, BTN: 1 } },
      7,
      20
    );

    expect(event.hw_tick).toBe(1);
    expect(event.mono_seq).toBe(7);
    expect(event.digital).toBe(7);
    expect(event.analog).toHaveLength(8);
    expect(event.ts_wall).toBe(50);
  });
});
