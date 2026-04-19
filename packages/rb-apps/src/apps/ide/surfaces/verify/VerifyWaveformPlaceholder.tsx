// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.

import React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VerifyWaveformPlaceholderProps {
  /** Signal names to show as scaffold lines */
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  readonly clockName?: string;

  /** Whether the circuit is sequential */
  readonly isSequential: boolean;

  /** Call-to-action */
  readonly onGenerate: () => void;
  readonly hasVectors: boolean;
  readonly runLabel: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const VerifyWaveformPlaceholder: React.FC<VerifyWaveformPlaceholderProps> = ({
  inputNames,
  outputNames,
  clockName,
  isSequential,
  onGenerate,
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
    <div className="ide-vwp" data-testid="ide-verify-waveform-placeholder">
      {/* Scaffold signal lanes */}
      <div className="ide-vwp-lanes" data-testid="ide-vwp-lanes">
        {allSignals.length > 0 ? (
          allSignals.map((sig) => (
            <div key={sig.name} className={`ide-vwp-lane ide-vwp-lane--${sig.kind}`}>
              <span className="ide-vwp-lane-label">
                <code>{sig.name}</code>
              </span>
              <div className="ide-vwp-lane-trace">
                {/* Placeholder trace line */}
                <div className="ide-vwp-lane-bar" />
              </div>
            </div>
          ))
        ) : (
          <div className="ide-vwp-lane ide-vwp-lane--empty">
            <span className="ide-vwp-lane-label">No signals detected</span>
          </div>
        )}
      </div>

      {/* Overlay CTA */}
      <div className="ide-vwp-overlay" data-testid="ide-vwp-overlay">
        <div className="ide-vwp-overlay-content">
          <span className="ide-vwp-overlay-icon" aria-hidden="true">
            {isSequential ? '📊' : '📈'}
          </span>
          <p className="ide-vwp-overlay-text">
            {hasVectors
              ? `Author stimulus on the left, then use ${runLabel} to observe outputs here`
              : isSequential
                ? 'Generate starter stimulus to begin the timeline'
                : 'Seed stimulus to begin the waveform'}
          </p>
          {hasVectors && (
            <p className="ide-vwp-overlay-note" data-testid="ide-vwp-header-run-note">
              The header {runLabel} control is the main run action for this workspace.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
