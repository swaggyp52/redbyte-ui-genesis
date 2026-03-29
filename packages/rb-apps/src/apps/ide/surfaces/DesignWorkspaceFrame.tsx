import React from 'react';
import type { DesignWorkspaceBodyMode } from './designWorkspaceConfig';

export interface DesignWorkspaceFrameProps {
  view: DesignWorkspaceBodyMode;
  children: React.ReactNode;
  testId?: string;
}

export function DesignWorkspaceFrame({
  view,
  children,
  testId = 'ide-design-workspace',
}: DesignWorkspaceFrameProps) {
  return (
    <section
      className="ide-design-workspace ide-design-frame"
      data-testid={testId}
      data-design-view={view}
    >
      {children}
    </section>
  );
}
