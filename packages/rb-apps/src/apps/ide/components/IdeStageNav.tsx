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

// Compact workspace labels — professional workspace navigation, not a five-step
// game progression. The full "Board & Constraints" / "Build & Export" names live
// on the surfaces themselves; the switcher stays terse.
const NAV_LABELS: Record<Exclude<IdeMode, 'import'>, string> = {
  project: 'Project',
  design: 'Design',
  verify: 'Simulate',
  hardware: 'Board',
  export: 'Package',
};

/**
 * The single horizontal workspace switcher. It selects a workspace document; it is
 * NOT a progress dashboard — no completion checkmarks, no per-workspace status
 * subtitle. A workspace that genuinely needs attention shows one small dot; its
 * detailed state lives on the surface, the inspector, and the status line.
 */
export const IdeStageNav: React.FC<IdeStageNavProps> = ({
  currentMode,
  onModeChange,
  stepsBlocked,
  stageStatus,
}) => (
  <div className="ide-stage-nav-frame" data-testid="ide-stage-nav">
    <nav className="ide-stage-nav" role="tablist" aria-label="Workspaces">
      {STUDENT_WORKFLOW_STAGES.map((stage) => {
        const isActive = stage.id === currentMode;
        const isBlocked = Boolean(stepsBlocked?.[stage.id]) && !isActive;
        const state = isActive ? 'current' : isBlocked ? 'blocked' : 'available';
        const status = stageStatus?.[stage.id];

        return (
          <button
            key={stage.id}
            type="button"
            role="tab"
            className="ide-stage-nav-button"
            data-testid={`mode-button-${stage.id}`}
            data-active={isActive ? 'true' : 'false'}
            data-state={state}
            data-stage={stage.id}
            aria-selected={isActive}
            aria-current={isActive ? 'step' : undefined}
            title={status ? `${stage.label} — ${status}` : stage.label}
            onClick={() => onModeChange(stage.id)}
          >
            <span className="ide-stage-nav-label">{NAV_LABELS[stage.id]}</span>
            {isBlocked ? <span className="ide-stage-nav-dot" aria-label="needs attention" /> : null}
          </button>
        );
      })}
    </nav>
  </div>
);
