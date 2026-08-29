import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IdeButton, IdeEmptyState } from '../components/IdePrimitives';
import { SurfacePanel } from '../components/SurfaceLayoutPrimitives';
import { COMPONENT_DEFINITION_REGISTRY } from '../componentDefinitions';

/**
 * DesignComponentLibrary — the Design left-dock component discovery owner.
 *
 * Extracted from the inline Components-tab JSX in DesignSurface so component
 * discovery has one focused owner. Renders the search-first library: Recent,
 * Common, Board Resources, Inputs & Outputs, Logic Gates, Sequential & Timing,
 * and Reusable Blocks. Placement, filtering, and catalog truth stay with their
 * existing authorities (DesignSurface placement state machine, palette query
 * filters, COMPONENT_DEFINITION_REGISTRY); this component only presents them.
 *
 * All pre-existing data-testids are preserved verbatim — a large browser-gate
 * surface keys off them.
 */

export interface DesignLibraryPaletteItem {
  type: string;
  title: string;
  subtitle: string;
  glyph: string;
  paletteBadge?: string;
}

export interface DesignLibraryBoardEntry {
  alias: string;
  kind: 'switch' | 'button' | 'clock' | 'reset' | 'led' | 'segment' | 'anode' | 'dp';
  direction: 'in' | 'out';
}

export interface DesignLibraryBoardGroup {
  id: string;
  title: string;
  description: string;
  entries: DesignLibraryBoardEntry[];
}

export interface DesignLibraryCategories {
  io: DesignLibraryPaletteItem[];
  logic: DesignLibraryPaletteItem[];
  sequential: DesignLibraryPaletteItem[];
  sequentialRegisters: DesignLibraryPaletteItem[];
  sequentialTiming: DesignLibraryPaletteItem[];
  sequentialLegacy: DesignLibraryPaletteItem[];
  components: DesignLibraryPaletteItem[];
}

export interface DesignLibraryPendingPlacement {
  kind: 'node' | 'board-io';
  nodeType?: string;
  boardIoEntry?: { alias: string; direction: 'in' | 'out' };
}

export interface DesignComponentLibraryProps {
  query: string;
  onQueryChange: (value: string) => void;
  commonItems: DesignLibraryPaletteItem[];
  categories: DesignLibraryCategories;
  boardGroups: DesignLibraryBoardGroup[];
  boardResourcesCount: number;
  pendingPlacement: DesignLibraryPendingPlacement | null;
  onBeginNodePlacement: (type: string) => void;
  onBeginBoardIoPlacement: (entry: DesignLibraryBoardEntry) => void;
  isBoardEntryPlaced: (entry: DesignLibraryBoardEntry) => boolean;
  boardEntryTooltip: (entry: DesignLibraryBoardEntry) => string;
  /** Custom parts + saved macros blocks, rendered inside Reusable Blocks. */
  reusableSlot?: React.ReactNode;
  /** Count of custom parts + macros contributing to the Reusable header count. */
  reusableExtraCount?: number;
}

const SECTION_COPY = {
  board: {
    title: 'Board Resources',
    description:
      'Basys3 physical pins — place these to name your I/O signals directly from the board. Placing SW3 creates an input pin pre-configured as SW3; placing LD0 creates an output pin pre-configured as LD0. You will still assign board mappings in Board & Constraints.',
  },
  io: {
    title: 'Inputs & Outputs',
    description:
      'Generic pins for abstract or board-agnostic designs. Name them anything you like. Use Board Resources (above) to start from specific Basys3 hardware signals instead.',
  },
  logic: {
    title: 'Logic Gates',
    description: 'Core combinational building blocks for the main circuit path.',
  },
  sequential: {
    title: 'Sequential & Timing',
    description:
      'Native registers and state banks first, then timing sources — legacy DFF/TFF sit in clearly marked tiers.',
  },
  reusable: {
    title: 'Reusable Blocks',
    description: 'Built-in helpers, saved macros, and custom parts you can place quickly.',
  },
} as const;

const SEQUENTIAL_SUBSECTIONS: readonly {
  key: 'sequentialRegisters' | 'sequentialTiming' | 'sequentialLegacy';
  title: string;
  description: string;
  testId: string;
}[] = [
  {
    key: 'sequentialRegisters',
    title: 'Registers & state banks',
    description: 'Native path: width, clock enable, reset behavior, and edge polarity are explicit.',
    testId: 'ide-design-palette-sequential-registers',
  },
  {
    key: 'sequentialTiming',
    title: 'Timing',
    description: 'Clock sources that drive sequential updates (map to board timing in Board & Constraints).',
    testId: 'ide-design-palette-sequential-timing',
  },
  {
    key: 'sequentialLegacy',
    title: 'Legacy primitives',
    description: 'Classic DFF for imports and tutorials — new work should start with Native registers.',
    testId: 'ide-design-palette-sequential-legacy',
  },
];

const RECENT_STORAGE_KEY = 'rb-design-recent-components-v1';
const RECENT_LIMIT = 6;

function readRecentTypes(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function persistRecentTypes(types: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(types.slice(0, RECENT_LIMIT)));
  } catch {
    // Blocked or full storage degrades to session-only recents.
  }
}

/**
 * Port signature from the canonical component catalog, e.g. "A, B → Y".
 * Progressive disclosure: surfaced through the card tooltip, not extra chrome.
 */
export function describeComponentPortSignature(type: string): string | null {
  const definition =
    COMPONENT_DEFINITION_REGISTRY.getByRuntimeType(type) ?? COMPONENT_DEFINITION_REGISTRY.getById(type);
  if (!definition || definition.ports.length === 0) return null;
  const inputs = definition.ports.filter((port) => port.direction === 'input').map((port) => port.displayName);
  const outputs = definition.ports.filter((port) => port.direction === 'output').map((port) => port.displayName);
  if (inputs.length === 0 && outputs.length === 0) return null;
  if (inputs.length === 0) return outputs.join(', ');
  if (outputs.length === 0) return inputs.join(', ');
  return `${inputs.join(', ')} → ${outputs.join(', ')}`;
}

export const DesignComponentLibrary: React.FC<DesignComponentLibraryProps> = ({
  query,
  onQueryChange,
  commonItems,
  categories,
  boardGroups,
  boardResourcesCount,
  pendingPlacement,
  onBeginNodePlacement,
  onBeginBoardIoPlacement,
  isBoardEntryPlaced,
  boardEntryTooltip,
  reusableSlot,
  reusableExtraCount = 0,
}) => {
  const sectionsRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [recentTypes, setRecentTypes] = useState<string[]>(() => readRecentTypes());

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const resultCount =
    categories.logic.length + categories.sequential.length + categories.io.length + categories.components.length;
  const hasResults =
    resultCount > 0 || boardGroups.length > 0 || reusableExtraCount > 0;

  const placeNode = useCallback(
    (type: string) => {
      setRecentTypes((previous) => {
        const next = [type, ...previous.filter((entry) => entry !== type)].slice(0, RECENT_LIMIT);
        persistRecentTypes(next);
        return next;
      });
      onBeginNodePlacement(type);
    },
    [onBeginNodePlacement]
  );

  const itemByType = useMemo(() => {
    const index = new Map<string, DesignLibraryPaletteItem>();
    for (const item of [
      ...commonItems,
      ...categories.io,
      ...categories.logic,
      ...categories.sequential,
      ...categories.components,
    ]) {
      if (!index.has(item.type)) index.set(item.type, item);
    }
    return index;
  }, [commonItems, categories]);

  const recentItems = useMemo(() => {
    if (hasQuery) return [];
    return recentTypes
      .map((type) => itemByType.get(type))
      .filter((item): item is DesignLibraryPaletteItem => Boolean(item));
  }, [hasQuery, recentTypes, itemByType]);

  useEffect(() => {
    // Drop recents whose components no longer exist in the catalog projection.
    setRecentTypes((previous) => {
      const next = previous.filter((type) => itemByType.has(type));
      return next.length === previous.length ? previous : next;
    });
  }, [itemByType]);

  const focusCard = useCallback((direction: 1 | -1, from?: HTMLElement | null) => {
    const host = sectionsRef.current;
    if (!host) return;
    const cards = Array.from(
      host.querySelectorAll<HTMLButtonElement>(
        'button.ide-palette-card:not([disabled]), button.ide-design-resource-tile:not([disabled])'
      )
    );
    if (cards.length === 0) return;
    const activeIndex = from ? cards.indexOf(from as HTMLButtonElement) : -1;
    const nextIndex =
      activeIndex === -1
        ? direction === 1
          ? 0
          : cards.length - 1
        : Math.min(Math.max(activeIndex + direction, 0), cards.length - 1);
    cards[nextIndex]?.focus();
  }, []);

  const handleSectionsKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const target = event.target as HTMLElement;
      if (!target.matches('button.ide-palette-card, button.ide-design-resource-tile')) return;
      event.preventDefault();
      focusCard(event.key === 'ArrowDown' ? 1 : -1, target);
    },
    [focusCard]
  );

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusCard(1, null);
      } else if (event.key === 'Escape' && hasQuery) {
        event.preventDefault();
        onQueryChange('');
      }
    },
    [focusCard, hasQuery, onQueryChange]
  );

  const renderCard = (
    item: DesignLibraryPaletteItem,
    options?: { badge?: string; testId?: string }
  ) => {
    const isPending = pendingPlacement?.kind === 'node' && pendingPlacement.nodeType === item.type;
    const signature = describeComponentPortSignature(item.type);
    return (
      <button
        key={item.type}
        type="button"
        className={`ide-palette-card${isPending ? ' is-placement-active' : ''}`}
        onClick={() => placeNode(item.type)}
        data-testid={options?.testId ?? `ide-design-palette-${item.type.toLowerCase()}`}
        aria-pressed={isPending}
        title={`${item.title}${signature ? ` (${signature})` : ''} - ${item.subtitle}`}
      >
        <span className="ide-design-component-tile-glyph" aria-hidden="true">
          {item.glyph}
        </span>
        <span className="ide-palette-card-body">
          <span className="ide-palette-card-title-row">
            <span className="ide-design-component-tile-title">{item.title}</span>
            {options?.badge || item.paletteBadge ? (
              <span className="ide-palette-card-badge">{options?.badge ?? item.paletteBadge}</span>
            ) : null}
          </span>
          <span className="ide-palette-card-subtitle">{item.subtitle}</span>
        </span>
      </button>
    );
  };

  return (
    <SurfacePanel className="ide-design-palette" testId="ide-design-dock-palette">
      <header className="ide-design-subheader ide-design-palette-header">
        <div>
          <h3>Component Library</h3>
        </div>
      </header>
      <div className="ide-design-palette-toolbar">
        <input
          ref={searchRef}
          type="text"
          className="ide-design-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search gates or pins..."
          data-testid="ide-design-search"
          aria-label="Search components"
        />
        {hasQuery && (
          <p className="ide-design-palette-results" data-testid="ide-design-palette-results">
            {hasResults ? `${resultCount} results` : `No results for "${trimmedQuery}".`}
          </p>
        )}
      </div>

      <div className="ide-design-palette-sections" ref={sectionsRef} onKeyDown={handleSectionsKeyDown}>
        {recentItems.length > 0 ? (
          <section
            className="ide-palette-section ide-palette-section--recent"
            data-testid="ide-design-palette-section-recent"
          >
            <header className="ide-palette-section-header">
              <div className="ide-palette-section-title-row">
                <h4>Recent</h4>
                <span className="ide-palette-section-count">{recentItems.length}</span>
              </div>
              <p className="ide-palette-section-copy">Components you placed most recently in this browser.</p>
            </header>
            <div className="ide-palette-card-list">
              {recentItems.map((item) =>
                renderCard(item, { testId: `ide-design-recent-${item.type.toLowerCase()}` })
              )}
            </div>
          </section>
        ) : null}

        {commonItems.length > 0 ? (
          <section
            className="ide-palette-section ide-palette-section--common"
            data-testid="ide-design-palette-section-common"
          >
            <header className="ide-palette-section-header">
              <div className="ide-palette-section-title-row">
                <h4>Common</h4>
                <span className="ide-palette-section-count">{commonItems.length}</span>
              </div>
              <p className="ide-palette-section-copy">
                Start here for most combinational and first sequential circuits.
              </p>
            </header>
            <div className="ide-palette-card-list">
              {commonItems.map((item) =>
                renderCard(item, { testId: `ide-design-common-${item.type.toLowerCase()}` })
              )}
            </div>
          </section>
        ) : null}

        {/* Board Resources — first: primary destination for board-aware work */}
        {boardGroups.length > 0 ? (
          <section
            className="ide-palette-section ide-palette-section--board"
            data-testid="ide-design-palette-section-board"
            data-collapsed="false"
          >
            <header className="ide-palette-section-header">
              <div className="ide-palette-section-title-row">
                <h4>{SECTION_COPY.board.title}</h4>
              </div>
              <div className="ide-palette-section-meta">
                <span className="ide-palette-section-count">{boardResourcesCount}</span>
              </div>
            </header>
            <div className="ide-palette-board-groups" data-testid="ide-design-board-io-palette">
              {boardGroups.map((group) => (
                <div
                  key={group.id}
                  className="ide-palette-board-group"
                  data-testid={`ide-design-board-group-${group.id}`}
                >
                  <div className="ide-palette-subsection-header">
                    <div>
                      <h5>{group.title}</h5>
                      <p>{group.description}</p>
                    </div>
                    <span className="ide-palette-subsection-count">{group.entries.length}</span>
                  </div>
                  <div className="ide-palette-board-grid">
                    {group.entries.map((entry) => {
                      const isPlaced = isBoardEntryPlaced(entry);
                      const isPending =
                        pendingPlacement?.kind === 'board-io' &&
                        pendingPlacement.boardIoEntry?.alias === entry.alias &&
                        pendingPlacement.boardIoEntry?.direction === entry.direction;
                      const testId =
                        entry.direction === 'in'
                          ? `ide-design-board-input-${entry.alias.toLowerCase()}`
                          : `ide-design-board-output-${entry.alias.toLowerCase()}`;
                      return (
                        <button
                          key={entry.alias}
                          className={`ide-design-resource-tile${isPlaced ? ' is-placed' : ''}${isPending ? ' is-placement-active' : ''}`}
                          type="button"
                          onClick={() => onBeginBoardIoPlacement(entry)}
                          data-testid={testId}
                          disabled={isPlaced}
                          title={boardEntryTooltip(entry)}
                          aria-pressed={isPending}
                        >
                          {entry.alias}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Inputs & Outputs — second: generic pins for abstract designs */}
        {categories.io.length > 0 ? (
          <section className="ide-palette-section ide-palette-section--io" data-testid="ide-design-palette-section-io">
            <header className="ide-palette-section-header">
              <div className="ide-palette-section-title-row">
                <h4>{SECTION_COPY.io.title}</h4>
                <span className="ide-palette-section-count">{categories.io.length}</span>
              </div>
              <p className="ide-palette-section-copy">{SECTION_COPY.io.description}</p>
            </header>
            <div className="ide-palette-card-list">{categories.io.map((item) => renderCard(item))}</div>
          </section>
        ) : null}

        {categories.logic.length > 0 ? (
          <section
            className="ide-palette-section ide-palette-section--logic"
            data-testid="ide-design-palette-section-logic"
          >
            <header className="ide-palette-section-header">
              <div className="ide-palette-section-title-row">
                <h4>{SECTION_COPY.logic.title}</h4>
                <span className="ide-palette-section-count">{categories.logic.length}</span>
              </div>
              <p className="ide-palette-section-copy">{SECTION_COPY.logic.description}</p>
            </header>
            <div className="ide-palette-card-list">{categories.logic.map((item) => renderCard(item))}</div>
          </section>
        ) : null}

        {categories.sequential.length > 0 ? (
          <section
            className="ide-palette-section ide-palette-section--sequential"
            data-testid="ide-design-palette-section-sequential"
          >
            <header className="ide-palette-section-header">
              <div className="ide-palette-section-title-row">
                <h4>{SECTION_COPY.sequential.title}</h4>
                <span className="ide-palette-section-count">{categories.sequential.length}</span>
              </div>
              <p className="ide-palette-section-copy">{SECTION_COPY.sequential.description}</p>
            </header>
            {SEQUENTIAL_SUBSECTIONS.map((subsection) => {
              const items = categories[subsection.key];
              if (!items || items.length === 0) return null;
              return (
                <div key={subsection.key} className="ide-palette-subsection" data-testid={subsection.testId}>
                  <div className="ide-palette-subsection-header">
                    <div>
                      <h5>{subsection.title}</h5>
                      <p>{subsection.description}</p>
                    </div>
                    <span className="ide-palette-subsection-count">{items.length}</span>
                  </div>
                  <div className="ide-palette-card-list">{items.map((item) => renderCard(item))}</div>
                </div>
              );
            })}
            <p className="ide-palette-section-hint" data-testid="ide-design-palette-sequential-workflow-hint">
              Tip: after choosing a register, hold Shift while clicking the canvas to place another of the same
              type — useful for counters and multi-bit state.
            </p>
          </section>
        ) : null}

        {/* Reusable Blocks — macros, custom parts, built-in helpers */}
        {categories.components.length > 0 || reusableExtraCount > 0 ? (
          <section
            className="ide-palette-section ide-palette-section--reusable"
            data-testid="ide-design-palette-section-reusable"
          >
            <header className="ide-palette-section-header">
              <div className="ide-palette-section-title-row">
                <h4>{SECTION_COPY.reusable.title}</h4>
                <span className="ide-palette-section-count">
                  {categories.components.length + reusableExtraCount}
                </span>
              </div>
              <p className="ide-palette-section-copy">{SECTION_COPY.reusable.description}</p>
            </header>

            {categories.components.length > 0 ? (
              <div className="ide-palette-subsection" data-testid="ide-design-palette-built-in-blocks">
                <div className="ide-palette-subsection-header">
                  <div>
                    <h5>Built-in Blocks</h5>
                    <p>Ready-made helpers for arithmetic and sequential experiments.</p>
                  </div>
                  <span className="ide-palette-subsection-count">{categories.components.length}</span>
                </div>
                <div className="ide-palette-card-list">
                  {categories.components.map((item) =>
                    renderCard(item, { badge: item.paletteBadge ?? 'Built-in' })
                  )}
                </div>
              </div>
            ) : null}

            {reusableSlot}
          </section>
        ) : null}
      </div>

      {!hasResults && hasQuery ? (
        <IdeEmptyState
          title={`No results for "${trimmedQuery}"`}
          body="Try logic terms like AND or flipflop, or board terms like SW0, LED, or clock."
          primaryAction={
            <IdeButton tone="ghost" onClick={() => onQueryChange('')}>
              Clear search
            </IdeButton>
          }
          testId="ide-design-palette-empty"
        />
      ) : null}
    </SurfacePanel>
  );
};
