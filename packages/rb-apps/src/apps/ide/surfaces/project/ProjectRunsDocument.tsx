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
  readonly availableRunIds?: readonly string[];
  readonly onOpenRecording?: (run: VerifyRunLedgerEntry) => void;
  readonly latestRunIsCurrent?: boolean | null;
}

/** A grouped projection of the existing ledger. Every retained sample set opens by run ID. */
export const ProjectRunsDocument: React.FC<ProjectRunsDocumentProps> = ({
  runs, selected, onSelect, onNavigateMode, availableRunIds = [], onOpenRecording,
  latestRunIsCurrent = null,
}) => {
  const ordered = [...runs].reverse();
  const groups = new Map<string, VerifyRunLedgerEntry[]>();
  for (const run of ordered) {
    const key = run.identity ? JSON.stringify([run.identity.design, run.identity.stimulus, run.identity.engine]) : 'legacy:' + run.runId;
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  return <div className="rb-doc rb-project-runs" data-testid="ide-project-runs-document">
    <header className="rb-doc-header">
      <h2 className="rb-doc-title">Runs</h2>
      <span className="wb-toolbar-meta">{runs.length} recorded · browser simulation</span>
      <span className="wb-toolbar-spacer" />
      <button type="button" className="wb-btn" onClick={() => onNavigateMode('verify')} data-testid="ide-project-runs-open-simulate">Open Simulate</button>
    </header>
    <section className="rb-doc-section" aria-label="Run ledger">
      <div className="wb-table-frame">
        <table className="wb-table" data-testid="ide-project-runs-table">
          <thead><tr><th>Run</th><th>Scenario</th><th>Checks</th><th>Ticks</th><th>Output digest</th><th>State</th><th>When</th><th>Recording</th></tr></thead>
          {[...groups].map(([key, group]) => <tbody key={key} data-configuration-digest={key}>
            <tr className="rb-run-group"><th colSpan={8}>
              <strong>{group.length} {group.length === 1 ? 'run' : 'runs'} · {group.length === 1 ? 'no repeat yet' : new Set(group.map(run => run.outputDigest).filter(Boolean)).size === 1 ? 'same output digest' : new Set(group.map(run => run.outputDigest).filter(Boolean)).size + ' output digests'}</strong>
              {group[0].identity ? <span title={`Design ${group[0].identity.design} · Stimulus ${group[0].identity.stimulus} · Engine ${group[0].identity.engine}`}>
                {' '}Design <code>{group[0].identity.design}</code> + Stimulus <code>{group[0].identity.stimulus}</code> + Engine <code>{group[0].identity.engine}</code>
              </span> : <span> · older recording, configuration identity unavailable</span>}
            </th></tr>
            {group.map(run => {
              const ref: EngineeringObjectRef = { kind: 'run', runId: run.runId };
              const hasChecks = run.passedRows + run.failedRows > 0 && run.runKind !== 'trace';
              const isNewest = run.runId === ordered[0]?.runId;
              const current = isNewest && latestRunIsCurrent === true;
              const available = availableRunIds.includes(run.runId) && Boolean(onOpenRecording);
              return <tr key={run.runId} data-testid={`ide-project-run-${run.runId}`}
                aria-selected={sameEngineeringObject(selected, ref)} data-current={current ? 'true' : 'false'}
                onClick={() => onSelect(ref)} onDoubleClick={() => available && onOpenRecording?.(run)}>
                <td className="is-mono">{run.sequence ?? run.runId.slice(-8)}</td>
                <td>{run.scenarioName ?? '—'}</td>
                <td data-tone={hasChecks && run.failedRows > 0 ? 'error' : undefined}>
                  {hasChecks ? `${run.passedRows} passed · ${run.failedRows} failed` : 'No checks configured'}
                </td>
                <td className="is-mono">{run.tickCount ?? '—'}</td>
                <td className="is-mono" data-recording-output-digest={run.outputDigest}>{run.outputDigest ?? 'Unavailable'}</td>
                <td>{current ? 'Current' : isNewest && latestRunIsCurrent === false ? 'Inputs changed' : 'Retained'}</td>
                <td title={run.ranAtIso}>{formatRelative(run.ranAtIso)}</td>
                <td><button type="button" className="wb-btn wb-btn--ghost" disabled={!available}
                  title={available ? 'Inspect this exact recording' : 'Sample data is no longer retained for this ledger entry'}
                  data-testid={`ide-project-run-evidence-${run.runId}`}
                  onClick={event => { event.stopPropagation(); onOpenRecording?.(run); }}>Inspect</button></td>
              </tr>;
            })}
          </tbody>)}
          {!runs.length && <tbody><tr><td colSpan={8} className="wb-table-empty">No runs recorded yet. Run a scenario in Simulate.</td></tr></tbody>}
        </table>
      </div>
    </section>
  </div>;
};
