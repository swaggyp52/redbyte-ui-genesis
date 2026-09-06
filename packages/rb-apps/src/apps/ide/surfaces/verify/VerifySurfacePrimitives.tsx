// Copyright (c) 2025 Connor Angiel - RedByte
// Verify surface primitives: context header, results summary.
// Each component is a focused presentational primitive with no IO.
// Wiring/derivation lives in VerifySurface.tsx.

import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// VerifyContextHeader
// One slim header that answers: project/scenario and current verification state.
// Sits above VerifyCommandBar so the user can read context at a glance before
// they look at run controls or stimulus.
// ─────────────────────────────────────────────────────────────────────────────

export type VerifyStateTone = 'idle' | 'running' | 'pass' | 'fail' | 'stale' | 'attention';

export interface VerifyContextHeaderProps {
  readonly projectName: string;
  /** Semantic verify-state label (e.g. "Not started", "Observation only", "Checks aligned", "Stale"). */
  readonly stateLabel: string;
  readonly stateTone: VerifyStateTone;
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
  stateLabel,
  stateTone,
  scenarioName,
}) => {
  return (
    <header
      className="ide-verify-context-header ide-verify-job-header"
      data-testid="ide-verify-context-header"
    >
      <div className="ide-verify-context-details" aria-label="Simulation session context">
        <div className="ide-verify-context-identity">
          <span className="ide-verify-context-label">Active scenario</span>
          <span
            className="ide-verify-context-project"
            data-testid="ide-verify-context-project"
            title={projectName}
          >
            {projectName}
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
            <span data-testid="ide-verify-summary-status">{stateLabel}</span>
          </span>
        </div>
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
  readonly tone?: 'neutral' | 'ok' | 'attention' | 'blocked' | 'quiet';
}

export interface VerifyResultsSummaryProps {
  readonly kind: VerifyResultsKind;
  /** Compact one-liner ("Checks aligned", "1 check failed at t=3", …). */
  readonly headline: string;
  /** Additional one-line context (e.g. when the run happened, scenario name). */
  readonly subline?: string;
  /** Plain-language causes or checks that should remain visible in the normal result state. */
  readonly guidanceItems?: readonly string[];
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
  'observe-done': 'Simulated',
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
  guidanceItems,
  metrics,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionTestId,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionTestId,
}) => {
  const tone = RESULT_KIND_TONE[kind];
  const summary = (
    <section
      className={`rb-wave-results-summary ${STATE_TONE_CLASS[tone]}`}
      data-testid="ide-verify-results-summary"
      data-kind={kind}
    >
      <div className="rb-wave-results-summary-main">
        <span
          className="rb-wave-results-summary-state"
          data-testid="ide-verify-results-summary-state"
        >
          <span className="rb-wave-results-summary-dot" aria-hidden="true" />
          {RESULT_KIND_LABEL[kind]}
        </span>
        <span
          className="rb-wave-results-summary-headline"
          data-testid="ide-verify-results-summary-headline"
        >
          {kind === 'pass' ? <span data-testid="ide-verify-pass-hero-title">{headline}</span> : headline}
        </span>
        {subline ? (
          <span
            className="rb-wave-results-summary-subline"
            data-testid="ide-verify-results-summary-subline"
          >
            {kind === 'pass' ? <span data-testid="ide-verify-pass-hero-meta">{subline}</span> : subline}
          </span>
        ) : null}
        {guidanceItems && guidanceItems.length > 0 ? (
          <ol className="rb-wave-results-guidance" data-testid="ide-verify-results-guidance">
            {guidanceItems.map((item) => <li key={item}>{item}</li>)}
          </ol>
        ) : null}
      </div>
      {metrics && metrics.length > 0 ? (
        <ul
          className="rb-wave-results-summary-metrics"
          data-testid="ide-verify-results-summary-metrics"
          aria-label="Run metrics"
        >
          {metrics.map((metric) => (
            <li
              key={metric.id}
              className={`rb-wave-results-summary-metric is-${metric.tone ?? 'neutral'}`}
              data-testid={`ide-verify-results-summary-metric-${metric.id}`}
            >
              <span className="rb-wave-results-summary-metric-label">{metric.label}</span>
              <span className="rb-wave-results-summary-metric-value">{metric.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {(primaryActionLabel && onPrimaryAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <div className="rb-wave-results-summary-actions">
          {primaryActionLabel && onPrimaryAction ? (
            <button
              type="button"
              className="rb-wave-results-summary-action is-ghost"
              onClick={onPrimaryAction}
              data-testid={primaryActionTestId ?? 'ide-verify-results-summary-primary'}
            >
              {primaryActionLabel}
            </button>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <button
              type="button"
              className="rb-wave-results-summary-action is-ghost"
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

  return kind === 'pass' ? (
    <div className="ide-verify-pass-summary-anchor" data-testid="ide-verify-pass-hero">
      {summary}
    </div>
  ) : summary;
};
