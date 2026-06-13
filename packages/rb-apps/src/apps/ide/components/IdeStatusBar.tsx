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
      ? 'Checks synced'
      : gateStatus === 'warn'
        ? 'Checks need review'
        : 'Checks flagged';

  return (
    <footer
      className={`ide-status-bar${isQuietDesignMode ? ' ide-status-bar--quiet' : ''}`}
      data-testid="ide-status-bar"
      aria-label="Workbench support context"
    >
      <span className="ide-status-item">
        {isQuietDesignMode ? 'Support context' : `Support: ${mode}`}
      </span>
      <span className={`ide-status-support ide-status-support--${gateStatus}`}>
        {supportLabel}
      </span>
    </footer>
  );
};
