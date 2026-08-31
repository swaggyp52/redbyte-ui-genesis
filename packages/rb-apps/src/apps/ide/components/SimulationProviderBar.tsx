import React from 'react';
import {
  BROWSER_LOGIC_PROVIDER,
  importedVcdProvider,
  type ProviderKind,
  type SimulationProviderInfo,
} from '../simulationProvider';

/**
 * Simulation provider bar — makes the *provenance* of what Simulate is showing
 * explicit and selectable. RedByte serves simulation through providers, each
 * with an honest evidence tier:
 *
 *   - Browser Logic (Browser-E0): RedByte executes the elaborated logic model in
 *     the browser. Real, but only the browser model — never Vivado or hardware.
 *   - Imported VCD (imported-external): a waveform recorded by an external
 *     simulator. RedByte replays it and executes nothing.
 *
 * The selected provider is the "run of record" — the current view. The bar always
 * states the active provider's evidence label so a result is never mistaken for
 * something it is not.
 */

export interface SimulationProviderBarProps {
  /** Whether an imported VCD is loaded (enables the Imported VCD provider). */
  readonly hasImportedWaveform: boolean;
  /** The imported waveform's own provider descriptor (used verbatim, not rebuilt). */
  readonly importedProvider?: SimulationProviderInfo | null;
  /** The currently selected provider. */
  readonly activeProvider: ProviderKind;
  /** Select a provider. */
  readonly onSelectProvider: (kind: ProviderKind) => void;
  /** Short label for the latest native run (e.g. "Run 3 · passing"), if any. */
  readonly nativeRunLabel?: string | null;
}

const TIER_NOTE: Record<string, string> = {
  'browser-e0': 'RedByte executes the browser logic model only — not Vivado, not hardware.',
  'imported-external': 'External evidence — replayed, never executed. No imported HDL or Tcl runs.',
};

export const SimulationProviderBar: React.FC<SimulationProviderBarProps> = ({
  hasImportedWaveform,
  importedProvider,
  activeProvider,
  onSelectProvider,
  nativeRunLabel,
}) => {
  const imported = importedProvider ?? importedVcdProvider('imported.vcd');
  const providers: Array<{ info: SimulationProviderInfo; enabled: boolean }> = [
    { info: BROWSER_LOGIC_PROVIDER, enabled: true },
    { info: imported, enabled: hasImportedWaveform },
  ];
  const active = providers.find((p) => p.info.kind === activeProvider)?.info ?? BROWSER_LOGIC_PROVIDER;

  return (
    <section className="ide-sim-provider-bar" data-testid="ide-sim-provider-bar" aria-label="Simulation provider">
      <header className="ide-sim-provider-head">
        <span className="ide-sim-provider-title">Simulation provider</span>
        <span className="ide-sim-provider-active" data-testid="ide-sim-provider-active">
          {active.displayName}
        </span>
      </header>

      <div className="ide-sim-provider-chips" role="radiogroup" aria-label="Choose simulation provider">
        {providers.map(({ info, enabled }) => {
          const isActive = info.kind === activeProvider;
          return (
            <button
              key={info.kind}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={`ide-sim-provider-chip${isActive ? ' is-active' : ''}`}
              data-testid={`ide-sim-provider-${info.kind}`}
              data-tier={info.evidenceTier}
              disabled={!enabled}
              onClick={() => enabled && onSelectProvider(info.kind)}
              title={enabled ? info.evidenceLabel : 'Load a VCD to enable this provider'}
            >
              <span className="ide-sim-provider-chip-name">{info.displayName}</span>
              <span className={`ide-sim-provider-tier is-${info.evidenceTier}`}>
                {info.evidenceTier === 'browser-e0' ? 'Browser-E0' : 'Imported evidence'}
              </span>
            </button>
          );
        })}
      </div>

      <p className="ide-sim-provider-provenance" data-testid="ide-sim-provenance">
        <strong>{active.evidenceLabel}.</strong> {TIER_NOTE[active.evidenceTier]}
        {active.kind === 'browser-logic' && nativeRunLabel ? (
          <span className="ide-sim-provider-run" data-testid="ide-sim-provenance-run"> Current run: {nativeRunLabel}.</span>
        ) : null}
        {active.kind === 'imported-vcd' && !hasImportedWaveform ? (
          <span className="ide-sim-provider-hint"> Load a .vcd in the Analyzer below to view its waveform.</span>
        ) : null}
      </p>
    </section>
  );
};
