import React, { useCallback, useMemo, useRef, useState } from 'react';
import { sameEngineeringObject, type EngineeringObjectRef } from '../../engineeringSelection';
import { documentKey, type WorkbenchDocument } from '../../workbenchDocuments';
import type { IdeMode } from '../../workflowStages';
import {
  filterExplorer,
  type ExplorerRowKind,
  type ProjectExplorerGroup,
  type ProjectExplorerRow,
} from './projectWorkbenchModel';

export interface ProjectExplorerProps {
  readonly groups: readonly ProjectExplorerGroup[];
  readonly selected: EngineeringObjectRef | null;
  readonly onSelect: (ref: EngineeringObjectRef) => void;
  readonly onOpenDocument: (doc: WorkbenchDocument) => void;
  readonly onNavigateMode: (mode: IdeMode) => void;
  /** Key of the active workbench document; document rows read as current, not selected. */
  readonly activeDocumentKey?: string | null;
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ROW_ICON: Record<ExplorerRowKind, React.ReactNode> = {
  module: <svg viewBox="0 0 14 14" {...stroke}><rect x="2.5" y="2.5" width="9" height="9" rx="1" /><path d="M1 5h1.5M1 9h1.5M11.5 5H13M11.5 9H13" /></svg>,
  instance: <svg viewBox="0 0 14 14" {...stroke}><rect x="3.5" y="3.5" width="7" height="7" rx="0.5" /><path d="M1.5 5.5h2M1.5 8.5h2M10.5 5.5h2M10.5 8.5h2" /></svg>,
  component: <svg viewBox="0 0 14 14" {...stroke}><path d="M3 3h3.5a4 4 0 0 1 0 8H3z" /><path d="M1 5h2M1 9h2M10.5 7H13" /></svg>,
  macro: <svg viewBox="0 0 14 14" {...stroke}><rect x="2" y="2" width="10" height="10" rx="1" strokeDasharray="2 1.5" /></svg>,
  'source-file': <svg viewBox="0 0 14 14" {...stroke}><path d="M3.5 1.5h5l3 3v8h-8z" /><path d="M8.5 1.5V4.5h3M5.5 8h3M5.5 10h3" /></svg>,
  scenario: <svg viewBox="0 0 14 14" {...stroke}><rect x="1.5" y="2.5" width="11" height="9" rx="0.5" /><path d="M1.5 5.5h11M1.5 8.5h11M5.5 2.5v9" /></svg>,
  'constraint-set': <svg viewBox="0 0 14 14" {...stroke}><rect x="4" y="4" width="6" height="6" rx="0.5" /><path d="M6 4V1.5M8 4V1.5M6 12.5V10M8 12.5V10M4 6H1.5M4 8H1.5M12.5 6H10M12.5 8H10" /></svg>,
  artifact: <svg viewBox="0 0 14 14" {...stroke}><path d="M3 2h5l3 3v7H3z" /><path d="M8 2v3h3" /></svg>,
  run: <svg viewBox="0 0 14 14" {...stroke}><path d="M1.5 9.5h2v-5h2v5h2v-5h2v5h2" /></svg>,
  problem: <svg viewBox="0 0 14 14" {...stroke}><circle cx="7" cy="7" r="5.5" /><path d="M7 4.5v3M7 9.5v.5" /></svg>,
  io: <svg viewBox="0 0 14 14" {...stroke}><path d="M1.5 7h5M6.5 4l3 3-3 3M9.5 3v8" /></svg>,
  document: <svg viewBox="0 0 14 14" {...stroke}><rect x="2" y="2" width="10" height="10" rx="1" /><path d="M2 5.5h10M5.5 5.5v6.5" /></svg>,
};

/**
 * Project Explorer — one compact tree over the project's engineering objects.
 * Single click selects (publishes the engineering object), double-click / Enter
 * opens the object's document, Arrow keys move, Space toggles a group. It owns
 * no data: every row is a typed reference derived from the authorities.
 */
export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
  groups,
  selected,
  onSelect,
  onOpenDocument,
  onNavigateMode,
  activeDocumentKey = null,
}) => {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ generated: true, runs: true });
  const listRef = useRef<HTMLDivElement | null>(null);

  const visibleGroups = useMemo(() => filterExplorer(groups, query), [groups, query]);
  const flatRows = useMemo(
    () =>
      visibleGroups.flatMap((group) =>
        collapsed[group.id] && !query ? [] : group.rows.map((row) => ({ group, row }))
      ),
    [collapsed, query, visibleGroups]
  );

  const activate = useCallback(
    (row: ProjectExplorerRow) => {
      if (row.kind !== 'document') onSelect(row.select);
      if (row.open) onOpenDocument(row.open);
      else if (row.navigateMode) onNavigateMode(row.navigateMode);
    },
    [onNavigateMode, onOpenDocument, onSelect]
  );

  const focusRow = (key: string) => {
    listRef.current?.querySelector<HTMLButtonElement>(`[data-row-key="${CSS.escape(key)}"]`)?.focus();
  };

  const onRowKey = (event: React.KeyboardEvent, index: number, row: ProjectExplorerRow) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = flatRows[index + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next) {
        onSelect(next.row.select);
        focusRow(next.row.key);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      activate(row);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const target = flatRows[event.key === 'Home' ? 0 : flatRows.length - 1];
      if (target) {
        onSelect(target.row.select);
        focusRow(target.row.key);
      }
    }
  };

  const totalRows = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <section className="wb-toolwindow rb-project-explorer" data-testid="ide-project-explorer" aria-label="Project explorer">
      <header className="wb-toolwindow-header">
        <span>Explorer</span>
        <span className="wb-toolwindow-count" data-testid="ide-project-explorer-count">{totalRows}</span>
      </header>
      <div className="wb-search">
        <svg viewBox="0 0 14 14" width="12" height="12" {...stroke} aria-hidden="true"><circle cx="6" cy="6" r="4" /><path d="M9 9l3.5 3.5" /></svg>
        <input
          type="search"
          value={query}
          placeholder="Filter objects"
          aria-label="Filter project objects"
          data-testid="ide-project-explorer-filter"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div ref={listRef} className="wb-toolwindow-body" role="tree" aria-label="Project objects">
        {visibleGroups.map((group) => {
          const isCollapsed = Boolean(collapsed[group.id]) && !query;
          return (
            <div key={group.id} className="wb-tree-group" role="group" aria-label={group.label} data-testid={`ide-project-explorer-group-${group.id}`}>
              <div className="wb-tree-heading">
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.label}`}
                  onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                >
                  {isCollapsed ? '▸' : '▾'}
                </button>
                <span>{group.label}</span>
                <span className="wb-toolwindow-count">{group.count}</span>
              </div>
              {isCollapsed
                ? null
                : group.rows.length === 0
                  ? <div className="rb-project-explorer-empty">none</div>
                  : group.rows.map((row) => {
                      const index = flatRows.findIndex((entry) => entry.row.key === row.key);
                      const isDocumentRow = row.kind === 'document';
                      const isCurrentDocument = isDocumentRow && Boolean(row.open) && documentKey(row.open as WorkbenchDocument) === activeDocumentKey;
                      const isSelected = isDocumentRow ? isCurrentDocument : sameEngineeringObject(selected, row.select);
                      return (
                        <button
                          key={row.key}
                          type="button"
                          role="treeitem"
                          className="wb-tree-row"
                          style={{ ['--wb-depth' as string]: row.depth }}
                          data-row-key={row.key}
                          data-row-kind={row.kind}
                          data-testid={`ide-project-row-${row.key}`}
                          aria-selected={isSelected}
                          aria-current={isCurrentDocument ? 'page' : row.current ? 'true' : undefined}
                          tabIndex={isSelected || (index === 0 && !selected) ? 0 : -1}
                          title={row.meta ? `${row.label} — ${row.meta}` : row.label}
                          onClick={() => (isDocumentRow ? activate(row) : onSelect(row.select))}
                          onDoubleClick={() => activate(row)}
                          onKeyDown={(event) => onRowKey(event, index, row)}
                        >
                          <span className="wb-tree-chevron" aria-hidden="true" />
                          <span className="wb-tree-icon" data-tone={row.tone}>{ROW_ICON[row.kind]}</span>
                          <span className="wb-tree-label">
                            <span>{row.label}</span>
                            {row.meta ? <code className="wb-tree-meta">{row.meta}</code> : null}
                          </span>
                          {row.tone ? <span className="wb-mark" data-tone={row.tone} aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
            </div>
          );
        })}
        {visibleGroups.length === 0 ? <div className="wb-empty">No objects match “{query}”.</div> : null}
      </div>
    </section>
  );
};
