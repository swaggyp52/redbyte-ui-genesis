import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'rb-onboarding-v1-seen';

const STEPS = [
  {
    title: 'Build your circuit',
    body: 'Use the gate palette on the left to place logic gates. Drag from output ports to input ports to wire them together.',
  },
  {
    title: 'Verify correctness',
    body: 'Switch to the Verify tab to add test vectors and run your circuit against expected outputs.',
  },
  {
    title: 'Export to hardware',
    body: 'Once verification passes, switch to Export to download a Vivado-ready zip for your Basys3 FPGA.',
  },
];

export const OnboardingOverlay: React.FC = () => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch { /* storage unavailable */ }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  const current = STEPS[step];

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
          {STEPS.map((_, i) => (
            <span key={i} className={`rb-onboarding-dot${i === step ? ' is-active' : ''}`} />
          ))}
        </div>
        <h2 className="rb-onboarding-title">{current.title}</h2>
        <p className="rb-onboarding-body">{current.body}</p>
        <div className="rb-onboarding-actions">
          <button className="rb-onboarding-skip" onClick={dismiss} data-testid="ide-onboarding-skip">
            Skip
          </button>
          {step < STEPS.length - 1 ? (
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
