// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// PipelineStrip — replaces IdeGuidedStrip with a 4-stage pipeline visualization.
// Drop-in compatible: same props interface as IdeGuidedStrip.

import React, { useMemo } from 'react';
import {
  deriveProjectVerifyState,
  deriveStageCompletion,
  type ProjectHealth,
  type ProjectHealthMode,
  type ProjectPrimaryCta,
  type ProjectReadinessState,
} from '../projectHealth';
import { IdeButton } from './IdePrimitives';
import { IDE_WORKFLOW_ROUTE_STEPS } from '../workflowStages';

export interface PipelineStripProps {
  currentMode: ProjectHealthMode;
  health: ProjectHealth;
  readiness: ProjectReadinessState;
  primaryCta: ProjectPrimaryCta;
  onNavigate: (mode: ProjectHealthMode) => void;
}

// Pipeline stages — Design, Verify, Map Pins, Export (not project/import, those are entry points)
type PipelineStage = 'design' | 'verify' | 'hardware' | 'export';
type StageStatus = 'pass' | 'fail' | 'blocked' | 'active' | 'pending';

interface StageConfig {
  key: PipelineStage;
  mode: ProjectHealthMode;
  letter: string;
  label: string;
  /** Hard blocker codes that override completion — shown as "blocked" even when on the active page. */
  blockerCodes: string[];
}

const STAGES: StageConfig[] = IDE_WORKFLOW_ROUTE_STEPS.map((stage) => ({
  key: stage.id,
  mode: stage.id,
  letter: stage.id === 'design' ? 'D' : stage.id === 'verify' ? 'V' : stage.id === 'hardware' ? 'M' : 'E',
  label: stage.label,
  blockerCodes:
    stage.id === 'design'
      ? ['RBP1000']           // Design only blocked by missing circuit, NOT by missing mapping
      : stage.id === 'export'
        ? ['RBP2001']
        : [],
}));

function deriveStageStatus(
  stage: StageConfig,
  health: ProjectHealth,
  readiness: ProjectReadinessState,
  currentMode: ProjectHealthMode
): StageStatus {
  const codes = new Set(health.blockingIssues.map((i) => i.code));

  // Blocked takes priority over active so the student sees the problem even on the current page
  if (stage.blockerCodes.some((c) => codes.has(c))) return 'blocked';
  if (currentMode === stage.mode) return 'active';

  // Use the unified completion signal — same thresholds as IdeLeftRail and ProjectSurface dock
  const completion = deriveStageCompletion(health, readiness);
  if (completion[stage.key]) return 'pass';

  // Verify that ran and failed is "fail" — distinct from "blocked" (cannot run) and "pending" (not yet run)
  if (stage.key === 'verify') {
    const verifyState = deriveProjectVerifyState(health);
    if (verifyState === 'assertions-differ' || verifyState === 'verify-error') return 'fail';
  }

  return 'pending';
}

// Checkmark icon for passing stages
const CheckIcon: React.FC = () => (
  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
    <path
      d="M1 4.5L3.5 7L8 1.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Warning dot for blocked stages
const WarnIcon: React.FC = () => (
  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
    <path d="M4.5 1.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="4.5" cy="7" r="0.75" fill="currentColor" />
  </svg>
);

// Cross icon for failed stages
const FailIcon: React.FC = () => (
  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
    <path d="M2 2L7 7M7 2L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const PipelineStrip: React.FC<PipelineStripProps> = ({
  currentMode,
  health,
  readiness,
  primaryCta,
  onNavigate,
}) => {
  const hardBlockerCodes = useMemo(
    () => new Set(STAGES.flatMap((stage) => stage.blockerCodes)),
    []
  );
  const stageStatuses = useMemo(
    () =>
      STAGES.map((stage) => ({
        stage,
        status: deriveStageStatus(stage, health, readiness, currentMode),
      })),
    [health, readiness, currentMode]
  );

  const primaryBlocker = health.blockingIssues.find((issue) => hardBlockerCodes.has(issue.code)) ?? null;
  const hideBlankDesignBlocker = currentMode === 'design' && primaryBlocker?.fixPath?.mode === 'design';
  const visiblePrimaryBlocker = hideBlankDesignBlocker ? null : primaryBlocker;
  // Only show CTA when the recommended destination is different from current page
  const showCta = primaryCta.mode !== currentMode;
  const showReadyState = !visiblePrimaryBlocker && !showCta && !hideBlankDesignBlocker;

  return (
    <section
      className="ide-pipeline-strip"
      data-testid="ide-guided-strip"
      data-current-mode={currentMode}
      aria-label="Pipeline progress"
    >
      {/* Stage pills with PCB trace connectors */}
      <div className="ide-pipeline-stages" role="list">
        {stageStatuses.map(({ stage, status }, index) => (
          <React.Fragment key={stage.key}>
            {index > 0 && (
              <span
                className={`ide-pipeline-trace ide-pipeline-trace--${stageStatuses[index - 1].status}`}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              role="listitem"
              className={`ide-pipeline-stage ide-pipeline-stage--${status}`}
              data-testid={`ide-pipeline-stage-${stage.key}`}
              onClick={() => onNavigate(stage.mode)}
              aria-current={status === 'active' ? 'step' : undefined}
              aria-label={`${stage.label} — ${status}`}
            >
              <span className="ide-pipeline-badge" aria-hidden="true">
                {status === 'pass' ? <CheckIcon /> : status === 'fail' ? <FailIcon /> : status === 'blocked' ? <WarnIcon /> : stage.letter}
              </span>
              <span className="ide-pipeline-label">{stage.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Right side: blocker message + primary CTA */}
      <div className="ide-pipeline-right">
        {visiblePrimaryBlocker ? (
          <span className="ide-pipeline-blocker" data-testid="ide-guided-blocker">
            <span className="ide-pipeline-blocker-pulse" aria-hidden="true" />
            <span
              className="ide-pipeline-blocker-message"
              data-testid="ide-guided-blocker-message"
              title={visiblePrimaryBlocker.message}
            >
              {visiblePrimaryBlocker.message}
            </span>
            {health.blockingIssues.length > 1 && (
              <span className="ide-pipeline-blocker-count" data-testid="ide-guided-blocker-count">
                +{health.blockingIssues.length - 1}
              </span>
            )}
          </span>
        ) : null}

        {showCta ? (
          <IdeButton
            tone="primary"
            onClick={() => onNavigate(primaryCta.mode)}
            testId="ide-guided-primary-cta"
          >
            {primaryCta.label} →
          </IdeButton>
        ) : showReadyState ? (
          <span className="ide-pipeline-all-pass" data-testid="ide-guided-ready">
            All stages complete
          </span>
        ) : null}

        {visiblePrimaryBlocker?.fixPath ? (
          <button
            type="button"
            className="ide-pipeline-fix-link"
            onClick={() => onNavigate(visiblePrimaryBlocker.fixPath!.mode)}
            data-testid="ide-guided-fix-link"
          >
            {visiblePrimaryBlocker.fixPath.actionLabel} →
          </button>
        ) : null}
      </div>
    </section>
  );
};
