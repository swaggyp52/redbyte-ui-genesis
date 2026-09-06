import React from 'react';
import type { IdeBuildIdentity } from '../buildIdentity';
import {
  IDE_COMMAND_IDS,
  type IdeCommandId,
  type IdeCommandRegistry,
} from '../ideCommandRegistry';

export type WorkbenchSaveState = 'saved' | 'unsaved' | 'autosaving' | 'saving' | 'save-failed';

export interface WorkbenchMenuSpec {
  readonly id: string;
  readonly label: string;
  /** Command ids grouped into sections; a separator renders between sections. */
  readonly sections: readonly (readonly IdeCommandId[])[];
}

export interface WorkbenchCommandBarProps<TContext> {
  projectName: string;
  saveState: WorkbenchSaveState;
  lastSavedAt?: string | null;
  storageLabel?: string;
  buildIdentity?: IdeBuildIdentity;
  registry: IdeCommandRegistry<TContext>;
  context: TContext;
  /** Which command ids are currently "checked" (view modes, presets, theme). */
  checkedCommandIds?: ReadonlySet<IdeCommandId>;
  menus?: readonly WorkbenchMenuSpec[];
  onRenameProject?: (nextName: string) => void;
  onOpenCommandPalette?: () => void;
  onSave?: () => void;
  /** Compact path of the selected engineering object; null shows the command/search entry. */
  selectionPath?: string | null;
  /** Kind label shown beside the path (signal, node, case…). */
  selectionKind?: string | null;
  /** Current run/operation state where relevant. */
  runState?: { label: string; tone: 'ok' | 'warn' | 'error' | 'idle' } | null;
  /** Target board and part, e.g. "Basys3 · xc7a35tcpg236-1". */
  targetLabel?: string | null;
}

/** Default menubar. Every entry is a real registry command; nothing here is inert. */
export const DEFAULT_WORKBENCH_MENUS: readonly WorkbenchMenuSpec[] = [
  {
    id: 'file',
    label: 'File',
    sections: [
      [IDE_COMMAND_IDS.openProject, IDE_COMMAND_IDS.buildFreshProject, 'project.open-starter' as IdeCommandId, IDE_COMMAND_IDS.openImportRecover],
      [IDE_COMMAND_IDS.saveProject, IDE_COMMAND_IDS.saveProjectAs, IDE_COMMAND_IDS.duplicateProject],
      ['project.export-backup' as IdeCommandId, IDE_COMMAND_IDS.restoreRecoverySnapshot],
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    sections: [
      [IDE_COMMAND_IDS.undoDesignEdit, IDE_COMMAND_IDS.redoDesignEdit],
      [IDE_COMMAND_IDS.selectDesignTool, IDE_COMMAND_IDS.selectWireTool],
      [IDE_COMMAND_IDS.arrangeDesign],
    ],
  },
  {
    id: 'view',
    label: 'View',
    sections: [[IDE_COMMAND_IDS.openCommandPalette], 
      [IDE_COMMAND_IDS.showDesignCanvas, IDE_COMMAND_IDS.showDesignCode, IDE_COMMAND_IDS.showDesignSplit],
      [IDE_COMMAND_IDS.closeDocument, IDE_COMMAND_IDS.closeOtherDocuments, IDE_COMMAND_IDS.reopenClosedDocument],
      [IDE_COMMAND_IDS.fitDesignCanvas, IDE_COMMAND_IDS.zoomInDesignCanvas, IDE_COMMAND_IDS.zoomOutDesignCanvas],
      [
        IDE_COMMAND_IDS.toggleWorkspacePanel,
        'workspace.panel.toggle-right' as IdeCommandId,
        'workspace.panel.toggle-bottom' as IdeCommandId,
        IDE_COMMAND_IDS.resetWorkspaceLayout,
      ],
      [IDE_COMMAND_IDS.useLightTheme, IDE_COMMAND_IDS.useDarkTheme, IDE_COMMAND_IDS.useSystemTheme],
    ],
  },
  {
    id: 'run',
    label: 'Run',
    sections: [[IDE_COMMAND_IDS.runSimulation, IDE_COMMAND_IDS.openReplay], [IDE_COMMAND_IDS.buildExportPackage]],
  },
  {
    id: 'help',
    label: 'Help',
    sections: [[IDE_COMMAND_IDS.openHelp]],
  },
];

// Geometric circuit mark: hexagon with a two-node net. Brand coral via currentColor.
const RbLogomark: React.FC = () => (
  <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <polygon points="14,2 24,8 24,20 14,26 4,20 4,8" stroke="currentColor" strokeWidth="1.6" fill="none" />
    <line x1="8" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="10" cy="14" r="2" fill="currentColor" />
    <circle cx="18" cy="14" r="2" fill="currentColor" />
  </svg>
);

const SAVE_LABEL: Record<WorkbenchSaveState, string> = {
  saved: 'Saved',
  unsaved: 'Unsaved',
  autosaving: 'Autosaving…',
  saving: 'Saving…',
  'save-failed': 'Save failed',
};

/**
 * Application frame bar: identity, project name, a functional menubar of real
 * commands, the selected engineering object (or the command/search entry),
 * run state, target, save state, Save. One row, 32px. Menus are
 * derived from the command registry so the bar can never expose a command the
 * palette does not also expose (one command system, several entry points).
 */
/** True when the frame has less room than its full composition needs - a narrow window, a
 *  large text setting, or both, which are the same problem measured differently.
 *
 *  The width is measured in the reader's own text size rather than in pixels, so 64 means
 *  "sixty-four lines of body text wide". At the default 16px root that is 1024px, so an
 *  ordinary desktop is unaffected; at 200% text a 1366px window measures 42.7 and the
 *  compact composition takes over.
 *
 *  This deliberately does not use a `rem` media query. Inside `@media`, `rem` resolves
 *  against the browser's INITIAL font size rather than the document's current one, so a
 *  query cannot see a page whose root has been enlarged. Reading the computed root size
 *  answers the real question. The decision depends only on the viewport and that size,
 *  never on the composition's own width, so it cannot oscillate. */
const COMPACT_MENU_ID = '__compact__';
const COMPACT_CHROME_MAX_TEXT_WIDTHS = 64;

function useCompactChrome(ref: React.RefObject<HTMLElement | null>): boolean {
  const [compact, setCompact] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const evaluate = () => {
      const rootPx =
        Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      const next = window.innerWidth / rootPx < COMPACT_CHROME_MAX_TEXT_WIDTHS;
      setCompact(next);
      // Published on the document so every surface composes against one decision rather
      // than each re-deriving it. Stylesheets read [data-rb-chrome='compact'].
      document.documentElement.dataset.rbChrome = next ? 'compact' : 'full';
    };
    evaluate();
    window.addEventListener('resize', evaluate);
    // The bar's own height is expressed in the same unit, so it changes when the reader's
    // text size does - the one event no resize listener would otherwise see.
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(evaluate);
      if (ref.current) observer.observe(ref.current);
      observer.observe(document.documentElement);
    }
    return () => {
      window.removeEventListener('resize', evaluate);
      if (observer) observer.disconnect();
    };
  }, [ref]);
  return compact;
}

export function WorkbenchCommandBar<TContext>({
  projectName,
  saveState,
  lastSavedAt = null,
  storageLabel = 'This browser on this device',
  buildIdentity,
  registry,
  context,
  checkedCommandIds,
  menus = DEFAULT_WORKBENCH_MENUS,
  onRenameProject,
  onOpenCommandPalette,
  onSave,
  selectionPath = null,
  selectionKind = null,
  runState = null,
  targetLabel = null,
}: WorkbenchCommandBarProps<TContext>): React.ReactElement {
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [activeItemIndex, setActiveItemIndex] = React.useState(0);
  const barRef = React.useRef<HTMLElement | null>(null);
  const compactChrome = useCompactChrome(barRef);
  const [editingName, setEditingName] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState(projectName);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);
  const cancelBlurRef = React.useRef(false);

  React.useEffect(() => {
    if (!editingName) setNameDraft(projectName);
  }, [editingName, projectName]);
  React.useEffect(() => {
    if (!editingName) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [editingName]);

  // Close an open menu on outside pointer-down or Escape.
  React.useEffect(() => {
    if (!openMenuId) return;
    const onPointer = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpenMenuId(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null);
        barRef.current?.querySelector<HTMLButtonElement>(`[data-menu-id="${openMenuId}"]`)?.focus();
      }
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [openMenuId]);

  const commitName = () => {
    if (cancelBlurRef.current) {
      cancelBlurRef.current = false;
      return;
    }
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (trimmed.length > 0 && trimmed !== projectName) onRenameProject?.(trimmed);
    else setNameDraft(projectName);
  };

  const resolvedMenus = React.useMemo(
    () =>
      menus.map((menu) => ({
        ...menu,
        sections: menu.sections
          .map((section) =>
            section.flatMap((id) => {
              const command = registry.get(id);
              if (!command) return [];
              const availability = command.availability?.(context) ?? { state: 'available' as const };
              if (availability.state === 'hidden') return [];
              return [{ command, availability }];
            })
          )
          .filter((section) => section.length > 0),
      })),
    [context, menus, registry]
  );

  const flatItems = (menuId: string) =>
    menuId === COMPACT_MENU_ID
      ? resolvedMenus.flatMap((menu) => menu.sections.flat())
      : (resolvedMenus.find((menu) => menu.id === menuId)?.sections.flat() ?? []);

  const runCommand = (id: IdeCommandId) => {
    // Escape from a menu already returns focus to the menu button. Activating an item did not,
    // so a keyboard user who ran a command from the menubar landed on <body> and restarted the
    // tab order from the top of the page. Same pattern, both exits.
    const menuButton = openMenuId
      ? barRef.current?.querySelector<HTMLButtonElement>(`[data-menu-id="${openMenuId}"]`) ?? null
      : null;
    setOpenMenuId(null);
    void registry.execute(id, context);
    // After the menu unmounts, and only if the command did not deliberately move focus itself.
    window.requestAnimationFrame(() => {
      if (document.activeElement === document.body && menuButton?.isConnected) {
        menuButton.focus();
      }
    });
  };

  const openMenu = (menuId: string) => {
    setOpenMenuId(menuId);
    setActiveItemIndex(0);
  };

  const onMenuButtonKey = (event: React.KeyboardEvent, index: number) => {
    const ids = resolvedMenus.map((menu) => menu.id);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = ids[(index + (event.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
      barRef.current?.querySelector<HTMLButtonElement>(`[data-menu-id="${next}"]`)?.focus();
      if (openMenuId) openMenu(next);
    } else if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu(ids[index]);
    }
  };

  const onMenuListKey = (event: React.KeyboardEvent, menuId: string) => {
    const items = flatItems(menuId);
    if (items.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveItemIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveItemIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveItemIndex(items.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const entry = items[activeItemIndex];
      if (entry && entry.availability.state === 'available') runCommand(entry.command.id);
    } else if (
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
      menuId !== COMPACT_MENU_ID
    ) {
      const ids = resolvedMenus.map((menu) => menu.id);
      const index = ids.indexOf(menuId);
      event.preventDefault();
      const next = ids[(index + (event.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
      openMenu(next);
      barRef.current?.querySelector<HTMLButtonElement>(`[data-menu-id="${next}"]`)?.focus();
    }
  };

  const saveTitle = [SAVE_LABEL[saveState], lastSavedAt ? `Last saved ${lastSavedAt}` : null, storageLabel]
    .filter(Boolean)
    .join(' · ');

  return (
    <header
      ref={barRef}
      className={`wb-cmdbar${compactChrome ? ' is-compact' : ''}`}
      data-testid="ide-top-bar"
      data-chrome={compactChrome ? 'compact' : 'full'}
      data-save-state={saveState}
      data-build-sha={buildIdentity?.shortSha}
      data-build-full-sha={buildIdentity?.fullSha}
      data-build-branch={buildIdentity?.branch}
      data-build-runtime={buildIdentity?.runtime}
      data-dev-url={buildIdentity?.devUrl}
      data-build-environment={buildIdentity?.envLabel}
    >
      <div className="wb-cmdbar-brand" aria-label="RedByte">
        <RbLogomark />
        <span className="wb-cmdbar-wordmark">RedByte</span>
      </div>
      <span className="wb-cmdbar-sep" aria-hidden="true" />
      <h1 className="wb-cmdbar-project-h" style={{ display: 'contents', margin: 0, font: 'inherit' }}>
        {editingName ? (
          <input
            ref={nameInputRef}
            className="wb-cmdbar-project-input"
            value={nameDraft}
            aria-label="Project title"
            data-testid="ide-topbar-project-name-input"
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitName();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelBlurRef.current = true;
                setNameDraft(projectName);
                setEditingName(false);
              }
            }}
          />
        ) : onRenameProject ? (
          <button
            type="button"
            className="wb-cmdbar-project"
            onClick={() => {
              cancelBlurRef.current = false;
              setEditingName(true);
            }}
            title={`Rename project "${projectName}"`}
            aria-label={`Project title ${projectName}. Click to rename.`}
            data-testid="ide-topbar-project-rename"
          >
            <span className="wb-cmdbar-project-text">{projectName}</span>
          </button>
        ) : (
          <span className="wb-cmdbar-project" data-testid="ide-topbar-project-name">
            <span className="wb-cmdbar-project-text">{projectName}</span>
          </span>
        )}
      </h1>
      <span className="wb-cmdbar-sep" aria-hidden="true" />

      <div className="wb-menubar" role="menubar" aria-label="Application menu" data-testid="ide-menubar">
        {compactChrome ? (
          <div className="wb-menubar-item">
            <button
              type="button"
              className="wb-menubar-btn"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openMenuId === COMPACT_MENU_ID}
              data-menu-id={COMPACT_MENU_ID}
              data-testid="ide-menu-compact"
              onClick={() =>
                openMenuId === COMPACT_MENU_ID ? setOpenMenuId(null) : openMenu(COMPACT_MENU_ID)
              }
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openMenu(COMPACT_MENU_ID);
                }
              }}
            >
              Menu
            </button>
            {openMenuId === COMPACT_MENU_ID ? (
              <ul
                className="wb-menu wb-menu--compact"
                role="menu"
                aria-label="Application menu"
                data-testid="ide-menu-compact-popup"
                onKeyDown={(event) => onMenuListKey(event, COMPACT_MENU_ID)}
              >
                {runState || targetLabel ? (
                  <li className="wb-menu-facts" role="none">
                    {runState ? <span data-testid="ide-menu-compact-run">{runState.label}</span> : null}
                    {targetLabel ? <code data-testid="ide-menu-compact-target">{targetLabel}</code> : null}
                  </li>
                ) : null}
                {(() => {
                  let compactIndex = -1;
                  return resolvedMenus.map((menu) => (
                    <React.Fragment key={menu.id}>
                      <li className="wb-menu-group-heading" role="presentation">{menu.label}</li>
                      {menu.sections.flat().map(({ command, availability }) => {
                        compactIndex += 1;
                        const itemIndex = compactIndex;
                        const disabled = availability.state === 'disabled';
                        const checked = checkedCommandIds?.has(command.id) ?? false;
                        return (
                          <li key={command.id} role="none">
                            <button
                              type="button"
                              role="menuitemcheckbox"
                              aria-checked={checked}
                              aria-disabled={disabled}
                              className="wb-menu-item"
                              data-active={itemIndex === activeItemIndex ? 'true' : 'false'}
                              data-testid={`ide-menu-item-${command.id}`}
                              title={disabled ? availability.reason : undefined}
                              tabIndex={itemIndex === activeItemIndex ? 0 : -1}
                              ref={(node) => {
                                if (node && itemIndex === activeItemIndex) node.focus();
                              }}
                              onPointerEnter={() => setActiveItemIndex(itemIndex)}
                              onClick={() => {
                                if (!disabled) runCommand(command.id);
                              }}
                            >
                              <span className="wb-menu-item-check" aria-hidden="true">{checked ? '\u25CF' : ''}</span>
                              <span className="wb-menu-item-label">{command.title}</span>
                              <span className="wb-menu-item-key">{command.shortcut?.label ?? ''}</span>
                            </button>
                          </li>
                        );
                      })}
                    </React.Fragment>
                  ));
                })()}
              </ul>
            ) : null}
          </div>
        ) : resolvedMenus.map((menu, menuIndex) => {
          const isOpen = openMenuId === menu.id;
          const items = menu.sections.flat();
          let runningIndex = -1;
          return (
            <div key={menu.id} className="wb-menubar-item">
              <button
                type="button"
                className="wb-menubar-btn"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                data-menu-id={menu.id}
                data-testid={`ide-menu-${menu.id}`}
                onClick={() => (isOpen ? setOpenMenuId(null) : openMenu(menu.id))}
                onPointerEnter={() => {
                  if (openMenuId && openMenuId !== menu.id) openMenu(menu.id);
                }}
                onKeyDown={(event) => onMenuButtonKey(event, menuIndex)}
              >
                {menu.label}
              </button>
              {isOpen ? (
                <ul
                  className="wb-menu"
                  role="menu"
                  aria-label={`${menu.label} menu`}
                  data-testid={`ide-menu-${menu.id}-popup`}
                  onKeyDown={(event) => onMenuListKey(event, menu.id)}
                >
                  {menu.sections.map((section, sectionIndex) => (
                    <React.Fragment key={sectionIndex}>
                      {sectionIndex > 0 ? <li role="separator" className="wb-menu-sep" /> : null}
                      {section.map(({ command, availability }) => {
                        runningIndex += 1;
                        const itemIndex = runningIndex;
                        const disabled = availability.state === 'disabled';
                        const checked = checkedCommandIds?.has(command.id) ?? false;
                        return (
                          <li key={command.id} role="none">
                            <button
                              type="button"
                              role="menuitemcheckbox"
                              aria-checked={checked}
                              aria-disabled={disabled}
                              className="wb-menu-item"
                              data-active={itemIndex === activeItemIndex ? 'true' : 'false'}
                              data-testid={`ide-menu-item-${command.id}`}
                              title={disabled && availability.state === 'disabled' ? availability.reason : undefined}
                              tabIndex={itemIndex === activeItemIndex ? 0 : -1}
                              ref={(node) => {
                                if (node && itemIndex === activeItemIndex && isOpen) node.focus();
                              }}
                              onPointerEnter={() => setActiveItemIndex(itemIndex)}
                              onClick={() => {
                                if (!disabled) runCommand(command.id);
                              }}
                            >
                              <span className="wb-menu-item-check" aria-hidden="true">{checked ? '●' : ''}</span>
                              <span className="wb-menu-item-label">{command.title}</span>
                              <span className="wb-menu-item-key">{command.shortcut?.label ?? ''}</span>
                            </button>
                          </li>
                        );
                      })}
                    </React.Fragment>
                  ))}
                  {items.length === 0 ? <li className="wb-menu-item" aria-disabled="true">No commands available</li> : null}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="wb-cmdbar-center">
        {selectionPath ? (
          <button
            type="button"
            className="wb-cmdbar-object"
            onClick={onOpenCommandPalette}
            data-testid="ide-topbar-selection"
            title={`Selected: ${selectionPath}. Ctrl K lists related commands.`}
          >
            {selectionKind ? <span className="wb-cmdbar-object-kind">{selectionKind}</span> : null}
            <code>{selectionPath}</code>
          </button>
        ) : onOpenCommandPalette ? (
          <button
            type="button"
            className="wb-cmdbar-search"
            onClick={onOpenCommandPalette}
            data-testid="ide-topbar-command-palette"
            aria-label="Open command palette"
          >
            Search commands, signals, files… <kbd>Ctrl K</kbd>
          </button>
        ) : null}
      </div>

      <div className="wb-cmdbar-right">
        {runState && !compactChrome ? (
          <span className="wb-cmdbar-fact" data-testid="ide-topbar-run" data-tone={runState.tone === 'idle' ? undefined : runState.tone}>
            {runState.label}
          </span>
        ) : null}
        {/* The target stays in the bar even when the frame is short: it is one of the six, the
            row has the room once the menubar and the wordmark fold, and a fact you have to
            click for is not a fact you can glance at. The run state is the one that folds,
            because the status bar carries it at the other end of the window. */}
        {targetLabel ? (
          <span className="wb-cmdbar-fact" data-testid="ide-topbar-target" title="Target board and part">
            <code>{targetLabel}</code>
          </span>
        ) : null}
        <span className="wb-cmdbar-fact" data-testid="ide-save-state" data-state={saveState} title={saveTitle} aria-label={saveState}>
          <span className="wb-save-dot" data-state={saveState} aria-hidden="true" />
          <span className="wb-cmdbar-fact-label" aria-live="polite">{SAVE_LABEL[saveState]}</span>
        </span>
        {selectionPath && onOpenCommandPalette ? (
          <button
            type="button"
            className="wb-btn"
            onClick={onOpenCommandPalette}
            data-testid="ide-topbar-command-palette"
            aria-label="Open command palette"
            title="Command palette (Ctrl K)"
          >
            <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="4" /><path d="M9 9l3.5 3.5" /></svg>
            <kbd>Ctrl K</kbd>
          </button>
        ) : null}
        {onSave ? (
          <button type="button" className="wb-btn wb-btn--primary" onClick={onSave} data-testid="ide-topbar-save-btn">
            Save
          </button>
        ) : null}
      </div>
    </header>
  );
}
