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
}

export const VerifyWaveformPlaceholder: React.FC<VerifyWaveformPlaceholderProps> = ({
  inputNames,
  outputNames,
  clockName,
  isSequential,
  hasVectors,
  runLabel,
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
          <h4 className="ide-vwp-empty-hero-title">No test vectors yet</h4>
          <p className="ide-vwp-empty-hero-desc">
            Build your first stimulus in the pane on the left, or use{' '}
            <strong>Seed stimulus</strong> in the toolbar above to auto-generate a starter set.
            The waveform appears here after the first run.
          </p>
          <div className="ide-vwp-empty-hero-signals">
            {allSignals.length > 0 ? (
              <>
                <span className="ide-vwp-empty-hero-signals-label">Signals in this circuit:</span>
                <div className="ide-vwp-empty-hero-chips">
                  {allSignals.map((signal) => (
                    <span
                      key={signal.name}
                      className={`ide-vwp-empty-chip ide-vwp-empty-chip--${signal.kind}`}
                    >
                      {signal.kind === 'clk' ? '⏱' : signal.kind === 'in' ? '→' : '←'}{' '}
                      <code>{signal.name}</code>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <span className="ide-vwp-empty-hero-signals-label">
                Add circuit inputs and outputs first — then come back to author vectors.
              </span>
            )}
          </div>
        </div>
      ) : (
        /* ── Vectors exist: show lane preview ── */
        <>
          <div className="ide-vwp-summary" data-testid="ide-vwp-header">
            <span className="ide-vwp-observe-chip" data-testid="ide-vwp-observe-chip">
              Observe
            </span>
            <p className="ide-vwp-header-note" data-testid="ide-vwp-header-run-note">
              {runLabel} to populate waveform and observed outputs.
            </p>
            <div className="ide-vwp-header-meta">
              <span className="ide-vwp-header-chip">
                {allSignals.length} lane{allSignals.length === 1 ? '' : 's'}
              </span>
              <span className="ide-vwp-header-chip">
                {isSequential ? 'Sequential lab' : 'Combinational lab'}
              </span>
            </div>
          </div>

          <div className="ide-vwp-lanes" data-testid="ide-vwp-lanes">
            {allSignals.map((signal) => (
              <div key={signal.name} className={`ide-vwp-lane ide-vwp-lane--${signal.kind}`}>
                <span className="ide-vwp-lane-label">
                  <code>{signal.name}</code>
                </span>
                <div className="ide-vwp-lane-trace">
                  <div className="ide-vwp-lane-bar" />
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
