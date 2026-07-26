// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.

import React from 'react';

export interface VerifyWaveformPlaceholderProps {
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  readonly clockName?: string;
  readonly isSequential: boolean;
  readonly hasVectors: boolean;
  readonly runLabel: string;
  /**
   * Primary "Run Verify" handler shown in the empty-state hero when vectors
   * are ready. NOTE: this CTA must NOT use the testid `ide-vwp-run` — the
   * canonical Run is `ide-vcb-run` in the command bar header. This CTA uses
   * `ide-verify-waveform-placeholder-run-cta` so the dedup contract holds.
   */
  readonly onRun?: () => void;
  readonly runDisabled?: boolean;
  /** Secondary "Seed stimulus" handler shown when no vectors are authored. */
  readonly onSeed?: () => void;
  readonly seedLabel?: string;
}

export const VerifyWaveformPlaceholder: React.FC<VerifyWaveformPlaceholderProps> = ({
  inputNames,
  outputNames,
  clockName,
  isSequential,
  hasVectors,
  runLabel,
  onRun,
  runDisabled,
  onSeed,
  seedLabel,
}) => {
  const allSignals: Array<{ name: string; kind: 'clk' | 'in' | 'out' }> = [];
  const seenSignals = new Set<string>();

  const registerSignal = (name: string | undefined, kind: 'clk' | 'in' | 'out') => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    if (seenSignals.has(normalized)) return;
    seenSignals.add(normalized);
    allSignals.push({ name: trimmed, kind });
  };

  registerSignal(clockName, 'clk');
  inputNames.forEach((name) => registerSignal(name, 'in'));
  outputNames.forEach((name) => registerSignal(name, 'out'));

  return (
    <div
      className={`ide-vwp${!hasVectors ? ' ide-vwp--no-vectors' : ''}`}
      data-testid="ide-verify-waveform-placeholder"
    >
      {!hasVectors ? (
        /* ── Empty state: no vectors authored yet ── */
        <div className="ide-vwp-empty-hero" data-testid="ide-verify-waveform-placeholder-cta">
          <div className="ide-vwp-empty-hero-icon" aria-hidden="true">◈</div>
          <h4 className="ide-vwp-empty-hero-title">Build the first testbench case</h4>
          <p className="ide-vwp-empty-hero-desc">
            This is the evidence workspace, not an error. Add a case in the testbench, then run it to record observed outputs here.
          </p>
          <ol className="ide-vwp-empty-hero-steps" data-testid="ide-verify-waveform-placeholder-steps">
            <li>Set input stimulus in the grid.</li>
            <li>Add expected outputs only where checks are needed.</li>
            <li>Run Verify to populate lanes and mismatches.</li>
          </ol>
          {onSeed ? (
            <div className="ide-vwp-empty-hero-actions">
              <button
                type="button"
                className="ide-vwp-empty-hero-seed"
                onClick={onSeed}
                data-testid="ide-verify-waveform-placeholder-seed-cta"
              >
                {seedLabel ?? (isSequential ? 'Generate starter stimulus' : 'Seed stimulus')}
              </button>
            </div>
          ) : null}
          <div className="ide-vwp-empty-hero-signals">
            {allSignals.length > 0 ? (
              <>
                <span className="ide-vwp-empty-hero-signals-label">Signals in this circuit:</span>
                <ul className="ide-vwp-empty-signal-list" aria-label="Signals available to the testbench">
                  {allSignals.map((signal) => (
                    <li
                      key={signal.name}
                      className={`ide-vwp-empty-signal ide-vwp-empty-signal--${signal.kind}`}
                    >
                      {signal.kind === 'clk' ? '⏱' : signal.kind === 'in' ? '→' : '←'}{' '}
                      <code>{signal.name}</code>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <span className="ide-vwp-empty-hero-signals-label">
                Add circuit inputs and outputs first — then come back to author vectors.
              </span>
            )}
          </div>
        </div>
      ) : (
        /* ── Vectors exist: show lane preview + a strong "ready to run" hero ── */
        <>
          <div className="ide-vwp-summary" data-testid="ide-vwp-header">
            <strong className="ide-vwp-workspace-label" data-testid="ide-vwp-observe-chip">
              Observed output workspace
            </strong>
            <p className="ide-vwp-header-note" data-testid="ide-vwp-header-run-note">
              {runLabel} to populate waveform and observed outputs.
            </p>
            <dl className="ide-vwp-header-facts">
              <div><dt>Lanes</dt><dd>{allSignals.length}</dd></div>
              <div><dt>Timing</dt><dd>{isSequential ? 'Sequential' : 'Combinational'}</dd></div>
            </dl>
          </div>

          <div className="ide-vwp-ready-hero" data-testid="ide-verify-waveform-placeholder-ready">
            <h4 className="ide-vwp-ready-hero-title">Testbench ready for its first run</h4>
            <p className="ide-vwp-ready-hero-desc">
              The case grid is editable now. After Run, this pane shows the values RedByte computed at each case.
            </p>
            {onRun ? (
              <button
                type="button"
                className="ide-vwp-ready-hero-run"
                onClick={onRun}
                disabled={runDisabled}
                data-testid="ide-verify-waveform-placeholder-run-cta"
              >
                {runLabel}
              </button>
            ) : null}
          </div>

          <div className="ide-vwp-lanes" data-testid="ide-vwp-lanes">
            {allSignals.map((signal) => (
              <div key={signal.name} className={`ide-vwp-lane ide-vwp-lane--${signal.kind}`}>
                <span className="ide-vwp-lane-label">
                  <code>{signal.name}</code>
                </span>
                <div className="ide-vwp-lane-trace" aria-label={`${signal.name} has no sample yet`}>
                  <div className="ide-vwp-lane-bar" aria-hidden="true" />
                  <span className="ide-vwp-lane-empty-label">No sample yet</span>
                </div>
              </div>
            ))}
            {allSignals.length === 0 && (
              <div className="ide-vwp-lane ide-vwp-lane--empty">
                <span className="ide-vwp-lane-label">No signals detected</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
