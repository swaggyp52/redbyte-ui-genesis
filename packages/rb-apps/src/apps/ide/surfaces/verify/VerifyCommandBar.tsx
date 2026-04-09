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

  /** Secondary analysis controls */
  readonly showAnalysisToggle?: boolean;
  readonly analysisOpen?: boolean;
  readonly analysisHint?: string;
  readonly onToggleAnalysis?: () => void;

  /** Direct Verify recovery action */
  readonly showEditCases?: boolean;
  readonly onEditCases?: () => void;

  /** Verify → Design continuity bridge */
  readonly showGoToDesign?: boolean;
  readonly onGoToDesign?: () => void;
  /** Selected tick whose inputs will be injected when opening Design */
  readonly goToDesignTick?: number | null;
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
  showAnalysisToggle,
  analysisOpen,
  analysisHint,
  onToggleAnalysis,
  showEditCases,
  onEditCases,
  showGoToDesign,
  onGoToDesign,
  goToDesignTick,
}) => {
  const toneClass =
    statusTone === 'ok' ? 'ide-vcb-status--ok'
    : statusTone === 'error' ? 'ide-vcb-status--error'
    : statusTone === 'warn' ? 'ide-vcb-status--warn'
    : 'ide-vcb-status--idle';

  return (
    <div className="ide-verify-command-bar" data-testid="ide-verify-command-bar">
      {/* Left: primary loop actions — Run is the first visible control */}
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
      </div>

      {/* Center: mode toggle — secondary context, rarely changes mid-session */}
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
                ? 'Run the stimulus first, then save observed outputs as checks to unlock Compare'
                : 'Compare observed outputs against saved checks'
            }
            data-testid="ide-vcb-mode-compare"
          >
            Check outputs
          </button>
        </div>
      </div>

      {/* Right: status chips + utility actions (ghost weight) */}
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
        {showEditCases && onEditCases && (
          <IdeButton
            tone="ghost"
            onClick={onEditCases}
            testId="ide-verify-run-proof-edit-vectors"
          >
            Edit checks
          </IdeButton>
        )}
        {showAnalysisToggle && onToggleAnalysis && (
          <button
            type="button"
            className={`ide-vcb-analysis-toggle${analysisOpen ? ' is-open' : ''}`}
            onClick={onToggleAnalysis}
            data-testid="ide-verify-drawer-toggle"
            aria-expanded={analysisOpen ? 'true' : 'false'}
          >
            <span className="ide-vcb-analysis-label">
              {analysisOpen ? 'Hide analysis' : 'Analysis'}
            </span>
            {!analysisOpen && analysisHint && (
              <span
                className="ide-vcb-analysis-hint"
                data-testid="ide-verify-drawer-hint"
              >
                {analysisHint}
              </span>
            )}
          </button>
        )}
        {showSaveAsExpected && onSaveAsExpected && (
          <IdeButton
            tone="ghost"
            onClick={onSaveAsExpected}
            testId="ide-vcb-save-expected"
          >
            Save observed as checks
          </IdeButton>
        )}
        {showGoToDesign && onGoToDesign && (
          <span className="ide-vcb-design-bridge">
            {goToDesignTick != null && (
              <span
                className="ide-vcb-design-tick-chip"
                data-testid="ide-vcb-design-tick-chip"
                title={`Open Design with inputs from tick t${goToDesignTick}`}
              >
                t{goToDesignTick}
              </span>
            )}
            <IdeButton
              tone="ghost"
              onClick={onGoToDesign}
              testId="ide-verify-inspect-design"
            >
              Open in Design
            </IdeButton>
          </span>
        )}
      </div>
    </div>
  );
};
