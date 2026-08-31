import React from 'react';
import type { DesignWorkspaceBodyMode } from './designWorkspaceConfig';

export interface DesignWorkspaceFrameProps {
  view: DesignWorkspaceBodyMode;
  children: React.ReactNode;
  testId?: string;
  canvasAppearance?: 'dark' | 'light' | 'system';
  canvasDensity?: 'comfortable' | 'compact';
}

export function DesignWorkspaceFrame({
  view,
  children,
  testId = 'ide-design-workspace',
  canvasAppearance = 'dark',
  canvasDensity = 'comfortable',
}: DesignWorkspaceFrameProps) {
  return (
    <section
      className="ide-design-workspace ide-design-frame"
      data-testid={testId}
      data-design-view={view}
      data-canvas-appearance={canvasAppearance}
      data-canvas-density={canvasDensity}
    >
      {children}
    </section>
  );
}
