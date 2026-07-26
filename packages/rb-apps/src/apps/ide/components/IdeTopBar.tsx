import React from 'react';
import type { IdeBuildIdentity } from '../buildIdentity';
import { getIdeModeLabel, type IdeMode } from '../workflowStages';

export interface IdeTopBarProps {
  projectName: string;
  projectId?: string;
  boardTarget?: string;
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
  onImport?: () => void;
  onHelp?: () => void;
  onRenameProject?: (nextName: string) => void;
}

// Geometric circuit mark. Color is inherited from the professional shell theme.
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
      stroke="currentColor"
      strokeWidth="1.2"
      fill="none"
    />
    <line x1="8" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="10" y1="10" x2="10" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="18" y1="10" x2="18" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="10" cy="14" r="1.8" fill="currentColor" />
    <circle cx="18" cy="14" r="1.8" fill="currentColor" />
  </svg>
);

export const IdeTopBar: React.FC<IdeTopBarProps> = ({
  projectName,
  boardTarget = 'Basys3',
  saveState,
  currentMode,
  buildIdentity,
  onSave,
  onImport,
  onHelp,
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
  const boardLabel = boardTarget.toLowerCase() === 'basys3' ? 'Basys3' : boardTarget;

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
    <header
      className="ide-top-bar"
      data-testid="ide-top-bar"
      data-save-state={saveState}
      data-build-sha={buildIdentity?.shortSha}
      data-build-environment={buildIdentity?.envLabel}
    >
      <div className="ide-top-left">
        <div className="ide-brand" aria-label="RedByte">
          <span className="ide-brand-mark" aria-hidden="true">
            <RbLogomark />
          </span>
          <span className="ide-brand-wordmark">RedByte</span>
        </div>

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
        </div>

        {modeLabel && (
          <>
            <span className="ide-breadcrumb-sep" aria-hidden="true">/</span>
            <span className="ide-mode-breadcrumb" data-testid="ide-topbar-mode-label">
              {modeLabel}
            </span>
          </>
        )}
      </div>

      <div className="ide-top-right">
        <span className="ide-topbar-fact" data-testid="ide-board-chip">
          <span className="ide-topbar-fact-label">Board</span>
          <strong>{boardLabel}</strong>
        </span>
        <span
          className={`ide-save-dot ${saveDotClass}`}
          data-testid="ide-save-state"
          title={saveState === 'saved' ? 'All changes saved' : saveState === 'autosaving' ? 'Saving…' : 'Unsaved changes'}
          aria-label={saveState}
        />
        <span className="ide-save-label" aria-live="polite">
          {saveState === 'saved' ? 'Saved' : saveState === 'autosaving' ? 'Saving…' : 'Unsaved'}
        </span>
        {onSave && (
          <button
            type="button"
            className="ide-topbar-action"
            onClick={onSave}
            data-testid="ide-topbar-save-btn"
          >
            Save
          </button>
        )}
        {onImport && (
          <button
            type="button"
            className="ide-topbar-action"
            onClick={onImport}
            data-testid="mode-button-import"
            data-active={currentMode === 'import' ? 'true' : 'false'}
            aria-current={currentMode === 'import' ? 'page' : undefined}
          >
            Import
          </button>
        )}
        {onHelp && (
          <button
            className="ide-topbar-help-btn"
            onClick={onHelp}
            title="Help and keyboard shortcuts"
            aria-label="Help and keyboard shortcuts"
            data-testid="ide-topbar-help-btn"
          >
            Help
          </button>
        )}
      </div>
    </header>
  );
};
