// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, expect, it, vi } from "vitest";
import { buildTraceEvent, computeStreamSilenceMs, parseNumeric } from "../apps/hardwarePanelUtils";
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
        const event = buildTraceEvent({ t_ms: 50, io: { SW: 3, BTN: 1 } }, 7, 20);
        expect(event.hw_tick).toBe(1);
        expect(event.mono_seq).toBe(7);
        expect(event.digital).toBe(7);
        expect(event.analog).toHaveLength(8);
        expect(event.ts_wall).toBe(50);
    });
});
describe("computeStreamSilenceMs", () => {
    it("returns minimum 2000ms for high Hz values", () => {
        // At 20Hz, period = 50ms, so 3x = 150ms, but min is 2000ms
        expect(computeStreamSilenceMs(20)).toBe(2000);
        expect(computeStreamSilenceMs(100)).toBe(2000);
        expect(computeStreamSilenceMs(200)).toBe(2000);
    });
    it("scales with Hz for low sample rates", () => {
        // At 1Hz, period = 1000ms, so 3x = 3000ms
        expect(computeStreamSilenceMs(1)).toBe(3000);
        // At 0.5Hz, period = 2000ms, so 3x = 6000ms
        expect(computeStreamSilenceMs(0.5)).toBe(6000);
    });
    it("handles edge cases gracefully", () => {
        // Zero or negative Hz defaults to 1Hz behavior
        expect(computeStreamSilenceMs(0)).toBe(3000);
        expect(computeStreamSilenceMs(-5)).toBe(3000);
        // NaN/Infinity defaults to 1Hz
        expect(computeStreamSilenceMs(NaN)).toBe(3000);
        expect(computeStreamSilenceMs(Infinity)).toBe(3000);
    });
    it("does not fail at Hz=1 before first sample would arrive", () => {
        // Critical acceptance test: Hz=1 should give at least 3000ms
        // which is longer than 1 sample period (1000ms)
        const silenceMs = computeStreamSilenceMs(1);
        expect(silenceMs).toBeGreaterThanOrEqual(3000);
    });
    it("catches real stalls fast at Hz=20", () => {
        // At 20Hz we should still detect stalls reasonably quickly
        const silenceMs = computeStreamSilenceMs(20);
        expect(silenceMs).toBeLessThanOrEqual(2000);
    });
});
