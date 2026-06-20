import React from 'react';

export interface IdeStatusBarProps {
  mode: string;
  determinismHash: string;
  gateStatus: 'pass' | 'warn' | 'fail';
}

export const IdeStatusBar: React.FC<IdeStatusBarProps> = ({ mode, gateStatus }) => {
  const isQuietDesignMode = mode === 'design';
  const supportLabel =
    gateStatus === 'pass'
      ? 'Ready'
      : gateStatus === 'warn'
        ? 'Needs review'
        : 'Issue flagged';

  return (
    <footer
      className={`ide-status-bar${isQuietDesignMode ? ' ide-status-bar--quiet' : ''}`}
      data-testid="ide-status-bar"
      aria-label="Workspace status"
    >
      <span className="ide-status-item">
        {isQuietDesignMode ? 'Design workspace' : `${capitalizeMode(mode)} workspace`}
      </span>
      <span className={`ide-status-support ide-status-support--${gateStatus}`}>
        {supportLabel}
      </span>
    </footer>
  );
};

function capitalizeMode(value: string): string {
  if (!value) return 'Current';
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
