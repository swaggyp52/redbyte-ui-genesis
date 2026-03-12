import React, { useEffect, useMemo, useState } from 'react';
import type { IdeMode } from './IdeLeftRail';

const STORAGE_KEY = 'rb-onboarding-v1-seen';

interface OnboardingStep {
  title: string;
  body: string;
}

const MODE_STEPS: Record<IdeMode, OnboardingStep[]> = {
  project: [
    {
      title: 'Choose your starting point',
      body: 'Start a new project, open an existing project, or continue recent work from the Project home.',
    },
    {
      title: 'Follow the lab flow',
      body: 'Project is your home base. Move through Build, Test, Program, and Export as your circuit becomes ready.',
    },
    {
      title: 'Keep work safe',
      body: 'RedByte keeps local progress and recovery data, but exported project files remain the safest handoff for lab.',
    },
  ],
  design: [
    {
      title: 'Build your circuit',
      body: 'Use the gate palette on the left to place logic gates. Drag from output ports to input ports to wire them together.',
    },
    {
      title: 'Verify correctness',
      body: 'Switch to Test to add or generate test vectors, then compare expected and observed outputs.',
    },
    {
      title: 'Export to hardware',
      body: 'Once verification passes, move to Program or Export to build your Basys3 Vivado project.',
    },
  ],
  verify: [
    {
      title: 'Run verification first',
      body: 'Verify checks your circuit against expected outputs and captures waveform evidence for each tick.',
    },
    {
      title: 'Use failures as a guide',
      body: 'If a run fails, jump to the first mismatch, inspect the failing tick, then return to Build with a concrete fix target.',
    },
    {
      title: 'Move forward only when current',
      body: 'After a passing run, continue to Program or Export. If the circuit changes, rerun Test before trusting the result.',
    },
  ],
  hardware: [
    {
      title: 'Check readiness first',
      body: 'Program depends on a current passing Test run and a current export bundle for this project state.',
    },
    {
      title: 'Use the board view as proof',
      body: 'The Program screen helps you compare mapped I/O, bring-up vectors, and expected behavior before programming Basys3.',
    },
    {
      title: 'Return to Build when blocked',
      body: 'If this screen says the project is blocked or stale, go back, fix the circuit, rerun Test, or rebuild the export bundle.',
    },
  ],
  export: [
    {
      title: 'Download the Vivado project',
      body: 'Use Download Vivado Project (Open Project) for the normal lab path. It creates a folder Vivado can open directly from the .xpr file.',
    },
    {
      title: 'Open the .xpr in Vivado',
      body: 'Unzip the download, choose Open Project in Vivado, and select the generated .xpr file.',
    },
    {
      title: 'Keep the ZIP for round-trip restore',
      body: 'RedByte exports include the project manifest so the same ZIP can be imported back into RedByte later.',
    },
  ],
  import: [
    {
      title: 'Start with a ZIP or HDL',
      body: 'Recommended: load a Vivado ZIP. You can also paste structural VHDL or Verilog and optional XDC constraints.',
    },
    {
      title: 'Review before replacing anything',
      body: 'Imports do not overwrite your project immediately. RedByte shows a review step before any replacement happens.',
    },
    {
      title: 'Re-run Test after import',
      body: 'Imported projects restore design state, but verification evidence must be regenerated from the Test screen.',
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

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

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
