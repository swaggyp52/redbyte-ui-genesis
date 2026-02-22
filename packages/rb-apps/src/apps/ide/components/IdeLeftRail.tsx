import React, { useCallback, useEffect, useState } from 'react';

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

const STORAGE_KEY = 'rb.ide.left-rail.expanded';

export interface IdeLeftRailProps {
  currentMode: IdeMode;
  onModeChange: (mode: IdeMode) => void;
  /** Optional lab context — shows step progress badge when set */
  labStepCurrent?: number;
  labStepTotal?: number;
}

export const IdeLeftRail: React.FC<IdeLeftRailProps> = ({
  currentMode,
  onModeChange,
  labStepCurrent,
  labStepTotal,
}) => {
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Sync CSS variable on the root element so IdeWorkbenchShell resizes
  useEffect(() => {
    const root = document.querySelector('[data-redbyte-mode="ide"]') as HTMLElement | null;
    if (!root) return;
    root.style.setProperty('--ide-rail-width', expanded ? '180px' : '52px');
  }, [expanded]);

  const hasLabProgress =
    typeof labStepCurrent === 'number' && typeof labStepTotal === 'number' && labStepTotal > 0;

  return (
    <aside
      className={`ide-left-rail ${expanded ? 'ide-left-rail--expanded' : ''}`}
      data-testid="ide-left-rail"
      aria-label="IDE modes"
    >
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
              title={expanded ? undefined : mode.label}
            >
              <span className="ide-mode-active-rail" aria-hidden="true" />
              <span className="ide-mode-glyph" aria-hidden="true">
                {mode.shortLabel}
              </span>
              {expanded && <span className="ide-mode-label">{mode.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="ide-left-rail-footer">
        {hasLabProgress && (
          <div
            className="ide-rail-lab-progress"
            data-testid="ide-rail-lab-progress"
            title={`Step ${labStepCurrent} of ${labStepTotal}`}
          >
            <span className="ide-rail-lab-step-badge">
              {labStepCurrent}/{labStepTotal}
            </span>
            {expanded && (
              <span className="ide-rail-lab-step-label">Step {labStepCurrent}</span>
            )}
          </div>
        )}
        <button
          type="button"
          className="ide-rail-collapse-btn"
          onClick={toggleExpanded}
          data-testid="ide-rail-collapse-toggle"
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <span className={`ide-rail-chevron ${expanded ? 'ide-rail-chevron--left' : 'ide-rail-chevron--right'}`} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};
