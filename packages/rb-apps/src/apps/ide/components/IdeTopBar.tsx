import React from 'react';
import type { IdeBuildIdentity } from '../buildIdentity';
import { getIdeModeLabel, type IdeMode } from '../workflowStages';
import { IdeHelpMenu } from './IdeHelpMenu';

export interface IdeTopBarProps {
  projectName: string;
  projectId?: string;
  saveState: 'saved' | 'unsaved' | 'autosaving';
  currentMode?: IdeMode;
  buildIdentity?: IdeBuildIdentity;
  // Legacy toolbar props — kept optional for backward compat; no longer rendered.
  onSave?: () => void;
  onSaveAs?: () => void;
  onLoad?: () => void;
  onResetToExample?: () => void;
  onRunVerify?: () => void;
  onExport?: () => void;
  onHelp?: () => void;
  onWorkflowHelp?: () => void;
  onRenameProject?: (nextName: string) => void;
}

// Geometric logomark — circuit-trace hex
const RbLogomark: React.FC = () => (
  <svg
    className="ide-brand-svg"
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <polygon
      points="14,2 24,8 24,20 14,26 4,20 4,8"
      stroke="rgba(46,196,182,0.65)"
      strokeWidth="1.2"
      fill="rgba(46,196,182,0.07)"
    />
    <line x1="8" y1="14" x2="20" y2="14" stroke="rgba(46,196,182,0.9)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="10" y1="10" x2="10" y2="18" stroke="rgba(46,196,182,0.5)" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="18" y1="10" x2="18" y2="18" stroke="rgba(46,196,182,0.5)" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="10" cy="14" r="1.8" fill="rgba(46,196,182,0.9)" />
    <circle cx="18" cy="14" r="1.8" fill="rgba(46,196,182,0.5)" />
  </svg>
);

export const IdeTopBar: React.FC<IdeTopBarProps> = ({
  projectName,
  projectId,
  saveState,
  currentMode,
  buildIdentity,
  onHelp,
  onWorkflowHelp,
  onRenameProject,
}) => {
  const [editingName, setEditingName] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState(projectName);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);
  const cancelNextBlurCommitRef = React.useRef(false);
  const saveDotClass =
    saveState === 'saved'
      ? 'ide-save-dot--ok'
      : saveState === 'autosaving'
        ? 'ide-save-dot--saving'
        : 'ide-save-dot--unsaved';

  const modeLabel = currentMode ? getIdeModeLabel(currentMode) : null;
  const canRenameProject = Boolean(onRenameProject);

  React.useEffect(() => {
    if (!editingName) setNameDraft(projectName);
  }, [editingName, projectName]);

  React.useEffect(() => {
    if (!editingName) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [editingName]);

  const startNameEdit = React.useCallback(() => {
    if (!canRenameProject) return;
    cancelNextBlurCommitRef.current = false;
    setEditingName(true);
  }, [canRenameProject]);

  const commitName = React.useCallback(() => {
    if (cancelNextBlurCommitRef.current) {
      cancelNextBlurCommitRef.current = false;
      return;
    }
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (trimmed.length > 0 && trimmed !== projectName) {
      onRenameProject?.(trimmed);
      return;
    }
    setNameDraft(projectName);
  }, [nameDraft, onRenameProject, projectName]);

  const cancelNameEdit = React.useCallback(() => {
    cancelNextBlurCommitRef.current = true;
    setNameDraft(projectName);
    setEditingName(false);
  }, [projectName]);

  return (
    <header className="ide-top-bar" data-testid="ide-top-bar" data-save-state={saveState}>
      <div className="ide-top-left">
        <div className="ide-brand-mark" aria-label="RedByte">
          <RbLogomark />
        </div>

        <span className="ide-brand-wordmark" aria-hidden="true">RedByte</span>

        <span className="ide-breadcrumb-sep" aria-hidden="true">/</span>

        <div className="ide-project-meta">
          <h1 className="ide-project-name" title={projectName}>
            {editingName ? (
              <input
                ref={nameInputRef}
                className="ide-project-name-input"
                value={nameDraft}
                aria-label="Project title"
                data-testid="ide-topbar-project-name-input"
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitName();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelNameEdit();
                  }
                }}
              />
            ) : canRenameProject ? (
              <button
                type="button"
                className="ide-project-name-button"
                onClick={startNameEdit}
                onDoubleClick={startNameEdit}
                title={`Rename project "${projectName}"`}
                aria-label={`Project title ${projectName}. Click or double-click to rename.`}
                data-testid="ide-topbar-project-rename"
              >
                <span className="ide-project-name-text">{projectName}</span>
                <span className="ide-project-name-edit-cue" aria-hidden="true">Rename</span>
              </button>
            ) : (
              projectName
            )}
          </h1>
          {projectId ? <p className="ide-project-subline">{projectId}</p> : null}
        </div>

        {modeLabel && (
          <>
            <span className="ide-breadcrumb-sep" aria-hidden="true">/</span>
            <span className="ide-mode-breadcrumb" data-testid="ide-topbar-mode-label">
              {modeLabel}
            </span>
          </>
        )}

        <span className="ide-board-chip" data-testid="ide-board-chip">Basys3</span>
      </div>

      <div className="ide-top-right">
        <span
          className={`ide-save-dot ${saveDotClass}`}
          data-testid="ide-save-state"
          title={saveState === 'saved' ? 'All changes saved' : saveState === 'autosaving' ? 'Saving…' : 'Unsaved changes'}
          aria-label={saveState}
        />
        <span className="ide-save-label" aria-live="polite">
          {saveState === 'saved' ? 'Saved' : saveState === 'autosaving' ? 'Saving…' : 'Unsaved'}
        </span>
        {onWorkflowHelp && (
          <button
            className="ide-topbar-workflow-help-btn"
            onClick={onWorkflowHelp}
            title="Workflow orientation"
            aria-label="Workflow orientation"
            data-testid="ide-topbar-workflow-help-btn"
          >
            Flow
          </button>
        )}
        <IdeHelpMenu buildIdentity={buildIdentity} onKeyboardShortcuts={onHelp} />
      </div>
    </header>
  );
};
