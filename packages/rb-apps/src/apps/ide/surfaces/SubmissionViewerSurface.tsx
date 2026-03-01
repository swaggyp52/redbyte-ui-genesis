import React, { useMemo } from 'react';
import type { RBProject } from '../../../export/projectFormat';
import type { ParsedIdeSubmission } from '../../../export/parseIdeSubmission';
import {
  IdeButton,
  IdeDataTable,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';

export interface SubmissionViewerSurfaceProps {
  submission: ParsedIdeSubmission;
  onLoadIntoIde: (project: RBProject) => void;
  onClose: () => void;
}

function formatIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.replace('T', ' ').replace(/\.\d{3}Z$/, 'Z');
}

function verdictPill(verdict: 'pass' | 'warn' | 'block' | 'ungraded'): React.ReactNode {
  const toneMap: Record<typeof verdict, 'ok' | 'warn' | 'error' | 'idle'> = {
    pass: 'ok',
    warn: 'warn',
    block: 'error',
    ungraded: 'idle',
  };
  return <IdeStatusPill tone={toneMap[verdict]}>{verdict.toUpperCase()}</IdeStatusPill>;
}

function statusPill(status: 'pass' | 'fail' | 'none'): React.ReactNode {
  const toneMap = { pass: 'ok' as const, fail: 'error' as const, none: 'idle' as const };
  return <IdeStatusPill tone={toneMap[status]}>{status.toUpperCase()}</IdeStatusPill>;
}

export const SubmissionViewerSurface: React.FC<SubmissionViewerSurfaceProps> = ({
  submission,
  onLoadIntoIde,
  onClose,
}) => {
  const { gradeSummary, project, verifyLastRun, verifyRunHistory } = submission;

  const gradeSummaryRows = useMemo(() => [
    ['Student name', gradeSummary.studentName ?? '—'],
    ['Assignment ID', gradeSummary.assignmentId ?? '—'],
    ['Lab code', gradeSummary.labCode ?? '—'],
    ['Project name', gradeSummary.projectName],
    ['Project ID', gradeSummary.projectId ?? '—'],
    ['Submitted at', formatIso(gradeSummary.submittedAt)],
    ['Created at', formatIso(gradeSummary.createdAt)],
    ['Last verify status', statusPill(gradeSummary.verifyRuns.lastStatus)],
    ['Passed rows', String(gradeSummary.lastRun?.passedRows ?? 0)],
    ['Failed rows', String(gradeSummary.lastRun?.failedRows ?? 0)],
    ['Total runs', String(gradeSummary.verifyRuns.total)],
    ['First pass at', formatIso(gradeSummary.verifyRuns.firstPassAt)],
    ['Last pass at', formatIso(gradeSummary.verifyRuns.lastPassAt)],
    ['Mapping complete', gradeSummary.mapping.complete ? 'Yes' : 'No'],
    ['Nodes', String(gradeSummary.circuit.nodeCount)],
    ['Wires', String(gradeSummary.circuit.wireCount)],
    ['Contains DFF', gradeSummary.circuit.containsDff ? 'Yes' : 'No'],
    ['Overall gate verdict', verdictPill(gradeSummary.overallGateVerdict)],
    ['Bundle ID', gradeSummary.bundleId.slice(0, 16) + '…'],
    ['App commit', gradeSummary.appCommitSha || '—'],
  ], [gradeSummary]);

  const ledgerRows = useMemo(() =>
    verifyRunHistory.map((entry, i) => [
      String(i + 1),
      formatIso(entry.ranAtIso),
      statusPill(entry.status),
      String(entry.passedRows),
      String(entry.failedRows),
      entry.didCircuitChangeSinceLast ? '✓' : '',
      entry.didVectorsChangeSinceLast ? '✓' : '',
      entry.didMappingChangeSinceLast ? '✓' : '',
    ]),
  [verifyRunHistory]);

  const failureRows = useMemo(() => {
    if (!verifyLastRun) return [];
    return verifyLastRun.report.rows
      .filter((r) => r.status === 'fail')
      .map((r) => [
        String(r.tick),
        r.signal,
        r.expected,
        r.actual,
        <IdeStatusPill key={`${r.tick}-${r.signal}`} tone="error">FAIL</IdeStatusPill>,
      ]);
  }, [verifyLastRun]);

  const allMismatchRows = useMemo(() => {
    if (!verifyLastRun) return [];
    return verifyLastRun.report.rows.map((r) => [
      String(r.tick),
      r.signal,
      r.expected,
      r.actual,
      <IdeStatusPill key={`${r.tick}-${r.signal}-s`} tone={r.status === 'pass' ? 'ok' : 'error'}>
        {r.status.toUpperCase()}
      </IdeStatusPill>,
    ]);
  }, [verifyLastRun]);

  const ioMappingRows = useMemo(() => {
    const inputs = (project.ioMapping?.inputs ?? []).map((r) => [r.id, r.label ?? r.id, 'IN', r.pin ?? '—']);
    const outputs = (project.ioMapping?.outputs ?? []).map((r) => [r.id, r.label ?? r.id, 'OUT', r.pin ?? '—']);
    return [...inputs, ...outputs];
  }, [project.ioMapping]);

  const vectorRows = useMemo(() => {
    const vecs = project.vectors ?? [];
    if (vecs.length === 0) return [];
    return vecs.map((v) => [
      String(v.tick),
      JSON.stringify(v.inputs ?? {}),
      JSON.stringify(v.expected ?? {}),
    ]);
  }, [project.vectors]);

  const blockedGateCount = gradeSummary.gateResults.filter(g => g.verdict === 'block').length;

  return (
    <IdeSurfaceLayout
      mode="import"
      consoleHasBlocking={false}
      consoleHasEntries={false}
      inspector={null}
      hideRightDock
      dock={
        <div className="ide-sub-dock" data-testid="ide-submission-viewer-dock">
          <div className="ide-sub-dock-identity">
            <span className="ide-sub-dock-label">SUBMISSION</span>
            <IdeStatusPill tone="warn">READ-ONLY</IdeStatusPill>
          </div>
          <div className="ide-sub-dock-fields">
            <div className="ide-kv-row">
              <span className="ide-kv-key">Student</span>
              <span className="ide-kv-val">{gradeSummary.studentName ?? '—'}</span>
            </div>
            <div className="ide-kv-row">
              <span className="ide-kv-key">Assignment</span>
              <span className="ide-kv-val">{gradeSummary.assignmentId ?? '—'}</span>
            </div>
            <div className="ide-kv-row">
              <span className="ide-kv-key">Verdict</span>
              <span className="ide-kv-val">{verdictPill(gradeSummary.overallGateVerdict)}</span>
            </div>
          </div>
          <p className="ide-sub-dock-hint">
            Editing disabled. &ldquo;Load into IDE&rdquo; copies this into a new project.
          </p>
          <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
            <IdeButton
              tone="primary"
              onClick={() => onLoadIntoIde(project)}
              testId="ide-submission-load-into-ide"
            >
              Load into IDE
            </IdeButton>
            <IdeButton tone="ghost" onClick={onClose} testId="ide-submission-close">
              Close
            </IdeButton>
          </div>
        </div>
      }
      console={
        <section className="ide-workbench-console-content" data-testid="ide-submission-viewer-console">
          <header className="ide-workbench-console-header">
            <h3>Submission Viewer</h3>
            <span className="ide-workbench-console-mode">Read-Only</span>
          </header>
        </section>
      }
    >
      <IdePanel testId="ide-submission-viewer-panel" description="Read-only view of a student submission ZIP.">

        {/* ── Hero: score at a glance ── */}
        <div className="ide-sub-hero" data-testid="ide-submission-hero">
          <div className="ide-sub-hero-identity">
            <span className="ide-sub-hero-name">
              {gradeSummary.studentName ?? 'Unknown Student'}
            </span>
            <span className="ide-sub-hero-assignment">
              {gradeSummary.assignmentId ?? gradeSummary.labCode ?? 'No assignment ID'}
            </span>
            <span className="ide-sub-hero-project">{gradeSummary.projectName}</span>
          </div>
          <div className="ide-sub-hero-stats">
            <div className="ide-sub-hero-stat">
              <span className="ide-sub-hero-stat-value">
                {gradeSummary.lastRun?.passedRows ?? 0}
              </span>
              <span className="ide-sub-hero-stat-label">PASS</span>
            </div>
            <div className="ide-sub-hero-stat ide-sub-hero-stat--fail">
              <span className="ide-sub-hero-stat-value">
                {gradeSummary.lastRun?.failedRows ?? 0}
              </span>
              <span className="ide-sub-hero-stat-label">FAIL</span>
            </div>
            <div className="ide-sub-hero-stat">
              {verdictPill(gradeSummary.overallGateVerdict)}
              <span className="ide-sub-hero-stat-label">GATES</span>
            </div>
          </div>
          <div className="ide-sub-hero-meta">
            <span>Submitted {formatIso(gradeSummary.submittedAt)}</span>
            <span className="ide-sub-hero-bundle">
              Bundle <code>{gradeSummary.bundleId.slice(0, 12)}&hellip;</code>
            </span>
          </div>
        </div>

        {/* ── Grade Details (collapsible) ── */}
        <details className="ide-sub-section" open data-testid="ide-submission-grade-summary">
          <summary className="ide-sub-section-header">Grade Details</summary>
          <IdeDataTable
            columns={['Field', 'Value']}
            rows={gradeSummaryRows}
            testId="ide-submission-grade-summary-table"
          />
        </details>

        {/* ── Gate Results (collapsible) ── */}
        {gradeSummary.gateResults.length > 0 && (
          <details className="ide-sub-section" open data-testid="ide-submission-gate-results">
            <summary className="ide-sub-section-header">
              Gate Results
              {blockedGateCount > 0 && (
                <span className="ide-sub-section-badge ide-sub-section-badge--fail">
                  {blockedGateCount} blocked
                </span>
              )}
            </summary>
            <table className="ide-sub-gate-table" data-testid="ide-submission-gate-table">
              <thead>
                <tr>
                  <th>Gate ID</th>
                  <th>Verdict</th>
                  <th>Title</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {gradeSummary.gateResults.map((g) => (
                  <tr
                    key={g.gateId}
                    data-verdict={g.verdict}
                    className="ide-sub-gate-row"
                  >
                    <td><code className="ide-sub-gate-id">{g.gateId}</code></td>
                    <td>{verdictPill(g.verdict as 'pass' | 'warn' | 'block')}</td>
                    <td>{g.title}</td>
                    <td className="ide-sub-gate-detail">{g.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        {/* ── Run Ledger (collapsible) ── */}
        {ledgerRows.length > 0 && (
          <details className="ide-sub-section" open data-testid="ide-submission-run-ledger">
            <summary className="ide-sub-section-header">
              Verify Run Ledger
              <span className="ide-sub-section-badge ide-sub-section-badge--pass">
                {ledgerRows.length} run{ledgerRows.length !== 1 ? 's' : ''}
              </span>
            </summary>
            <IdeDataTable
              columns={['#', 'Time', 'Status', 'Pass', 'Fail', 'Circuit Δ', 'Vectors Δ', 'Mapping Δ']}
              rows={ledgerRows}
              testId="ide-submission-ledger-table"
            />
          </details>
        )}

        {/* ── Verify Results (collapsible) ── */}
        {allMismatchRows.length > 0 && (
          <details className="ide-sub-section" open data-testid="ide-submission-verify-rows">
            <summary className="ide-sub-section-header">
              Verify Results
              {failureRows.length > 0 && (
                <span className="ide-sub-section-badge ide-sub-section-badge--fail">
                  {failureRows.length} fail{failureRows.length !== 1 ? 's' : ''}
                </span>
              )}
              {failureRows.length === 0 && allMismatchRows.length > 0 && (
                <span className="ide-sub-section-badge ide-sub-section-badge--pass">ALL PASS</span>
              )}
            </summary>
            <IdeDataTable
              columns={['Tick', 'Signal', 'Expected', 'Actual', 'Status']}
              rows={allMismatchRows}
              testId="ide-submission-verify-table"
            />
          </details>
        )}

        {/* ── IO Mapping (collapsible) ── */}
        {ioMappingRows.length > 0 && (
          <details className="ide-sub-section" open data-testid="ide-submission-io-mapping">
            <summary className="ide-sub-section-header">
              IO Mapping
              <span className="ide-sub-section-badge ide-sub-section-badge--pass">
                {ioMappingRows.length} signal{ioMappingRows.length !== 1 ? 's' : ''}
              </span>
            </summary>
            <IdeDataTable
              columns={['ID', 'Label', 'Dir', 'Pin']}
              rows={ioMappingRows}
              testId="ide-submission-mapping-table"
            />
          </details>
        )}

        {/* ── Test Vectors (collapsible, closed by default) ── */}
        {vectorRows.length > 0 && (
          <details className="ide-sub-section" data-testid="ide-submission-vectors">
            <summary className="ide-sub-section-header">
              Test Vectors
              <span className="ide-sub-section-badge ide-sub-section-badge--pass">
                {vectorRows.length}
              </span>
            </summary>
            <IdeDataTable
              columns={['Tick', 'Inputs', 'Expected']}
              rows={vectorRows}
              testId="ide-submission-vectors-table"
            />
          </details>
        )}

      </IdePanel>
    </IdeSurfaceLayout>
  );
};
