import React, { useEffect, useMemo, useState } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { sameEngineeringObject, type EngineeringObjectRef } from '../../engineeringSelection';
import type { WorkbenchDocument } from '../../workbenchDocuments';
import type { IdeMode } from '../../workflowStages';
import { ArchitecturePreview } from './ArchitecturePreview';
import { xdcPortToken } from '../../hardwareXdcPreview';
import type { OverviewFact, ProjectMappingRowLike, ProjectProblem } from './projectWorkbenchModel';

export interface ProjectContinuation {
  /** What the button says, e.g. "Resume simulation". */
  readonly label: string;
  /** A short reason the destination is the one offered, e.g. "where you were last working". */
  readonly hint?: string;
  readonly onActivate: () => void;
}

export interface ProjectOverviewDocumentProps {
  readonly projectName: string;
  /** Starter this project came from — its brief is project context, not canvas narration. */
  readonly starter?: {
    readonly name: string;
    readonly lab?: string;
    readonly concept?: string;
    readonly summary?: string;
    readonly expectedBehavior?: string;
    readonly nextAction?: string;
  } | null;
  readonly topModuleName: string;
  readonly canEditTop: boolean;
  readonly onSetTop?: (top: string) => void;
  readonly facts: readonly OverviewFact[];
  readonly circuit: Circuit | undefined;
  readonly ioLabelByNodeId: ReadonlyMap<string, string>;
  readonly moduleNameByNodeId: ReadonlyMap<string, string>;
  readonly mappingRows: readonly ProjectMappingRowLike[];
  readonly problems: readonly ProjectProblem[];
  readonly selected: EngineeringObjectRef | null;
  readonly onSelect: (ref: EngineeringObjectRef) => void;
  readonly onOpenDocument: (doc: WorkbenchDocument) => void;
  readonly onNavigateMode: (mode: IdeMode) => void;
  /** The one action that puts the reader back to work. */
  readonly continuation?: ProjectContinuation | null;
  /** Opens the shared Problems ledger, which owns the complete list. */
  readonly onOpenProblems?: () => void;
  /** A source-only or imported project has no renderable graph; say so rather than draw nothing. */
  readonly sourceSummary?: { readonly fileCount: number; readonly moduleCount: number } | null;
}

const TOP_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

/**
 * Overview answers one question: what is this project, where did I leave it, and what deserves
 * attention? It is composed, not tabulated - the circuit is the object, one action continues the
 * work, and three lines carry the state that changes what a reader would do next.
 *
 * Everything else the project knows about itself is still here and is one disclosure away. It used
 * to be twelve equal facts in a strip above two equal panes, which reads as a specification sheet:
 * true in every particular and no help at all in deciding what to do.
 */
/** Facts that change what a reader does next. Everything else describes the project. */
const STATUS_FACT_IDS = ['simulation', 'mapping', 'package'] as const;

export const ProjectOverviewDocument: React.FC<ProjectOverviewDocumentProps> = ({
  projectName,
  starter = null,
  topModuleName,
  canEditTop,
  onSetTop,
  facts,
  circuit,
  ioLabelByNodeId,
  moduleNameByNodeId,
  mappingRows,
  problems,
  selected,
  onSelect,
  onOpenDocument,
  onNavigateMode,
  continuation = null,
  onOpenProblems,
  sourceSummary = null,
}) => {
  const [topDraft, setTopDraft] = useState(topModuleName);
  const [topError, setTopError] = useState<string | null>(null);
  useEffect(() => setTopDraft(topModuleName), [topModuleName]);

  const commitTop = () => {
    const trimmed = topDraft.trim();
    if (!TOP_PATTERN.test(trimmed)) {
      setTopError('Top must be a valid HDL identifier (letter, then letters, digits, underscore).');
      return;
    }
    setTopError(null);
    if (trimmed !== topModuleName) onSetTop?.(trimmed);
  };

  const selectedNodeId = selected?.kind === 'node' ? selected.nodeId : selected?.kind === 'signal' ? selected.nodeId ?? null : null;

  // The same facts the project already derives, read in two registers rather than recomputed.
  const factById = useMemo(() => new Map(facts.map((fact) => [fact.id, fact])), [facts]);
  const statusFacts = useMemo(
    () => STATUS_FACT_IDS.map((id) => factById.get(id)).filter((fact): fact is OverviewFact => Boolean(fact)),
    [factById]
  );
  const savedFact = factById.get('saved');
  const detailFacts = useMemo(
    () => facts.filter((fact) => !STATUS_FACT_IDS.includes(fact.id as (typeof STATUS_FACT_IDS)[number]) && fact.id !== 'saved'),
    [facts]
  );
  // One problem earns a place beside the work; the ledger owns the rest.
  const leadProblem = useMemo(
    () =>
      problems.find((problem) => problem.severity === 'error') ??
      problems.find((problem) => problem.severity === 'warning') ??
      problems[0] ??
      null,
    [problems]
  );
  const hasCircuit = Boolean(circuit && circuit.nodes.length > 0);

  const renderFactValue = (fact: OverviewFact) =>
    fact.open || fact.navigateMode ? (
      <button
        type="button"
        className="wb-link"
        onClick={() => (fact.open ? onOpenDocument(fact.open) : fact.navigateMode ? onNavigateMode(fact.navigateMode) : undefined)}
      >
        {fact.value}
      </button>
    ) : (
      fact.value
    );

  return (
    <div className="rb-doc rb-project-overview" data-testid="ide-project-overview-document">
      {/* ── Recognise the project, and get back to work ───────────────────────────────── */}
      <header className="rb-doc-header rb-project-identity">
        <h2 className="rb-doc-title" data-testid="ide-project-overview-title">{projectName}</h2>
        {savedFact ? (
          <span className="rb-project-saved" data-testid="ide-project-saved-state" data-tone={savedFact.tone}>
            {savedFact.value}
          </span>
        ) : null}
        <span className="wb-toolbar-spacer" />
        {continuation ? (
          <button
            type="button"
            className="wb-btn wb-btn--primary rb-project-continue"
            onClick={continuation.onActivate}
            data-testid="ide-project-continue"
            title={continuation.hint}
          >
            {continuation.label}
          </button>
        ) : null}
      </header>

      {/* ── The circuit is the object; the state beside it is what would change a plan ── */}
      <div className="rb-project-stage">
        <section className="rb-project-canvas" aria-label="Circuit" data-testid="ide-project-design-overview">
          {hasCircuit && circuit ? (
            <ArchitecturePreview
              circuit={circuit}
              ioLabelByNodeId={ioLabelByNodeId}
              moduleNameByNodeId={moduleNameByNodeId}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => onSelect({ kind: 'node', moduleId: 'top', nodeId })}
              onOpenDesign={() => onOpenDocument({ kind: 'schematic', moduleId: 'top' })}
            />
          ) : sourceSummary && sourceSummary.fileCount > 0 ? (
            // An imported or source-only project has no graph to draw. Say what it does have.
            <div className="rb-project-canvas-empty" data-testid="ide-project-canvas-sources">
              <strong>No schematic in this project</strong>
              <p>
                {sourceSummary.fileCount} source file{sourceSummary.fileCount === 1 ? '' : 's'}
                {sourceSummary.moduleCount > 0
                  ? ` · ${sourceSummary.moduleCount} module${sourceSummary.moduleCount === 1 ? '' : 's'}`
                  : ''}
              </p>
              <button type="button" className="wb-btn" onClick={() => onOpenDocument({ kind: 'sources' })}>
                Open sources
              </button>
            </div>
          ) : (
            <div className="rb-project-canvas-empty" data-testid="ide-project-canvas-blank">
              <strong>Nothing on the sheet yet</strong>
              <p>Place a part in Design and it will appear here.</p>
              <button type="button" className="wb-btn" onClick={() => onNavigateMode('design')}>
                Open Design
              </button>
            </div>
          )}
          <footer className="rb-project-canvas-foot">
            <label className="rb-doc-top" data-testid="ide-project-active-top">
            <span>Top</span>
            <input
              className="rb-doc-top-input"
              value={topDraft}
              readOnly={!canEditTop}
              aria-label="Active top entity"
              data-testid="ide-project-fpga-top"
              spellCheck={false}
              onChange={(event) => {
                // A valid identifier commits as it is typed (the export reads the authority
                // live); an invalid draft only reports on Enter / blur.
                const next = event.target.value;
                setTopDraft(next);
                setTopError(null);
                const trimmed = next.trim();
                if (canEditTop && TOP_PATTERN.test(trimmed) && trimmed !== topModuleName) onSetTop?.(trimmed);
              }}
              onBlur={() => {
                if (canEditTop) commitTop();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitTop();
                } else if (event.key === 'Escape') {
                  setTopDraft(topModuleName);
                  setTopError(null);
                }
              }}
            />
          </label>
          {topError ? <span className="rb-doc-error" role="alert" data-testid="ide-project-active-top-error">{topError}</span> : null}
            <span className="wb-toolbar-meta">
              {circuit ? `${circuit.nodes.length} components · ${circuit.connections.length} nets` : 'no circuit'}
            </span>
            <span className="wb-toolbar-spacer" />
            <button
              type="button"
              className="wb-link"
              onClick={() => onOpenDocument({ kind: 'schematic', moduleId: 'top' })}
              data-testid="ide-project-overview-open-design-primary"
            >
              Open in Design
            </button>
            <button type="button" className="wb-link" onClick={() => onOpenDocument({ kind: 'architecture' })} data-testid="ide-project-overview-open-architecture">
              Architecture
            </button>
          </footer>
        </section>

        <aside className="rb-project-context" aria-label="Project state">
          <dl className="rb-project-status" data-testid="ide-project-status">
            {statusFacts.map((fact) => (
              <div key={fact.id} className="rb-project-status-row" data-testid={`ide-project-fact-${fact.id}`} data-tone={fact.tone}>
                <dt>{fact.label}</dt>
                <dd>{renderFactValue(fact)}</dd>
              </div>
            ))}
          </dl>

          <div className="rb-project-attention" data-testid="ide-project-attention">
            {leadProblem ? (
              <>
                <p className="rb-project-attention-lead" data-tone={leadProblem.severity === 'error' ? 'error' : leadProblem.severity === 'warning' ? 'warn' : undefined}>
                  <code>{leadProblem.code}</code> {leadProblem.message}
                </p>
                <div className="rb-project-attention-actions">
                  {leadProblem.fixMode ? (
                    <button
                      type="button"
                      className="wb-btn"
                      data-testid={`ide-project-problem-fix-${leadProblem.id}`}
                      onClick={() => onNavigateMode(leadProblem.fixMode as IdeMode)}
                    >
                      Open {leadProblem.fixMode === 'verify' ? 'Simulate' : leadProblem.fixMode === 'hardware' ? 'Board' : leadProblem.fixMode === 'export' ? 'Package' : 'Design'}
                    </button>
                  ) : null}
                  {problems.length > 1 && onOpenProblems ? (
                    <button type="button" className="wb-link" onClick={onOpenProblems} data-testid="ide-project-open-problems">
                      {problems.length} problems
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="rb-project-attention-lead" data-testid="ide-project-attention-clear">
                Nothing is asking for attention.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* ── Everything the project knows about itself, one disclosure away ───────────── */}
      <details className="rb-doc-section rb-project-details" data-testid="ide-project-details">
        <summary>Project details</summary>
        <dl className="rb-facts" data-testid="ide-project-professional-facts">
          {detailFacts.map((fact) => (
            <div key={fact.id} className="rb-fact" data-testid={`ide-project-fact-${fact.id}`} data-tone={fact.tone}>
              <dt>{fact.label}</dt>
              <dd
                className={fact.mono ? 'is-mono' : undefined}
                data-testid={fact.id === 'part' ? 'ide-project-fpga-part' : fact.id === 'hash' ? 'ide-project-hash-short' : undefined}
                data-board-owned={fact.id === 'part' ? 'true' : undefined}
                title={fact.id === 'part' ? 'Owned by the target board profile' : undefined}
              >
                {renderFactValue(fact)}
              </dd>
            </div>
          ))}
        </dl>

      </details>

      <details className="rb-doc-section rb-project-io-details" data-testid="ide-project-io-details">
        <summary>
          I/O boundary <span className="wb-toolbar-meta">{mappingRows.length} signals</span>
        </summary>
        <div className="wb-table-frame">
          <table className="wb-table" data-testid="ide-project-io-table">
            <thead>
              <tr>
                <th scope="col">Signal</th>
                <th scope="col">Dir</th>
                <th scope="col">Port</th>
                <th scope="col">Pin</th>
                <th scope="col">Req</th>
              </tr>
            </thead>
            <tbody>
              {mappingRows.length === 0 ? (
                <tr><td colSpan={5} className="wb-table-empty">No boundary signals.</td></tr>
              ) : (
                mappingRows.map((row) => {
                  const ref: EngineeringObjectRef = { kind: 'signal', fieldId: row.id, runSignal: null, nodeId: row.nodeId };
                  const isSelected = sameEngineeringObject(selected, ref);
                  const missing = row.required && row.pin.trim().length === 0;
                  return (
                    <tr
                      key={row.id}
                      aria-selected={isSelected}
                      data-testid={`ide-project-io-row-${row.id}`}
                      className={missing ? 'is-stale' : undefined}
                      onClick={() => onSelect(ref)}
                      onDoubleClick={() => onOpenDocument({ kind: 'board-io', constraintSetId: 'default' })}
                    >
                      <td className="is-mono">{row.label}</td>
                      <td className="is-mono">{row.direction}</td>
                      <td className="is-mono" title="Artifact port in top.vhd / top.xdc">{xdcPortToken(row.label)}</td>
                      <td className={`is-mono${missing ? ' is-mismatch' : ''}`}>{row.pin.trim() || (row.required ? 'unmapped' : '—')}</td>
                      <td className="is-center">{row.required ? '●' : ''}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </details>

      {starter ? (
        <details className="rb-doc-section rb-project-starter" data-testid="ide-project-starter-brief">
          <summary>
            Lab brief <code data-testid="ide-project-starter-name">{starter.name}</code>
            {starter.lab ? <code data-testid="ide-project-starter-lab">{starter.lab}</code> : null}
          </summary>
          {starter.nextAction ? (
            <p className="wb-toolbar-meta" data-testid="ide-project-starter-next-action">{starter.nextAction}</p>
          ) : null}
          {starter.summary || starter.expectedBehavior ? (
            <div className="rb-project-starter-body" data-testid="ide-project-starter-body">
              {starter.summary ? <p>{starter.summary}</p> : null}
              {starter.expectedBehavior ? (
                <p><strong>Expected behavior:</strong> {starter.expectedBehavior}</p>
              ) : null}
            </div>
          ) : null}
        </details>
      ) : null}

      {problems.length > 0 ? (
        <details className="rb-doc-section" data-testid="ide-project-problems">
          <summary>
            Problems <span className="wb-toolbar-meta">{problems.length}</span>
          </summary>
          <ul className="rb-problem-list">
            {problems.map((problem) => (
              <li key={problem.id} className="wb-panel-line" data-tone={problem.severity === 'error' ? 'error' : problem.severity === 'warning' ? 'warn' : undefined}>
                <span aria-hidden="true">{problem.severity === 'error' ? '✕' : problem.severity === 'warning' ? '▲' : 'i'}</span>
                <span>
                  <code>{problem.code}</code> {problem.message}
                  {problem.fixMode ? (
                    <>
                      {' '}
                      <button type="button" className="wb-link" onClick={() => onNavigateMode(problem.fixMode as IdeMode)}>
                        Open {problem.fixMode === 'verify' ? 'Simulate' : problem.fixMode === 'hardware' ? 'Board' : problem.fixMode === 'export' ? 'Package' : problem.fixMode === 'design' ? 'Design' : problem.fixMode}
                      </button>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
};
