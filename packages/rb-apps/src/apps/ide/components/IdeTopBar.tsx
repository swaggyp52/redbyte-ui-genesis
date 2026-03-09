import React from 'react';
import type { IdeMode } from './IdeLeftRail';

export interface IdeTopBarProps {
  projectName: string;
  projectId?: string;
  saveState: 'saved' | 'unsaved' | 'autosaving';
  currentMode?: IdeMode;
  // Legacy toolbar props — kept optional for backward compat; no longer rendered.
  onSave?: () => void;
  onSaveAs?: () => void;
  onLoad?: () => void;
  onResetToExample?: () => void;
  onRunVerify?: () => void;
  onExport?: () => void;
  onHelp?: () => void;
}

const MODE_LABELS: Record<IdeMode, string> = {
  project: 'Project',
  design: 'Design',
  verify: 'Verify',
  hardware: 'Hardware',
  export: 'Export',
  import: 'Import',
};

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
  onHelp,
}) => {
  const saveDotClass =
    saveState === 'saved'
      ? 'ide-save-dot--ok'
      : saveState === 'autosaving'
        ? 'ide-save-dot--saving'
        : 'ide-save-dot--unsaved';

  const modeLabel = currentMode ? MODE_LABELS[currentMode] : null;

  return (
    <header className="ide-top-bar" data-testid="ide-top-bar" data-save-state={saveState}>
      <div className="ide-top-left">
        <div className="ide-brand-mark" aria-label="RedByte">
          <RbLogomark />
        </div>

        <span className="ide-brand-wordmark" aria-hidden="true">RedByte</span>

        <span className="ide-breadcrumb-sep" aria-hidden="true">/</span>

        <div className="ide-project-meta">
          <h1 className="ide-project-name" title={projectName}>{projectName}</h1>
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
        {onHelp && (
          <button
            className="ide-topbar-help-btn"
            onClick={onHelp}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            data-testid="ide-topbar-help-btn"
          >
            ?
          </button>
        )}
      </div>
    </header>
  );
};
