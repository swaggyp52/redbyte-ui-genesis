import React from 'react';
import { IdeButton, IdeStatusPill } from './IdePrimitives';

export interface IdeTopBarProps {
  projectName: string;
  saveState: 'saved' | 'unsaved' | 'autosaving';
  onRunVerify?: () => void;
  onExport?: () => void;
  onHelp?: () => void;
}

export const IdeTopBar: React.FC<IdeTopBarProps> = ({
  projectName,
  saveState,
  onRunVerify,
  onExport,
  onHelp,
}) => {
  const saveTone = saveState === 'saved' ? 'ok' : saveState === 'autosaving' ? 'warn' : 'error';
  const saveLabel =
    saveState === 'saved' ? 'Saved' : saveState === 'autosaving' ? 'Autosaving' : 'Unsaved';

  return (
    <header className="ide-top-bar" data-testid="ide-top-bar">
      <div className="ide-top-left">
        <div className="ide-brand-mark" aria-hidden="true">
          RB
        </div>
        <div className="ide-project-meta">
          <p className="ide-project-label">RedByte IDE</p>
          <h1 className="ide-project-name">{projectName}</h1>
        </div>
      </div>

      <div className="ide-top-center">
        <span className="ide-board-chip" data-testid="ide-board-chip">
          Basys3
        </span>
      </div>

      <div className="ide-top-right">
        <IdeStatusPill tone={saveTone} testId="ide-save-state">
          {saveLabel}
        </IdeStatusPill>
        <IdeButton tone="secondary" onClick={onRunVerify} testId="ide-action-run-verify">
          Run Verify
        </IdeButton>
        <IdeButton tone="primary" onClick={onExport} testId="ide-action-export">
          Export
        </IdeButton>
        <IdeButton tone="ghost" onClick={onHelp} testId="ide-action-help">
          Help
        </IdeButton>
      </div>
    </header>
  );
};
