import React, { useEffect, useState } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { sameEngineeringObject, type EngineeringObjectRef } from '../../engineeringSelection';
import type { WorkbenchDocument } from '../../workbenchDocuments';
import type { IdeMode } from '../../workflowStages';
import { ArchitecturePreview } from './ArchitecturePreview';
import type { OverviewFact, ProjectMappingRowLike, ProjectProblem } from './projectWorkbenchModel';

export interface ProjectOverviewDocumentProps {
  readonly projectName: string;
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
}

const TOP_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

/**
 * Overview document — compact technical facts (a property strip, not cards),
 * the architecture view with real area, the I/O boundary table, and the actual
 * problems. No goal paragraph, no next-step narration, no recent projects.
 */
export const ProjectOverviewDocument: React.FC<ProjectOverviewDocumentProps> = ({
  projectName,
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

  return (
    <div className="rb-doc rb-project-overview" data-testid="ide-project-overview-document">
      <header className="rb-doc-header">
        <h2 className="rb-doc-title" data-testid="ide-project-overview-title">{projectName}</h2>
        <span className="rb-doc-header-sep" aria-hidden="true" />
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
              // A valid identifier commits as it is typed (the export reads the
              // authority live); an invalid draft only reports on Enter / blur.
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
        <span className="wb-toolbar-spacer" />
        <button type="button" className="wb-btn" onClick={() => onOpenDocument({ kind: 'schematic', moduleId: 'top' })} data-testid="ide-project-overview-open-design-primary">
          Open schematic
        </button>
      </header>

      <dl className="rb-facts" data-testid="ide-project-professional-facts">
        {facts.map((fact) => (
          <div key={fact.id} className="rb-fact" data-testid={`ide-project-fact-${fact.id}`} data-tone={fact.tone}>
            <dt>{fact.label}</dt>
            <dd
              className={fact.mono ? 'is-mono' : undefined}
              data-testid={fact.id === 'part' ? 'ide-project-fpga-part' : undefined}
              data-board-owned={fact.id === 'part' ? 'true' : undefined}
              title={fact.id === 'part' ? 'Owned by the target board profile' : undefined}
            >
              {fact.open || fact.navigateMode ? (
                <button
                  type="button"
                  className="wb-link"
                  onClick={() => (fact.open ? onOpenDocument(fact.open) : fact.navigateMode ? onNavigateMode(fact.navigateMode) : undefined)}
                >
                  {fact.value}
                </button>
              ) : (
                fact.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="rb-project-overview-body">
        <section className="rb-doc-section rb-project-overview-arch" aria-label="Architecture" data-testid="ide-project-design-overview">
          <header className="rb-doc-section-header">
            <span>Architecture</span>
            <code>{topModuleName}</code>
            <span className="wb-toolbar-spacer" />
            <span className="wb-toolbar-meta">
              {circuit ? `${circuit.nodes.length} components · ${circuit.connections.length} nets` : 'no circuit'}
            </span>
            <button type="button" className="wb-link" onClick={() => onOpenDocument({ kind: 'architecture' })} data-testid="ide-project-overview-open-architecture">
              Architecture
            </button>
          </header>
          {circuit && circuit.nodes.length > 0 ? (
            <ArchitecturePreview
              circuit={circuit}
              ioLabelByNodeId={ioLabelByNodeId}
              moduleNameByNodeId={moduleNameByNodeId}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => onSelect({ kind: 'node', moduleId: 'top', nodeId })}
              onOpenDesign={() => onOpenDocument({ kind: 'schematic', moduleId: 'top' })}
            />
          ) : (
            <div className="wb-empty">
              <strong>No circuit yet.</strong>
              <button type="button" className="wb-btn" onClick={() => onNavigateMode('design')}>Open Design</button>
            </div>
          )}
        </section>

        <section className="rb-doc-section rb-project-overview-io" aria-label="I/O boundary">
          <header className="rb-doc-section-header">
            <span>I/O boundary</span>
            <span className="wb-toolbar-spacer" />
            <span className="wb-toolbar-meta">{mappingRows.length} signals</span>
          </header>
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
                        <td className="is-mono">{row.port}</td>
                        <td className={`is-mono${missing ? ' is-mismatch' : ''}`}>{row.pin.trim() || (row.required ? 'unmapped' : '—')}</td>
                        <td className="is-center">{row.required ? '●' : ''}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {problems.length > 0 ? (
        <section className="rb-doc-section" aria-label="Problems" data-testid="ide-project-problems">
          <header className="rb-doc-section-header">
            <span>Problems</span>
            <span className="wb-toolbar-spacer" />
            <span className="wb-toolbar-meta">{problems.length}</span>
          </header>
          <ul className="rb-problem-list">
            {problems.map((problem) => (
              <li key={problem.id} className="wb-panel-line" data-tone={problem.severity === 'error' ? 'error' : problem.severity === 'warning' ? 'warn' : undefined}>
                <span aria-hidden="true">{problem.severity === 'error' ? '✕' : problem.severity === 'warning' ? '▲' : 'i'}</span>
                <span>
                  <code>{problem.code}</code> {problem.message}
                  {problem.fixMode ? (
                    <>
                      {' '}
                      <button type="button" className="wb-link" data-testid={`ide-project-problem-fix-${problem.id}`} onClick={() => onNavigateMode(problem.fixMode as IdeMode)}>
                        Open {problem.fixMode === 'verify' ? 'Simulate' : problem.fixMode === 'hardware' ? 'Board' : problem.fixMode === 'export' ? 'Package' : problem.fixMode === 'design' ? 'Design' : problem.fixMode}
                      </button>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
