import React, { useEffect, useRef, useState } from 'react';

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
  /** Retained for source compatibility. Unified Workbench v3 never collapses docks. */
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
 * A supplied dock is either present at a predictable edge or explicitly
 * omitted by the surface. There are no collapsed rails, floating reveal
 * controls, exclusive side panels, or student-facing chrome switches.
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

  const showLeftDock = Boolean(leftDock) && leftDockMode !== 'hidden';
  const showRightDock = Boolean(rightDock) && !hideRightDock && rightDockMode !== 'hidden';
  const showConsole = Boolean(console) && (consoleHasBlocking || consoleMode === 'expanded');

  return (
    <section
      ref={shellRef}
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
      data-support-dock-policy="stable"
    >
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
            {leftDock}
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
            {rightDock}
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
