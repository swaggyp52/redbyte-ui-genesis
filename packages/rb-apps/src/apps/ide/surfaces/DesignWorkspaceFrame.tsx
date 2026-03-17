import React from 'react';
import type { DesignWorkspaceBodyMode } from './designWorkspaceConfig';

export interface DesignWorkspaceFrameProps {
  title: string;
  intent: string;
  status?: React.ReactNode;
  view: DesignWorkspaceBodyMode;
  children: React.ReactNode;
  testId?: string;
}

export function DesignWorkspaceFrame({
  title,
  intent,
  status,
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
      <header className="ide-design-frame-header">
        <div className="ide-design-frame-copy">
          <p className="ide-design-frame-kicker">Design Workspace</p>
          <div className="ide-design-frame-title-row">
            <h2 className="ide-design-frame-title">{title}</h2>
            {status ? <div className="ide-design-frame-status">{status}</div> : null}
          </div>
          <p className="ide-design-frame-intent">{intent}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
