import React from 'react';
import type { VerifyRunLedgerEntry } from '../projectRuntime';

/**
 * Runs document — a read-only projection of the project store's verify run
 * ledger (`verifyRunHistory`, a bounded ring). It never owns run truth; it
 * lists the most-recent runs newest-first with their pass/fail outcome, the
 * first failing case, and what changed since the previous run, so the engineer
 * can see the verification trail without leaving Project.
 */

export interface ProjectRunsListProps {
  readonly runs: VerifyRunLedgerEntry[];
  readonly onOpenVerify?: () => void;
  /** Max rows to show (newest first). */
  readonly limit?: number;
}

function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const deltaSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (deltaSec < 45) return 'just now';
  const min = Math.round(deltaSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function changedLabels(run: VerifyRunLedgerEntry): string[] {
  const labels: string[] = [];
  if (run.didCircuitChangeSinceLast) labels.push('circuit');
  if (run.didVectorsChangeSinceLast) labels.push('scenario');
  if (run.didMappingChangeSinceLast) labels.push('mapping');
  return labels;
}

export const ProjectRunsList: React.FC<ProjectRunsListProps> = ({ runs, onOpenVerify, limit = 8 }) => {
  const ordered = [...runs].reverse().slice(0, limit);
  const total = runs.length;

  return (
    <section className="ide-project-runs" data-testid="ide-project-runs" aria-label="Verification runs">
      <header className="ide-project-runs-head">
        <span>Verification runs</span>
        <strong data-testid="ide-project-runs-count">
          {total === 0 ? 'None yet' : `${total} recorded`}
        </strong>
      </header>

      {ordered.length === 0 ? (
        <p className="ide-project-runs-empty" data-testid="ide-project-runs-empty">
          Run a simulation in Simulate to record the first verification. Runs
          capture pass/fail, the first failing case, and what changed since the
          previous run.
        </p>
      ) : (
        <ol className="ide-project-runs-list">
          {ordered.map((run, index) => {
            const changes = changedLabels(run);
            return (
              <li
                key={run.runId}
                className={`ide-project-run-row is-${run.status}`}
                data-testid={`ide-project-run-${index}`}
                data-run-status={run.status}
              >
                <span
                  className={`ide-project-run-badge is-${run.status}`}
                  data-testid={`ide-project-run-status-${index}`}
                >
                  {run.status === 'pass' ? 'PASS' : 'FAIL'}
                </span>
                <div className="ide-project-run-body">
                  <div className="ide-project-run-line">
                    <strong>
                      {run.passedRows}/{run.passedRows + run.failedRows} rows
                    </strong>
                    <span className="ide-project-run-time">{formatRelative(run.ranAtIso)}</span>
                  </div>
                  {run.status === 'fail' && run.firstFailure ? (
                    <p
                      className="ide-project-run-failure"
                      data-testid={`ide-project-run-failure-${index}`}
                    >
                      t{run.firstFailure.tick} · {run.firstFailure.signal}: expected{' '}
                      <code>{run.firstFailure.expected}</code> got{' '}
                      <code>{run.firstFailure.actual}</code>
                    </p>
                  ) : null}
                  {changes.length > 0 ? (
                    <p className="ide-project-run-changes" data-testid={`ide-project-run-changes-${index}`}>
                      changed since last: {changes.join(', ')}
                    </p>
                  ) : (
                    index < ordered.length - 1 ? (
                      <p className="ide-project-run-changes is-unchanged">no inputs changed since last</p>
                    ) : null
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {onOpenVerify ? (
        <button
          type="button"
          className="ide-project-runs-open"
          data-testid="ide-project-runs-open-verify"
          onClick={onOpenVerify}
        >
          Open Simulate
        </button>
      ) : null}
    </section>
  );
};
