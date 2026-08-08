import React from 'react';
import { STUDENT_WORKFLOW_STAGES, type IdeMode } from '../workflowStages';

export type { IdeMode } from '../workflowStages';

export interface IdeStageNavProps {
  currentMode: IdeMode;
  onModeChange: (mode: IdeMode) => void;
  stepsCompleted?: Partial<Record<IdeMode, boolean>>;
  stepsBlocked?: Partial<Record<IdeMode, boolean>>;
  stageStatus?: Partial<Record<IdeMode, string>>;
}

const StageGlyph: React.FC<{ mode: Exclude<IdeMode, 'import'>; complete: boolean }> = ({
  mode,
  complete,
}) => {
  if (complete) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6.5 12.5 3.5 3.5 7.5-8" />
      </svg>
    );
  }

  if (mode === 'project') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 7.5h6l2-2h9v13h-17z" />
      </svg>
    );
  }
  if (mode === 'design') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="2" />
        <circle cx="19" cy="6" r="2" />
        <circle cx="19" cy="18" r="2" />
        <path d="M7 12h4l3-6h3M11 12l3 6h3" />
      </svg>
    );
  }
  if (mode === 'verify') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 14h4V8h4v8h4v-6h6" />
        <path d="m16.5 5.5 1.6 1.6 3.2-3.2" />
      </svg>
    );
  }
  if (mode === 'hardware') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
        <path d="M9 3v3.5M15 3v3.5M9 17.5V21M15 17.5V21M3 9h3.5M17.5 9H21M3 15h3.5M17.5 15H21" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h7l4 4v13H7z" />
      <path d="M14 3.5v4h4M12.5 10v6M9.5 13l3 3 3-3" />
    </svg>
  );
};

/** The single horizontal project-flow authority for Unified Workbench v3. */
export const IdeStageNav: React.FC<IdeStageNavProps> = ({
  currentMode,
  onModeChange,
  stepsCompleted,
  stepsBlocked,
  stageStatus,
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
            data-stage={stage.id}
            aria-current={isActive ? 'step' : undefined}
            onClick={() => onModeChange(stage.id)}
          >
            <span className="ide-stage-nav-icon">
              <StageGlyph mode={stage.id} complete={isComplete && !isActive} />
            </span>
            <span className="ide-stage-nav-copy">
              <span className="ide-stage-nav-label">{stage.label}</span>
              <span className="ide-stage-nav-hint">{stageStatus?.[stage.id] ?? stage.hint}</span>
            </span>
            {isBlocked && !isActive ? (
              <span className="ide-stage-nav-state" aria-label="Blocked">!</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  </div>
);
