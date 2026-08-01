import React from 'react';
import type { ThemeVariant } from '@redbyte/rb-theme';
import type { IdeBuildIdentity } from '../buildIdentity';
import { getIdeModeLabel, type IdeMode } from '../workflowStages';
import { WORKSPACE_PRESETS, type WorkspacePresetId } from '../workspacePreferences';

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
        {onApplyWorkspacePreset ? (
          <details className="ide-topbar-menu" data-testid="ide-workspace-menu">
            <summary>Workspace</summary>
            <div className="ide-topbar-menu-popover" role="menu" aria-label="Workspace presets">
              <span className="ide-topbar-menu-heading">Layout preset</span>
              {(Object.keys(WORKSPACE_PRESETS) as WorkspacePresetId[]).map((presetId) => (
                <button
                  key={presetId}
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeWorkspacePreset === presetId}
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
              {onResetWorkspace ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    onResetWorkspace();
                    event.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                  data-testid="ide-workspace-reset"
                >
                  Restore default layout
                </button>
              ) : null}
            </div>
          </details>
        ) : null}
        {onThemeChange ? (
          <label className="ide-theme-control" data-testid="ide-theme-control">
            <span className="ide-theme-control-label">Theme</span>
            <select
              value={themeVariant === 'midnight' ? 'dark' : themeVariant}
              onChange={(event) => onThemeChange(event.target.value as Exclude<ThemeVariant, 'midnight'>)}
              aria-label="Workbench theme"
              data-testid="ide-theme-select"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
        ) : null}
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
        {(onSaveAs || onLoad || onDuplicateProject || onExportBackup || onRecover) ? (
          <details className="ide-topbar-menu" data-testid="ide-project-menu">
            <summary>Project</summary>
            <div className="ide-topbar-menu-popover" role="menu" aria-label="Project actions">
              {onLoad ? <button type="button" role="menuitem" onClick={(event) => { onLoad(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>Open project...</button> : null}
              {onSaveAs ? <button type="button" role="menuitem" onClick={(event) => { onSaveAs(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>Save As...</button> : null}
              {onDuplicateProject ? <button type="button" role="menuitem" onClick={(event) => { onDuplicateProject(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>Duplicate project</button> : null}
              {onExportBackup ? <button type="button" role="menuitem" onClick={(event) => { onExportBackup(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>Export backup</button> : null}
              {onRecover ? (
                <button type="button" role="menuitem" onClick={(event) => { onRecover(); event.currentTarget.closest('details')?.removeAttribute('open'); }} disabled={!recoveryAvailable}>
                  Restore recovery snapshot{recoveryAvailable ? '' : ' (none available)'}
                </button>
              ) : null}
              <span className="ide-topbar-menu-storage">Stored in {storageLabel}</span>
            </div>
          </details>
        ) : null}
        {onImport && (
          <button
            type="button"
            className="ide-topbar-action"
            onClick={onImport}
            data-testid="mode-button-import"
            data-active={currentMode === 'import' ? 'true' : 'false'}
            aria-current={currentMode === 'import' ? 'page' : undefined}
          >
            Import / Recover
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
