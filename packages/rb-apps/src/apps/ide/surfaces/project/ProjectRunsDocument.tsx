import React from 'react';
import { sameEngineeringObject, type EngineeringObjectRef } from '../../engineeringSelection';
import type { VerifyRunLedgerEntry } from '../../projectRuntime';
import type { WorkbenchDocument } from '../../workbenchDocuments';
import type { IdeMode } from '../../workflowStages';
import { formatRelative, type ProjectProblem, type ProjectScenarioSummary } from './projectWorkbenchModel';

export interface ProjectRunsDocumentProps {
  readonly runs: readonly VerifyRunLedgerEntry[];
  readonly problems: readonly ProjectProblem[];
  readonly scenarios: readonly ProjectScenarioSummary[];
  readonly activeScenarioId: string | null;
  readonly selected: EngineeringObjectRef | null;
  readonly onSelect: (ref: EngineeringObjectRef) => void;
  readonly onOpenDocument: (doc: WorkbenchDocument) => void;
  readonly onNavigateMode: (mode: IdeMode) => void;
  /** Whether the newest run still describes the present design (the runtime's own staleness). Older runs are superseded. */
  readonly latestRunIsCurrent?: boolean | null;
}

/**
 * Runs & Problems document — real ledger data, newest first, and the actual
 * diagnostics. A run row publishes the run; double-click opens the recorded
 * evidence (Waveform) for the scenario the run belongs to.
 */
export const ProjectRunsDocument: React.FC<ProjectRunsDocumentProps> = ({
  runs,
  problems,
  scenarios,
  activeScenarioId,
  selected,
  onSelect,
  onOpenDocument,
  onNavigateMode,
  latestRunIsCurrent = null,
}) => {
  const ordered = [...runs].reverse();
  const evidenceDocumentFor = (run: VerifyRunLedgerEntry): WorkbenchDocument | null => {
    const scenarioId = run.scenarioId ?? waveformScenarioId;
    return scenarioId ? { kind: 'waveform', scenarioId } : null;
  };
  const waveformScenarioId = activeScenarioId ?? scenarios[0]?.id ?? null;

  return (
    <div className="rb-doc rb-project-runs" data-testid="ide-project-runs-document">
      <header className="rb-doc-header">
        <h2 className="rb-doc-title">Runs</h2>
        <span className="rb-doc-header-sep" aria-hidden="true" />
        <span className="wb-toolbar-meta">{runs.length} recorded · browser simulation only</span>
        <span className="wb-toolbar-spacer" />
        <button type="button" className="wb-btn" onClick={() => onNavigateMode('verify')} data-testid="ide-project-runs-open-simulate">
          Open Simulate
        </button>
      </header>
      <section className="rb-doc-section" aria-label="Run ledger">
        <div className="wb-table-frame">
          <table className="wb-table" data-testid="ide-project-runs-table">
            <thead>
              <tr>
                <th scope="col">Result</th>
                <th scope="col">Type</th>
                <th scope="col">Scenario</th>
                <th scope="col">Checks</th>
                <th scope="col">Ticks</th>
                <th scope="col">Failed</th>
                <th scope="col">Changed since previous</th>
                <th scope="col">State</th>
                <th scope="col">When</th>
                <th scope="col" aria-label="Evidence" />
              </tr>
            </thead>
            <tbody>
              {ordered.length === 0 ? (
                <tr><td colSpan={10} className="wb-table-empty">No runs recorded yet. Run a scenario in Simulate.</td></tr>
              ) : (
                ordered.map((run, index) => {
                  const ref: EngineeringObjectRef = { kind: 'run', runId: run.runId };
                  const changed = [
                    run.didCircuitChangeSinceLast ? 'design' : null,
                    run.didVectorsChangeSinceLast ? 'cases' : null,
                    run.didMappingChangeSinceLast ? 'mapping' : null,
                  ].filter(Boolean);
                  const evidence = evidenceDocumentFor(run);
                  const isCurrent = index === 0 && latestRunIsCurrent === true;
                  const stateWord = latestRunIsCurrent == null ? '—' : isCurrent ? 'current' : index === 0 ? 'stale' : 'superseded';
                  const isCompare = run.runKind ? run.runKind === 'verify' : run.passedRows + run.failedRows > 0;
                  return (
                    <tr
                      key={run.runId}
                      aria-selected={sameEngineeringObject(selected, ref)}
                      data-testid={`ide-project-run-${run.runId}`}
                      data-tone={run.status === 'pass' ? 'ok' : 'error'}
                      data-current={isCurrent ? 'true' : 'false'}
                      className={isCurrent ? undefined : 'is-stale'}
                      onClick={() => onSelect(ref)}
                      onDoubleClick={() => evidence && onOpenDocument(evidence)}
                    >
                      <td className="is-mono" data-tone={run.status === 'pass' ? 'ok' : 'error'}>{run.status === 'pass' ? 'PASS' : 'FAIL'}</td>
                      <td className="is-mono">{isCompare ? 'compare' : 'observe'}</td>
                      <td className="is-mono">{run.scenarioName ?? '—'}</td>
                      <td className="is-mono">{isCompare ? `${run.passedRows}/${run.passedRows + run.failedRows}` : '—'}</td>
                      <td className="is-mono">{run.tickCount ?? '—'}</td>
                      <td className="is-mono" title={run.failedSignals?.join(', ')}>
                        {run.failedSignals && run.failedSignals.length > 0
                          ? `${run.failedSignals.slice(0, 3).join(', ')}${run.failedSignals.length > 3 ? ` +${run.failedSignals.length - 3}` : ''}`
                          : run.firstFailure ? `${run.firstFailure.signal} @ t${run.firstFailure.tick}` : '—'}
                      </td>
                      <td className="is-mono">{changed.length ? changed.join(', ') : 'nothing'}</td>
                      <td className="is-mono" data-tone={isCurrent ? 'ok' : index === 0 ? 'warn' : undefined} title={`Project hash ${run.projectHash.slice(0, 12)}`}>
                        {stateWord}
                      </td>
                      <td className="is-mono" title={run.ranAtIso}>{formatRelative(run.ranAtIso)}</td>
                      <td>
                        {evidence ? (
                          <button
                            type="button"
                            className="wb-btn wb-btn--ghost"
                            onClick={(event) => { event.stopPropagation(); onOpenDocument(evidence); }}
                            data-testid={`ide-project-run-evidence-${run.runId}`}
                            title={`Open the waveform of scenario ${run.scenarioName ?? ''}`.trim()}
                          >
                            Evidence
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rb-doc-section" aria-label="Problems" data-testid="ide-project-runs-problems">
        <header className="rb-doc-section-header">
          <span>Problems</span>
          <span className="wb-toolbar-spacer" />
          <span className="wb-toolbar-meta">{problems.length}</span>
        </header>
        {problems.length === 0 ? (
          <div className="wb-empty">No problems reported.</div>
        ) : (
          <ul className="rb-problem-list">
            {problems.map((problem) => {
              const ref: EngineeringObjectRef = { kind: 'problem', problemId: problem.id };
              return (
                <li
                  key={problem.id}
                  className="wb-panel-line"
                  data-tone={problem.severity === 'error' ? 'error' : problem.severity === 'warning' ? 'warn' : undefined}
                  aria-selected={sameEngineeringObject(selected, ref)}
                  onClick={() => onSelect(ref)}
                >
                  <span aria-hidden="true">{problem.severity === 'error' ? '✕' : problem.severity === 'warning' ? '▲' : 'i'}</span>
                  <span>
                    <code>{problem.code}</code> {problem.message}
                    {problem.fixMode ? (
                      <>
                        {' '}
                        <button type="button" className="wb-link" onClick={() => onNavigateMode(problem.fixMode as IdeMode)}>
                          Open {problem.fixMode === 'verify' ? 'Simulate' : problem.fixMode === 'hardware' ? 'Board' : problem.fixMode === 'export' ? 'Package' : 'Design'}
                        </button>
                      </>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
