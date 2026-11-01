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

/**
 * Provider provenance is a compact concern, not a full-width banner. With only the
 * native RedByte simulator (no imported waveform) there is nothing to choose, so
 * this renders nothing — the external Vivado/hardware boundary is stated once in
 * Package, not repeated on every Simulate view. A compact source toggle appears
 * only when an imported waveform is available to switch to.
 */
export const SimulationProviderBar: React.FC<SimulationProviderBarProps> = ({
  hasImportedWaveform,
  importedProvider,
  activeProvider,
  onSelectProvider,
}) => {
  if (!hasImportedWaveform) return null;
  const imported = importedProvider ?? importedVcdProvider('imported.vcd');
  const providers: SimulationProviderInfo[] = [BROWSER_LOGIC_PROVIDER, imported];

  return (
    <div
      className="ide-sim-provider-strip"
      data-testid="ide-sim-provider-bar"
      role="radiogroup"
      aria-label="Simulation source"
    >
      <span className="ide-sim-provider-strip-label">Source</span>
      {providers.map((info) => {
        const isActive = info.kind === activeProvider;
        return (
          <button
            key={info.kind}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`ide-sim-provider-pill${isActive ? ' is-active' : ''}`}
            data-testid={`ide-sim-provider-${info.kind}`}
            onClick={() => onSelectProvider(info.kind)}
            title={info.evidenceLabel}
          >
            {info.kind === 'browser-logic' ? 'RedByte simulator' : 'Imported .vcd'}
          </button>
        );
      })}
    </div>
  );
};
