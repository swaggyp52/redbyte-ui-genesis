// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.

import React from 'react';
import { IdeButton } from '../../components/IdePrimitives';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VerifyFirstRunPanelProps {
  /** Whether this circuit uses sequential logic (DFFs, clocking) */
  readonly isSequential: boolean;

  /** Signal summaries for orientation */
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  readonly clockName?: string;

  /** Actions */
  readonly onGenerateStarter: () => void;
  /** @deprecated Run action moved to VerifyCommandBar (ide-vcb-run) — B-13 Phase 2 */
  readonly onRunCircuit?: () => void;
  /** @deprecated Run label moved to VerifyCommandBar — B-13 Phase 2 */
  readonly runLabel?: string;

  /** @deprecated Sequential presets moved to ide-verify-sequential-helper callout — B-13 Phase 2 */
  readonly onAlternatingClock?: () => void;
  readonly onHoldLow?: () => void;
  readonly onHoldHigh?: () => void;
  readonly onSinglePulse?: () => void;

  /** Whether vectors already exist (user already generated) */
  readonly hasVectors: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const VerifyFirstRunPanel: React.FC<VerifyFirstRunPanelProps> = ({
  isSequential,
  inputNames,
  outputNames,
  clockName,
  onGenerateStarter,
  hasVectors,
}) => {
  return (
    <section className="ide-vfr-panel" data-testid="ide-verify-first-run-panel">
      {/* Hero card */}
      <div className="ide-vfr-hero">
        <div className="ide-vfr-hero-icon" aria-hidden="true">
          {isSequential ? '⏱' : '⚡'}
        </div>
        <h3 className="ide-vfr-hero-title" data-testid="ide-vfr-title">
          {isSequential ? 'Test your sequential circuit' : 'Test your circuit'}
        </h3>
        <p className="ide-vfr-hero-desc">
          {isSequential
            ? 'Generate a starter timeline with clock transitions, then run to see how your flip-flops respond over time.'
            : 'Generate starter inputs, run the circuit, and check that outputs match what you expect.'}
        </p>
      </div>

      {/* Signal preview */}
      <div className="ide-vfr-signals" data-testid="ide-vfr-signals">
        {inputNames.length > 0 && (
          <div className="ide-vfr-signal-group">
            <span className="ide-vfr-signal-label">Inputs</span>
            <span className="ide-vfr-signal-list">
              {inputNames.map((name) => (
                <code key={name} className="ide-vfr-signal-chip ide-vfr-signal-chip--in">{name}</code>
              ))}
            </span>
          </div>
        )}
        {outputNames.length > 0 && (
          <div className="ide-vfr-signal-group">
            <span className="ide-vfr-signal-label">Outputs</span>
            <span className="ide-vfr-signal-list">
              {outputNames.map((name) => (
                <code key={name} className="ide-vfr-signal-chip ide-vfr-signal-chip--out">{name}</code>
              ))}
            </span>
          </div>
        )}
        {clockName && (
          <div className="ide-vfr-signal-group">
            <span className="ide-vfr-signal-label">Clock</span>
            <code className="ide-vfr-signal-chip ide-vfr-signal-chip--clk">{clockName}</code>
          </div>
        )}
      </div>

      {/* Primary starter actions */}
      <div className="ide-vfr-actions" data-testid="ide-vfr-actions">
        {!hasVectors ? (
          <>
            <IdeButton
              tone="primary"
              onClick={onGenerateStarter}
              testId="ide-vfr-generate-starter"
            >
              {isSequential ? 'Generate 8-tick starter' : 'Initialize inputs'}
            </IdeButton>
            <span className="ide-vfr-action-hint">
              {isSequential
                ? 'Creates a starter timeline with alternating clock and sensible defaults'
                : 'Sets up input lanes so you can edit values and run immediately'}
            </span>
          </>
        ) : (
          <span className="ide-vfr-action-hint">
            Vectors ready — use Run above to test your circuit
          </span>
        )}
      </div>

      {/* Workflow steps — what happens next */}
      <div className="ide-vfr-steps" data-testid="ide-vfr-steps">
        <div className={`ide-vfr-step${hasVectors ? ' is-done' : ' is-current'}`}>
          <span className="ide-vfr-step-num">{hasVectors ? '✓' : '1'}</span>
          <span className="ide-vfr-step-text">Set up inputs</span>
        </div>
        <div className={`ide-vfr-step${hasVectors ? ' is-current' : ''}`}>
          <span className="ide-vfr-step-num">2</span>
          <span className="ide-vfr-step-text">Run circuit</span>
        </div>
        <div className="ide-vfr-step">
          <span className="ide-vfr-step-num">3</span>
          <span className="ide-vfr-step-text">Check outputs</span>
        </div>
        <div className="ide-vfr-step">
          <span className="ide-vfr-step-num">4</span>
          <span className="ide-vfr-step-text">Save as expected → Compare</span>
        </div>
      </div>
    </section>
  );
};
