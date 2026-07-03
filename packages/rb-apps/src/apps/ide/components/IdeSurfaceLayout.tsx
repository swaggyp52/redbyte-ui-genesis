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
import { PageProductHeader, type PageProductHeaderState } from './PageProductHeader';

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
  productSpine?: PageProductHeaderState | null;
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
  productSpine,
}) => {
  const workspace = (
    <>
      <PageProductHeader mode={mode} state={productSpine} />
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
