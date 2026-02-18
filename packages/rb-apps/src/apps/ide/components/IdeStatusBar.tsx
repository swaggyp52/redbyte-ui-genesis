import React from 'react';
import { IdeStatusPill } from './IdePrimitives';

export interface IdeStatusBarProps {
  mode: string;
  determinismHash: string;
  gateStatus: 'pass' | 'warn' | 'fail';
}

export const IdeStatusBar: React.FC<IdeStatusBarProps> = ({ mode, determinismHash, gateStatus }) => {
  const gateTone = gateStatus === 'pass' ? 'ok' : gateStatus === 'warn' ? 'warn' : 'error';
  const gateLabel = gateStatus === 'pass' ? 'Gates OK' : gateStatus === 'warn' ? 'Gates Pending' : 'Gate Fail';

  return (
    <footer className="ide-status-bar" data-testid="ide-status-bar">
      <span className="ide-status-item">Mode: {mode}</span>
      <span className="ide-status-item ide-status-mono">Hash: {determinismHash}</span>
      <IdeStatusPill tone={gateTone}>{gateLabel}</IdeStatusPill>
    </footer>
  );
};
