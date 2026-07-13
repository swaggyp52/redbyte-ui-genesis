import React from 'react';
import {
  IDE_MODE_DEFINITIONS,
  IDE_WORKFLOW_ROUTE_STEPS,
  type IdeMode,
  type IdeModeDefinition,
} from '../workflowStages';

interface WorkflowStep {
  id: IdeMode;
  label: string;
  step: number;
  hint: string;
}

interface UtilityEntry {
  id: IdeMode;
  label: string;
  hint: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'project',
    label: 'Project',
    step: 1,
    hint: 'Choose your work',
  },
  ...IDE_WORKFLOW_ROUTE_STEPS.map((step) => ({
    ...step,
    step: step.step + 1,
  })),
];

const IMPORT_ENTRY: UtilityEntry = {
  id: 'import',
  label: 'Import',
  hint: 'Open project files',
};

export type { IdeMode } from '../workflowStages';

export const MODES: IdeModeDefinition[] = IDE_MODE_DEFINITIONS;

export interface IdeLeftRailProps {
  currentMode: IdeMode;
  onModeChange: (mode: IdeMode) => void;
  labStepCurrent?: number;
  labStepTotal?: number;
  stepsCompleted?: Partial<Record<IdeMode, boolean>>;
  stepsBlocked?: Partial<Record<IdeMode, boolean>>;
}

export const IdeLeftRail: React.FC<IdeLeftRailProps> = ({
  currentMode,
  onModeChange,
  stepsCompleted,
  stepsBlocked,
}) => {
  const renderUtility = (entry: UtilityEntry) => {
    const isActive = entry.id === currentMode;
    return (
      <button
        key={entry.id}
        type="button"
        onClick={() => onModeChange(entry.id)}
        className={`ide-mode-button ide-mode-button--utility ${isActive ? 'is-active' : ''}`}
        data-testid={`mode-button-${entry.id}`}
        data-active={isActive ? 'true' : 'false'}
        aria-current={isActive ? 'page' : undefined}
        title={entry.label}
      >
        <span className="ide-mode-copy">
          <span className="ide-mode-label">{entry.label}</span>
          <span className="ide-mode-hint">{entry.hint}</span>
        </span>
        {isActive ? <span className="ide-mode-state">Current</span> : null}
      </button>
    );
  };

  const renderStep = (step: WorkflowStep) => {
    const isActive = step.id === currentMode;
    const isDone = Boolean(stepsCompleted?.[step.id]);
    const isBlocked = Boolean(stepsBlocked?.[step.id]) && !isDone;
    const stateLabel = isActive ? 'Current' : isDone ? 'Complete' : isBlocked ? 'Blocked' : null;

    return (
      <button
        key={step.id}
        type="button"
        onClick={() => onModeChange(step.id)}
        className={`ide-mode-button ide-mode-button--step ${isActive ? 'is-active' : ''} ${
          isDone && !isActive ? 'is-complete' : ''
        } ${isBlocked && !isActive ? 'is-blocked' : ''}`}
        data-testid={`mode-button-${step.id}`}
        data-active={isActive ? 'true' : 'false'}
        data-complete={isDone ? 'true' : 'false'}
        data-blocked={isBlocked ? 'true' : 'false'}
        aria-current={isActive ? 'step' : undefined}
        title={`Stage ${step.step}: ${step.label}`}
      >
        <span className="ide-step-num" aria-hidden="true">{step.step}</span>
        <span className="ide-mode-copy">
          <span className="ide-mode-label">{step.label}</span>
          <span className="ide-mode-hint">{step.hint}</span>
        </span>
        {stateLabel ? <span className="ide-mode-state">{stateLabel}</span> : null}
      </button>
    );
  };

  return (
    <aside className="ide-left-rail" data-testid="ide-left-rail" aria-label="RedByte workflow">
      <p className="ide-left-rail-heading">Workflow</p>
      <nav className="ide-left-rail-nav" aria-label="Workflow stages">
        {WORKFLOW_STEPS.map(renderStep)}
      </nav>

      <div className="ide-rail-divider" aria-hidden="true" />
      <div className="ide-left-rail-utility" aria-label="Project utilities">
        <p className="ide-left-rail-utility-label">Utility</p>
        {renderUtility(IMPORT_ENTRY)}
      </div>
    </aside>
  );
};
