// Copyright (c) 2025 Connor Angiel - RedByte
// Verify surface primitives: context header, results summary.
// Each component is a focused presentational primitive with no IO.
// Wiring/derivation lives in VerifySurface.tsx.

import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// VerifyContextHeader
// One slim header that answers: project, board, state, mode, next action.
// Sits above VerifyCommandBar so the user can read context at a glance before
// they look at run controls or stimulus.
// ─────────────────────────────────────────────────────────────────────────────

export type VerifyStateTone = 'idle' | 'running' | 'pass' | 'fail' | 'stale' | 'attention';

export interface VerifyContextHeaderProps {
  readonly projectName: string;
  readonly board: string;
  /** Compact verify-state label (e.g. "Not run", "Observe done", "Pass", "Stale"). */
  readonly stateLabel: string;
  readonly stateTone: VerifyStateTone;
  /** Mode label: "Observe only" or "Compare checks". */
  readonly modeLabel: string;
  /** One-line "what to do next" hint. */
  readonly nextActionHint?: string;
  /** Optional scenario/case name shown alongside the project. */
  readonly scenarioName?: string | null;
}

const STATE_TONE_CLASS: Record<VerifyStateTone, string> = {
  idle: 'is-idle',
  running: 'is-running',
  pass: 'is-pass',
  fail: 'is-fail',
  stale: 'is-stale',
  attention: 'is-attention',
};

export const VerifyContextHeader: React.FC<VerifyContextHeaderProps> = ({
  projectName,
  board,
  stateLabel,
  stateTone,
  modeLabel,
  nextActionHint,
  scenarioName,
}) => {
  return (
    <header
      className="ide-verify-context-header"
      data-testid="ide-verify-context-header"
    >
      <div className="ide-verify-context-identity">
        <span
          className="ide-verify-context-project"
          data-testid="ide-verify-context-project"
          title={projectName}
        >
          {projectName}
        </span>
        <span className="ide-verify-context-sep" aria-hidden="true">/</span>
        <span
          className="ide-verify-context-board"
          data-testid="ide-verify-context-board"
        >
          {board}
        </span>
        {scenarioName ? (
          <>
            <span className="ide-verify-context-sep" aria-hidden="true">/</span>
            <span
              className="ide-verify-context-scenario"
              data-testid="ide-verify-context-scenario"
            >
              {scenarioName}
            </span>
          </>
        ) : null}
      </div>
      <div className="ide-verify-context-meta">
        <span
          className={`ide-verify-context-state ${STATE_TONE_CLASS[stateTone]}`}
          data-testid="ide-verify-context-state"
          data-tone={stateTone}
        >
          <span className="ide-verify-context-state-dot" aria-hidden="true" />
          {stateLabel}
        </span>
        <span
          className="ide-verify-context-mode"
          data-testid="ide-verify-context-mode"
        >
          {modeLabel}
        </span>
        {nextActionHint ? (
          <span
            className="ide-verify-context-next"
            data-testid="ide-verify-context-next"
          >
            {nextActionHint}
          </span>
        ) : null}
      </div>
    </header>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VerifyResultsSummary
// Slim post-run summary card surfaced at the top of the waveform/results
// region. Answers "what happened in the last run?" without forcing the user
// to scan the oscilloscope or open the analysis drawer.
// ─────────────────────────────────────────────────────────────────────────────

export type VerifyResultsKind =
  | 'not-run'
  | 'running'
  | 'observe-done'
  | 'pass'
  | 'fail'
  | 'stale'
  | 'error';

export interface VerifyResultsMetric {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly tone?: 'neutral' | 'ok' | 'attention' | 'blocked';
}

export interface VerifyResultsSummaryProps {
  readonly kind: VerifyResultsKind;
  /** Compact one-liner ("Checks aligned", "1 check failed at t=3", …). */
  readonly headline: string;
  /** Additional one-line context (e.g. when the run happened, scenario name). */
  readonly subline?: string;
  /** Optional metrics row: passed/failed/coverage etc. */
  readonly metrics?: readonly VerifyResultsMetric[];
  /** Optional primary follow-up action ("Open mismatch", "Re-run Verify"). */
  readonly primaryActionLabel?: string;
  readonly onPrimaryAction?: () => void;
  readonly primaryActionTestId?: string;
  /** Optional ghost secondary action. */
  readonly secondaryActionLabel?: string;
  readonly onSecondaryAction?: () => void;
  readonly secondaryActionTestId?: string;
}

const RESULT_KIND_LABEL: Record<VerifyResultsKind, string> = {
  'not-run': 'Not run',
  running: 'Running',
  'observe-done': 'Observation only',
  pass: 'Pass',
  fail: 'Fail',
  stale: 'Stale',
  error: 'Error',
};

const RESULT_KIND_TONE: Record<VerifyResultsKind, VerifyStateTone> = {
  'not-run': 'idle',
  running: 'running',
  'observe-done': 'idle',
  pass: 'pass',
  fail: 'fail',
  stale: 'stale',
  error: 'attention',
};

export const VerifyResultsSummary: React.FC<VerifyResultsSummaryProps> = ({
  kind,
  headline,
  subline,
  metrics,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionTestId,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionTestId,
}) => {
  const tone = RESULT_KIND_TONE[kind];
  return (
    <section
      className={`ide-verify-results-summary ${STATE_TONE_CLASS[tone]}`}
      data-testid="ide-verify-results-summary"
      data-kind={kind}
    >
      <div className="ide-verify-results-summary-main">
        <span
          className="ide-verify-results-summary-state"
          data-testid="ide-verify-results-summary-state"
        >
          <span className="ide-verify-results-summary-dot" aria-hidden="true" />
          {RESULT_KIND_LABEL[kind]}
        </span>
        <span
          className="ide-verify-results-summary-headline"
          data-testid="ide-verify-results-summary-headline"
        >
          {headline}
        </span>
        {subline ? (
          <span
            className="ide-verify-results-summary-subline"
            data-testid="ide-verify-results-summary-subline"
          >
            {subline}
          </span>
        ) : null}
      </div>
      {metrics && metrics.length > 0 ? (
        <ul
          className="ide-verify-results-summary-metrics"
          data-testid="ide-verify-results-summary-metrics"
          aria-label="Run metrics"
        >
          {metrics.map((metric) => (
            <li
              key={metric.id}
              className={`ide-verify-results-summary-metric is-${metric.tone ?? 'neutral'}`}
              data-testid={`ide-verify-results-summary-metric-${metric.id}`}
            >
              <span className="ide-verify-results-summary-metric-label">{metric.label}</span>
              <span className="ide-verify-results-summary-metric-value">{metric.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {(primaryActionLabel && onPrimaryAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <div className="ide-verify-results-summary-actions">
          {primaryActionLabel && onPrimaryAction ? (
            <button
              type="button"
              className="ide-verify-results-summary-action is-primary"
              onClick={onPrimaryAction}
              data-testid={primaryActionTestId ?? 'ide-verify-results-summary-primary'}
            >
              {primaryActionLabel}
            </button>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <button
              type="button"
              className="ide-verify-results-summary-action is-ghost"
              onClick={onSecondaryAction}
              data-testid={secondaryActionTestId ?? 'ide-verify-results-summary-secondary'}
            >
              {secondaryActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
