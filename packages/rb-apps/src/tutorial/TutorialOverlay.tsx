// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { useTutorialStore, TUTORIAL_STEPS } from './tutorialStore';

export interface TutorialOverlayProps {
  onLoadExample?: (filename: string) => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onLoadExample }) => {
  const { step, next, prev, stop } = useTutorialStore();
  const currentStep = TUTORIAL_STEPS[step];

  React.useEffect(() => {
    // Auto-load example circuit when step changes
    if (currentStep?.exampleCircuit && onLoadExample) {
      onLoadExample(currentStep.exampleCircuit);
    }
  }, [step, currentStep, onLoadExample]);

  if (!currentStep) return null;

  const isFirstStep = step === 0;
  const isLastStep = step === TUTORIAL_STEPS.length - 1;

  return (
    <div
      className="tutorial-overlay"
      data-testid="tutorial-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {/* Tutorial card */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '320px',
          background: 'rgba(10, 12, 14, 0.95)',
          borderRadius: '12px',
          padding: '1.5rem',
          color: 'white',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(0, 135, 255, 0.3)',
          pointerEvents: 'auto',
        }}
        data-testid="tutorial-card"
      >
        {/* Progress indicator */}
        <div style={{ marginBottom: '1rem' }}>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#6c757d',
              marginBottom: '0.5rem',
            }}
          >
            Step {step + 1} of {TUTORIAL_STEPS.length}
          </div>
          <div
            style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${((step + 1) / TUTORIAL_STEPS.length) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #ff0000, #0087ff)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Title */}
        <h3
          style={{
            margin: '0 0 0.75rem 0',
            fontSize: '1.25rem',
            fontWeight: '600',
            background: 'linear-gradient(135deg, #ff0000, #0087ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {currentStep.title}
        </h3>

        {/* Description */}
        <p
          style={{
            margin: '0 0 1rem 0',
            fontSize: '0.9375rem',
            lineHeight: '1.5',
            color: '#e9ecef',
          }}
        >
          {currentStep.description}
        </p>

        {/* Docs link */}
        {currentStep.docsLink && (
          <a
            href={currentStep.docsLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              color: '#0087ff',
              textDecoration: 'none',
            }}
            data-testid="tutorial-docs-link"
          >
            Learn more in docs →
          </a>
        )}

        {/* Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <button
            onClick={stop}
            data-testid="tutorial-skip"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Skip Tutorial
          </button>

          <div style={{ flex: 1 }} />

          {!isFirstStep && (
            <button
              onClick={prev}
              data-testid="tutorial-prev"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Back
            </button>
          )}

          <button
            onClick={next}
            data-testid="tutorial-next"
            style={{
              padding: '0.5rem 1.5rem',
              fontSize: '0.875rem',
              background: 'linear-gradient(135deg, #ff0000, #0087ff)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>

      {/* Coach marks - positioned hints on the canvas */}
      <div
        className="coach-mark"
        style={{
          position: 'absolute',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '0.75rem 1.5rem',
          background: 'rgba(0, 135, 255, 0.9)',
          borderRadius: '8px',
          color: 'white',
          fontSize: '0.875rem',
          pointerEvents: 'none',
          animation: 'pulse 2s ease-in-out infinite',
        }}
        data-testid="tutorial-coach-mark"
      >
        {step === 0 && 'Click on components in the toolbar above to add them'}
        {step === 1 && 'Drag between connection points to create wires'}
        {step === 2 && 'Use the clock icon to toggle simulation speed'}
        {step === 3 && 'Click inputs to toggle them and watch the circuit react'}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};
