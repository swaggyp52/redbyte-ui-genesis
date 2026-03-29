import React, { useEffect, useMemo, useState } from 'react';
import {
  MAP_PINS_STAGE_LABEL,
  PROGRAM_STAGE_LABEL,
  STUDENT_WORKFLOW_SUMMARY,
  VERIFY_STAGE_LABEL,
  type IdeMode,
} from '../workflowStages';

const STORAGE_KEY = 'rb-onboarding-v1-seen';

interface OnboardingStep {
  title: string;
  body: string;
}

const MODE_STEPS: Record<IdeMode, OnboardingStep[]> = {
  project: [
    {
      title: 'This is your project hub.',
      body: `See your circuit's status and jump into ${STUDENT_WORKFLOW_SUMMARY} from here.`,
    },
    {
      title: 'Follow the workflow.',
      body: `${STUDENT_WORKFLOW_SUMMARY}. Each step unlocks the next.`,
    },
    {
      title: 'Export saves your work.',
      body: 'Download a ZIP from Export to hand off or restore this project at any time.',
    },
  ],
  design: [
    {
      title: 'This is Design — draw your circuit here.',
      body: 'Pick gates from the palette, then drag wires from output ports to input ports.',
    },
    {
      title: 'Run verification.',
      body: `Switch to ${VERIFY_STAGE_LABEL}, add test vectors in the stimulus grid, and see waveforms fill in.`,
    },
    {
      title: 'Map pins, then export.',
      body: `After ${VERIFY_STAGE_LABEL}, finish ${MAP_PINS_STAGE_LABEL}, then use Export to build the Basys3 project you will ${PROGRAM_STAGE_LABEL.toLowerCase()}.`,
    },
  ],
  verify: [
    {
      title: 'This is the Verify workstation.',
      body: 'Edit stimulus vectors in the top grid — waveforms appear in the panel below.',
    },
    {
      title: 'Read the waveforms.',
      body: 'Each column is one clock tick — trace any mismatch back to the first failing row.',
    },
    {
      title: 'Compare here before exporting.',
      body: `Run Compare here, then continue to ${MAP_PINS_STAGE_LABEL}, Export, and ${PROGRAM_STAGE_LABEL}.`,
    },
  ],
  hardware: [
    {
      title: `This is ${MAP_PINS_STAGE_LABEL}.`,
      body: `Assign each logic signal to a Basys3 pin before Export and ${PROGRAM_STAGE_LABEL}.`,
    },
    {
      title: 'Finish the board map.',
      body: `Unmapped required signals block Export, and incomplete output mapping keeps ${PROGRAM_STAGE_LABEL.toLowerCase()} untrusted.`,
    },
    {
      title: `${PROGRAM_STAGE_LABEL} after Export.`,
      body: `Export generates the Vivado project. ${PROGRAM_STAGE_LABEL} is the final step after the current bundle is ready.`,
    },
  ],
  export: [
    {
      title: 'Download your Vivado project.',
      body: 'Click Download to get a ZIP with an .xpr file Vivado can open directly.',
    },
    {
      title: 'Open the .xpr in Vivado.',
      body: 'Unzip the download, choose Open Project in Vivado, then generate the bitstream.',
    },
    {
      title: 'Keep the ZIP for later.',
      body: 'This same ZIP can be imported back into RedByte to fully restore your project.',
    },
  ],
  import: [
    {
      title: 'Import a ZIP or paste HDL.',
      body: 'Drop a RedByte export ZIP to restore a project, or paste structural VHDL/Verilog to convert.',
    },
    {
      title: 'Review before replacing.',
      body: 'RedByte shows a preview — your current circuit is not changed until you confirm.',
    },
    {
      title: 'Re-run Verify after import.',
      body: 'Verification evidence must be regenerated from the Verify screen after any import.',
    },
  ],
};

export const OnboardingOverlay: React.FC<{ mode?: IdeMode }> = ({ mode = 'project' }) => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const steps = useMemo(() => MODE_STEPS[mode] ?? MODE_STEPS.project, [mode]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    setStep(0);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'design') return;
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  }, [mode]);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible || mode === 'design') return null;

  const current = steps[step];

  return (
    <div
      className="rb-onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to RedByte"
      data-testid="ide-onboarding-overlay"
    >
      <div className="rb-onboarding-card">
        <div className="rb-onboarding-step-indicator">
          {steps.map((_, i) => (
            <span key={i} className={`rb-onboarding-dot${i === step ? ' is-active' : ''}`} />
          ))}
        </div>
        <h2 className="rb-onboarding-title">{current.title}</h2>
        <p className="rb-onboarding-body">{current.body}</p>
        <div className="rb-onboarding-actions">
          <button className="rb-onboarding-skip" onClick={dismiss} data-testid="ide-onboarding-skip">
            Skip
          </button>
          {step < steps.length - 1 ? (
            <button
              className="rb-onboarding-next"
              onClick={() => setStep((s) => s + 1)}
              data-testid="ide-onboarding-next"
            >
              Next →
            </button>
          ) : (
            <button
              className="rb-onboarding-next"
              onClick={dismiss}
              data-testid="ide-onboarding-finish"
            >
              Get started →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
