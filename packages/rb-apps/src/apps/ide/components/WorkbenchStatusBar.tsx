import React from 'react';

export interface WorkbenchStatusBarProps {
  problemsCount: number;
  onShowProblems?: () => void;
  /** Compact path of the selected engineering object, or null when nothing is selected. */
  selectionLabel?: string | null;
  /** Current simulation run state where relevant (Simulate / Design replay). */
  runState?: { label: string; tone: 'ok' | 'warn' | 'error' | 'idle' } | null;
  boardTarget?: string;
  fpgaPart?: string;
}

/**
 * Status bar — compact, actionable state only: problems (a real command that
 * opens the bottom panel), the selected engineering object, run state, and the
 * target part. Project identity and save state live in the command bar; they are
 * never repeated here.
 */
export const WorkbenchStatusBar: React.FC<WorkbenchStatusBarProps> = ({
  problemsCount,
  onShowProblems,
  selectionLabel = null,
  runState = null,
  boardTarget,
  fpgaPart,
}) => {
  return (
    <footer className="wb-status" data-testid="ide-status-bar" aria-label="Workbench status">
      <button
        type="button"
        className="wb-status-btn"
        data-testid="ide-status-problems"
        data-tone={problemsCount > 0 ? 'error' : undefined}
        onClick={onShowProblems}
        title="Show problems"
      >
        {problemsCount > 0 ? `${problemsCount} problem${problemsCount === 1 ? '' : 's'}` : 'No problems'}
      </button>
      <span className="wb-status-spacer" />
      {selectionLabel ? (
        <span className="wb-status-item wb-status-selection" data-testid="ide-status-selection" title={selectionLabel}>
          <code>{selectionLabel}</code>
        </span>
      ) : null}
      {runState ? (
        <span className="wb-status-item" data-testid="ide-status-run" data-tone={runState.tone === 'idle' ? undefined : runState.tone}>
          {runState.label}
        </span>
      ) : null}
      {boardTarget ? (
        <span className="wb-status-item" data-testid="ide-status-target">
          <code>{boardTarget}{fpgaPart ? ` · ${fpgaPart}` : ''}</code>
        </span>
      ) : null}
    </footer>
  );
};
