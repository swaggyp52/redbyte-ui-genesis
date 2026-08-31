import React from 'react';
import type { ProviderWaveform } from '../simulationProvider';
import { evidenceCaption } from '../simulationProvider';

/**
 * VCD waveform view — the core display for the imported-VCD Analyzer. It renders
 * a {@link ProviderWaveform} (produced from a parsed VCD via `waveformFromVcd`):
 * the honest evidence caption (so the imported-external tier is never mistaken
 * for RedByte's own simulation), each signal with its width, and a compact
 * per-signal value-change timeline. Renders nothing when there is no waveform.
 */

export interface VcdWaveformViewProps {
  readonly waveform: ProviderWaveform | null;
  /** Max value-changes to show per signal (older-first). */
  readonly maxChangesPerSignal?: number;
}

export const VcdWaveformView: React.FC<VcdWaveformViewProps> = ({ waveform, maxChangesPerSignal = 12 }) => {
  if (!waveform || waveform.signals.length === 0) return null;

  const changesByKey = new Map<string, { time: number; value: string }[]>();
  for (const change of waveform.changes) {
    const list = changesByKey.get(change.key) ?? [];
    list.push({ time: change.time, value: change.value });
    changesByKey.set(change.key, list);
  }

  return (
    <section className="ide-vcd-waveform" data-testid="ide-vcd-waveform" aria-label="Imported waveform">
      <header className="ide-vcd-waveform-head">
        <span>Imported waveform</span>
        <strong data-testid="ide-vcd-signal-count">
          {waveform.signals.length} signal{waveform.signals.length === 1 ? '' : 's'} · ends t={waveform.endTime}
        </strong>
      </header>

      <p className="ide-vcd-evidence" data-testid="ide-vcd-evidence">
        {evidenceCaption(waveform.provider)}
      </p>

      {waveform.notes.length > 0 ? (
        <ul className="ide-vcd-notes" data-testid="ide-vcd-notes">
          {waveform.notes.slice(0, 5).map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      ) : null}

      <ul className="ide-vcd-signals">
        {waveform.signals.map((signal) => {
          const changes = changesByKey.get(signal.key) ?? [];
          const shown = changes.slice(0, maxChangesPerSignal);
          return (
            <li
              key={signal.key}
              className="ide-vcd-signal"
              data-testid={`ide-vcd-signal-${signal.key}`}
            >
              <span className="ide-vcd-signal-name">
                <code>{signal.name}</code>
                {signal.width > 1 ? <small>[{signal.width}]</small> : null}
              </span>
              <span className="ide-vcd-signal-timeline">
                {shown.length === 0 ? (
                  <em>no changes</em>
                ) : (
                  shown.map((change, index) => (
                    <span key={index} className="ide-vcd-change">
                      <span className="ide-vcd-change-time">{change.time}</span>
                      <span className="ide-vcd-change-value">{change.value}</span>
                    </span>
                  ))
                )}
                {changes.length > shown.length ? (
                  <span className="ide-vcd-change-more">+{changes.length - shown.length}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
