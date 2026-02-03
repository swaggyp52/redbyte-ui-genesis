/**
 * SynthesisDialog Component
 * 
 * PHASE 1: UI Feedback During FPGA Programming
 * 
 * Displays a modal dialog with:
 * - Progress spinner (indeterminate, looping animation)
 * - Status messages (Generating Verilog → Synthesizing → Implementing → Programming)
 * - Success/error toast notification
 * - Cancel button to abort synthesis
 * 
 * Used when student clicks "Deploy to Basys3" or "Program FPGA" button.
 */

import { useState, useEffect } from 'react';

export type SynthesisPhase = 
  | 'idle'           // Initial state (not visible)
  | 'generating'     // Generating Verilog from circuit
  | 'synthesizing'   // Running Vivado synthesis
  | 'implementing'   // Running Vivado implementation
  | 'programming'    // Programming bitstream to board
  | 'success'        // Completed successfully
  | 'error';         // Failed with error

interface SynthesisDialogProps {
  isOpen: boolean;
  phase: SynthesisPhase;
  message?: string;
  errorMessage?: string;
  onCancel?: () => void;
  onDismiss?: () => void;
}

export const SynthesisDialog = ({
  isOpen,
  phase,
  message,
  errorMessage,
  onCancel,
  onDismiss
}: SynthesisDialogProps) => {
  const [displayedPhase, setDisplayedPhase] = useState<SynthesisPhase>(phase);

  useEffect(() => {
    setDisplayedPhase(phase);
  }, [phase]);

  if (!isOpen || displayedPhase === 'idle') {
    return null;
  }

  const isLoading = ['generating', 'synthesizing', 'implementing', 'programming'].includes(displayedPhase);
  const isSuccess = displayedPhase === 'success';
  const isError = displayedPhase === 'error';

  const getPhaseLabel = (p: SynthesisPhase): string => {
    switch (p) {
      case 'generating':
        return 'Generating Verilog...';
      case 'synthesizing':
        return 'Synthesizing...';
      case 'implementing':
        return 'Implementing...';
      case 'programming':
        return 'Programming Board...';
      case 'success':
        return 'Success! ✓';
      case 'error':
        return 'Error ✗';
      default:
        return 'Processing...';
    }
  };

  const getPhaseDescription = (p: SynthesisPhase): string => {
    switch (p) {
      case 'generating':
        return 'Converting your circuit design to Verilog HDL...';
      case 'synthesizing':
        return 'Running logic synthesis with Vivado...';
      case 'implementing':
        return 'Placement & routing implementation...';
      case 'programming':
        return 'Loading bitstream to Basys 3 board via USB-JTAG...';
      case 'success':
        return 'Your design is now running on the FPGA!';
      case 'error':
        return errorMessage || 'An error occurred during synthesis or programming.';
      default:
        return 'Processing...';
    }
  };

  // Spinner animation CSS
  const spinnerStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255, 255, 255, 0.2)',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto',
  };

  // Modal backdrop
  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  };

  // Modal content box
  const modalStyle: React.CSSProperties = {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '2rem',
    maxWidth: '500px',
    width: '90%',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
  };

  // Title styling
  const titleStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: isError ? '#f43f5e' : isSuccess ? '#10b981' : '#f8fafc',
    marginBottom: '0.5rem',
    marginTop: 0,
  };

  // Description styling
  const descriptionStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: '#94a3b8',
    lineHeight: '1.6',
    marginBottom: '1.5rem',
    marginTop: '1rem',
  };

  // Buttons container
  const buttonsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
    marginTop: '1.5rem',
  };

  // Button styles
  const primaryButtonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    background: '#3b82f6',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #475569',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '0.875rem',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    opacity: isLoading ? 0.6 : 1,
    transition: 'all 0.15s ease',
  };

  return (
    <>
      {/* Inject spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Modal backdrop */}
      <div style={backdropStyle}>
        {/* Modal content */}
        <div style={modalStyle}>
          {/* Spinner (only visible while loading) */}
          {isLoading && (
            <div style={spinnerStyle} />
          )}

          {/* Success icon */}
          {isSuccess && (
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
          )}

          {/* Error icon */}
          {isError && (
            <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#f43f5e' }}>✗</div>
          )}

          {/* Phase label/title */}
          <h2 style={titleStyle}>
            {getPhaseLabel(displayedPhase)}
          </h2>

          {/* Description text */}
          <p style={descriptionStyle}>
            {message || getPhaseDescription(displayedPhase)}
          </p>

          {/* Buttons */}
          {(isSuccess || isError) && (
            <div style={buttonsStyle}>
              <button
                onClick={onDismiss}
                style={primaryButtonStyle}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.opacity = '1';
                }}
              >
                {isSuccess ? 'Great!' : 'Dismiss'}
              </button>
            </div>
          )}

          {isLoading && (
            <div style={buttonsStyle}>
              <button
                onClick={onCancel}
                disabled={false}
                style={secondaryButtonStyle}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    (e.target as HTMLButtonElement).style.background = '#475569';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Progress indicators (visual dots) */}
          {isLoading && (
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: displayedPhase === 'generating' ? '#3b82f6' : '#475569',
                  transition: 'all 0.3s ease',
                }}
                title="Generating Verilog"
              />
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: ['synthesizing', 'implementing', 'programming'].includes(displayedPhase) ? '#3b82f6' : '#475569',
                  transition: 'all 0.3s ease',
                }}
                title="Synthesizing"
              />
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: ['implementing', 'programming'].includes(displayedPhase) ? '#3b82f6' : '#475569',
                  transition: 'all 0.3s ease',
                }}
                title="Implementing"
              />
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: displayedPhase === 'programming' ? '#3b82f6' : '#475569',
                  transition: 'all 0.3s ease',
                }}
                title="Programming"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SynthesisDialog;
