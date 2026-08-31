// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Simulation provider architecture.
 *
 * RedByte simulation is served by *providers*, each carrying an honest evidence
 * tier so results are never mislabeled as something they are not:
 *
 *   - Browser Logic Provider — RedByte recomputes the elaborated native circuit
 *     in the browser (`state.sim`). Evidence tier: Browser-E0. It DOES execute
 *     logic, but only the browser logic model — never Vivado/hardware.
 *   - Imported VCD Provider — a waveform produced by an *external* simulator,
 *     imported as evidence. RedByte executes nothing; it replays what it was
 *     given. Evidence tier: imported (external).
 *
 * The workbench grammar (signals, waveform, cross-probe) is identical across
 * providers; only the evidence tier and editability differ. No provider ever
 * fabricates execution — an unknown value is reported as unknown.
 */

import type { VcdWaveform } from './vcdImport';

export type ProviderKind = 'browser-logic' | 'imported-vcd';
export type EvidenceTier = 'browser-e0' | 'imported-external';

export interface SimulationProviderInfo {
  kind: ProviderKind;
  displayName: string;
  evidenceTier: EvidenceTier;
  /** Honest label shown wherever this provider's results appear. */
  evidenceLabel: string;
  /** True only for the browser logic model. Never implies Vivado/hardware. */
  executesInBrowser: boolean;
  /** True when the provider's data is externally produced (read-only evidence). */
  external: boolean;
}

export const BROWSER_LOGIC_PROVIDER: SimulationProviderInfo = {
  kind: 'browser-logic',
  displayName: 'Browser logic simulation',
  evidenceTier: 'browser-e0',
  evidenceLabel: 'Browser E0 — RedByte logic simulation',
  executesInBrowser: true,
  external: false,
};

/** Build the descriptor for a VCD imported from `sourceName`. */
export function importedVcdProvider(sourceName: string): SimulationProviderInfo {
  return {
    kind: 'imported-vcd',
    displayName: `Imported waveform · ${sourceName}`,
    evidenceTier: 'imported-external',
    evidenceLabel: 'Imported evidence — waveform generated outside RedByte',
    executesInBrowser: false,
    external: true,
  };
}

export interface ProviderSignal {
  /** Stable key within the provider (VCD id, or a native signal key). */
  key: string;
  /** Human name. */
  name: string;
  width: number;
}

export interface ProviderWaveformChange {
  time: number;
  key: string;
  value: string;
}

export interface ProviderWaveform {
  provider: SimulationProviderInfo;
  signals: ProviderSignal[];
  changes: ProviderWaveformChange[];
  endTime: number;
  /** Non-fatal issues from producing this waveform (e.g. VCD parse diagnostics). */
  notes: string[];
}

/**
 * Adapt a parsed VCD into a neutral provider waveform tagged with the imported
 * evidence tier. The Analyzer consumes {@link ProviderWaveform} regardless of
 * which provider produced it.
 */
export function waveformFromVcd(vcd: VcdWaveform, sourceName: string): ProviderWaveform {
  const provider = importedVcdProvider(sourceName);
  const signals: ProviderSignal[] = vcd.signals.map((signal) => ({
    key: signal.id,
    name: signal.reference,
    width: signal.width,
  }));
  const changes: ProviderWaveformChange[] = vcd.changes.map((change) => ({
    time: change.time,
    key: change.id,
    value: change.value,
  }));
  const notes = vcd.diagnostics
    .filter((diagnostic) => diagnostic.severity !== 'info')
    .map((diagnostic) => diagnostic.message);
  return { provider, signals, changes, endTime: vcd.endTime, notes };
}

/**
 * Whether two providers may be compared side by side. Cross-tier comparison is
 * allowed (that is a legitimate native-vs-imported check), but the caller must
 * always render each side's evidence tier so the comparison stays honest.
 */
export function providersComparable(a: SimulationProviderInfo, b: SimulationProviderInfo): boolean {
  return a.kind !== b.kind || a.displayName !== b.displayName;
}

/** The honest one-line evidence caption for a provider. */
export function evidenceCaption(provider: SimulationProviderInfo): string {
  return provider.evidenceLabel;
}
