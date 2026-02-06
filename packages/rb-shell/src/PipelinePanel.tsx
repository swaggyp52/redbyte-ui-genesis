// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

/* ─── Types ─────────────────────────────────────────────────── */

export interface PipelinePanelProps {
  /** Circuit is loaded and has at least one node */
  hasCircuit: boolean;
  /** A completed run recording exists */
  hasRecording: boolean;
  /** Currently recording */
  isRecording: boolean;
  /** Result of replay verification */
  verificationStatus: 'unknown' | 'pass' | 'fail';
  /** An evidence/proof export has been produced */
  hasExport: boolean;
  /** Navigate to the Record tab / start recording */
  onGoToRecord: () => void;
  /** Trigger verification */
  onGoToVerify: () => void;
  /** Trigger evidence export */
  onGoToExport: () => void;
}

/* ─── Step status derivation ───────────────────────────────── */

type StepState = 'pending' | 'active' | 'complete';

interface StepDef {
  label: string;
  state: StepState;
  sublabel: string;
  onClick?: () => void;
}

/* ─── Sub-components ───────────────────────────────────────── */

const DOT_SIZE = 8;

const stepColors: Record<StepState, string> = {
  complete: 'var(--rb-ui-accent)',
  active: 'var(--rb-ui-accent)',
  pending: 'var(--rb-ui-surface-3)',
};

const Step: React.FC<{ step: StepDef }> = ({ step }) => {
  const isClickable = !!step.onClick;
  const Tag = isClickable ? 'button' : 'div';

  return (
    <Tag
      {...(isClickable ? { type: 'button' as const, onClick: step.onClick } : {})}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 4,
        border: 'none',
        background: isClickable ? 'transparent' : 'transparent',
        cursor: isClickable ? 'pointer' : 'default',
        fontFamily: 'var(--rb-ui-font-mono)',
      }}
      title={isClickable ? `Go to ${step.label}` : undefined}
    >
      <span
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: '50%',
          background: stepColors[step.state],
          flexShrink: 0,
          boxShadow: step.state === 'active' ? '0 0 6px var(--rb-ui-accent)' : 'none',
          animation: step.state === 'active' ? 'rbPipelinePulse 1.5s ease-in-out infinite' : 'none',
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: step.state === 'pending' ? 'var(--rb-ui-text-3)' : 'var(--rb-ui-text)',
        }}
      >
        {step.label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--rb-ui-text-3)' }}>{step.sublabel}</span>
    </Tag>
  );
};

const Arrow: React.FC = () => (
  <span style={{ fontSize: 10, color: 'var(--rb-ui-text-3)', userSelect: 'none' }}>&rarr;</span>
);

/* ─── Main Component ───────────────────────────────────────── */

export const PipelinePanel: React.FC<PipelinePanelProps> = ({
  hasCircuit,
  hasRecording,
  isRecording,
  verificationStatus,
  hasExport,
  onGoToRecord,
  onGoToVerify,
  onGoToExport,
}) => {
  const steps: StepDef[] = [
    {
      label: 'Build',
      state: hasCircuit ? 'complete' : 'pending',
      sublabel: hasCircuit ? '' : 'no circuit',
    },
    {
      label: 'Record',
      state: isRecording ? 'active' : hasRecording ? 'complete' : 'pending',
      sublabel: isRecording ? 'recording...' : hasRecording ? '' : 'not recorded',
      onClick: onGoToRecord,
    },
    {
      label: 'Verify',
      state: verificationStatus === 'pass' ? 'complete' : verificationStatus === 'fail' ? 'active' : 'pending',
      sublabel: verificationStatus === 'pass' ? 'proven' : verificationStatus === 'fail' ? 'diverged' : '',
      onClick: hasRecording && !isRecording ? onGoToVerify : undefined,
    },
    {
      label: 'Export',
      state: hasExport ? 'complete' : 'pending',
      sublabel: hasExport ? '' : '',
      onClick: verificationStatus === 'pass' ? onGoToExport : undefined,
    },
  ];

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          borderRadius: 6,
          background: 'var(--rb-ui-surface-1)',
          border: '1px solid var(--rb-ui-border)',
        }}
      >
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            {i > 0 && <Arrow />}
            <Step step={step} />
          </React.Fragment>
        ))}
      </div>
      <style>{`
        @keyframes rbPipelinePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
};
