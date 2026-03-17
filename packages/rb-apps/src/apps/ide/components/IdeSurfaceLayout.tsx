import React from 'react';
import {
  IdeWorkbenchShell,
  type ConsoleMode,
  type IdeSurfaceMode,
  type LeftDockMode,
  type RightDockMode,
  type WorkbenchShellDensity,
  type WorkbenchSurfaceFrame,
} from './IdeWorkbenchShell';

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
  consoleMode?: ConsoleMode;
  shellDensity?: WorkbenchShellDensity;
  surfaceFrame?: WorkbenchSurfaceFrame;
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
  consoleMode,
  shellDensity,
  surfaceFrame,
}) => {
  return (
    <IdeWorkbenchShell
      mode={mode}
      workspace={children}
      leftDock={dock}
      rightDock={inspector}
      console={console}
      consoleHasBlocking={consoleHasBlocking}
      consoleHasEntries={consoleHasEntries}
      leftDockMode={leftDockMode}
      hideRightDock={hideRightDock}
      rightDockMode={rightDockMode}
      consoleMode={consoleMode}
      shellDensity={shellDensity}
      surfaceFrame={surfaceFrame}
    />
  );
};
