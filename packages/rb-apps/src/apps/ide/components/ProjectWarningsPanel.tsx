// Copyright (c) 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { IdeButton } from './IdePrimitives';
import { SurfacePanel } from './SurfaceLayoutPrimitives';
import type { ProjectHealthIssue, ProjectHealthMode } from '../projectHealth';

/**
 * ProjectWarningsPanel — lists structured `ProjectHealth.blockingIssues` with
 * direct fix-path buttons, replacing the older "N blocking issues open" count
 * buried under the Bridge callout. Pure presentational: the caller supplies
 * pre-derived issues and a fix-path router.
 *
 * Hidden when there are no issues — this panel must never clutter a clean
 * project state.
 */

export interface ProjectWarningsPanelProps {
  issues: ProjectHealthIssue[];
  /** Router for fix-path mode links. Returning null/undefined hides the button. */
  onNavigateFix: (mode: ProjectHealthMode) => void;
  testId?: string;
}

export const ProjectWarningsPanel: React.FC<ProjectWarningsPanelProps> = ({
  issues,
  onNavigateFix,
  testId = 'ide-project-warnings',
}) => {
  if (issues.length === 0) {
    return null;
  }

  return (
    <SurfacePanel className="ide-project-warnings" testId={testId}>
      <header className="ide-project-warnings-header">
        <div>
          <p className="ide-surface-block-label">Project warnings</p>
          <h3
            className="ide-project-warnings-title"
            data-testid={`${testId}-title`}
          >
            {issues.length === 1
              ? '1 thing to resolve'
              : `${issues.length} things to resolve`}
          </h3>
          <p className="ide-project-warnings-subtitle">
            Each item blocks a clean hand-off. Fix paths open the correct surface.
          </p>
        </div>
      </header>

      <ul
        className="ide-project-warnings-list"
        data-testid={`${testId}-list`}
      >
        {issues.map((issue) => (
          <li
            key={issue.code}
            className="ide-project-warnings-item"
            data-testid={`${testId}-item-${issue.code}`}
          >
            <div className="ide-project-warnings-item-body">
              <div className="ide-project-warnings-item-message">
                {issue.message}
              </div>
              <code className="ide-project-warnings-item-code">
                {issue.code}
              </code>
            </div>
            {issue.fixPath && (
              <IdeButton
                tone="secondary"
                onClick={() => onNavigateFix(issue.fixPath!.mode)}
                testId={`${testId}-fix-${issue.code}`}
              >
                {issue.fixPath.actionLabel}
              </IdeButton>
            )}
          </li>
        ))}
      </ul>
    </SurfacePanel>
  );
};
