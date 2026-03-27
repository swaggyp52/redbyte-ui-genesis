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

interface WorkflowStep {
  id: IdeMode;
  label: string;
  step: number;
  icon: React.ReactNode;
}

interface UtilityEntry {
  id: IdeMode;
  label: string;
  icon: React.ReactNode;
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const ProjectIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <rect x="2" y="2" width="5" height="5" rx="1" opacity="0.9" />
    <rect x="9" y="2" width="5" height="5" rx="1" opacity="0.5" />
    <rect x="2" y="9" width="5" height="5" rx="1" opacity="0.5" />
    <rect x="9" y="9" width="5" height="5" rx="1" opacity="0.7" />
  </svg>
);

const DesignIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
    <rect x="2" y="5" width="5" height="6" rx="1" />
    <rect x="10" y="5" width="4" height="6" rx="1" />
    <line x1="7" y1="8" x2="10" y2="8" />
    <line x1="14" y1="6.5" x2="15.5" y2="6.5" />
    <line x1="14" y1="9.5" x2="15.5" y2="9.5" />
    <line x1="0.5" y1="8" x2="2" y2="8" />
  </svg>
);

const VerifyIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="8" cy="8" r="6" opacity="0.45" />
    <path d="M5.5 8.3L7.2 10 10.5 6" strokeWidth="1.7" />
  </svg>
);

const HardwareIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="3" width="10" height="10" rx="1.5" />
    <line x1="1" y1="5.5" x2="3" y2="5.5" />
    <line x1="1" y1="8" x2="3" y2="8" />
    <line x1="1" y1="10.5" x2="3" y2="10.5" />
    <line x1="13" y1="5.5" x2="15" y2="5.5" />
    <line x1="13" y1="8" x2="15" y2="8" />
    <line x1="13" y1="10.5" x2="15" y2="10.5" />
    <rect x="5.5" y="5.5" width="5" height="5" rx="0.75" fill="currentColor" opacity="0.2" stroke="none" />
  </svg>
);

const ExportIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 2v7M5.5 6.5L8 9l2.5-2.5" />
    <path d="M2.5 11.5v2h11v-2" />
  </svg>
);

const ImportIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 11V4M5.5 7.5L8 5l2.5 2.5" />
    <path d="M2.5 11.5v2h11v-2" />
  </svg>
);

// ─── Mode definitions ─────────────────────────────────────────────────────────

const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 'design',   label: 'Design',   step: 1, icon: <DesignIcon />   },
  { id: 'verify',   label: 'Verify',   step: 2, icon: <VerifyIcon />   },
  { id: 'hardware', label: 'Hardware', step: 3, icon: <HardwareIcon /> },
  { id: 'export',   label: 'Export',   step: 4, icon: <ExportIcon />   },
];

const PROJECT_ENTRY: UtilityEntry = { id: 'project', label: 'Project', icon: <ProjectIcon /> };
const IMPORT_ENTRY: UtilityEntry  = { id: 'import',  label: 'Import',  icon: <ImportIcon />  };

// Backward-compat export
export const MODES: IdeModeDefinition[] = [
  { id: 'project',  label: 'Project',  shortLabel: 'P' },
  { id: 'design',   label: 'Design',   shortLabel: 'D' },
  { id: 'verify',   label: 'Verify',   shortLabel: 'V' },
  { id: 'hardware', label: 'Hardware', shortLabel: 'H' },
  { id: 'export',   label: 'Export',   shortLabel: 'E' },
  { id: 'import',   label: 'Import',   shortLabel: 'I' },
];

const STORAGE_KEY = 'rb.ide.left-rail.expanded';

export interface IdeLeftRailProps {
  currentMode: IdeMode;
  onModeChange: (mode: IdeMode) => void;
  labStepCurrent?: number;
  labStepTotal?: number;
  stepsCompleted?: Partial<Record<IdeMode, boolean>>;
}

export const IdeLeftRail: React.FC<IdeLeftRailProps> = ({
  currentMode,
  onModeChange,
  labStepCurrent,
  labStepTotal,
  stepsCompleted,
}) => {
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.querySelector('[data-redbyte-mode="ide"]') as HTMLElement | null;
    if (!root) return;
    root.style.setProperty('--ide-rail-width', expanded ? '160px' : '72px');
  }, [expanded]);

  const hasLabProgress =
    typeof labStepCurrent === 'number' && typeof labStepTotal === 'number' && labStepTotal > 0;

  const renderUtility = (entry: UtilityEntry) => {
    const isActive = entry.id === currentMode;
    return (
      <button
        key={entry.id}
        type="button"
        onClick={() => onModeChange(entry.id)}
        className={`ide-mode-button ide-mode-button--utility ${isActive ? 'is-active' : ''}`}
        data-testid={`mode-button-${entry.id}`}
        data-active={isActive ? 'true' : 'false'}
        aria-current={isActive ? 'page' : undefined}
        title={expanded ? undefined : entry.label}
      >
        <span className="ide-mode-icon">{entry.icon}</span>
        <span className="ide-mode-label">{entry.label}</span>
      </button>
    );
  };

  const renderStep = (step: WorkflowStep) => {
    const isActive = step.id === currentMode;
    const isDone = Boolean(stepsCompleted?.[step.id]);
    return (
      <button
        key={step.id}
        type="button"
        onClick={() => onModeChange(step.id)}
        className={`ide-mode-button ide-mode-button--step ${isActive ? 'is-active' : ''} ${isDone && !isActive ? 'is-complete' : ''}`}
        data-testid={`mode-button-${step.id}`}
        data-active={isActive ? 'true' : 'false'}
        data-complete={isDone ? 'true' : 'false'}
        aria-current={isActive ? 'page' : undefined}
        title={expanded ? undefined : `Step ${step.step}: ${step.label}`}
      >
        <span className="ide-step-num" aria-hidden="true">
          {isDone && !isActive ? '✓' : step.step}
        </span>
        <span className="ide-mode-icon">{step.icon}</span>
        <span className="ide-mode-label">{step.label}</span>
      </button>
    );
  };

  return (
    <aside
      className={`ide-left-rail ${expanded ? 'ide-left-rail--expanded' : ''}`}
      data-testid="ide-left-rail"
      aria-label="IDE modes"
    >
      {/* Project config */}
      <div className="ide-left-rail-utility-top">
        {renderUtility(PROJECT_ENTRY)}
      </div>

      <div className="ide-rail-divider" aria-hidden="true" />

      {/* Workflow steps 1–4 */}
      <nav className="ide-left-rail-nav" aria-label="Workflow steps">
        {WORKFLOW_STEPS.map(renderStep)}
      </nav>

      <div className="ide-rail-divider" aria-hidden="true" />

      {/* Import utility */}
      <div className="ide-left-rail-utility-bottom">
        {renderUtility(IMPORT_ENTRY)}
      </div>

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
