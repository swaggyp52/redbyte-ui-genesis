import React, { useMemo } from 'react';
import type { RBProject } from '../../../export/projectFormat';
import type { ParsedIdeSubmission } from '../../../export/parseIdeSubmission';
import {
  IdeButton,
  IdeCallout,
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

  const gateRows = useMemo(() =>
    gradeSummary.gateResults.map((g) => [
      g.gateId,
      verdictPill(g.verdict as 'pass' | 'warn' | 'block'),
      g.title,
      g.detail,
    ]),
  [gradeSummary.gateResults]);

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

  return (
    <IdeSurfaceLayout
      mode="import"
      consoleHasBlocking={false}
      consoleHasEntries={false}
      inspector={null}
      hideRightDock
      dock={
        <section className="ide-workbench-placeholder" data-testid="ide-submission-viewer-dock">
          <header className="ide-workbench-placeholder-header">
            <h3>Submission</h3>
            <IdeStatusPill tone="warn">READ-ONLY</IdeStatusPill>
          </header>

          <IdeCallout tone="warn" title="Viewing student submission" testId="ide-submission-viewer-banner">
            This project cannot be edited. Edits are disabled. Use "Load into IDE" to make it active.
          </IdeCallout>

          <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
            <IdeButton
              tone="primary"
              onClick={() => onLoadIntoIde(project)}
              testId="ide-submission-load-into-ide"
            >
              Load into IDE
            </IdeButton>
            <IdeButton tone="ghost" onClick={onClose} testId="ide-submission-close">
              Close viewer
            </IdeButton>
          </div>
        </section>
      }
      console={
        <section className="ide-workbench-console-content" data-testid="ide-submission-viewer-console">
          <header className="ide-workbench-console-header">
            <h3>Submission Viewer</h3>
            <span className="ide-workbench-console-mode">Read-Only</span>
          </header>
          {gradeSummary.overallGateVerdict === 'block' ? (
            <IdeCallout tone="warn" title="Gate check blocked">
              One or more gate checks are blocking. Review the Gate Results table.
            </IdeCallout>
          ) : gradeSummary.overallGateVerdict === 'ungraded' ? (
            <IdeCallout tone="info" title="Freeplay submission">
              No lab ID — no gate checks applied.
            </IdeCallout>
          ) : (
            <IdeCallout tone="success" title="Gate checks passed">
              All submission gates passed.
            </IdeCallout>
          )}
        </section>
      }
    >
      <IdePanel testId="ide-submission-viewer-panel" description="Read-only view of a student submission ZIP.">

        {/* Grade Summary */}
        <section data-testid="ide-submission-grade-summary">
          <h3 style={{ margin: '0 0 var(--ide-space-2)', fontSize: 'var(--rb-font-size-2)' }}>
            Grade Summary
          </h3>
          <IdeDataTable
            columns={['Field', 'Value']}
            rows={gradeSummaryRows}
            testId="ide-submission-grade-summary-table"
          />
        </section>

        {/* Gate Results */}
        {gateRows.length > 0 && (
          <section style={{ marginTop: 'var(--ide-space-3)' }} data-testid="ide-submission-gate-results">
            <h3 style={{ margin: '0 0 var(--ide-space-2)', fontSize: 'var(--rb-font-size-2)' }}>
              Gate Results
            </h3>
            <IdeDataTable
              columns={['Gate ID', 'Verdict', 'Title', 'Detail']}
              rows={gateRows}
              testId="ide-submission-gate-table"
            />
          </section>
        )}

        {/* Run Ledger */}
        {ledgerRows.length > 0 && (
          <section style={{ marginTop: 'var(--ide-space-3)' }} data-testid="ide-submission-run-ledger">
            <h3 style={{ margin: '0 0 var(--ide-space-2)', fontSize: 'var(--rb-font-size-2)' }}>
              Verify Run Ledger
            </h3>
            <IdeDataTable
              columns={['#', 'Time', 'Status', 'Pass', 'Fail', 'Circuit Δ', 'Vectors Δ', 'Mapping Δ']}
              rows={ledgerRows}
              testId="ide-submission-ledger-table"
            />
          </section>
        )}

        {/* Verify Mismatch Table */}
        {allMismatchRows.length > 0 && (
          <section style={{ marginTop: 'var(--ide-space-3)' }} data-testid="ide-submission-verify-rows">
            <h3 style={{ margin: '0 0 var(--ide-space-2)', fontSize: 'var(--rb-font-size-2)' }}>
              Verify Results
              {failureRows.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 'var(--rb-font-size-1)', color: 'var(--rb-error, #e55)' }}>
                  ({failureRows.length} failure{failureRows.length !== 1 ? 's' : ''})
                </span>
              )}
            </h3>
            <IdeDataTable
              columns={['Tick', 'Signal', 'Expected', 'Actual', 'Status']}
              rows={allMismatchRows}
              testId="ide-submission-verify-table"
            />
          </section>
        )}

        {/* IO Mapping */}
        {ioMappingRows.length > 0 && (
          <section style={{ marginTop: 'var(--ide-space-3)' }} data-testid="ide-submission-io-mapping">
            <h3 style={{ margin: '0 0 var(--ide-space-2)', fontSize: 'var(--rb-font-size-2)' }}>
              IO Mapping
            </h3>
            <IdeDataTable
              columns={['ID', 'Label', 'Dir', 'Pin']}
              rows={ioMappingRows}
              testId="ide-submission-mapping-table"
            />
          </section>
        )}

        {/* Vectors */}
        {vectorRows.length > 0 && (
          <section style={{ marginTop: 'var(--ide-space-3)' }} data-testid="ide-submission-vectors">
            <h3 style={{ margin: '0 0 var(--ide-space-2)', fontSize: 'var(--rb-font-size-2)' }}>
              Test Vectors ({vectorRows.length})
            </h3>
            <IdeDataTable
              columns={['Tick', 'Inputs', 'Expected']}
              rows={vectorRows}
              testId="ide-submission-vectors-table"
            />
          </section>
        )}

      </IdePanel>
    </IdeSurfaceLayout>
  );
};
