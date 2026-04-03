// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.

import React from 'react';
import { IdeButton } from '../../components/IdePrimitives';

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
  readonly onRun: () => void;
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
  onRun,
  hasVectors,
  runLabel,
}) => {
  const allSignals = [
    ...(clockName ? [{ name: clockName, kind: 'clk' as const }] : []),
    ...inputNames.map((n) => ({ name: n, kind: 'in' as const })),
    ...outputNames.map((n) => ({ name: n, kind: 'out' as const })),
  ];

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
              ? 'Waveform will appear here after running'
              : isSequential
                ? 'Generate a starter timeline to see waveforms'
                : 'Initialize inputs to see waveforms'}
          </p>
          {hasVectors ? (
            <IdeButton tone="primary" onClick={onRun} testId="ide-vwp-run">
              {runLabel}
            </IdeButton>
          ) : (
            <IdeButton tone="primary" onClick={onGenerate} testId="ide-vwp-generate">
              {isSequential ? 'Generate starter' : 'Initialize inputs'}
            </IdeButton>
          )}
        </div>
      </div>
    </div>
  );
};
