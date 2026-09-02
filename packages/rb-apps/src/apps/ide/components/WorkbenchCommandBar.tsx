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
}

/** Default menubar. Every entry is a real registry command; nothing here is inert. */
export const DEFAULT_WORKBENCH_MENUS: readonly WorkbenchMenuSpec[] = [
  {
    id: 'file',
    label: 'File',
    sections: [
      [IDE_COMMAND_IDS.openProject, IDE_COMMAND_IDS.buildFreshProject, IDE_COMMAND_IDS.openImportRecover],
      [IDE_COMMAND_IDS.saveProject, IDE_COMMAND_IDS.saveProjectAs, IDE_COMMAND_IDS.duplicateProject],
      ['project.export-backup' as IdeCommandId, IDE_COMMAND_IDS.restoreRecoverySnapshot],
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    sections: [[IDE_COMMAND_IDS.undoDesignEdit, IDE_COMMAND_IDS.redoDesignEdit]],
  },
  {
    id: 'view',
    label: 'View',
    sections: [
      [IDE_COMMAND_IDS.showDesignCanvas, IDE_COMMAND_IDS.showDesignCode, IDE_COMMAND_IDS.showDesignSplit],
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
    id: 'design',
    label: 'Design',
    sections: [
      [IDE_COMMAND_IDS.selectDesignTool, IDE_COMMAND_IDS.selectWireTool],
      [IDE_COMMAND_IDS.arrangeDesign, IDE_COMMAND_IDS.fitDesignCanvas, IDE_COMMAND_IDS.zoomInDesignCanvas, IDE_COMMAND_IDS.zoomOutDesignCanvas],
    ],
  },
  {
    id: 'simulate',
    label: 'Simulate',
    sections: [[IDE_COMMAND_IDS.runSimulation, IDE_COMMAND_IDS.openReplay]],
  },
  {
    id: 'board',
    label: 'Board',
    sections: [[IDE_COMMAND_IDS.assignBoardResource]],
  },
  {
    id: 'package',
    label: 'Package',
    sections: [[IDE_COMMAND_IDS.buildExportPackage]],
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
 * Application command bar: identity, project name, menubar of real commands,
 * save state, board target, command palette, Save. One row, 32px. Menus are
 * derived from the command registry so the bar can never expose a command the
 * palette does not also expose (one command system, several entry points).
 */
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
}: WorkbenchCommandBarProps<TContext>): React.ReactElement {
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [activeItemIndex, setActiveItemIndex] = React.useState(0);
  const barRef = React.useRef<HTMLElement | null>(null);
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
    resolvedMenus.find((menu) => menu.id === menuId)?.sections.flat() ?? [];

  const runCommand = (id: IdeCommandId) => {
    setOpenMenuId(null);
    void registry.execute(id, context);
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
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
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
      className="wb-cmdbar"
      data-testid="ide-top-bar"
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
        <span>RedByte</span>
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
        {resolvedMenus.map((menu, menuIndex) => {
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

      <span className="wb-cmdbar-spacer" />

      <div className="wb-cmdbar-right">
        <span className="wb-cmdbar-fact" data-testid="ide-save-state" data-state={saveState} title={saveTitle} aria-label={saveState}>
          <span className="wb-save-dot" data-state={saveState} aria-hidden="true" />
          <span className="wb-cmdbar-fact-label" aria-live="polite">{SAVE_LABEL[saveState]}</span>
        </span>
        {onOpenCommandPalette ? (
          <button
            type="button"
            className="wb-btn"
            onClick={onOpenCommandPalette}
            data-testid="ide-topbar-command-palette"
            aria-label="Open command palette"
          >
            Commands <kbd>Ctrl K</kbd>
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
