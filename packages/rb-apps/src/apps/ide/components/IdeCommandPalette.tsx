import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  IdeCommandCategory,
  IdeCommandId,
  IdeCommandRegistry,
  IdeCommandSearchMatch,
} from '../ideCommandRegistry';

const COMMAND_CATEGORY_LABELS: Readonly<Record<IdeCommandCategory, string>> = {
  navigation: 'Navigation',
  project: 'Project',
  edit: 'Edit',
  design: 'Design',
  simulation: 'Simulation',
  board: 'Board',
  export: 'Build & Export',
  workspace: 'Workspace',
  theme: 'Theme',
  help: 'Help',
};

export interface IdeCommandPaletteProps<TContext> {
  open: boolean;
  registry: IdeCommandRegistry<TContext>;
  context: TContext;
  onClose: () => void;
}

export function IdeCommandPalette<TContext>({
  open,
  registry,
  context,
  onClose,
}: IdeCommandPaletteProps<TContext>): React.ReactElement | null {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [executionMessage, setExecutionMessage] = useState('');
  const [scrollEdges, setScrollEdges] = useState({ canScrollUp: false, canScrollDown: false });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const matches = useMemo(
    () => registry.search(query, context, { includeDisabled: true }),
    [context, query, registry]
  );
  const groupedMatches = useMemo(() => groupCommandMatches(matches), [matches]);
  const orderedMatches = useMemo(
    () => groupedMatches.flatMap((group) => group.matches),
    [groupedMatches]
  );
  const updateScrollEdges = useCallback(() => {
    const results = resultsRef.current;
    if (!results) return;
    const next = {
      canScrollUp: results.scrollTop > 1,
      canScrollDown: results.scrollTop + results.clientHeight < results.scrollHeight - 1,
    };
    setScrollEdges((current) =>
      current.canScrollUp === next.canScrollUp && current.canScrollDown === next.canScrollDown
        ? current
        : next
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    setExecutionMessage('');
    setScrollEdges({ canScrollUp: false, canScrollDown: false });
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setActiveIndex((current) =>
      orderedMatches.length === 0
        ? 0
        : Math.max(0, Math.min(current, orderedMatches.length - 1))
    );
  }, [orderedMatches.length]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(updateScrollEdges);
    window.addEventListener('resize', updateScrollEdges);
    return () => window.removeEventListener('resize', updateScrollEdges);
  }, [groupedMatches.length, open, orderedMatches.length, updateScrollEdges]);

  useEffect(() => {
    if (!open || !orderedMatches[activeIndex]) return;
    const option = document.getElementById(commandOptionId(orderedMatches[activeIndex].command.id));
    if (option && typeof option.scrollIntoView === 'function') {
      option.scrollIntoView({ block: 'nearest' });
    }
    window.requestAnimationFrame(updateScrollEdges);
  }, [activeIndex, open, orderedMatches, updateScrollEdges]);

  if (!open) return null;

  const execute = async (match: IdeCommandSearchMatch<TContext>) => {
    const result = await registry.execute(match.command.id, context);
    if (result.status === 'executed') {
      onClose();
      return;
    }
    if (result.status === 'disabled') {
      setExecutionMessage(result.reason);
      return;
    }
    setExecutionMessage('That command is not available in the current workspace.');
  };

  return (
    <div
      className="ide-command-palette-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      data-testid="ide-command-palette-backdrop"
    >
      <section
        className="ide-command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        data-testid="ide-command-palette"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (orderedMatches.length > 0) {
              setActiveIndex((index) => Math.min(orderedMatches.length - 1, index + 1));
            }
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (orderedMatches.length > 0) {
              setActiveIndex((index) => Math.max(0, index - 1));
            }
          } else if (event.key === 'Enter' && orderedMatches[activeIndex]) {
            event.preventDefault();
            void execute(orderedMatches[activeIndex]);
          }
        }}
      >
        <header className="ide-command-palette-header">
          <label htmlFor="ide-command-palette-query">Run a command</label>
          <kbd>Ctrl K</kbd>
        </header>
        <input
          ref={inputRef}
          id="ide-command-palette-query"
          className="ide-command-palette-query"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setExecutionMessage('');
          }}
          placeholder="Search projects, surfaces, workspace, theme..."
          autoComplete="off"
          aria-controls="ide-command-palette-results"
          aria-activedescendant={orderedMatches[activeIndex] ? commandOptionId(orderedMatches[activeIndex].command.id) : undefined}
          data-testid="ide-command-palette-query"
        />
        <div
          className="ide-command-palette-results-frame"
          data-can-scroll-up={scrollEdges.canScrollUp ? 'true' : 'false'}
          data-can-scroll-down={scrollEdges.canScrollDown ? 'true' : 'false'}
        >
          <div
            ref={resultsRef}
            id="ide-command-palette-results"
            className="ide-command-palette-results"
            role="listbox"
            aria-label="Available commands"
            onScroll={updateScrollEdges}
            data-testid="ide-command-palette-results"
          >
            {orderedMatches.length > 0 ? (
              groupedMatches.map((group) => {
                const categoryLabel = COMMAND_CATEGORY_LABELS[group.category];
                const categoryHeadingId = commandCategoryHeadingId(group.category);
                return (
                  <div
                    key={group.category}
                    role="group"
                    aria-labelledby={categoryHeadingId}
                    data-command-category={group.category}
                    data-testid={`ide-command-category-${group.category}`}
                  >
                    <div
                      id={categoryHeadingId}
                      className="ide-shortcuts-section-label"
                    >
                      {categoryLabel}
                    </div>
                    {group.matches.map((match, indexWithinGroup) => {
                      const index = group.startIndex + indexWithinGroup;
                      const disabled = match.availability.state === 'disabled';
                      return (
                        <button
                          id={commandOptionId(match.command.id)}
                          key={match.command.id}
                          type="button"
                          role="option"
                          aria-selected={index === activeIndex}
                          aria-disabled={disabled}
                          className={`ide-command-palette-option${index === activeIndex ? ' is-active' : ''}`}
                          onMouseMove={() => setActiveIndex(index)}
                          onClick={() => void execute(match)}
                          data-command-id={match.command.id}
                          data-testid={`ide-command-${match.command.id}`}
                        >
                          <span className="ide-command-palette-option-copy">
                            <strong>{match.command.title}</strong>
                            <small>
                              {disabled ? match.availability.reason : categoryLabel}
                            </small>
                          </span>
                          {match.command.shortcut ? <kbd>{match.command.shortcut.label}</kbd> : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <p className="ide-command-palette-empty">No matching command.</p>
            )}
          </div>
          {scrollEdges.canScrollUp ? (
            <div
              className="ide-command-palette-scroll-cue is-top"
              data-testid="ide-command-palette-scroll-up"
              aria-hidden="true"
            >
              More commands above
            </div>
          ) : null}
          {scrollEdges.canScrollDown ? (
            <div
              className="ide-command-palette-scroll-cue is-bottom"
              data-testid="ide-command-palette-scroll-down"
              aria-hidden="true"
            >
              More commands below
            </div>
          ) : null}
        </div>
        <footer className="ide-command-palette-footer" aria-live="polite">
          {executionMessage || 'Arrow keys move. Enter runs. Escape closes.'}
        </footer>
      </section>
    </div>
  );
}

function commandOptionId(commandId: IdeCommandId): string {
  return `ide-command-option-${commandId.replaceAll('.', '-')}`;
}

function commandCategoryHeadingId(category: IdeCommandCategory): string {
  return `ide-command-category-${category}-heading`;
}

interface GroupedCommandMatches<TContext> {
  readonly category: IdeCommandCategory;
  readonly matches: readonly IdeCommandSearchMatch<TContext>[];
  readonly startIndex: number;
}

function groupCommandMatches<TContext>(
  matches: readonly IdeCommandSearchMatch<TContext>[]
): readonly GroupedCommandMatches<TContext>[] {
  const matchesByCategory = new Map<IdeCommandCategory, IdeCommandSearchMatch<TContext>[]>();
  for (const match of matches) {
    const categoryMatches = matchesByCategory.get(match.command.category);
    if (categoryMatches) {
      categoryMatches.push(match);
    } else {
      matchesByCategory.set(match.command.category, [match]);
    }
  }

  let startIndex = 0;
  return Array.from(matchesByCategory, ([category, categoryMatches]) => {
    const group = {
      category,
      matches: categoryMatches,
      startIndex,
    } satisfies GroupedCommandMatches<TContext>;
    startIndex += categoryMatches.length;
    return group;
  });
}
