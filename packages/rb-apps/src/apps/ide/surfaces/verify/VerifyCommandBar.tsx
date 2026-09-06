// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.

import React from 'react';
import { IdeButton } from '../../components/IdePrimitives';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VerifyCommandBarProps {
  /** Current mode: false = stimulus tracing, true = assertion verification */
  readonly isCompareMode: boolean;
  readonly onSetObserve: () => void;
  readonly onSetCompare: () => void;
  /** Whether assertion verification is available (expected values exist) */
  readonly compareAvailable: boolean;
  readonly compareUnavailableReason?: string;

  /** Run action */
  readonly onRun: () => void;
  readonly runLabel: string;
  readonly runDisabled: boolean;
  readonly runPulsing?: boolean;
  /**
   * When cases exist without saved checks, authoring expected outputs becomes
   * the primary task while Observe remains available as a secondary run.
   */
  readonly needsExpectedOutputs?: boolean;
  readonly onAuthorExpectedOutputs?: () => void;

  /** @deprecated Generation now belongs to the empty testbench editor. */
  readonly onGenerate?: () => void;
  readonly generateLabel?: string;
  readonly showGenerate?: boolean;

  /** Save as expected */
  readonly onSaveAsExpected?: () => void;
  readonly showSaveAsExpected?: boolean;

  /** Status chip */
  readonly statusLabel?: string;
  readonly statusTone?: 'ok' | 'warn' | 'error' | 'idle';
  readonly sessionStatusBadge?: string;
  readonly sessionModeLabel?: string;
  readonly sessionTitle?: string;
  readonly referenceModeLabel?: string;
  readonly primaryStatusTitle?: string;
  readonly primaryStatusMessage?: string;
  readonly compactStatusActionLabel?: string;
  readonly compactStatusActionTone?: 'primary' | 'secondary' | 'ghost';
  readonly compactStatusActionTestId?: string;
  readonly onCompactStatusAction?: () => void;

  /** Circuit kind for contextual hints */
  readonly isSequential?: boolean;

  /** Compact post-run evidence metrics */
  readonly evidenceLabel?: string;
  readonly evidenceTone?: 'pass' | 'fail' | 'idle';
  readonly coverageLabel?: string;
  /** When inline, evidence + coverage sit in a slim row under the chip (hidden keeps the header calmer). */
  readonly sessionMetricsRow?: 'hidden' | 'inline';

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

  /** Prominent experiment context (scenario library / runtime name — no invented labels) */
  readonly experimentScenarioName?: string | null;
  /** Selected stimulus case, e.g. "Case t3" or "No case selected" */
  readonly experimentCaseLabel?: string | null;
  /** Timing / lab mode line (e.g. sequential vs manual-event lab) */
  readonly experimentTimingHint?: string | null;

  /** Optional authority / recovery callout rendered above the tool row inside one chrome card */
  readonly leadingPanel?: React.ReactNode;
  /**
   * Compare-failure: one line students can read before opening the details drawer
   * (first recovery move + where detail lives).
   */
  readonly failureRecoveryLine?: string;
  readonly workspaceMode?: 'scenario' | 'bench' | 'replay' | 'checks' | 'testbench';
  readonly onWorkspaceModeChange?: (
    mode: 'scenario' | 'bench' | 'replay' | 'checks' | 'testbench'
  ) => void;
  readonly configuredCheckCount?: number;
  readonly hasReplay?: boolean;
  /** Live I/O (drive inputs, read outputs) is a toggle over the current document. */
  readonly liveIoActive?: boolean;
  readonly onToggleLiveIo?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const VerifyCommandBar: React.FC<VerifyCommandBarProps> = ({
  isCompareMode,
  onSetObserve,
  onSetCompare,
  compareAvailable,
  compareUnavailableReason,
  onRun,
  runLabel,
  runDisabled,
  runPulsing,
  workspaceMode = 'scenario',
  onWorkspaceModeChange,
  configuredCheckCount = 0,
  hasReplay = false,
  liveIoActive = false,
  onToggleLiveIo,
}) => {
  const commandBarRef = React.useRef<HTMLDivElement>(null);
  const restoreRunFocusRef = React.useRef(false);

  React.useEffect(() => {
    if (!runDisabled || !restoreRunFocusRef.current) return;

    const handleFocusIn = (event: FocusEvent) => {
      const runButton = commandBarRef.current?.querySelector<HTMLButtonElement>(
        '[data-testid="ide-vcb-run"]'
      );
      if (
        event.target !== runButton &&
        event.target !== document.body &&
        event.target !== document.documentElement
      ) {
        restoreRunFocusRef.current = false;
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [runDisabled]);

  React.useEffect(() => {
    if (runDisabled || !restoreRunFocusRef.current) return;

    const canRestoreRunFocus = () => {
      const runButton = commandBarRef.current?.querySelector<HTMLButtonElement>(
        '[data-testid="ide-vcb-run"]'
      );
      const activeElement = document.activeElement;
      return (
        runButton != null &&
        (activeElement === runButton ||
          activeElement === document.body ||
          activeElement === document.documentElement)
      );
    };

    if (!canRestoreRunFocus()) {
      restoreRunFocusRef.current = false;
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (restoreRunFocusRef.current && canRestoreRunFocus()) {
        commandBarRef.current
          ?.querySelector<HTMLButtonElement>('[data-testid="ide-vcb-run"]')
          ?.focus();
      }
      restoreRunFocusRef.current = false;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [runDisabled]);

  const handleRun = () => {
    restoreRunFocusRef.current =
      document.activeElement?.getAttribute('data-testid') === 'ide-vcb-run';
    onRun();
  };

  return (
    <div
      ref={commandBarRef}
      className="wb-toolbar rb-sim-toolbar"
      data-testid="ide-verify-command-bar"
      data-run-mode="simulation"
      data-workspace-mode={workspaceMode}
      data-hierarchy-surface="verify"
      data-hierarchy-role="primary"
    >
      <div className="wb-segment rb-sim-seg" role="group" aria-label="Run intent" data-testid="ide-vcb-run-intent">
        <button
          type="button"
          className={`wb-btn${!isCompareMode ? ' is-active' : ''}`}
          aria-pressed={!isCompareMode}
          onClick={onSetObserve}
          data-testid="ide-vcb-observe-only"
          title="Run the circuit and record observed outputs. No checks are graded."
        >
          Observe
        </button>
        <button
          type="button"
          className={`wb-btn${isCompareMode ? ' is-active' : ''}${!compareAvailable ? ' is-blocked' : ''}`}
          aria-pressed={isCompareMode}
          disabled={!compareAvailable}
          onClick={onSetCompare}
          data-testid="ide-vcb-use-saved-checks"
          data-blocked={!compareAvailable ? 'true' : undefined}
          title={
            !compareAvailable
              ? compareUnavailableReason ?? 'Author at least one expected output to compare against.'
              : 'Run the circuit and compare observed outputs against your saved checks.'
          }
        >
          Compare
        </button>
      </div>
      <span className="wb-toolbar-sep" />
      {onToggleLiveIo ? (
        <button
          type="button"
          className={`wb-btn wb-btn--ghost${liveIoActive ? ' is-active' : ''}`}
          aria-pressed={liveIoActive}
          onClick={onToggleLiveIo}
          data-testid="ide-vcb-workspace-bench"
          title="Drive inputs and read outputs live — the same state as the simulated board."
        >
          Live I/O
        </button>
      ) : null}
      {configuredCheckCount > 0 ? (
        <span className="wb-toolbar-fact" data-testid="ide-vcb-check-count" title="Saved expected outputs in this scenario">
          <code>{configuredCheckCount}</code> checks
        </span>
      ) : null}
      <span className="wb-toolbar-spacer" />
      <div className="wb-toolbar-group rb-sim-run" data-testid="ide-vcb-run-authority">
        <IdeButton
          tone="primary"
          onClick={handleRun}
          disabled={runDisabled}
          testId="ide-vcb-run"
          className={`wb-btn wb-btn--primary${runPulsing ? ' is-pulsing' : ''}`}
          hierarchySurface="verify"
          hierarchyRole="next"
        >
          {runLabel}
        </IdeButton>
      </div>
      {/* A disabled control whose only explanation is a `title` explains nothing: the tooltip
          is hidden until hover and browsers do not reliably show one on a disabled button.
          When Compare is blocked, the reason takes the explainer slot. */}
      <span
        className={`wb-toolbar-meta rb-sim-explainer${!compareAvailable && compareUnavailableReason ? ' is-blocked-reason' : ''}`}
        data-testid="ide-vcb-mode-explainer"
        title={
          !compareAvailable && compareUnavailableReason
            ? compareUnavailableReason
            : isCompareMode
              ? 'Check filled expected outputs against this run.'
              : 'Record observed outputs without grading expected values.'
        }
      >
        {!compareAvailable && compareUnavailableReason
          ? compareUnavailableReason
          : isCompareMode
            ? 'Check filled expected outputs against this run.'
            : 'Record observed outputs without grading expected values.'}
      </span>
    </div>
  );
};
