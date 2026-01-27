import type { HardwareTraceEvent } from "@redbyte/rb-fpga-proof-core";

interface StreamSample {
  t_ms?: number | string | null;
  device_id?: string | null;
  io?: Record<string, unknown> | null;
}

export function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isHex = trimmed.startsWith("0x") || /[a-f]/i.test(trimmed);
  const parsed = isHex
    ? parseInt(trimmed.replace(/^0x/i, ""), 16)
    : Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildDigitalFromIo(
  io: Record<string, unknown> | null | undefined
): number {
  if (!io) return 0;
  const direct = parseNumeric((io as any).digital ?? (io as any).DIGITAL);
  if (direct !== null) return direct;

  const sw =
    parseNumeric(
      (io as any).sw ??
        (io as any).SW ??
        (io as any).switches ??
        (io as any).inputs?.SW ??
        (io as any).inputs?.sw
    ) ?? 0;
  const btn =
    parseNumeric(
      (io as any).btn ??
        (io as any).BTN ??
        (io as any).buttons ??
        (io as any).inputs?.BTN ??
        (io as any).inputs?.btn
    ) ?? 0;

  const sw0 = sw & 0x1;
  const sw1 = (sw >> 1) & 0x1;
  const btn0 = btn & 0x1;
  return (sw0 << 0) | (sw1 << 1) | (btn0 << 2);
}

export function buildTraceEvent(
  sample: StreamSample,
  seq: number,
  hz: number
): HardwareTraceEvent {
  const tMs = parseNumeric(sample.t_ms) ?? 0;
  const hwTick = hz > 0 ? Math.floor((tMs * hz) / 1000) : seq;
  return {
    hw_tick: hwTick,
    mono_seq: seq,
    digital: buildDigitalFromIo(sample.io ?? undefined),
    analog: Array.from({ length: 8 }, () => 0),
    ts_wall: tMs,
  };
}

export function computeStreamSilenceMs(hz: number): number {
  const safeHz = Number.isFinite(hz) && hz > 0 ? hz : 1;
  const periodMs = 1000 / safeHz;
  return Math.max(2000, Math.round(periodMs * 3));
}
