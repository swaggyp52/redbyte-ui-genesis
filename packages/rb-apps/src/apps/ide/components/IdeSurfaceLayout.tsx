import React from 'react';
import { IdeWorkbenchShell } from './IdeWorkbenchShell';

type IdeSurfaceMode = 'project' | 'design' | 'verify' | 'export' | 'import';

export interface IdeSurfaceLayoutProps {
  mode: IdeSurfaceMode;
  children: React.ReactNode;
  inspector: React.ReactNode;
  dock?: React.ReactNode;
  console?: React.ReactNode;
}

export const IdeSurfaceLayout: React.FC<IdeSurfaceLayoutProps> = ({
  mode,
  children,
  inspector,
  dock,
  console,
}) => {
  return (
    <IdeWorkbenchShell
      mode={mode}
      workspace={children}
      leftDock={dock}
      rightDock={inspector}
      console={console}
    />
  );
};
