import React from 'react';

export interface WorkbenchStatusBarProps {
  problemsCount: number;
  onShowProblems?: () => void;
  /** Evidence freshness where relevant (Simulate / Design replay). */
  runState?: { label: string; tone: 'ok' | 'warn' | 'error' | 'idle' } | null;
}

/**
 * Status line — compact, actionable state only: problems (a real command that
 * opens the bottom panel) and evidence freshness. Project identity, the selected
 * object, the target and save state live in the application frame bar; they
 * are never repeated here.
 */
export const WorkbenchStatusBar: React.FC<WorkbenchStatusBarProps> = ({
  problemsCount,
  onShowProblems,
  runState = null,
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
      {runState ? (
        <span className="wb-status-item" data-testid="ide-status-run" data-tone={runState.tone === 'idle' ? undefined : runState.tone}>
          {runState.label}
        </span>
      ) : null}
    </footer>
  );
};
