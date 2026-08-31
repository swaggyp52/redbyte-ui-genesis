import React from 'react';

export interface IdeStatusBarProps {
  mode: string;
  determinismHash?: string;
  gateStatus?: 'pass' | 'warn' | 'fail';
  storageState?: string;
  problemsCount?: number;
  branch?: string;
  fullSha?: string;
  runtime?: string;
  devUrl?: string;
}

export const IdeStatusBar: React.FC<IdeStatusBarProps> = ({
  mode,
  gateStatus = 'warn',
  storageState,
  problemsCount,
  branch,
  fullSha,
  runtime,
  devUrl,
}) => {
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
      {storageState ? <span className="ide-status-item" data-testid="ide-status-storage">Storage: {storageState}</span> : null}
      {typeof problemsCount === 'number' ? <span className="ide-status-item" data-testid="ide-status-problems">Problems: {problemsCount}</span> : null}
      {branch && fullSha && runtime && devUrl ? (
        <span
          className="ide-status-item ide-status-build"
          data-testid="ide-status-build"
          title={`${branch} @ ${fullSha} - Node ${runtime} - ${devUrl}`}
        >
          {branch} @ {fullSha} - Node {runtime} - {devUrl}
        </span>
      ) : null}
    </footer>
  );
};
