import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type IdeSurfaceMode =
  | 'project'
  | 'design'
  | 'verify'
  | 'hardware'
  | 'export'
  | 'import';
type ResizeEdge = 'left' | 'right' | 'bottom';

const LAYOUT_STORAGE_KEY = 'rb.ide.workbench.layout.v2';
const DEFAULT_LAYOUT = {
  leftWidth: 200,
  rightWidth: 320,
  consoleHeight: 64,
};

const LEFT_WIDTH_RANGE = { min: 180, max: 420 };
const RIGHT_WIDTH_RANGE = { min: 280, max: 480 };
const CONSOLE_HEIGHT_RANGE = { min: 40, max: 320 };
const COLLAPSED_CONSOLE_HEIGHT = 40;
const DEFAULT_EXPANDED_CONSOLE_HEIGHT = 88;
const EXPANDED_CONSOLE_HEIGHT = 176;

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

export interface IdeWorkbenchShellProps {
  mode: IdeSurfaceMode;
  workspace: React.ReactNode;
  leftDock?: React.ReactNode;
  rightDock?: React.ReactNode;
  console?: React.ReactNode;
  consoleHasBlocking?: boolean;
  consoleHasEntries?: boolean;
}

export const IdeWorkbenchShell: React.FC<IdeWorkbenchShellProps> = ({
  mode,
  workspace,
  leftDock,
  rightDock,
  console,
  consoleHasBlocking = false,
  consoleHasEntries = false,
}) => {
  const [layout, setLayout] = useState<WorkbenchLayoutState>(DEFAULT_LAYOUT);
  const resizeRef = useRef<ActiveResizeState | null>(null);
  const [consolePinnedOpen, setConsolePinnedOpen] = useState(false);
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(`rb.ide.workbench.focus.${mode}`) === '1';
  });

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
    if (!consoleHasBlocking) return;
    setLayout((previous) =>
      previous.consoleHeight >= EXPANDED_CONSOLE_HEIGHT
        ? previous
        : {
            ...previous,
            consoleHeight: EXPANDED_CONSOLE_HEIGHT,
          }
    );
  }, [consoleHasBlocking]);

  useEffect(() => {
    if (consoleHasBlocking) {
      setConsolePinnedOpen(true);
      return;
    }
    if (consoleHasEntries) {
      setLayout((previous) =>
        previous.consoleHeight >= DEFAULT_EXPANDED_CONSOLE_HEIGHT
          ? previous
          : {
              ...previous,
              consoleHeight: DEFAULT_EXPANDED_CONSOLE_HEIGHT,
            }
      );
      return;
    }
    setConsolePinnedOpen(false);
    setLayout((previous) =>
      previous.consoleHeight === COLLAPSED_CONSOLE_HEIGHT
        ? previous
        : {
            ...previous,
            consoleHeight: COLLAPSED_CONSOLE_HEIGHT,
          }
    );
  }, [consoleHasBlocking, consoleHasEntries]);

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
    () =>
      ({
        '--ide-workbench-left-width': `${layout.leftWidth}px`,
        '--ide-workbench-right-width': `${layout.rightWidth}px`,
        '--ide-workbench-console-height': `${layout.consoleHeight}px`,
      }) as React.CSSProperties,
    [layout.consoleHeight, layout.leftWidth, layout.rightWidth]
  );

  const consoleState = consoleHasBlocking
    ? 'blocking'
    : consoleHasEntries || consolePinnedOpen
      ? 'expanded'
      : 'collapsed';

  return (
    <section
      className={`ide-surface-shell ide-workbench-shell${focusMode ? ' is-focus-mode' : ''}`}
      data-testid={`ide-mode-${mode}`}
      data-ide-mode-marker={mode}
      data-focus-mode={focusMode ? '1' : '0'}
      style={shellStyle}
    >
      <div className="ide-workbench-main" data-testid="ide-surface-grid" data-grid-columns="12">
        <aside className="ide-workbench-dock ide-workbench-dock-left" data-testid="ide-left-dock">
          {leftDock ?? <DefaultDock mode={mode} side="left" />}
        </aside>

        <button
          type="button"
          className="ide-workbench-divider ide-workbench-divider-vertical"
          data-testid="ide-workbench-resize-left"
          aria-label="Resize left dock"
          onPointerDown={(event) => beginResize('left', event)}
        />

        <main className="ide-main-area ide-workbench-workspace" data-testid="ide-mode-body">
          {workspace}
        </main>

        <button
          type="button"
          className="ide-workbench-divider ide-workbench-divider-vertical"
          data-testid="ide-workbench-resize-right"
          aria-label="Resize right dock"
          onPointerDown={(event) => beginResize('right', event)}
        />

        <aside className="ide-inspector ide-workbench-dock ide-workbench-dock-right" data-testid="ide-inspector">
          {rightDock ?? <DefaultDock mode={mode} side="right" />}
        </aside>
      </div>

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
      >
        <button
          type="button"
          className="ide-workbench-console-toggle"
          data-testid="ide-workbench-console-toggle"
          onClick={() => {
            if (consoleHasBlocking) return;
            if (!consoleHasEntries) return;
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
        >
          <span className="ide-workbench-console-toggle-label">Console</span>
          <span className="ide-workbench-console-toggle-state">
            {consoleState === 'collapsed' ? 'Show' : 'Hide'}
          </span>
        </button>
        {console ?? <DefaultConsole mode={mode} />}
      </section>
      {/* Focus toggle lives outside the console so it's always clickable */}
      <button
        type="button"
        className="ide-workbench-focus-toggle"
        data-testid="ide-workbench-focus-toggle"
        onClick={() => setFocusMode((previous) => !previous)}
        aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
      >
        {focusMode ? '\u229e Restore' : '\u22a1 Focus'}
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
