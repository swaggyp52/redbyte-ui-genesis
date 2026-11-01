import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PROBLEM_CATEGORY_LABELS,
  countProblems,
  useEngineeringProblems,
  type EngineeringProblem,
  type ProblemCategory,
  type ProblemSeverity,
} from '../engineeringProblems';
import { useEngineeringSelection } from '../engineeringSelection';
import { openWorkbenchDocument } from '../workbenchNavigation';

/**
 * The Problems tool window — one view over the unified ledger, mounted in
 * every workspace's bottom dock. Filtering by severity and category, grouping
 * by category, roving keyboard navigation, Enter/click opens the owning
 * document and publishes the exact object. It never edits anything.
 */
export interface ProblemsPanelProps {
  /** Compact projection: only these categories (a workspace's local view). */
  readonly categories?: readonly ProblemCategory[];
  /** Origin published with selections (defaults to 'problems'). */
  readonly origin?: 'problems' | 'bottom-panel';
}

const SEVERITY_GLYPH: Readonly<Record<ProblemSeverity, string>> = { error: 'E', warning: 'W', info: 'i' };
const SEVERITY_LABEL: Readonly<Record<ProblemSeverity, string>> = { error: 'Error', warning: 'Warning', info: 'Note' };

export function ProblemsPanel({ categories, origin = 'problems' }: ProblemsPanelProps): React.ReactElement {
  const ledger = useEngineeringProblems((state) => state.problems);
  const selected = useEngineeringSelection((state) => state.selected);
  const select = useEngineeringSelection((state) => state.select);
  const [severity, setSeverity] = useState<ProblemSeverity | 'all'>('all');
  const [category, setCategory] = useState<ProblemCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const scoped = useMemo(
    () => (categories ? ledger.filter((problem) => categories.includes(problem.category)) : ledger),
    [categories, ledger]
  );
  const counts = useMemo(() => countProblems(scoped), [scoped]);
  const presentCategories = useMemo(() => {
    const set = new Set<ProblemCategory>();
    for (const problem of scoped) set.add(problem.category);
    return Array.from(set);
  }, [scoped]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scoped.filter(
      (problem) =>
        (severity === 'all' || problem.severity === severity) &&
        (category === 'all' || problem.category === category) &&
        (!needle ||
          problem.message.toLowerCase().includes(needle) ||
          (problem.objectLabel ?? '').toLowerCase().includes(needle) ||
          (problem.detail ?? '').toLowerCase().includes(needle) ||
          problem.code.toLowerCase().includes(needle))
    );
  }, [category, query, scoped, severity]);
  const grouped = useMemo(() => {
    const byCategory = new Map<ProblemCategory, EngineeringProblem[]>();
    for (const problem of visible) {
      const list = byCategory.get(problem.category) ?? [];
      list.push(problem);
      byCategory.set(problem.category, list);
    }
    let start = 0;
    return Array.from(byCategory, ([key, problems]) => {
      const group = { category: key, problems, start };
      start += problems.length;
      return group;
    });
  }, [visible]);

  useEffect(() => {
    setFocusIndex((current) => (visible.length === 0 ? 0 : Math.min(current, visible.length - 1)));
  }, [visible.length]);

  const selectedProblemId = selected?.kind === 'problem' ? selected.problemId : null;

  const open = (problem: EngineeringProblem) => {
    select({ kind: 'problem', problemId: problem.id }, origin);
    if (problem.document) openWorkbenchDocument(problem.document);
    // Publish the owning object second so the landing document selects it.
    if (problem.object) {
      window.setTimeout(() => select(problem.object as NonNullable<typeof problem.object>, origin), 0);
    }
  };

  const focusRow = (index: number) => {
    setFocusIndex(index);
    const row = listRef.current?.querySelector<HTMLElement>(`[data-problem-index="${index}"]`);
    row?.focus();
  };

  return (
    <div className="rb-problems-panel" data-testid="ide-problems-panel">
      <div className="rb-problems-bar" role="toolbar" aria-label="Problem filters">
        <div className="rb-problems-severities" role="group" aria-label="Severity">
          {(['all', 'error', 'warning', 'info'] as const).map((level) => {
            const count = level === 'all' ? counts.total : counts[level];
            return (
              <button
                key={level}
                type="button"
                className={`wb-btn wb-btn--ghost rb-problems-sevbtn${severity === level ? ' is-active' : ''}`}
                aria-pressed={severity === level}
                onClick={() => setSeverity(level)}
                data-testid={`ide-problems-filter-${level}`}
                data-severity={level}
              >
                {level === 'all' ? 'All' : SEVERITY_LABEL[level] + (level === 'info' ? 's' : 's')}
                <span className="wb-toolwindow-count">{count}</span>
              </button>
            );
          })}
        </div>
        {presentCategories.length > 1 ? (
          <label className="rb-problems-category">
            <span className="wb-visually-hidden">Category</span>
            <select
              className="wb-select"
              value={category}
              onChange={(event) => setCategory(event.target.value as ProblemCategory | 'all')}
              data-testid="ide-problems-category"
            >
              <option value="all">All categories</option>
              {presentCategories.map((key) => (
                <option key={key} value={key}>
                  {PROBLEM_CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <input
          className="wb-input rb-problems-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter problems"
          aria-label="Filter problems"
          data-testid="ide-problems-search"
        />
      </div>
      {visible.length === 0 ? (
        <p className="rb-problems-empty" data-testid="ide-problems-empty">
          {scoped.length === 0
            ? 'No problems. Every authority reports clean.'
            : 'No problems match the current filter.'}
        </p>
      ) : (
        <div
          ref={listRef}
          className="rb-problems"
          role="grid"
          aria-label="Problems"
          aria-rowcount={visible.length}
          data-testid="ide-problems-list"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              focusRow(Math.min(visible.length - 1, focusIndex + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              focusRow(Math.max(0, focusIndex - 1));
            } else if (event.key === 'Home') {
              event.preventDefault();
              focusRow(0);
            } else if (event.key === 'End') {
              event.preventDefault();
              focusRow(visible.length - 1);
            } else if (event.key === 'Enter' && visible[focusIndex]) {
              event.preventDefault();
              open(visible[focusIndex]);
            }
          }}
        >
          {grouped.map((group) => (
            <div key={group.category} role="rowgroup" data-testid={`ide-problems-group-${group.category}`}>
              <div className="rb-problems-group" role="row">
                <span role="columnheader" className="rb-problems-group-label">
                  {PROBLEM_CATEGORY_LABELS[group.category]}
                  <span className="wb-toolwindow-count">{group.problems.length}</span>
                </span>
              </div>
              {group.problems.map((problem, indexWithinGroup) => {
                const index = group.start + indexWithinGroup;
                const isSelected = problem.id === selectedProblemId;
                return (
                  <button
                    type="button"
                    role="row"
                    key={problem.id}
                    className={`rb-problems-row${isSelected ? ' is-selected' : ''}`}
                    data-severity={problem.severity}
                    data-freshness={problem.freshness}
                    data-problem-index={index}
                    data-testid={`ide-problem-${problem.id}`}
                    tabIndex={index === focusIndex ? 0 : -1}
                    aria-selected={isSelected}
                    onFocus={() => setFocusIndex(index)}
                    onClick={() => open(problem)}
                    title={problem.action ? `${problem.action} · ${problem.authority}` : problem.authority}
                  >
                    <span className="rb-problems-sev" role="gridcell" aria-label={SEVERITY_LABEL[problem.severity]}>
                      {SEVERITY_GLYPH[problem.severity]}
                    </span>
                    <span className="rb-problems-main" role="gridcell">
                      <span className="rb-problems-title">{problem.message}</span>
                      {problem.detail ? <span className="rb-problems-msg">{problem.detail}</span> : null}
                    </span>
                    <span className="rb-problems-meta" role="gridcell">
                      {problem.objectLabel ? <code className="rb-problems-ref">{problem.objectLabel}</code> : null}
                      {problem.location?.file ? (
                        <code className="rb-problems-ref">
                          {problem.location.file}
                          {problem.location.line !== undefined ? `:${problem.location.line}` : ''}
                        </code>
                      ) : null}
                      {problem.freshness === 'stale' ? <span className="rb-problems-stale">stale</span> : null}
                      <span className="rb-problems-authority">{problem.authority}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
