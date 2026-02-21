import React from 'react';
import type { ProjectHealth, ProjectHealthMode, ProjectPrimaryCta } from '../projectHealth';
import { IdeButton } from './IdePrimitives';

export interface IdeGuidedStripProps {
  currentMode: ProjectHealthMode;
  health: ProjectHealth;
  primaryCta: ProjectPrimaryCta;
  onNavigate: (mode: ProjectHealthMode) => void;
}

const MODE_LABELS: Record<ProjectHealthMode, string> = {
  project: 'Project Setup',
  design: 'Circuit Design',
  verify: 'Verification',
  export: 'Export',
  hardware: 'Hardware Deployment',
  import: 'Import',
};

export const IdeGuidedStrip: React.FC<IdeGuidedStripProps> = ({
  currentMode,
  health,
  primaryCta,
  onNavigate,
}) => {
  const primaryBlocker = health.blockingIssues[0];
  const totalBlockers = health.blockingIssues.length;

  // Determine what to show
  const showBlocker = totalBlockers > 0;
  const showCta = primaryCta.mode !== currentMode;

  return (
    <section
      className="ide-guided-strip"
      data-testid="ide-guided-strip"
      data-current-mode={currentMode}
    >
      <div className="ide-guided-strip-content">
        <div className="ide-guided-strip-stage">
          <span className="ide-guided-strip-label">You are here:</span>
          <strong data-testid="ide-guided-current-stage">{MODE_LABELS[currentMode]}</strong>
        </div>

        {showBlocker && primaryBlocker ? (
          <div className="ide-guided-strip-blocker" data-testid="ide-guided-blocker">
            <span className="ide-guided-strip-label">Blocked:</span>
            <span data-testid="ide-guided-blocker-message">{primaryBlocker.message}</span>
            {totalBlockers > 1 && (
              <span className="ide-guided-strip-count" data-testid="ide-guided-blocker-count">
                +{totalBlockers - 1} more
              </span>
            )}
          </div>
        ) : null}

        {showCta ? (
          <div className="ide-guided-strip-actions">
            <span className="ide-guided-strip-label">Next:</span>
            <IdeButton
              tone="primary"
              onClick={() => onNavigate(primaryCta.mode)}
              testId="ide-guided-primary-cta"
            >
              {primaryCta.label}
            </IdeButton>
          </div>
        ) : !showBlocker ? (
          <div className="ide-guided-strip-ready" data-testid="ide-guided-ready">
            <span className="ide-guided-strip-label">Status:</span>
            <strong className="ide-guided-strip-ready-text">Ready</strong>
          </div>
        ) : null}

        {showBlocker && primaryBlocker?.fixPath ? (
          <button
            type="button"
            className="ide-guided-strip-fix-link"
            onClick={() => onNavigate(primaryBlocker.fixPath!.mode)}
            data-testid="ide-guided-fix-link"
          >
            Jump to: {primaryBlocker.fixPath.actionLabel} →
          </button>
        ) : null}
      </div>
    </section>
  );
};
