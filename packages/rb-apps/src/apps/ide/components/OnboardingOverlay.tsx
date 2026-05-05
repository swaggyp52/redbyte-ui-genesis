import React, { useEffect, useMemo, useState } from 'react';
import {
  DESIGN_STAGE_LABEL,
  EXPORT_STAGE_LABEL,
  MAP_PINS_STAGE_LABEL,
  PROGRAM_STAGE_LABEL,
  STUDENT_WORKFLOW_SUMMARY,
  VERIFY_STAGE_LABEL,
  type IdeMode,
} from '../workflowStages';

const STORAGE_KEY = 'rb-onboarding-v1-seen';

export const OnboardingOverlay: React.FC<{
  mode?: IdeMode;
  onOpenDesign?: () => void;
}> = ({ mode = 'project', onOpenDesign }) => {
  const [visible, setVisible] = useState(false);
  const orientationCopy = useMemo(
    () => ({
      title: 'Workflow Orientation',
      body:
        `RedByte uses a professional flow: Project -> ${STUDENT_WORKFLOW_SUMMARY}. ` +
        `${DESIGN_STAGE_LABEL} builds the circuit, ${VERIFY_STAGE_LABEL} proves behavior, ` +
        `${MAP_PINS_STAGE_LABEL} binds board resources, and ${EXPORT_STAGE_LABEL} creates the Vivado handoff.`,
      trust:
        `Trust boundary: ${MAP_PINS_STAGE_LABEL} is required binding work, not behavior proof. ` +
        `Draft export is artifact-ready; trusted handoff requires current Compare PASS plus current mapping before ${PROGRAM_STAGE_LABEL}.`,
    }),
    []
  );

  useEffect(() => {
    if (mode !== 'project') {
      setVisible(false);
      return;
    }
    try {
      setVisible(!localStorage.getItem(STORAGE_KEY));
    } catch { /* storage unavailable */ }
  }, [mode]);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  const openDesign = () => {
    dismiss();
    onOpenDesign?.();
  };

  if (!visible || mode !== 'project') return null;

  return (
    <div
      className="rb-onboarding-overlay"
      role="region"
      aria-label="RedByte workflow orientation"
      data-testid="ide-onboarding-overlay"
    >
      <div className="rb-onboarding-card">
        <h2 className="rb-onboarding-title">{orientationCopy.title}</h2>
        <p className="rb-onboarding-body">{orientationCopy.body}</p>
        <p className="rb-onboarding-body">{orientationCopy.trust}</p>
        <div className="rb-onboarding-actions">
          <button className="rb-onboarding-skip" onClick={dismiss} data-testid="ide-onboarding-skip">
            Dismiss
          </button>
          <button
            className="rb-onboarding-next"
            onClick={openDesign}
            data-testid="ide-onboarding-open-design"
          >
            Open Design
          </button>
        </div>
      </div>
    </div>
  );
};
