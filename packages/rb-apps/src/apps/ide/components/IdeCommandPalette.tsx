import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  IdeCommandCategory,
  IdeCommandId,
  IdeCommandRegistry,
  IdeCommandSearchMatch,
} from '../ideCommandRegistry';
import {
  searchNavigator,
  type NavigatorEntry,
  type NavigatorGroup,
  type NavigatorKind,
} from '../workbenchNavigator';

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

/**
 * The Universal Navigator (Ctrl+K). One entry searches and executes across
 * commands and every engineering object the project has — signals, buses,
 * modules, instances, files, cases, failures, board resources, constraint
 * lines, artifacts, problems, runs, open documents.
 *
 * Commands still come from the registry; objects come from the derived
 * navigator index. Choosing an object opens its real document and publishes
 * the exact selection; the palette itself mutates nothing.
 */
export interface IdeCommandPaletteProps<TContext> {
  open: boolean;
  registry: IdeCommandRegistry<TContext>;
  context: TContext;
  onClose: () => void;
  /** Derived engineering-object index; absent ⇒ commands only. */
  navigator?: readonly NavigatorEntry[];
  onNavigate?: (entry: NavigatorEntry) => void;
}

type PaletteItem<TContext> =
  | { readonly kind: 'command'; readonly match: IdeCommandSearchMatch<TContext>; readonly id: string }
  | { readonly kind: 'object'; readonly entry: NavigatorEntry; readonly id: string };

interface PaletteGroup<TContext> {
  readonly id: string;
  readonly label: string;
  readonly items: readonly PaletteItem<TContext>[];
  readonly startIndex: number;
  readonly category?: IdeCommandCategory;
  readonly navigatorKind?: NavigatorKind;
}

export function IdeCommandPalette<TContext>({
  open,
  registry,
  context,
  onClose,
  navigator,
  onNavigate,
}: IdeCommandPaletteProps<TContext>): React.ReactElement | null {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [executionMessage, setExecutionMessage] = useState('');
  const [scrollEdges, setScrollEdges] = useState({ canScrollUp: false, canScrollDown: false });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const commandMatches = useMemo(
    () => registry.search(query, context, { includeDisabled: true }),
    [context, query, registry]
  );
  const objectGroups = useMemo<readonly NavigatorGroup[]>(
    () => (navigator && query.trim() ? searchNavigator(navigator, query) : []),
    [navigator, query]
  );
  const openDocumentEntries = useMemo(
    () => (navigator && !query.trim() ? navigator.filter((entry) => entry.kind === 'document') : []),
    [navigator, query]
  );

  const groups = useMemo<readonly PaletteGroup<TContext>[]>(() => {
    const result: PaletteGroup<TContext>[] = [];
    let startIndex = 0;
    const pushGroup = (group: Omit<PaletteGroup<TContext>, 'startIndex'>) => {
      if (group.items.length === 0) return;
      result.push({ ...group, startIndex });
      startIndex += group.items.length;
    };
    // With a query: the objects the user named come first, commands after.
    for (const group of objectGroups) {
      pushGroup({
        id: `object:${group.kind}`,
        label: group.label,
        navigatorKind: group.kind,
        items: group.matches.map((match) => ({ kind: 'object', entry: match.entry, id: `object:${match.entry.id}` })),
      });
    }
    if (openDocumentEntries.length > 0) {
      pushGroup({
        id: 'object:document',
        label: 'Open documents',
        navigatorKind: 'document',
        items: openDocumentEntries.map((entry) => ({ kind: 'object', entry, id: `object:${entry.id}` })),
      });
    }
    for (const group of groupCommandMatches(commandMatches)) {
      pushGroup({
        id: `command:${group.category}`,
        label: COMMAND_CATEGORY_LABELS[group.category],
        category: group.category,
        items: group.matches.map((match) => ({ kind: 'command', match, id: `command:${match.command.id}` })),
      });
    }
    return result;
  }, [commandMatches, objectGroups, openDocumentEntries]);
  const orderedItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);

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
      orderedItems.length === 0 ? 0 : Math.max(0, Math.min(current, orderedItems.length - 1))
    );
  }, [orderedItems.length]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(updateScrollEdges);
    window.addEventListener('resize', updateScrollEdges);
    return () => window.removeEventListener('resize', updateScrollEdges);
  }, [groups.length, open, orderedItems.length, updateScrollEdges]);

  useEffect(() => {
    if (!open || !orderedItems[activeIndex]) return;
    const option = document.getElementById(optionId(orderedItems[activeIndex]));
    if (option && typeof option.scrollIntoView === 'function') {
      option.scrollIntoView({ block: 'nearest' });
    }
    window.requestAnimationFrame(updateScrollEdges);
  }, [activeIndex, open, orderedItems, updateScrollEdges]);

  if (!open) return null;

  const executeCommand = async (match: IdeCommandSearchMatch<TContext>) => {
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

  const activate = (item: PaletteItem<TContext>) => {
    if (item.kind === 'command') {
      void executeCommand(item.match);
      return;
    }
    if (!onNavigate) return;
    onNavigate(item.entry);
    onClose();
  };

  const activeItem = orderedItems[activeIndex];
  const hasObjects = Boolean(navigator);

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
        aria-label={hasObjects ? 'Navigator' : 'Command palette'}
        data-testid="ide-command-palette"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (orderedItems.length > 0) {
              setActiveIndex((index) => Math.min(orderedItems.length - 1, index + 1));
            }
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (orderedItems.length > 0) {
              setActiveIndex((index) => Math.max(0, index - 1));
            }
          } else if (event.key === 'Home' && orderedItems.length > 0) {
            event.preventDefault();
            setActiveIndex(0);
          } else if (event.key === 'End' && orderedItems.length > 0) {
            event.preventDefault();
            setActiveIndex(orderedItems.length - 1);
          } else if (event.key === 'Enter' && activeItem) {
            event.preventDefault();
            activate(activeItem);
          }
        }}
      >
        <header className="ide-command-palette-header">
          <label htmlFor="ide-command-palette-query">{hasObjects ? 'Go to anything' : 'Run a command'}</label>
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
          placeholder={
            hasObjects
              ? 'Signal, module, case, pin, constraint, file, artifact, problem, run or command…'
              : 'Search projects, surfaces, workspace, theme...'
          }
          autoComplete="off"
          spellCheck={false}
          aria-controls="ide-command-palette-results"
          aria-activedescendant={activeItem ? optionId(activeItem) : undefined}
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
            aria-label={hasObjects ? 'Objects and commands' : 'Available commands'}
            onScroll={updateScrollEdges}
            data-testid="ide-command-palette-results"
          >
            {orderedItems.length > 0 ? (
              groups.map((group) => {
                const headingId = groupHeadingId(group.id);
                return (
                  <div
                    key={group.id}
                    role="group"
                    aria-labelledby={headingId}
                    data-command-category={group.category}
                    data-navigator-kind={group.navigatorKind}
                    data-testid={
                      group.category
                        ? `ide-command-category-${group.category}`
                        : `ide-navigator-group-${group.navigatorKind}`
                    }
                  >
                    <div id={headingId} className="ide-shortcuts-section-label">
                      {group.label}
                      {group.navigatorKind ? <span className="wb-toolwindow-count">{group.items.length}</span> : null}
                    </div>
                    {group.items.map((item, indexWithinGroup) => {
                      const index = group.startIndex + indexWithinGroup;
                      const active = index === activeIndex;
                      if (item.kind === 'command') {
                        const { match } = item;
                        const disabled = match.availability.state === 'disabled';
                        return (
                          <button
                            id={optionId(item)}
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            aria-disabled={disabled}
                            className={`ide-command-palette-option${active ? ' is-active' : ''}`}
                            onMouseMove={() => setActiveIndex(index)}
                            onClick={() => activate(item)}
                            data-command-id={match.command.id}
                            data-testid={`ide-command-${match.command.id}`}
                          >
                            <span className="ide-command-palette-option-copy">
                              <strong>{match.command.title}</strong>
                              <small>{disabled ? match.availability.reason : group.label}</small>
                            </span>
                            {match.command.shortcut ? <kbd>{match.command.shortcut.label}</kbd> : null}
                          </button>
                        );
                      }
                      const { entry } = item;
                      return (
                        <button
                          id={optionId(item)}
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`ide-command-palette-option ide-navigator-option${active ? ' is-active' : ''}${entry.ambiguity ? ' is-ambiguous' : ''}`}
                          onMouseMove={() => setActiveIndex(index)}
                          onClick={() => activate(item)}
                          data-navigator-kind={entry.kind}
                          data-testid={`ide-navigator-${entry.id}`}
                          title={entry.ambiguity ?? undefined}
                        >
                          <span className="ide-command-palette-option-copy">
                            <strong className={entry.mono ? 'is-mono' : undefined}>{entry.title}</strong>
                            <small>{entry.subtitle}</small>
                            {entry.facts.length > 0 ? (
                              <span className="ide-navigator-facts">
                                {entry.facts.map((fact) => (
                                  <code key={fact}>{fact}</code>
                                ))}
                              </span>
                            ) : null}
                          </span>
                          {entry.ambiguity ? (
                            <span className="ide-navigator-ambiguous" aria-label="Identity ambiguous">?</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <p className="ide-command-palette-empty">
                {hasObjects && query.trim() ? 'Nothing in this project matches.' : 'No matching command.'}
              </p>
            )}
          </div>
          {scrollEdges.canScrollUp ? (
            <div className="ide-command-palette-scroll-cue is-top" data-testid="ide-command-palette-scroll-up" aria-hidden="true">
              More above
            </div>
          ) : null}
          {scrollEdges.canScrollDown ? (
            <div className="ide-command-palette-scroll-cue is-bottom" data-testid="ide-command-palette-scroll-down" aria-hidden="true">
              More below
            </div>
          ) : null}
        </div>
        <footer className="ide-command-palette-footer" aria-live="polite">
          {executionMessage ||
            (activeItem?.kind === 'object'
              ? activeItem.entry.ambiguity
                ? `Ambiguous — ${activeItem.entry.ambiguity}`
                : `Enter opens ${activeItem.entry.document ? describeDocument(activeItem.entry) : 'the object'} and selects it.`
              : 'Arrow keys move. Enter runs. Escape closes.')}
        </footer>
      </section>
    </div>
  );
}

function describeDocument(entry: NavigatorEntry): string {
  const doc = entry.document;
  if (!doc) return 'the object';
  switch (doc.kind) {
    case 'schematic':
      return doc.moduleId === 'top' ? 'the schematic' : `the ${doc.moduleId} schematic`;
    case 'cases':
      return 'Cases';
    case 'timing':
      return 'Timing';
    case 'waveform':
      return 'Waveform';
    case 'board-io':
      return 'Board mapping';
    case 'package-artifact':
      return 'Package';
    case 'handoff':
      return 'the Handoff overview';
    case 'source-file':
      return 'the source file';
    case 'runs':
      return 'Runs';
    default:
      return doc.kind.replace(/-/g, ' ');
  }
}

function optionId<TContext>(item: PaletteItem<TContext>): string {
  if (item.kind === 'command') return `ide-command-option-${item.match.command.id.replaceAll('.', '-')}`;
  return `ide-navigator-option-${item.entry.id.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}

function groupHeadingId(groupId: string): string {
  return `ide-command-group-${groupId.replace(/[^a-zA-Z0-9_-]+/g, '-')}-heading`;
}

interface GroupedCommandMatches<TContext> {
  readonly category: IdeCommandCategory;
  readonly matches: readonly IdeCommandSearchMatch<TContext>[];
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
  return Array.from(matchesByCategory, ([category, categoryMatches]) => ({ category, matches: categoryMatches }));
}

export type { IdeCommandId };
