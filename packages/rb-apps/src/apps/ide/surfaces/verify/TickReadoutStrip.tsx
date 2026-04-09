import React from 'react';
import type { WaveformSignalRow, SignalLaneGroup } from './WaveformInstrument';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TickReadoutStripProps {
  /** The tick index to display values for */
  tick: number;
  /** Full signal timeline from the waveform */
  signals: WaveformSignalRow[];
  /** Optional group membership — used to visually distinguish inputs vs outputs */
  signalGroups?: Map<string, SignalLaneGroup>;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * A compact horizontal bar displayed below the waveform when a tick is selected.
 * Shows the input and output signal values at that tick, colour-coded to match
 * the oscilloscope lane colours (steel-blue for stimulus, teal for observed).
 */
export const TickReadoutStrip: React.FC<TickReadoutStripProps> = ({
  tick,
  signals,
  signalGroups,
}) => {
  const inputs: Array<{ signal: string; value: string }> = [];
  const outputs: Array<{ signal: string; value: string }> = [];
  const unknowns: Array<{ signal: string; value: string }> = [];

  for (const row of signals) {
    const entry = row.values.find(v => v.tick === tick);
    const value = entry !== undefined ? entry.value : '?';
    const group = signalGroups?.get(row.signal);
    if (group === 'Inputs') {
      inputs.push({ signal: row.signal, value });
    } else if (group === 'Outputs') {
      outputs.push({ signal: row.signal, value });
    } else {
      unknowns.push({ signal: row.signal, value });
    }
  }

  return (
    <div className="ide-verify-tick-readout" data-testid="ide-verify-tick-readout">
      <span className="ide-verify-tick-readout__label">t{tick}</span>

      {inputs.length > 0 && (
        <span className="ide-verify-tick-readout__group ide-verify-tick-readout__group--inputs">
          {inputs.map(({ signal, value }) => (
            <span
              key={signal}
              className="ide-verify-tick-readout__chip ide-verify-tick-readout__chip--input"
              data-testid={`ide-verify-tick-readout-chip-${signal}`}
            >
              {signal}:{value}
            </span>
          ))}
        </span>
      )}

      {outputs.length > 0 && (
        <>
          <span className="ide-verify-tick-readout__sep" aria-hidden="true">→</span>
          <span className="ide-verify-tick-readout__group ide-verify-tick-readout__group--outputs">
            {outputs.map(({ signal, value }) => (
              <span
                key={signal}
                className="ide-verify-tick-readout__chip ide-verify-tick-readout__chip--output"
                data-testid={`ide-verify-tick-readout-chip-${signal}`}
              >
                {signal}:{value}
              </span>
            ))}
          </span>
        </>
      )}

      {unknowns.length > 0 && (
        <span className="ide-verify-tick-readout__group">
          {unknowns.map(({ signal, value }) => (
            <span
              key={signal}
              className="ide-verify-tick-readout__chip"
              data-testid={`ide-verify-tick-readout-chip-${signal}`}
            >
              {signal}:{value}
            </span>
          ))}
        </span>
      )}
    </div>
  );
};
