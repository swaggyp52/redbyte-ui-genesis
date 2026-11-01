// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Imported-VCD Analyzer view model.
 *
 * The Analyzer renders an imported {@link ProviderWaveform} (external evidence,
 * never in-browser execution) across three zones — SIGNALS, WAVEFORM,
 * MEASUREMENTS. This module owns the *pure* view logic those zones share:
 *
 *   - {@link VcdAnalyzerConfig}: the persisted view configuration (which signals
 *     are selected, per-signal radix, the measurement cursor time, the signal
 *     filter). One writable owner (the runtime store); this module only shapes
 *     and reads it.
 *   - {@link formatVcdValue}: format a raw VCD value string for a chosen radix.
 *   - {@link analyzerMeasurements}: the value of each selected signal at the
 *     cursor time, formatted — the MEASUREMENTS zone's data.
 *   - selection / filter helpers shared by the SIGNALS and WAVEFORM zones.
 *
 * Everything here is deterministic and free of wall-clock/random state, so the
 * Analyzer restores identically across reloads.
 */

import type { ProviderWaveform, ProviderSignal, ProviderWaveformChange } from './simulationProvider';

/** How a multi-bit value is displayed. Scalars are always shown as their bit. */
export type VcdRadix = 'bin' | 'hex' | 'dec' | 'signed';

export const VCD_RADIXES: readonly VcdRadix[] = ['bin', 'hex', 'dec', 'signed'];

export interface VcdAnalyzerConfig {
  /** Signal keys the user pinned. Empty means "show every signal". */
  selectedKeys: string[];
  /** Per-signal display radix override (keyed by provider signal key). */
  radixByKey: Record<string, VcdRadix>;
  /** Measurement cursor time (VCD time units, ≥ 0). */
  cursorTime: number;
  /** Case-insensitive filter applied to signal names in the SIGNALS/WAVEFORM zones. */
  search: string;
}

export const DEFAULT_VCD_ANALYZER_CONFIG: VcdAnalyzerConfig = {
  selectedKeys: [],
  radixByKey: {},
  cursorTime: 0,
  search: '',
};

function isRadix(value: unknown): value is VcdRadix {
  return value === 'bin' || value === 'hex' || value === 'dec' || value === 'signed';
}

/** Tolerant normalizer for persisted/untrusted config. Never throws. */
export function normalizeVcdAnalyzerConfig(input: unknown): VcdAnalyzerConfig {
  const source = input && typeof input === 'object' ? (input as Partial<VcdAnalyzerConfig>) : {};
  const selectedKeys = Array.isArray(source.selectedKeys)
    ? Array.from(new Set(source.selectedKeys.filter((key): key is string => typeof key === 'string')))
    : [];
  const radixByKey: Record<string, VcdRadix> = {};
  if (source.radixByKey && typeof source.radixByKey === 'object') {
    for (const [key, value] of Object.entries(source.radixByKey)) {
      if (isRadix(value)) radixByKey[key] = value;
    }
  }
  const cursorTime =
    typeof source.cursorTime === 'number' && Number.isFinite(source.cursorTime) && source.cursorTime >= 0
      ? Math.floor(source.cursorTime)
      : 0;
  const search = typeof source.search === 'string' ? source.search : '';
  return { selectedKeys, radixByKey, cursorTime, search };
}

/** The default radix for a signal of the given width (buses default to hex). */
export function defaultRadixForWidth(width: number): VcdRadix {
  return width > 1 ? 'hex' : 'bin';
}

/** The effective radix for a signal, honoring the per-signal override. */
export function radixForSignal(config: VcdAnalyzerConfig, signal: ProviderSignal): VcdRadix {
  return config.radixByKey[signal.key] ?? defaultRadixForWidth(signal.width);
}

/**
 * Format a raw VCD value string for display in `radix`.
 *
 * Raw VCD values are `0`/`1`/`x`/`z` (scalar), `b<bits>` (vector), or `r<real>`
 * (real). Reals are radix-independent. Values carrying `x`/`z` cannot convert to
 * a number, so they render as their (upper-cased) bit pattern regardless of the
 * requested radix — RedByte never fabricates a numeric value for unknown bits.
 */
export function formatVcdValue(raw: string | undefined, radix: VcdRadix, width: number): string {
  if (raw === undefined || raw === '') return '—';
  if (raw[0] === 'r' || raw[0] === 'R') return raw.slice(1);

  let bits = (raw[0] === 'b' || raw[0] === 'B' ? raw.slice(1) : raw).toLowerCase();
  if (bits === '') return '—';

  const hasUnknown = /[xz]/.test(bits);
  if (radix === 'bin' || hasUnknown) {
    const padded = width > 1 ? bits.padStart(width, bits.includes('x') ? 'x' : '0') : bits;
    return padded.replace(/x/g, 'X').replace(/z/g, 'Z');
  }
  if (!/^[01]+$/.test(bits)) return bits;

  const magnitude = BigInt('0b' + bits);
  if (radix === 'hex') {
    const nibbles = Math.max(1, Math.ceil(Math.max(width, bits.length) / 4));
    return '0x' + magnitude.toString(16).toUpperCase().padStart(nibbles, '0');
  }
  if (radix === 'dec') {
    return magnitude.toString(10);
  }
  // signed: two's complement over the declared width (fall back to bit length).
  const w = Math.max(width, bits.length, 1);
  const signBit = 1n << BigInt(w - 1);
  const signed = magnitude & signBit ? magnitude - (1n << BigInt(w)) : magnitude;
  return signed.toString(10);
}

/** The value of a signal at (or most recently before) `time`, from provider changes. */
export function valueAtTimeFromChanges(
  changes: readonly ProviderWaveformChange[],
  key: string,
  time: number,
): string | undefined {
  let value: string | undefined;
  for (const change of changes) {
    if (change.key !== key) continue;
    if (change.time > time) break;
    value = change.value;
  }
  return value;
}

/** Signals matching the search filter, in declaration order. */
export function filteredSignals(waveform: ProviderWaveform, search: string): ProviderSignal[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return [...waveform.signals];
  return waveform.signals.filter((signal) => signal.name.toLowerCase().includes(needle));
}

/**
 * The signals the WAVEFORM/MEASUREMENTS zones should show: the selected set
 * (intersected with the search filter), or — when nothing is pinned — every
 * signal that matches the filter.
 */
export function visibleSignals(waveform: ProviderWaveform, config: VcdAnalyzerConfig): ProviderSignal[] {
  const matches = filteredSignals(waveform, config.search);
  if (config.selectedKeys.length === 0) return matches;
  const selected = new Set(config.selectedKeys);
  return matches.filter((signal) => selected.has(signal.key));
}

/**
 * A {@link ProviderWaveform} narrowed to the currently visible signals (and only
 * their changes), so the existing `VcdWaveformView` can render the WAVEFORM zone
 * without knowing about selection/search.
 */
export function visibleWaveform(waveform: ProviderWaveform, config: VcdAnalyzerConfig): ProviderWaveform {
  const signals = visibleSignals(waveform, config);
  if (signals.length === waveform.signals.length) return waveform;
  const keys = new Set(signals.map((signal) => signal.key));
  return {
    ...waveform,
    signals,
    changes: waveform.changes.filter((change) => keys.has(change.key)),
  };
}

export interface VcdMeasurement {
  key: string;
  name: string;
  width: number;
  radix: VcdRadix;
  /** Raw VCD value at the cursor (undefined before the signal's first change). */
  raw: string | undefined;
  /** {@link raw} formatted for {@link radix}. */
  formatted: string;
  /** Total value changes recorded for this signal. */
  changeCount: number;
}

/** The MEASUREMENTS zone: each visible signal's value at the cursor time. */
export function analyzerMeasurements(
  waveform: ProviderWaveform,
  config: VcdAnalyzerConfig,
): VcdMeasurement[] {
  const signals = visibleSignals(waveform, config);
  const counts = new Map<string, number>();
  for (const change of waveform.changes) {
    counts.set(change.key, (counts.get(change.key) ?? 0) + 1);
  }
  return signals.map((signal) => {
    const radix = radixForSignal(config, signal);
    const raw = valueAtTimeFromChanges(waveform.changes, signal.key, config.cursorTime);
    return {
      key: signal.key,
      name: signal.name,
      width: signal.width,
      radix,
      raw,
      formatted: formatVcdValue(raw, radix, signal.width),
      changeCount: counts.get(signal.key) ?? 0,
    };
  });
}

/** Clamp a requested cursor time into the waveform's [0, endTime] window. */
export function clampCursorTime(waveform: ProviderWaveform, time: number): number {
  if (!Number.isFinite(time) || time < 0) return 0;
  return Math.min(Math.floor(time), waveform.endTime);
}
