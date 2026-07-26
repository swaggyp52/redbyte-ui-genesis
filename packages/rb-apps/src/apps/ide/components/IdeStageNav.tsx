import React from 'react';
import { STUDENT_WORKFLOW_STAGES, type IdeMode } from '../workflowStages';

export type { IdeMode } from '../workflowStages';

export interface IdeStageNavProps {
  currentMode: IdeMode;
  onModeChange: (mode: IdeMode) => void;
  stepsCompleted?: Partial<Record<IdeMode, boolean>>;
  stepsBlocked?: Partial<Record<IdeMode, boolean>>;
}

/** The single horizontal project-flow authority for Unified Workbench v3. */
export const IdeStageNav: React.FC<IdeStageNavProps> = ({
  currentMode,
  onModeChange,
  stepsCompleted,
  stepsBlocked,
}) => (
  <div className="ide-stage-nav-frame" data-testid="ide-stage-nav">
    <nav className="ide-stage-nav" aria-label="Project workflow stages">
      {STUDENT_WORKFLOW_STAGES.map((stage) => {
        const isActive = stage.id === currentMode;
        const isComplete = Boolean(stepsCompleted?.[stage.id]);
        const isBlocked = Boolean(stepsBlocked?.[stage.id]) && !isComplete;
        const state = isActive ? 'current' : isComplete ? 'complete' : isBlocked ? 'blocked' : 'available';

        return (
          <button
            key={stage.id}
            type="button"
            className="ide-stage-nav-button"
            data-testid={`mode-button-${stage.id}`}
            data-active={isActive ? 'true' : 'false'}
            data-state={state}
            aria-current={isActive ? 'step' : undefined}
            onClick={() => onModeChange(stage.id)}
          >
            <span className="ide-stage-nav-number" aria-hidden="true">{stage.step}</span>
            <span className="ide-stage-nav-copy">
              <span className="ide-stage-nav-label">{stage.label}</span>
            </span>
            {isComplete && !isActive ? (
              <span className="ide-stage-nav-state" aria-label="Complete">Done</span>
            ) : null}
            {isBlocked && !isActive ? (
              <span className="ide-stage-nav-state" aria-label="Blocked">Blocked</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  </div>
);
