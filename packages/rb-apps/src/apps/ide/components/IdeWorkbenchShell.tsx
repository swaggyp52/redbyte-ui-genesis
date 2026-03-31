import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type IdeSurfaceMode =
  | 'project'
  | 'design'
  | 'verify'
  | 'hardware'
  | 'export'
  | 'import';
type ResizeEdge = 'left' | 'right' | 'bottom';
type WorkbenchLayoutMode = 'wide' | 'standard' | 'compact';
export type LeftDockMode = 'visible' | 'collapsed' | 'hidden';
export type RightDockMode = 'visible' | 'collapsed' | 'hidden';
export type ConsoleMode = 'expanded' | 'collapsed' | 'hidden' | 'auto';
export type WorkbenchShellDensity = 'default' | 'immersive';
export type WorkbenchSurfaceFrame = 'panel' | 'edge-to-edge';
type WorkbenchConsoleState = 'blocking' | 'expanded' | 'collapsed' | 'hidden';

const LAYOUT_STORAGE_KEY = 'rb.ide.workbench.layout.v6';
const DEFAULT_LAYOUT = {
  leftWidth: 164,
  rightWidth: 212,
  consoleHeight: 0,
};

const LEFT_WIDTH_RANGE = { min: 136, max: 240 };
const RIGHT_WIDTH_RANGE = { min: 180, max: 280 };
const CONSOLE_HEIGHT_RANGE = { min: 0, max: 320 };
const COLLAPSED_CONSOLE_HEIGHT = 0;
const DEFAULT_EXPANDED_CONSOLE_HEIGHT = 120;
const COLLAPSED_DOCK_RAIL_WIDTH = 26;

interface WorkbenchLayoutState {
  leftWidth: number;
  rightWidth: number;
  consoleHeight: number;
}

interface ActiveResizeState {
  edge: ResizeEdge;
  startX: number;
  startY: number;
  initial: WorkbenchLayoutState;
}

export interface ResolvedWorkbenchPolicy {
  leftDockMode: LeftDockMode;
  rightDockMode: RightDockMode;
  consoleMode: ConsoleMode;
  shellDensity: WorkbenchShellDensity;
  surfaceFrame: WorkbenchSurfaceFrame;
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
  /** @deprecated Use rightDockMode='hidden' instead. */
  hideRightDock?: boolean;
}

export const IdeWorkbenchShell: React.FC<IdeWorkbenchShellProps> = ({
  mode,
  workspace,
  leftDock,
  rightDock,
  console,
  consoleHasBlocking = false,
  consoleHasEntries = false,
  leftDockMode = 'visible',
  rightDockMode = 'visible',
  consoleMode = 'auto',
  shellDensity = 'default',
  surfaceFrame = 'panel',
  hideRightDock = false,
}) => {
  const shellRef = useRef<HTMLElement | null>(null);
  const savedScrollRef = useRef(new Map<string, Record<string, number>>());
  const [layout, setLayout] = useState<WorkbenchLayoutState>(DEFAULT_LAYOUT);
  const resizeRef = useRef<ActiveResizeState | null>(null);
  const [consolePinnedOpen, setConsolePinnedOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<WorkbenchLayoutMode>(() => detectLayoutMode());
  const policy = useMemo<ResolvedWorkbenchPolicy>(
    () => ({
      leftDockMode,
      rightDockMode: hideRightDock ? 'hidden' : rightDockMode,
      consoleMode,
      shellDensity,
      surfaceFrame,
    }),
    [consoleMode, hideRightDock, leftDockMode, rightDockMode, shellDensity, surfaceFrame]
  );
  const [isLeftDockExpanded, setIsLeftDockExpanded] = useState(
    policy.leftDockMode === 'visible'
  );
  const [isRightDockExpanded, setIsRightDockExpanded] = useState(
    policy.rightDockMode === 'visible'
  );
  const previousLeftDockContextRef = useRef<{ mode: IdeSurfaceMode; dockMode: LeftDockMode }>({
    mode,
    dockMode: policy.leftDockMode,
  });
  const previousRightDockContextRef = useRef<{ mode: IdeSurfaceMode; dockMode: RightDockMode }>({
    mode,
    dockMode: policy.rightDockMode,
  });
  const previousConsoleContextRef = useRef<{ mode: IdeSurfaceMode; consoleMode: ConsoleMode }>({
    mode,
    consoleMode: policy.consoleMode,
  });
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(`rb.ide.workbench.focus.${mode}`) === '1';
  });

  useEffect(() => {
    const previous = previousLeftDockContextRef.current;
    if (policy.leftDockMode === 'visible') {
      setIsLeftDockExpanded(true);
    } else if (policy.leftDockMode === 'hidden') {
      setIsLeftDockExpanded(false);
    } else if (previous.dockMode !== policy.leftDockMode || previous.mode !== mode) {
      setIsLeftDockExpanded(false);
    }
    previousLeftDockContextRef.current = {
      mode,
      dockMode: policy.leftDockMode,
    };
  }, [mode, policy.leftDockMode]);

  useEffect(() => {
    const previous = previousRightDockContextRef.current;
    if (policy.rightDockMode === 'visible') {
      setIsRightDockExpanded(true);
    } else if (policy.rightDockMode === 'hidden') {
      setIsRightDockExpanded(false);
    } else if (previous.dockMode !== policy.rightDockMode || previous.mode !== mode) {
      setIsRightDockExpanded(false);
    }
    previousRightDockContextRef.current = {
      mode,
      dockMode: policy.rightDockMode,
    };
  }, [mode, policy.rightDockMode]);

  useEffect(() => {
    const previous = previousConsoleContextRef.current;
    if (policy.consoleMode === 'expanded') {
      setConsolePinnedOpen(true);
    } else if (previous.consoleMode !== policy.consoleMode || previous.mode !== mode) {
      setConsolePinnedOpen(false);
    }
    previousConsoleContextRef.current = {
      mode,
      consoleMode: policy.consoleMode,
    };
  }, [mode, policy.consoleMode]);

  const showLeftDock =
    policy.leftDockMode !== 'hidden' &&
    (policy.leftDockMode === 'visible' || isLeftDockExpanded);
  const showLeftCollapsedRail = policy.leftDockMode === 'collapsed' && !isLeftDockExpanded;
  const showRightDock =
    policy.rightDockMode !== 'hidden' &&
    (policy.rightDockMode === 'visible' || isRightDockExpanded);
  const showRightCollapsedRail = policy.rightDockMode === 'collapsed' && !isRightDockExpanded;
  const showConsole = policy.consoleMode !== 'hidden';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`rb.ide.workbench.focus.${mode}`, focusMode ? '1' : '0');
  }, [focusMode, mode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<WorkbenchLayoutState>;
      setLayout(clampLayout(parsed));
    } catch {
      setLayout(DEFAULT_LAYOUT);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === 'undefined') {
      setLayoutMode(detectLayoutMode());
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? shell.clientWidth;
      setLayoutMode(detectLayoutMode(nextWidth));
    });
    observer.observe(shell);
    setLayoutMode(detectLayoutMode(shell.clientWidth));
    return () => observer.disconnect();
  }, []);

  // Continuously capture scroll positions for the current mode
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof window === 'undefined') return;
    let raf: number | null = null;
    const onScroll = () => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        const positions: Record<string, number> = {};
        shell.querySelectorAll<HTMLElement>(SCROLL_SAVE_SELECTORS).forEach((el) => {
          positions[scrollKey(el)] = el.scrollTop;
        });
        savedScrollRef.current.set(mode, positions);
      });
    };
    shell.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      shell.removeEventListener('scroll', onScroll, { capture: true });
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, [mode]);

  // On mode/layout change: restore saved positions or reset to 0
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const frame = window.requestAnimationFrame(() => {
      const shell = shellRef.current;
      if (!shell) return;
      const saved = savedScrollRef.current.get(mode);
      shell.querySelectorAll<HTMLElement>(SCROLL_SAVE_SELECTORS).forEach((el) => {
        el.scrollTop = saved?.[scrollKey(el)] ?? 0;
        el.scrollLeft = 0;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [layoutMode, mode, showConsole, showLeftDock, showRightDock]);

  const onPointerMove = useCallback((event: PointerEvent) => {
    const active = resizeRef.current;
    if (!active) return;
    const deltaX = event.clientX - active.startX;
    const deltaY = event.clientY - active.startY;

    setLayout(() => {
      if (active.edge === 'left') {
        return clampLayout({
          ...active.initial,
          leftWidth: active.initial.leftWidth + deltaX,
        });
      }
      if (active.edge === 'right') {
        return clampLayout({
          ...active.initial,
          rightWidth: active.initial.rightWidth - deltaX,
        });
      }
      return clampLayout({
        ...active.initial,
        consoleHeight: active.initial.consoleHeight - deltaY,
      });
    });
  }, []);

  const endResize = useCallback(() => {
    resizeRef.current = null;
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointermove', onPointerMove);
  }, [onPointerMove]);

  useEffect(
    () => () => {
      if (typeof window === 'undefined') return;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endResize);
    },
    [endResize, onPointerMove]
  );

  const beginResize = (edge: ResizeEdge, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (typeof window === 'undefined') return;
    resizeRef.current = {
      edge,
      startX: event.clientX,
      startY: event.clientY,
      initial: layout,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endResize, { once: true });
  };

  const shellStyle = useMemo(
    () => {
      const widthCaps =
        mode === 'design'
          ? layoutMode === 'wide'
            ? { left: { min: 184, max: 212 }, right: { min: 220, max: 252 } }
            : layoutMode === 'standard'
              ? { left: { min: 172, max: 200 }, right: { min: 208, max: 240 } }
              : { left: { min: 160, max: 184 }, right: { min: 196, max: 224 } }
          : mode === 'export' || mode === 'hardware'
            ? layoutMode === 'wide'
              ? { left: { min: 200, max: 228 }, right: { min: 188, max: 212 } }
              : layoutMode === 'standard'
                ? { left: { min: 188, max: 216 }, right: { min: 180, max: 200 } }
                : { left: { min: 176, max: 204 }, right: { min: 168, max: 188 } }
          : mode === 'project' || mode === 'import'
            ? layoutMode === 'wide'
              ? { left: { min: 140, max: 156 }, right: { min: 188, max: 208 } }
              : layoutMode === 'standard'
                ? { left: { min: 132, max: 148 }, right: { min: 180, max: 196 } }
                : { left: { min: 124, max: 140 }, right: { min: 168, max: 184 } }
            : layoutMode === 'wide'
              ? { left: { min: 152, max: 172 }, right: { min: 196, max: 220 } }
              : layoutMode === 'standard'
                ? { left: { min: 144, max: 160 }, right: { min: 184, max: 208 } }
                : { left: { min: 136, max: 152 }, right: { min: 176, max: 196 } };
      const effectiveLeftWidth = clampValue(layout.leftWidth, widthCaps.left);
      const effectiveRightWidth = clampValue(layout.rightWidth, widthCaps.right);
      const leftSlotWidth = showLeftDock ? effectiveLeftWidth : 0;
      const overlayCollapsedRightRail = mode === 'design' && showRightCollapsedRail;
      const rightSlotWidth = showRightDock
        ? effectiveRightWidth
        : overlayCollapsedRightRail
          ? 0
          : showRightCollapsedRail
          ? COLLAPSED_DOCK_RAIL_WIDTH
          : 0;
      const effectiveConsoleHeight = showConsole
        ? policy.consoleMode === 'expanded'
          ? Math.max(layout.consoleHeight, DEFAULT_EXPANDED_CONSOLE_HEIGHT)
          : layout.consoleHeight
        : 0;
      return ({
        '--ide-workbench-left-width': `${effectiveLeftWidth}px`,
        '--ide-workbench-right-width': `${effectiveRightWidth}px`,
        '--ide-workbench-left-slot-width': `${leftSlotWidth}px`,
        '--ide-workbench-right-slot-width': `${rightSlotWidth}px`,
        '--ide-workbench-console-height': `${effectiveConsoleHeight}px`,
      }) as React.CSSProperties;
    },
    [
      layout.consoleHeight,
      layout.leftWidth,
      layout.rightWidth,
      layoutMode,
      mode,
      policy.consoleMode,
      showConsole,
      showLeftCollapsedRail,
      showLeftDock,
      showRightCollapsedRail,
      showRightDock,
    ]
  );

  const consoleState: WorkbenchConsoleState = resolveConsoleState({
    consoleHasBlocking,
    consoleHasEntries,
    consoleMode: policy.consoleMode,
    consolePinnedOpen,
  });
  const canToggleConsole =
    showConsole &&
    !consoleHasBlocking &&
    policy.consoleMode !== 'expanded' &&
    (policy.consoleMode === 'collapsed' || consoleHasEntries);

  return (
    <section
      ref={shellRef}
      className={`ide-surface-shell ide-workbench-shell${focusMode ? ' is-focus-mode' : ''}${
        !showConsole ? ' is-console-hidden' : ''
      }`}
      data-testid={`ide-mode-${mode}`}
      data-ide-mode-marker={mode}
      data-focus-mode={focusMode ? '1' : '0'}
      data-layout-mode={layoutMode}
      data-shell-density={policy.shellDensity}
      data-surface-frame={policy.surfaceFrame}
      style={shellStyle}
    >
      <div
        className={`ide-workbench-main${showLeftCollapsedRail ? ' is-left-dock-collapsed' : ''}${
          showRightCollapsedRail ? ' is-right-dock-collapsed' : ''
        }`}
        data-testid="ide-surface-grid"
        data-grid-columns="12"
        data-layout-mode={layoutMode}
      >
        {showLeftDock ? (
          <aside
            className="ide-workbench-dock ide-workbench-dock-left"
            data-testid="ide-left-dock"
          >
            {policy.leftDockMode === 'collapsed' ? (
              <button
                type="button"
                className="ide-workbench-dock-collapse-btn ide-workbench-dock-collapse-btn-left"
                data-testid="ide-workbench-dock-collapse-left"
                onClick={() => setIsLeftDockExpanded(false)}
                aria-label="Collapse library"
                title="Collapse library"
              >
                Hide
              </button>
            ) : null}
            {leftDock ?? <DefaultDock mode={mode} side="left" />}
          </aside>
        ) : showLeftCollapsedRail ? (
          <button
            type="button"
            className="ide-workbench-dock-toggle-rail ide-workbench-dock-toggle-rail-left"
            data-testid="ide-workbench-dock-toggle-left"
            onClick={() => setIsLeftDockExpanded(true)}
            aria-label="Show library"
            title="Show library"
          >
            Library
          </button>
        ) : (
          <div
            className="ide-workbench-slot-spacer"
            aria-hidden="true"
            style={{ pointerEvents: 'none' }}
          />
        )}

        <button
          type="button"
          className="ide-workbench-divider ide-workbench-divider-vertical"
          data-testid="ide-workbench-resize-left"
          aria-label="Resize left dock"
          aria-hidden="true"
          hidden
          onPointerDown={(event) => beginResize('left', event)}
        />

        <main
          className={`ide-main-area ide-workbench-workspace ide-workbench-workspace--${policy.surfaceFrame}`}
          data-testid="ide-mode-body"
        >
          {workspace}
        </main>

        {showRightDock ? (
          <>
            <button
              type="button"
              className="ide-workbench-divider ide-workbench-divider-vertical"
              data-testid="ide-workbench-resize-right"
              aria-label="Resize right dock"
              aria-hidden="true"
              hidden
              onPointerDown={(event) => beginResize('right', event)}
            />

            <aside
              className="ide-inspector ide-workbench-dock ide-workbench-dock-right"
              data-testid="ide-inspector"
            >
              {policy.rightDockMode === 'collapsed' ? (
                <button
                  type="button"
                  className="ide-workbench-dock-collapse-btn"
                  data-testid="ide-workbench-dock-collapse-right"
                  onClick={() => setIsRightDockExpanded(false)}
                  aria-label="Collapse inspector"
                  title="Collapse inspector"
                >
                  Hide
                </button>
              ) : null}
              {rightDock ?? <DefaultDock mode={mode} side="right" />}
            </aside>
          </>
        ) : showRightCollapsedRail ? (
          <button
            type="button"
            className="ide-workbench-dock-toggle-rail ide-workbench-dock-toggle-rail-right"
            data-testid="ide-workbench-dock-toggle-right"
            onClick={() => setIsRightDockExpanded(true)}
            aria-label="Show inspector"
            title="Show inspector"
          >
            Inspector
          </button>
        ) : (
          <div
            className="ide-workbench-slot-spacer"
            aria-hidden="true"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </div>

      {showConsole ? (
        <>
          <button
            type="button"
            className="ide-workbench-divider ide-workbench-divider-horizontal"
            data-testid="ide-workbench-resize-bottom"
            aria-label="Resize diagnostics console"
            onPointerDown={(event) => beginResize('bottom', event)}
          />

          <section
            className={`ide-workbench-console ${
              consoleState === 'collapsed' ? 'is-collapsed' : 'is-expanded'
            }`}
            data-testid="ide-workbench-console"
            data-console-state={consoleState}
            data-layout-mode={layoutMode}
          >
            <button
              type="button"
              className="ide-workbench-console-toggle"
              data-testid="ide-workbench-console-toggle"
              onClick={() => {
                if (!canToggleConsole) return;
                setConsolePinnedOpen((previous) => !previous);
                setLayout((previous) => ({
                  ...previous,
                  consoleHeight:
                    previous.consoleHeight <= COLLAPSED_CONSOLE_HEIGHT
                      ? DEFAULT_EXPANDED_CONSOLE_HEIGHT
                      : COLLAPSED_CONSOLE_HEIGHT,
                }));
              }}
              aria-label="Toggle workbench console"
              aria-disabled={!canToggleConsole}
            >
              <span className="ide-workbench-console-toggle-label">Console</span>
              <span className="ide-workbench-console-toggle-state">
                {consoleState === 'collapsed' ? 'Show' : 'Hide'}
              </span>
            </button>
            {console ?? <DefaultConsole mode={mode} />}
          </section>
        </>
      ) : null}
      {/* Focus toggle lives outside the console so it's always clickable */}
      <button
        type="button"
        className="ide-workbench-focus-toggle"
        data-testid="ide-workbench-focus-toggle"
        onClick={() => setFocusMode((previous) => !previous)}
        aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
      >
        {focusMode ? 'Done' : 'Focus'}
      </button>
    </section>
  );
};

const DefaultDock: React.FC<{ mode: IdeSurfaceMode; side: 'left' | 'right' }> = ({ mode, side }) => (
  <section className="ide-workbench-placeholder">
    <header className="ide-workbench-placeholder-header">
      <h3>{side === 'left' ? 'Sources' : 'Inspector'}</h3>
    </header>
    <p className="ide-copy">
      {side === 'left'
        ? `${capitalize(mode)} dock hosts sources, quick tools, and workflow context.`
        : `${capitalize(mode)} inspector hosts properties, validation status, and actions.`}
    </p>
  </section>
);

const DefaultConsole: React.FC<{ mode: IdeSurfaceMode }> = ({ mode }) => (
  <section className="ide-workbench-console-content">
    <header className="ide-workbench-console-header">
      <h3>Compiler Console</h3>
      <span className="ide-workbench-console-mode">{capitalize(mode)}</span>
    </header>
    <p className="ide-copy">
      Diagnostics, build output, and jump-to-fix actions appear here while you work in this mode.
    </p>
  </section>
);

function resolveConsoleState(input: {
  consoleHasBlocking: boolean;
  consoleHasEntries: boolean;
  consoleMode: ConsoleMode;
  consolePinnedOpen: boolean;
}): WorkbenchConsoleState {
  if (input.consoleMode === 'hidden') return 'hidden';
  if (input.consoleHasBlocking) return 'blocking';
  if (input.consoleMode === 'expanded') return 'expanded';
  if (input.consoleMode === 'collapsed') {
    return input.consolePinnedOpen ? 'expanded' : 'collapsed';
  }
  return input.consoleHasEntries || input.consolePinnedOpen ? 'expanded' : 'collapsed';
}

function clampLayout(layout: Partial<WorkbenchLayoutState>): WorkbenchLayoutState {
  return {
    leftWidth: clampValue(layout.leftWidth ?? DEFAULT_LAYOUT.leftWidth, LEFT_WIDTH_RANGE),
    rightWidth: clampValue(layout.rightWidth ?? DEFAULT_LAYOUT.rightWidth, RIGHT_WIDTH_RANGE),
    consoleHeight: clampValue(
      layout.consoleHeight ?? DEFAULT_LAYOUT.consoleHeight,
      CONSOLE_HEIGHT_RANGE
    ),
  };
}

function clampValue(value: number, range: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return range.min;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

function capitalize(value: string): string {
  if (!value) return value;
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function detectLayoutMode(width?: number): WorkbenchLayoutMode {
  const effectiveWidth =
    typeof width === 'number' && Number.isFinite(width)
      ? width
      : typeof window !== 'undefined'
        ? window.innerWidth
        : 1366;
  if (effectiveWidth >= 1600) return 'wide';
  if (effectiveWidth >= 1320) return 'standard';
  return 'compact';
}

const SCROLL_SAVE_SELECTORS =
  '.ide-workbench-dock, .ide-workbench-workspace, .ide-panel-body, .ide-workbench-console';

function scrollKey(el: HTMLElement): string {
  if (el.classList.contains('ide-workbench-dock-left')) return 'dL';
  if (el.classList.contains('ide-workbench-dock-right')) return 'dR';
  if (el.classList.contains('ide-workbench-console')) return 'co';
  if (el.classList.contains('ide-workbench-workspace')) return 'ws';
  return 'pb';
}

function resetWorkbenchScrollPositions(shell: HTMLElement | null): void {
  if (!shell) return;
  const scrollTargets = shell.querySelectorAll<HTMLElement>(
    '.ide-workbench-dock, .ide-workbench-workspace, .ide-panel-body, .ide-workbench-console'
  );
  scrollTargets.forEach((target) => {
    target.scrollTop = 0;
    target.scrollLeft = 0;
  });
}
