import React from 'react';
import { IdeStatusPill } from './IdePrimitives';

export interface IdeTopBarProps {
  projectName: string;
  projectId?: string;
  saveState: 'saved' | 'unsaved' | 'autosaving';
  // Legacy toolbar props — kept optional for backward compat; no longer rendered.
  // CTAs now live in each surface's right-dock and PipelineStrip.
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
          <h1 className="ide-project-name" title={projectName}>{projectName}</h1>
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
      </div>
    </header>
  );
};
