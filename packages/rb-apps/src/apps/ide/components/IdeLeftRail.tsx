import React from 'react';

export type IdeMode =
  | 'project'
  | 'design'
  | 'verify'
  | 'hardware'
  | 'export'
  | 'import';

export interface IdeModeDefinition {
  id: IdeMode;
  label: string;
  shortLabel: string;
}

const MODES: IdeModeDefinition[] = [
  { id: 'project', label: 'Project', shortLabel: 'P' },
  { id: 'design', label: 'Design', shortLabel: 'D' },
  { id: 'verify', label: 'Verify', shortLabel: 'V' },
  { id: 'hardware', label: 'Hardware', shortLabel: 'H' },
  { id: 'export', label: 'Export', shortLabel: 'E' },
  { id: 'import', label: 'Import', shortLabel: 'I' },
];

export interface IdeLeftRailProps {
  currentMode: IdeMode;
  onModeChange: (mode: IdeMode) => void;
}

export const IdeLeftRail: React.FC<IdeLeftRailProps> = ({ currentMode, onModeChange }) => {
  const activeIndex = MODES.findIndex((mode) => mode.id === currentMode);

  return (
    <aside className="ide-left-rail" data-testid="ide-left-rail" aria-label="IDE modes">
      <div className="ide-left-rail-progress" aria-hidden="true">
        {MODES.map((mode, index) => {
          const state =
            index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'upcoming';
          return <span key={`progress-${mode.id}`} className={`ide-progress-dot ide-progress-${state}`} />;
        })}
      </div>
      <nav className="ide-left-rail-nav">
        {MODES.map((mode) => {
          const isActive = mode.id === currentMode;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onModeChange(mode.id)}
              className={`ide-mode-button ${isActive ? 'is-active' : ''}`}
              data-testid={`mode-button-${mode.id}`}
              data-active={isActive ? 'true' : 'false'}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="ide-mode-active-rail" aria-hidden="true" />
              <span className="ide-mode-glyph" aria-hidden="true">
                {mode.shortLabel}
              </span>
              <span className="ide-mode-label">{mode.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
