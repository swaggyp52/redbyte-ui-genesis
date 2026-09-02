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
}) => {
  const ordered = [...runs].reverse();
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
                <th scope="col">Checks</th>
                <th scope="col">First mismatch</th>
                <th scope="col">Changed since previous</th>
                <th scope="col">Project hash</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {ordered.length === 0 ? (
                <tr><td colSpan={6} className="wb-table-empty">No runs recorded yet. Run a scenario in Simulate.</td></tr>
              ) : (
                ordered.map((run) => {
                  const ref: EngineeringObjectRef = { kind: 'run', runId: run.runId };
                  const changed = [
                    run.didCircuitChangeSinceLast ? 'design' : null,
                    run.didVectorsChangeSinceLast ? 'cases' : null,
                    run.didMappingChangeSinceLast ? 'mapping' : null,
                  ].filter(Boolean);
                  return (
                    <tr
                      key={run.runId}
                      aria-selected={sameEngineeringObject(selected, ref)}
                      data-testid={`ide-project-run-${run.runId}`}
                      data-tone={run.status === 'pass' ? 'ok' : 'error'}
                      onClick={() => onSelect(ref)}
                      onDoubleClick={() => waveformScenarioId && onOpenDocument({ kind: 'waveform', scenarioId: waveformScenarioId })}
                    >
                      <td className="is-mono" data-tone={run.status === 'pass' ? 'ok' : 'error'}>{run.status === 'pass' ? 'PASS' : 'FAIL'}</td>
                      <td className="is-mono">{run.passedRows}/{run.passedRows + run.failedRows}</td>
                      <td className="is-mono">{run.firstFailure ? `${run.firstFailure.signal} @ t${run.firstFailure.tick}` : '—'}</td>
                      <td className="is-mono">{changed.length ? changed.join(', ') : 'nothing'}</td>
                      <td className="is-mono">{run.projectHash.slice(0, 8)}</td>
                      <td className="is-mono" title={run.ranAtIso}>{formatRelative(run.ranAtIso)}</td>
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
