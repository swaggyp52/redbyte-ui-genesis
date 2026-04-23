import React from 'react';
import { IdeStatusPill } from './IdePrimitives';

export interface IdeStatusBarProps {
  mode: string;
  determinismHash: string;
  gateStatus: 'pass' | 'warn' | 'fail';
}

export const IdeStatusBar: React.FC<IdeStatusBarProps> = ({ mode, determinismHash, gateStatus }) => {
  const gateTone = gateStatus === 'pass' ? 'ok' : gateStatus === 'warn' ? 'warn' : 'error';
  const isQuietDesignMode = mode === 'design';
  const gateLabel =
    gateStatus === 'pass'
      ? 'Workflow Ready'
      : gateStatus === 'warn'
        ? 'Workflow Review'
        : 'Workflow Blocked';

  return (
    <footer
      className={`ide-status-bar${isQuietDesignMode ? ' ide-status-bar--quiet' : ''}`}
      data-testid="ide-status-bar"
    >
      {!isQuietDesignMode ? <span className="ide-status-item">Mode: {mode}</span> : null}
      {!isQuietDesignMode ? (
        <span className="ide-status-item ide-status-mono">Project Hash: {determinismHash}</span>
      ) : null}
      <IdeStatusPill tone={gateTone}>{gateLabel}</IdeStatusPill>
    </footer>
  );
};
