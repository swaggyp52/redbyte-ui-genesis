// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.

import React from 'react';
import { useProjectRuntime } from '../../projectRuntime';
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
  readonly onReproduce?: () => void;
  readonly reproduceDisabledReason?: string;
  /** The selected recording's state. It reads in this row, beside the scenario it belongs to. */
  readonly recordingSlot?: React.ReactNode;
  readonly runBlockedReason?: string;
  readonly runLabel: string;
  readonly runDisabled: boolean;
  readonly runPulsing?: boolean;
  /**
   * True when the cases carry no expected outputs. Observe stays primary and runnable in that
   * state - it is the ordinary way to use the instrument, not a deficiency. This only offers the
   * optional route to authoring reference values for a reader who wants a comparison.
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
  onReproduce,
  reproduceDisabledReason,
  recordingSlot,
  runBlockedReason,
  experimentScenarioName,
  runLabel,
  runDisabled,
  runPulsing,
  needsExpectedOutputs,
  onAuthorExpectedOutputs,
  workspaceMode = 'scenario',
  onWorkspaceModeChange,
  configuredCheckCount = 0,
  hasReplay = false,
  liveIoActive = false,
  onToggleLiveIo,
}) => {
  const commandBarRef = React.useRef<HTMLDivElement>(null);
  const status = useProjectRuntime(state => state.verificationExecution.status);
  const message = useProjectRuntime(state => state.verificationExecution.message);
  const cancelExecution = useProjectRuntime(state => state.cancelVerification);
  const computing = ['preparing', 'computing', 'publishing'].includes(status);
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

  const explainerText = runBlockedReason ?? (configuredCheckCount > 0
    ? configuredCheckCount + ' saved checks are evaluated automatically.'
    : 'No checks configured · records outputs without a pass/fail verdict.');
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
      <strong className="rb-sim-scenario-name">{experimentScenarioName || 'Current scenario'}</strong>
      {!recordingSlot && <span className="wb-toolbar-fact" data-testid="ide-vcb-unrecorded">No recording yet</span>}
      {!recordingSlot && <span className="wb-toolbar-fact" data-testid="ide-vcb-check-count" title={explainerText}>{configuredCheckCount} optional checks</span>}
      {recordingSlot}
      {/* Reproduce re-executes this recording's own inputs, so it sits with the recording. Run is
          the one primary action and uses the scenario as it is now. */}
      {onReproduce && !recordingSlot && <details className="rb-sim-recording-actions"><summary>Recording actions</summary><IdeButton tone="secondary" onClick={onReproduce} disabled={runDisabled || Boolean(reproduceDisabledReason)} testId="ide-vcb-reproduce"
        title={reproduceDisabledReason || 'Run this recording\'s own design and stimulus again with the same engine.'}>Reproduce recording</IdeButton></details>}
      <span className="wb-toolbar-spacer" />
      <div className="wb-toolbar-group rb-sim-run" data-testid="ide-vcb-run-authority">
        <IdeButton
          tone="primary"
          onClick={handleRun}
          disabled={runDisabled || computing}
          testId="ide-vcb-run"
          className={`wb-btn wb-btn--primary${runPulsing ? ' is-pulsing' : ''}`}
          hierarchySurface="verify"
          hierarchyRole="next"
        >
          {runLabel}
        </IdeButton>
        {computing ? <IdeButton tone="secondary" testId="ide-verify-cancel-execution" onClick={() => cancelExecution()}>Cancel Run</IdeButton> : null}
      </div>
      {computing || status === 'cancelled' || status === 'error' ? <span role="status" data-testid="ide-verify-execution-status" data-status={status} className="wb-toolbar-meta">
        {computing ? `${status === 'preparing' ? 'Preparing' : status === 'publishing' ? 'Publishing' : 'Computing'} · last recording kept` : message}
      </span> : null}
      <span className={`wb-toolbar-meta rb-sim-explainer${runBlockedReason ? ' is-blocked-reason' : ''}`} hidden={!runBlockedReason} title={explainerText} data-testid="ide-vcb-mode-explainer">{explainerText}</span>
    </div>
  );
};
