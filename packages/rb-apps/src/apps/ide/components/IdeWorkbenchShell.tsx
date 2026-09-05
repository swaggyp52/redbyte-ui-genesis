import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  WORKSPACE_DOCK_SIZE_LIMITS,
  workspacePreferencesStore,
  type WorkspaceDockId,
} from '../workspacePreferences';

export type IdeSurfaceMode =
  | 'project'
  | 'design'
  | 'verify'
  | 'hardware'
  | 'export'
  | 'import';
export type LeftDockMode = 'visible' | 'collapsed' | 'hidden';
export type RightDockMode = 'visible' | 'collapsed' | 'hidden';
export type ConsoleMode = 'expanded' | 'collapsed' | 'hidden' | 'auto';
export type WorkbenchShellDensity = 'default' | 'immersive';
export type WorkbenchSurfaceFrame = 'panel' | 'edge-to-edge';
export type WorkbenchLayoutIntent = 'readable' | 'workbench';
type WorkbenchLayoutMode = 'wide' | 'standard' | 'compact';

export interface ResolvedWorkbenchPolicy {
  leftDockMode: LeftDockMode;
  rightDockMode: RightDockMode;
  consoleMode: ConsoleMode;
  shellDensity: WorkbenchShellDensity;
  surfaceFrame: WorkbenchSurfaceFrame;
  layoutIntent: WorkbenchLayoutIntent;
}

export interface IdeWorkbenchShellProps {
  mode: IdeSurfaceMode;
  workspace: React.ReactNode;
  leftDock?: React.ReactNode;
  rightDock?: React.ReactNode;
  console?: React.ReactNode;
  consoleHasBlocking?: boolean;
  consoleHasEntries?: boolean;
  leftDockMode?: LeftDockMode;
  rightDockMode?: RightDockMode;
  consoleMode?: ConsoleMode;
  shellDensity?: WorkbenchShellDensity;
  surfaceFrame?: WorkbenchSurfaceFrame;
  layoutIntent?: WorkbenchLayoutIntent;
  /** Retained for source compatibility; visible docks are also student-collapsible. */
  rightDockCanCollapse?: boolean;
  /** Retained for source compatibility. Selection no longer changes dock geometry. */
  rightDockRevealKey?: string | null;
  /** @deprecated Use rightDockMode='hidden' instead. */
  hideRightDock?: boolean;
  /** @deprecated Unified Workbench v3 has no panel-visibility debug chrome. */
  showDevChrome?: boolean;
}

/**
 * Stable page workspace for Unified Workbench v3.
 *
 * Dock geometry is UI-only state. The shared preference authority persists
 * visibility and size without owning project, simulation, or mapping data.
 */
export const IdeWorkbenchShell: React.FC<IdeWorkbenchShellProps> = ({
  mode,
  workspace,
  leftDock,
  rightDock,
  console,
  consoleHasBlocking = false,
  leftDockMode = 'visible',
  rightDockMode = 'visible',
  consoleMode = 'auto',
  shellDensity = 'default',
  surfaceFrame = 'panel',
  layoutIntent = mode === 'import' ? 'readable' : 'workbench',
  hideRightDock = false,
}) => {
  const shellRef = useRef<HTMLElement | null>(null);
  const [layoutMode, setLayoutMode] = useState<WorkbenchLayoutMode>(() => detectLayoutMode());
  const preferences = useSyncExternalStore(
    workspacePreferencesStore.subscribe,
    workspacePreferencesStore.getSnapshot,
    workspacePreferencesStore.getSnapshot
  );
  const surfacePreferences = preferences.surfaces[mode];

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === 'undefined') {
      setLayoutMode(detectLayoutMode());
      return;
    }
    const observer = new ResizeObserver((entries) => {
      setLayoutMode(detectLayoutMode(entries[0]?.contentRect.width ?? shell.clientWidth));
    });
    observer.observe(shell);
    setLayoutMode(detectLayoutMode(shell.clientWidth));
    return () => observer.disconnect();
  }, []);

  const leftDockAllowed = Boolean(leftDock) && leftDockMode !== 'hidden';
  const rightDockAllowed = Boolean(rightDock) && !hideRightDock && rightDockMode !== 'hidden';
  const showLeftDock = leftDockAllowed && surfacePreferences.docks.left.visible;
  const showRightDock =
    rightDockAllowed && surfacePreferences.docks.right.visible;
  const showConsole =
    Boolean(console) &&
    (consoleHasBlocking ||
      consoleMode === 'expanded' ||
      ((consoleMode === 'auto' || consoleMode === 'collapsed') &&
        surfacePreferences.docks.bottom.visible));
  const shellStyle = {
    '--rb-workbench-pref-left-width': `${surfacePreferences.docks.left.sizePx}px`,
    '--rb-workbench-pref-right-width': `${surfacePreferences.docks.right.sizePx}px`,
    '--rb-workbench-pref-bottom-height': `${surfacePreferences.docks.bottom.sizePx}px`,
  } as React.CSSProperties;

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    // React intentionally keeps the shared shell mounted between stages. Reset
    // only the page/workspace scroll owners so a long surface cannot make the
    // next stage appear to open halfway down. Dock size, visibility, and each
    // stage's project state remain governed by their existing authorities.
    const scrollRegions = [
      shell.closest<HTMLElement>('.ide-surface-column'),
      shell.querySelector<HTMLElement>('[data-testid="ide-mode-body"]'),
      ...shell.querySelectorAll<HTMLElement>('.ide-panel-body'),
    ];
    scrollRegions.forEach((region) => {
      if (!region) return;
      region.scrollTop = 0;
      region.scrollLeft = 0;
    });
  }, [mode]);

  const setDockVisible = (dockId: WorkspaceDockId, visible: boolean) => {
    workspacePreferencesStore.setDock(mode, dockId, { visible });
  };

  const resizeDock = (dockId: WorkspaceDockId, sizePx: number) => {
    workspacePreferencesStore.setDock(mode, dockId, { sizePx });
  };

  const beginPointerResize = (dockId: WorkspaceDockId, event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startCoordinate = dockId === 'bottom' ? event.clientY : event.clientX;
    const startSize = surfacePreferences.docks[dockId].sizePx;
    const direction = dockId === 'right' || dockId === 'bottom' ? -1 : 1;
    const onMove = (moveEvent: PointerEvent) => {
      const coordinate = dockId === 'bottom' ? moveEvent.clientY : moveEvent.clientX;
      resizeDock(dockId, startSize + (coordinate - startCoordinate) * direction);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  const handleResizeKey = (dockId: WorkspaceDockId, event: React.KeyboardEvent) => {
    const isDecrease = event.key === 'ArrowLeft' || event.key === 'ArrowDown';
    const isIncrease = event.key === 'ArrowRight' || event.key === 'ArrowUp';
    if (!isDecrease && !isIncrease) return;
    event.preventDefault();
    // Keep a focused resize separator authoritative for arrow keys. Without
    // stopping propagation, Design's canvas shortcut listener also nudges the
    // selected circuit node while the student resizes a dock.
    event.stopPropagation();
    resizeDock(
      dockId,
      surfacePreferences.docks[dockId].sizePx + (isIncrease ? 16 : -16)
    );
  };

  return (
    <section
      ref={shellRef}
      style={shellStyle}
      className={`ide-surface-shell ide-workbench-shell${showConsole ? '' : ' is-console-hidden'}`}
      data-testid={`ide-mode-${mode}`}
      data-ide-mode-marker={mode}
      data-layout-mode={layoutMode}
      data-left-dock-state={showLeftDock ? 'visible' : 'hidden'}
      data-right-dock-state={showRightDock ? 'visible' : 'hidden'}
      data-console-state={showConsole ? (consoleHasBlocking ? 'blocking' : 'expanded') : 'hidden'}
      data-shell-density={shellDensity}
      data-surface-frame={surfaceFrame}
      data-layout-intent={layoutIntent}
      data-support-dock-policy="persistent-configurable"
      data-workspace-preset={preferences.activePresetId ?? 'custom'}
    >
      <div className="ide-workbench-panel-controls" aria-label="Workspace panels">
        {leftDockAllowed && !showLeftDock ? (
          <button type="button" onClick={() => setDockVisible('left', true)} data-testid="ide-show-left-dock">
            Show left panel
          </button>
        ) : null}
        {rightDockAllowed && !showRightDock ? (
          <button type="button" onClick={() => setDockVisible('right', true)} data-testid="ide-show-right-dock">
            Show right panel
          </button>
        ) : null}
        {console && !showConsole && consoleMode !== 'hidden' ? (
          <button type="button" onClick={() => setDockVisible('bottom', true)} data-testid="ide-show-bottom-dock">
            Show bottom panel
          </button>
        ) : null}
      </div>
      <div
        className={`ide-workbench-main${showLeftDock ? '' : ' hide-left-dock'}${
          showRightDock ? '' : ' hide-right-dock'
        }`}
        data-testid="ide-surface-grid"
        data-grid-columns="12"
        data-layout-mode={layoutMode}
      >
        {showLeftDock ? (
          <aside className="ide-workbench-dock ide-workbench-dock-left" data-testid="ide-left-dock">
            <button
              type="button"
              className="ide-workbench-dock-collapse ide-workbench-dock-collapse--left"
              onClick={() => setDockVisible('left', false)}
              aria-label="Hide left panel"
              data-testid="ide-hide-left-dock"
            >
              &#x2039;
            </button>
            {leftDock}
            <div
              className="ide-workbench-resize-handle ide-workbench-resize-handle--left"
              role="separator"
              tabIndex={0}
              aria-label="Resize left panel"
              aria-orientation="vertical"
              aria-valuemin={WORKSPACE_DOCK_SIZE_LIMITS.left.min}
              aria-valuemax={WORKSPACE_DOCK_SIZE_LIMITS.left.max}
              aria-valuenow={surfacePreferences.docks.left.sizePx}
              onPointerDown={(event) => beginPointerResize('left', event)}
              onKeyDown={(event) => handleResizeKey('left', event)}
              data-testid="ide-resize-left-dock"
            />
          </aside>
        ) : null}

        <main
          className={`ide-main-area ide-workbench-workspace ide-workbench-workspace--${surfaceFrame}`}
          data-testid="ide-mode-body"
          aria-label={`${mode} workspace`}
        >
          {workspace}
        </main>

        {showRightDock ? (
          <aside className="ide-workbench-dock ide-workbench-dock-right" data-testid="ide-right-dock">
            <button
              type="button"
              className="ide-workbench-dock-collapse ide-workbench-dock-collapse--right"
              onClick={() => setDockVisible('right', false)}
              aria-label="Hide right panel"
              data-testid="ide-hide-right-dock"
            >
              &#x203a;
            </button>
            {rightDock}
            <div
              className="ide-workbench-resize-handle ide-workbench-resize-handle--right"
              role="separator"
              tabIndex={0}
              aria-label="Resize right panel"
              aria-orientation="vertical"
              aria-valuemin={WORKSPACE_DOCK_SIZE_LIMITS.right.min}
              aria-valuemax={WORKSPACE_DOCK_SIZE_LIMITS.right.max}
              aria-valuenow={surfacePreferences.docks.right.sizePx}
              onPointerDown={(event) => beginPointerResize('right', event)}
              onKeyDown={(event) => handleResizeKey('right', event)}
              data-testid="ide-resize-right-dock"
            />
          </aside>
        ) : null}
      </div>

      {showConsole ? (
        <section
          className={`ide-workbench-console ${consoleHasBlocking ? 'is-blocking' : 'is-expanded'}`}
          data-testid="ide-workbench-console"
          data-console-state={consoleHasBlocking ? 'blocking' : 'expanded'}
          aria-label={consoleHasBlocking ? 'Blocking diagnostics' : 'Compiler output'}
        >
          {!consoleHasBlocking ? (
            <button
              type="button"
              className="ide-workbench-dock-collapse ide-workbench-dock-collapse--bottom"
              onClick={() => setDockVisible('bottom', false)}
              aria-label="Hide bottom panel"
              data-testid="ide-hide-bottom-dock"
            >
              &#x2304;
            </button>
          ) : null}
          <div
            className="ide-workbench-resize-handle ide-workbench-resize-handle--bottom"
            role="separator"
            tabIndex={0}
            aria-label="Resize bottom panel"
            aria-orientation="horizontal"
            aria-valuemin={WORKSPACE_DOCK_SIZE_LIMITS.bottom.min}
            aria-valuemax={WORKSPACE_DOCK_SIZE_LIMITS.bottom.max}
            aria-valuenow={surfacePreferences.docks.bottom.sizePx}
            onPointerDown={(event) => beginPointerResize('bottom', event)}
            onKeyDown={(event) => handleResizeKey('bottom', event)}
            data-testid="ide-resize-bottom-dock"
          />
          {console}
        </section>
      ) : null}
    </section>
  );
};

function detectLayoutMode(width?: number): WorkbenchLayoutMode {
  const effectiveWidth =
    typeof width === 'number' && Number.isFinite(width)
      ? width
      : typeof window !== 'undefined'
        ? window.innerWidth
        : 1366;
  if (effectiveWidth >= 1600) return 'wide';
  if (effectiveWidth >= 1180) return 'standard';
  return 'compact';
}
