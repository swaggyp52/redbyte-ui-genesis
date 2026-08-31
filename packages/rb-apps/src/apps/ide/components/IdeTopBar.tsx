import React from 'react';
import type { ThemeVariant } from '@redbyte/rb-theme';
import type { IdeBuildIdentity } from '../buildIdentity';
import type { IdeMode } from '../workflowStages';
import { WORKSPACE_PRESETS, type WorkspacePresetId } from '../workspacePreferences';
import { IdeStageNav } from './IdeStageNav';

export type IdeTopBarSaveState =
  | 'saved'
  | 'unsaved'
  | 'autosaving'
  | 'saving'
  | 'save-failed';

export interface IdeTopBarProps {
  projectName: string;
  projectId?: string;
  boardTarget?: string;
  saveState: IdeTopBarSaveState;
  lastSavedAt?: string | null;
  storageLabel?: string;
  recoveryAvailable?: boolean;
  currentMode?: IdeMode;
  onModeChange?: (mode: IdeMode) => void;
  stepsCompleted?: Partial<Record<IdeMode, boolean>>;
  stepsBlocked?: Partial<Record<IdeMode, boolean>>;
  stageStatus?: Partial<Record<IdeMode, string>>;
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
  onOpenCommandPalette?: () => void;
  onDuplicateProject?: () => void;
  onExportBackup?: () => void;
  onRecover?: () => void;
  activeWorkspacePreset?: WorkspacePresetId | null;
  onApplyWorkspacePreset?: (presetId: WorkspacePresetId) => void;
  onResetWorkspace?: () => void;
  onRenameProject?: (nextName: string) => void;
  themeVariant?: ThemeVariant;
  onThemeChange?: (theme: Exclude<ThemeVariant, 'midnight'>) => void;
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
  lastSavedAt = null,
  storageLabel = 'This browser on this device',
  recoveryAvailable = false,
  currentMode,
  onModeChange,
  stepsCompleted,
  stepsBlocked,
  stageStatus,
  buildIdentity,
  onSave,
  onSaveAs,
  onLoad,
  onImport,
  onHelp,
  onOpenCommandPalette,
  onDuplicateProject,
  onExportBackup,
  onRecover,
  activeWorkspacePreset = 'authoring',
  onApplyWorkspacePreset,
  onResetWorkspace,
  onRenameProject,
  themeVariant = 'light',
  onThemeChange,
}) => {
  const [editingName, setEditingName] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState(projectName);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);
  const cancelNextBlurCommitRef = React.useRef(false);
  const saveDotClass =
    saveState === 'saved'
      ? 'ide-save-dot--ok'
      : saveState === 'autosaving' || saveState === 'saving'
        ? 'ide-save-dot--saving'
        : saveState === 'save-failed'
          ? 'ide-save-dot--failed'
          : 'ide-save-dot--unsaved';
  const saveLabel =
    saveState === 'saved'
      ? 'Saved'
      : saveState === 'autosaving'
        ? 'Autosaving...'
        : saveState === 'saving'
          ? 'Saving...'
          : saveState === 'save-failed'
            ? 'Save failed'
            : 'Unsaved';
  const saveTitle = [saveLabel, lastSavedAt ? `Last saved ${lastSavedAt}` : null, storageLabel]
    .filter(Boolean)
    .join(' - ');

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
      data-build-full-sha={buildIdentity?.fullSha}
      data-build-branch={buildIdentity?.branch}
      data-build-runtime={buildIdentity?.runtime}
      data-dev-url={buildIdentity?.devUrl}
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

      </div>

      {currentMode && onModeChange ? (
        <div className="ide-top-center">
          <IdeStageNav
            currentMode={currentMode}
            onModeChange={onModeChange}
            stepsCompleted={stepsCompleted}
            stepsBlocked={stepsBlocked}
            stageStatus={stageStatus}
          />
        </div>
      ) : null}

      <div className="ide-top-right">
        <span className="ide-topbar-fact" data-testid="ide-board-chip">
          <span className="ide-topbar-fact-label">Board</span>
          <strong>{boardLabel}</strong>
        </span>
        <span
          className={`ide-save-dot ${saveDotClass}`}
          data-testid="ide-save-state"
          title={saveTitle}
          aria-label={saveState}
        />
        <span className="ide-save-label" aria-live="polite" title={saveTitle}>
          {saveLabel}
        </span>
        {onOpenCommandPalette ? (
          <button
            type="button"
            className="ide-topbar-action ide-topbar-command"
            onClick={onOpenCommandPalette}
            data-testid="ide-topbar-command-palette"
            aria-label="Open command palette"
          >
            Commands <kbd>Ctrl K</kbd>
          </button>
        ) : null}
        {onSave && (
          <button
            type="button"
            className="ide-topbar-action ide-topbar-save"
            onClick={onSave}
            data-testid="ide-topbar-save-btn"
          >
            Save
          </button>
        )}
        <details className="ide-topbar-menu ide-topbar-more" data-testid="ide-project-menu">
          <summary aria-label="Open application and project menu">More</summary>
          <div className="ide-topbar-menu-popover ide-topbar-more-popover" aria-label="Application and project actions">
            {onApplyWorkspacePreset ? (
              <section className="ide-topbar-menu-section" data-testid="ide-workspace-menu" aria-label="Workspace presets">
                <span className="ide-topbar-menu-heading">Workspace</span>
                <div className="ide-topbar-menu-choice-grid">
                  {(Object.keys(WORKSPACE_PRESETS) as WorkspacePresetId[]).map((presetId) => (
                    <button
                      key={presetId}
                      type="button"
                      aria-pressed={activeWorkspacePreset === presetId}
                      onClick={(event) => {
                        onApplyWorkspacePreset(presetId);
                        event.currentTarget.closest('details')?.removeAttribute('open');
                      }}
                      data-testid={`ide-workspace-preset-${presetId}`}
                    >
                      <strong>{WORKSPACE_PRESETS[presetId].name}</strong>
                      <small>{WORKSPACE_PRESETS[presetId].description}</small>
                    </button>
                  ))}
                </div>
                {onResetWorkspace ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      onResetWorkspace();
                      event.currentTarget.closest('details')?.removeAttribute('open');
                    }}
                    data-testid="ide-workspace-reset"
                  >
                    Restore default layout
                  </button>
                ) : null}
              </section>
            ) : null}
            {onThemeChange ? (
              <section className="ide-topbar-menu-section">
                <span className="ide-topbar-menu-heading">Appearance</span>
                <label className="ide-theme-control" data-testid="ide-theme-control">
                  <span className="ide-theme-control-label">Application theme</span>
                  <select
                    value={themeVariant === 'midnight' ? 'dark' : themeVariant}
                    onChange={(event) => {
                      onThemeChange(event.target.value as Exclude<ThemeVariant, 'midnight'>);
                      event.currentTarget.closest('details')?.removeAttribute('open');
                    }}
                    aria-label="Workbench theme"
                    data-testid="ide-theme-select"
                  >
                    <option value="light">Studio Light</option>
                    <option value="dark">Studio Dark</option>
                    <option value="system">Follow application</option>
                  </select>
                </label>
              </section>
            ) : null}
            <section className="ide-topbar-menu-section" aria-label="Project actions">
              <span className="ide-topbar-menu-heading">Project</span>
              <div className="ide-topbar-menu-action-grid">
                {onLoad ? <button type="button" onClick={(event) => { onLoad(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>Open project...</button> : null}
                {onSaveAs ? <button type="button" onClick={(event) => { onSaveAs(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>Save As...</button> : null}
                {onDuplicateProject ? <button type="button" onClick={(event) => { onDuplicateProject(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>Duplicate</button> : null}
                {onExportBackup ? <button type="button" onClick={(event) => { onExportBackup(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>Export backup</button> : null}
                {onRecover ? <button type="button" onClick={(event) => { onRecover(); event.currentTarget.closest('details')?.removeAttribute('open'); }} disabled={!recoveryAvailable}>Recover snapshot</button> : null}
                {onImport ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      onImport();
                      event.currentTarget.closest('details')?.removeAttribute('open');
                    }}
                    data-testid="mode-button-import"
                    aria-current={currentMode === 'import' ? 'page' : undefined}
                  >
                    Import / Recover
                  </button>
                ) : null}
              </div>
              <span className="ide-topbar-menu-storage">Stored in {storageLabel}</span>
            </section>
            {onHelp ? (
              <button type="button" className="ide-topbar-menu-help" onClick={(event) => { onHelp(); event.currentTarget.closest('details')?.removeAttribute('open'); }} data-testid="ide-topbar-help-btn">
                Help and keyboard shortcuts
              </button>
            ) : null}
          </div>
        </details>
      </div>
    </header>
  );
};
