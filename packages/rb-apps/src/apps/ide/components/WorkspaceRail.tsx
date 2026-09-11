import React from 'react';
import { STUDENT_WORKFLOW_STAGES, type IdeMode } from '../workflowStages';

export interface WorkspaceRailProps {
  currentMode: IdeMode;
  onModeChange: (mode: IdeMode) => void;
  /** A workspace with an actionable blocker shows one small amber dot. */
  stepsBlocked?: Partial<Record<IdeMode, boolean>>;
}

// Compact rail labels. The full stage names (Board & Constraints, Build &
// Export) are the document titles inside each workspace; the rail stays terse.
const RAIL_LABELS: Record<Exclude<IdeMode, 'import'>, string> = {
  project: 'Project',
  design: 'Design',
  verify: 'Simulate',
  hardware: 'Board',
  export: 'Package',
};

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const RAIL_ICONS: Record<IdeMode, React.ReactNode> = {
  // Project: source tree
  project: (
    <svg viewBox="0 0 18 18" aria-hidden="true" {...stroke}>
      <path d="M4 3.5v11M4 6h5M4 10h5M4 14h5" />
      <rect x="9.5" y="4.5" width="5" height="3" rx="0.5" />
      <rect x="9.5" y="8.5" width="5" height="3" rx="0.5" />
      <rect x="9.5" y="12.5" width="5" height="3" rx="0.5" />
    </svg>
  ),
  // Design: AND symbol
  design: (
    <svg viewBox="0 0 18 18" aria-hidden="true" {...stroke}>
      <path d="M5 4h4a5 5 0 0 1 0 10H5z" />
      <path d="M1.5 6.5H5M1.5 11.5H5M14 9h2.5" />
    </svg>
  ),
  // Simulate: step waveform
  verify: (
    <svg viewBox="0 0 18 18" aria-hidden="true" {...stroke}>
      <path d="M1.5 13h3V5h3v8h3V5h3v8h1.5" />
    </svg>
  ),
  // Board: package with pins
  hardware: (
    <svg viewBox="0 0 18 18" aria-hidden="true" {...stroke}>
      <rect x="5" y="5" width="8" height="8" rx="1" />
      <path d="M7 5V2.5M11 5V2.5M7 15.5V13M11 15.5V13M5 7H2.5M5 11H2.5M15.5 7H13M15.5 11H13" />
    </svg>
  ),
  // Package: archive
  export: (
    <svg viewBox="0 0 18 18" aria-hidden="true" {...stroke}>
      <path d="M2.5 6.5h13v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" />
      <path d="M2.5 6.5l1.5-3h10l1.5 3M7 9.5h4" />
    </svg>
  ),
  // Import: arrow into tray
  import: (
    <svg viewBox="0 0 18 18" aria-hidden="true" {...stroke}>
      <path d="M9 2.5v8M5.5 7.5L9 11l3.5-3.5" />
      <path d="M2.5 11.5v3a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-3" />
    </svg>
  ),
};

/**
 * The workspace rail — the only workspace switcher. It selects a workspace;
 * it is not a progress dashboard: no completion marks, no status subtitles,
 * no stage numbers. A workspace with an actionable blocker shows one dot.
 * Import / Recover is a utility, separated from the five workspaces.
 */
export const WorkspaceRail: React.FC<WorkspaceRailProps> = ({ currentMode, onModeChange, stepsBlocked }) => (
  <nav className="wb-rail" data-testid="ide-workspace-rail" aria-label="Workspaces">
    <div className="wb-rail-group" role="tablist" aria-orientation="vertical" aria-label="Workspaces">
      {STUDENT_WORKFLOW_STAGES.map((stage) => {
        const isActive = stage.id === currentMode;
        const isBlocked = Boolean(stepsBlocked?.[stage.id]) && !isActive;
        const state = isActive ? 'current' : isBlocked ? 'blocked' : 'available';
        return (
          <button
            key={stage.id}
            type="button"
            role="tab"
            className="wb-rail-btn"
            data-testid={`mode-button-${stage.id}`}
            data-active={isActive ? 'true' : 'false'}
            data-state={state}
            data-stage={stage.id}
            aria-selected={isActive}
            aria-current={isActive ? 'step' : undefined}
            title={isBlocked ? `${stage.label} — needs attention` : stage.label}
            onClick={() => onModeChange(stage.id)}
          >
            {RAIL_ICONS[stage.id]}
            <span>{RAIL_LABELS[stage.id]}</span>
            {isBlocked ? <span className="wb-rail-dot" aria-label="needs attention" /> : null}
          </button>
        );
      })}
    </div>
    <span className="wb-rail-spacer" />
    <span className="wb-rail-rule" aria-hidden="true" />
    <button
      type="button"
      className="wb-rail-btn wb-rail-btn--utility"
      data-testid="mode-button-import"
      data-state={currentMode === 'import' ? 'current' : 'available'}
      aria-current={currentMode === 'import' ? 'page' : undefined}
      title="Import / Recover"
      onClick={() => onModeChange('import')}
    >
      {RAIL_ICONS.import}
      <span>Import</span>
    </button>
  </nav>
);
