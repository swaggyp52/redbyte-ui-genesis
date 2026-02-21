import React from 'react';
import { IdeButton, IdeStatusPill } from './IdePrimitives';

export interface IdeTopBarProps {
  projectName: string;
  projectId?: string;
  saveState: 'saved' | 'unsaved' | 'autosaving';
  onSave?: () => void;
  onSaveAs?: () => void;
  onLoad?: () => void;
  onResetToExample?: () => void;
  onRunVerify?: () => void;
  onExport?: () => void;
  onHelp?: () => void;
}

export const IdeTopBar: React.FC<IdeTopBarProps> = ({
  projectName,
  projectId,
  saveState,
  onSave,
  onSaveAs,
  onLoad,
  onResetToExample,
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
          {projectId ? <p className="ide-project-subline">{projectId}</p> : null}
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
        <div className="ide-top-right-group" data-testid="ide-top-file-actions">
          <IdeButton tone="secondary" onClick={onSave} testId="ide-action-save">
            Save
          </IdeButton>
          <IdeButton tone="ghost" onClick={onSaveAs} testId="ide-action-save-as">
            Save As
          </IdeButton>
          <IdeButton tone="ghost" onClick={onLoad} testId="ide-action-load">
            Load
          </IdeButton>
          <IdeButton tone="ghost" onClick={onResetToExample} testId="ide-action-reset-example">
            Reset
          </IdeButton>
        </div>
        <div className="ide-top-right-group" data-testid="ide-top-run-actions">
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
      </div>
    </header>
  );
};
