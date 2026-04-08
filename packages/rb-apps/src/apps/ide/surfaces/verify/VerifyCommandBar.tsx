// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.

import React from 'react';
import { IdeButton } from '../../components/IdePrimitives';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VerifyCommandBarProps {
  /** Current mode: false = Observe, true = Compare */
  readonly isCompareMode: boolean;
  readonly onSetObserve: () => void;
  readonly onSetCompare: () => void;
  /** Whether Compare mode is available (expected values exist) */
  readonly compareAvailable: boolean;

  /** Run action */
  readonly onRun: () => void;
  readonly runLabel: string;
  readonly runDisabled: boolean;
  readonly runPulsing?: boolean;

  /** Generate / initialize action */
  readonly onGenerate: () => void;
  readonly generateLabel: string;
  readonly showGenerate: boolean;

  /** Save as expected */
  readonly onSaveAsExpected?: () => void;
  readonly showSaveAsExpected: boolean;

  /** Status chip */
  readonly statusLabel: string;
  readonly statusTone: 'ok' | 'warn' | 'error' | 'idle';

  /** Circuit kind for contextual hints */
  readonly isSequential: boolean;

  /** Compact post-run evidence metrics */
  readonly evidenceLabel?: string;
  readonly evidenceTone?: 'pass' | 'fail' | 'idle';
  readonly coverageLabel?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const VerifyCommandBar: React.FC<VerifyCommandBarProps> = ({
  isCompareMode,
  onSetObserve,
  onSetCompare,
  compareAvailable,
  onRun,
  runLabel,
  runDisabled,
  runPulsing,
  onGenerate,
  generateLabel,
  showGenerate,
  onSaveAsExpected,
  showSaveAsExpected,
  statusLabel,
  statusTone,
  isSequential,
  evidenceLabel,
  evidenceTone,
  coverageLabel,
}) => {
  const toneClass =
    statusTone === 'ok' ? 'ide-vcb-status--ok'
    : statusTone === 'error' ? 'ide-vcb-status--error'
    : statusTone === 'warn' ? 'ide-vcb-status--warn'
    : 'ide-vcb-status--idle';

  return (
    <div className="ide-verify-command-bar" data-testid="ide-verify-command-bar">
      {/* Left: mode toggle */}
      <div className="ide-vcb-group ide-vcb-group--mode">
        <div className="ide-vcb-mode-toggle" data-testid="ide-vcb-mode-toggle">
          <button
            type="button"
            className={`ide-vcb-mode-btn${!isCompareMode ? ' is-active' : ''}`}
            onClick={onSetObserve}
            data-testid="ide-vcb-mode-observe"
          >
            Observe
          </button>
          <button
            type="button"
            className={`ide-vcb-mode-btn${isCompareMode ? ' is-active' : ''}`}
            onClick={onSetCompare}
            disabled={!compareAvailable}
            title={
              !compareAvailable
                ? 'Run the circuit first, then save as expected to unlock Compare'
                : 'Compare circuit outputs against expected values'
            }
            data-testid="ide-vcb-mode-compare"
          >
            Compare
          </button>
        </div>
      </div>

      {/* Center: primary actions */}
      <div className="ide-vcb-group ide-vcb-group--actions">
        {showGenerate && (
          <IdeButton
            tone="secondary"
            onClick={onGenerate}
            testId="ide-vcb-generate"
          >
            {generateLabel}
          </IdeButton>
        )}
        <IdeButton
          tone="primary"
          onClick={onRun}
          disabled={runDisabled}
          testId="ide-vcb-run"
          className={runPulsing ? 'is-pulsing' : undefined}
        >
          {runLabel}
        </IdeButton>
        {showSaveAsExpected && onSaveAsExpected && (
          <IdeButton
            tone="secondary"
            onClick={onSaveAsExpected}
            testId="ide-vcb-save-expected"
          >
            Save as expected
          </IdeButton>
        )}
      </div>

      {/* Right: status + evidence */}
      <div className="ide-vcb-group ide-vcb-group--status">
        <span className={`ide-vcb-status ${toneClass}`} data-testid="ide-vcb-status">
          {statusLabel}
        </span>
        {evidenceLabel && (
          <span
            className={`ide-vcb-evidence ide-vcb-evidence--${evidenceTone ?? 'idle'}`}
            data-testid="ide-vcb-evidence"
          >
            {evidenceLabel}
          </span>
        )}
        {coverageLabel && (
          <span className="ide-vcb-coverage" data-testid="ide-vcb-coverage">
            {coverageLabel}
          </span>
        )}
        {isSequential && (
          <span className="ide-vcb-seq-chip" data-testid="ide-vcb-seq-chip">
            Sequential
          </span>
        )}
      </div>
    </div>
  );
};
