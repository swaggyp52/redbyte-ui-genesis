// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.

import React from 'react';
import { IdeButton } from '../../components/IdePrimitives';

function experimentCaseEmphasisClass(label: string): string {
  return /no case/i.test(label) ? ' is-idle' : ' is-locus';
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VerifyCommandBarProps {
  /** Current mode: false = stimulus tracing, true = assertion verification */
  readonly isCompareMode: boolean;
  readonly onSetObserve: () => void;
  readonly onSetCompare: () => void;
  /** Whether assertion verification is available (expected values exist) */
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
  readonly sessionStatusBadge?: string;
  readonly sessionModeLabel?: string;
  readonly sessionTitle?: string;
  readonly referenceModeLabel?: string;
  readonly primaryStatusTitle?: string;
  readonly primaryStatusMessage?: string;

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

  /** Prominent experiment context (scenario library / runtime name — no invented labels) */
  readonly experimentScenarioName?: string | null;
  /** Selected stimulus case, e.g. "Case t3" or "No case selected" */
  readonly experimentCaseLabel?: string | null;
  /** Timing / lab mode line (e.g. sequential vs manual-event lab) */
  readonly experimentTimingHint?: string | null;

  /** Optional authority / recovery callout rendered above the tool row inside one chrome card */
  readonly leadingPanel?: React.ReactNode;
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
  sessionStatusBadge,
  sessionModeLabel,
  sessionTitle,
  referenceModeLabel,
  primaryStatusTitle,
  primaryStatusMessage,
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
  experimentScenarioName,
  experimentCaseLabel,
  experimentTimingHint,
  leadingPanel,
}) => {
  const hasUtilityActions = Boolean(
    (showEditCases && onEditCases) || (showSaveAsExpected && onSaveAsExpected)
  );
  const [utilitiesOpen, setUtilitiesOpen] = React.useState(false);

  React.useEffect(() => {
    if (!hasUtilityActions) {
      setUtilitiesOpen(false);
    }
  }, [hasUtilityActions]);

  const toneClass =
    statusTone === 'ok' ? 'ide-vcb-status--ok'
    : statusTone === 'error' ? 'ide-vcb-status--error'
    : statusTone === 'warn' ? 'ide-vcb-status--warn'
    : 'ide-vcb-status--idle';
  const sessionCoverageLabel = [
    coverageLabel,
    isSequential ? 'Sequential' : null,
  ].filter(Boolean).join(' · ');
  const sessionMetaParts = [
    sessionStatusBadge ? (
      <span key="status" data-testid="ide-verify-session-status">
        {sessionStatusBadge}
      </span>
    ) : null,
    sessionModeLabel ? (
      <span key="mode" data-testid="ide-verify-session-mode">
        {sessionModeLabel}
      </span>
    ) : null,
    primaryStatusTitle ? (
      <span key="primary-status" data-testid="ide-verify-primary-status" title={primaryStatusMessage}>
        {primaryStatusTitle}
      </span>
    ) : null,
  ].filter(Boolean);
  const sessionSummaryParts = [
    sessionTitle ? (
      <span key="title" className="ide-vcb-session-title" data-testid="ide-verify-session-title">
        {sessionTitle}
      </span>
    ) : null,
    referenceModeLabel ? (
      <span key="reference" className="ide-vcb-reference-mode" data-testid="ide-verify-reference-mode">
        {referenceModeLabel}
      </span>
    ) : null,
    evidenceLabel ? (
      <span
        key="evidence"
        className={`ide-vcb-evidence ide-vcb-evidence--${evidenceTone ?? 'idle'}`}
        data-testid="ide-vcb-evidence"
      >
        {evidenceLabel}
      </span>
    ) : null,
    sessionCoverageLabel ? (
      <span key="coverage" className="ide-vcb-coverage" data-testid="ide-vcb-coverage">
        {sessionCoverageLabel}
      </span>
    ) : null,
  ].filter(Boolean);

  const interleaveWithSeparators = (nodes: React.ReactNode[], separatorClassName: string) =>
    nodes.flatMap((node, index) =>
      index === 0
        ? [node]
        : [
            <span
              key={`${separatorClassName}-${index}`}
              className={separatorClassName}
              aria-hidden="true"
            >
              ·
            </span>,
            node,
          ]
    );

  const scenarioHeadline =
    experimentScenarioName != null && experimentScenarioName.trim() !== ''
      ? experimentScenarioName.trim()
      : null;
  const showExperimentRail =
    scenarioHeadline != null ||
    experimentCaseLabel != null ||
    (experimentTimingHint != null && experimentTimingHint.trim() !== '');

  return (
    <div
      className={`ide-verify-command-bar${leadingPanel ? ' ide-verify-command-bar--with-leading' : ''}`}
      data-testid="ide-verify-command-bar"
    >
      {leadingPanel ? <div className="ide-vcb-leading-slot">{leadingPanel}</div> : null}
      <div className="ide-vcb-row ide-vcb-row--primary">
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

        {/* Procedure lens toggle — secondary to Run */}
        <div className="ide-vcb-group ide-vcb-group--mode">
          <span className="ide-vcb-mode-label">Procedure lens</span>
          <div className="ide-vcb-mode-toggle" data-testid="ide-vcb-mode-toggle">
            <button
              type="button"
              className={`ide-vcb-mode-btn${!isCompareMode ? ' is-active' : ''}`}
              onClick={onSetObserve}
              data-testid="ide-vcb-mode-observe"
            >
              Stimulus
            </button>
            <button
              type="button"
              className={`ide-vcb-mode-btn${isCompareMode ? ' is-active' : ''}`}
              onClick={onSetCompare}
              disabled={!compareAvailable}
              title={
                !compareAvailable
                  ? 'Run stimulus first, then save assertions to enable assertion verification'
                  : 'Verify assertions against observed waveform evidence'
              }
              data-testid="ide-vcb-mode-compare"
            >
              Assertions
            </button>
          </div>
        </div>

        {showExperimentRail ? (
          <div className="ide-vcb-experiment" data-testid="ide-vcb-experiment-context">
            <span className="ide-vcb-experiment-eyebrow">Experiment</span>
            <div className="ide-vcb-experiment-body">
              {scenarioHeadline ? (
                <span className="ide-vcb-experiment-scenario" data-testid="ide-vcb-experiment-scenario">
                  {scenarioHeadline}
                </span>
              ) : null}
              {experimentCaseLabel != null ? (
                <span
                  className={`ide-vcb-experiment-case${experimentCaseEmphasisClass(experimentCaseLabel)}`}
                  data-testid="ide-vcb-experiment-case"
                >
                  {experimentCaseLabel}
                </span>
              ) : null}
              {experimentTimingHint != null && experimentTimingHint.trim() !== '' ? (
                <span className="ide-vcb-experiment-timing" data-testid="ide-vcb-experiment-timing">
                  {experimentTimingHint.trim()}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Session truth + evidence (single strip, same row as procedure controls) */}
        <div className="ide-vcb-truth-strip" data-testid="ide-vcb-session-summary">
          <span data-testid="ide-verify-summary-status">
            <span className={`ide-vcb-status ${toneClass}`} data-testid="ide-vcb-status">
              {statusLabel}
            </span>
          </span>
          {(sessionMetaParts.length > 0 || sessionSummaryParts.length > 0) && (
            <div className="ide-vcb-session-copy">
              {sessionMetaParts.length > 0 && (
                <span
                  className="ide-vcb-session-line ide-vcb-session-line--meta"
                  data-testid="ide-verify-session-meta"
                >
                  {interleaveWithSeparators(sessionMetaParts, 'ide-vcb-session-sep')}
                </span>
              )}
              {sessionSummaryParts.length > 0 && (
                <span className="ide-vcb-session-line ide-vcb-session-line--summary">
                  {interleaveWithSeparators(sessionSummaryParts, 'ide-vcb-session-sep ide-vcb-session-sep--muted')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: utility actions (ghost weight) */}
        <div className="ide-vcb-group ide-vcb-group--status">
        {hasUtilityActions && (
          <div className="ide-vcb-utilities">
            <button
              type="button"
              className={`ide-vcb-utilities-toggle${utilitiesOpen ? ' is-open' : ''}`}
              onClick={() => setUtilitiesOpen((open) => !open)}
              data-testid="ide-vcb-utilities-toggle"
              aria-expanded={utilitiesOpen ? 'true' : 'false'}
            >
              More actions
            </button>
            {utilitiesOpen && (
              <div className="ide-vcb-utilities-panel" data-testid="ide-vcb-utilities-panel">
                {showEditCases && onEditCases && (
                  <IdeButton
                    tone="ghost"
                    onClick={() => {
                      onEditCases();
                      setUtilitiesOpen(false);
                    }}
                    testId="ide-verify-run-proof-edit-vectors"
                  >
                    Edit assertions
                  </IdeButton>
                )}
                {showSaveAsExpected && onSaveAsExpected && (
                  <IdeButton
                    tone="ghost"
                    onClick={() => {
                      onSaveAsExpected();
                      setUtilitiesOpen(false);
                    }}
                    testId="ide-vcb-save-expected"
                  >
                    Save assertions
                  </IdeButton>
                )}
              </div>
            )}
          </div>
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
        {showGoToDesign && onGoToDesign && (
          <span className="ide-vcb-design-bridge">
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
    </div>
  );
};
