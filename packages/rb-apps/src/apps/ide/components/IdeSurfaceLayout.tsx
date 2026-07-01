import React from 'react';
import {
  IdeWorkbenchShell,
  type ConsoleMode,
  type IdeSurfaceMode,
  type LeftDockMode,
  type RightDockMode,
  type WorkbenchLayoutIntent,
  type WorkbenchShellDensity,
  type WorkbenchSurfaceFrame,
} from './IdeWorkbenchShell';

const NEXT_STEP_GUIDE_BY_MODE: Record<IdeSurfaceMode, string> = {
  project:
    'Choose Start a Lab for a Gannon pilot assignment, Build fresh for an empty design, Open Starter for guided examples, or Import / Recover to review a ZIP before replacing work.',
  design: 'Place components, wire ports, and label signals, then open Verify when the circuit matches the assignment.',
  verify: 'Run Observe, edit expected outputs, then Compare until saved checks pass.',
  hardware: 'Map required pins and resolve conflicts before treating Export as a credible package.',
  export: 'Download the RedByte/Vivado ZIP for browser-E0 handoff; Vivado build, bitstream, and board observation are external.',
  import: 'Review the import before replacing work; Cancel keeps the current project and Confirm Replace Project applies the import.',
};

export interface IdeSurfaceLayoutProps {
  mode: IdeSurfaceMode;
  children: React.ReactNode;
  inspector: React.ReactNode;
  dock?: React.ReactNode;
  console?: React.ReactNode;
  consoleHasBlocking?: boolean;
  consoleHasEntries?: boolean;
  leftDockMode?: LeftDockMode;
  /** @deprecated Use rightDockMode='hidden' instead. */
  hideRightDock?: boolean;
  rightDockMode?: RightDockMode;
  rightDockCanCollapse?: boolean;
  rightDockRevealKey?: string | null;
  consoleMode?: ConsoleMode;
  shellDensity?: WorkbenchShellDensity;
  surfaceFrame?: WorkbenchSurfaceFrame;
  layoutIntent?: WorkbenchLayoutIntent;
}

export const IdeSurfaceLayout: React.FC<IdeSurfaceLayoutProps> = ({
  mode,
  children,
  inspector,
  dock,
  console,
  consoleHasBlocking = false,
  consoleHasEntries = false,
  leftDockMode,
  hideRightDock = false,
  rightDockMode,
  rightDockCanCollapse = false,
  rightDockRevealKey = null,
  consoleMode,
  shellDensity,
  surfaceFrame,
  layoutIntent,
}) => {
  const workspace = (
    <>
      <aside
        className="ide-student-next-step-rail"
        data-testid={`ide-next-step-guide-${mode}`}
        aria-label={`${mode} next step guide`}
      >
        <strong>What do I do next?</strong>
        <span>{NEXT_STEP_GUIDE_BY_MODE[mode]}</span>
      </aside>
      {children}
    </>
  );

  return (
    <IdeWorkbenchShell
      mode={mode}
      workspace={workspace}
      leftDock={dock}
      rightDock={inspector}
      console={console}
      consoleHasBlocking={consoleHasBlocking}
      consoleHasEntries={consoleHasEntries}
      leftDockMode={leftDockMode}
      hideRightDock={hideRightDock}
      rightDockMode={rightDockMode}
      rightDockCanCollapse={rightDockCanCollapse}
      rightDockRevealKey={rightDockRevealKey}
      consoleMode={consoleMode}
      shellDensity={shellDensity}
      surfaceFrame={surfaceFrame}
      layoutIntent={layoutIntent}
    />
  );
};
