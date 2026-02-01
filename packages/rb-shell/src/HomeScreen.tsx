// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import { listExamples } from '@redbyte/rb-apps';
import type { DeterminismMode } from './TruthBar';

type ExampleMetadata = ReturnType<typeof listExamples>[number];

/* ─── Types ─────────────────────────────────────────────────── */

export interface HomeScreenProps {
  onOpenApp: (appId: string, props?: any) => void;
  onOpenExample: (exampleId: string) => void;
  /** Current determinism mode */
  determinismMode: DeterminismMode;
  /** Current tick count */
  tickCount: number;
  /** Whether actively recording */
  isRecording: boolean;
  /** Whether a completed recording exists */
  hasRecording: boolean;
  /** Number of system log entries */
  logEntryCount: number;
  /** Whether a proof pack has been generated */
  hasProofPack: boolean;
  /** Verification status */
  verificationStatus?: 'pass' | 'fail';
}

/* ─── Pipeline Step ─────────────────────────────────────────── */

type StepStatus = 'pending' | 'active' | 'complete';

const PipelineStep: React.FC<{ label: string; status: StepStatus; sublabel: string }> = ({
  label,
  status,
  sublabel,
}) => {
  const dotStyle: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
    background:
      status === 'complete'
        ? '#22c55e'
        : status === 'active'
          ? '#3b82f6'
          : 'var(--rb-surface-3, #3f3f46)',
    boxShadow: status === 'active' ? '0 0 6px rgba(59,130,246,0.5)' : 'none',
    animation: status === 'active' ? 'rbPulse 1.5s ease-in-out infinite' : 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={dotStyle} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: status === 'pending' ? 'var(--rb-text-3, #71717a)' : 'var(--rb-text, #e4e4e7)',
          }}
        >
          {label}
        </span>
      </div>
      <span style={{ fontSize: 10, color: 'var(--rb-text-3, #71717a)', textAlign: 'center' }}>
        {sublabel}
      </span>
    </div>
  );
};

const PipelineArrow: React.FC = () => (
  <span
    style={{
      fontSize: 11,
      color: 'var(--rb-text-3, #71717a)',
      margin: '0 2px',
      marginBottom: 16,
    }}
  >
    &rarr;
  </span>
);

/* ─── State Chip ────────────────────────────────────────────── */

const StateChip: React.FC<{ label: string; value: string; accent?: boolean }> = ({
  label,
  value,
  accent,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      borderRadius: 6,
      border: '1px solid var(--rb-border, #333)',
      background: 'var(--rb-surface-1, #1e1e2e)',
      fontSize: 11,
      fontFamily: 'var(--rb-font-mono, monospace)',
    }}
  >
    <span style={{ color: 'var(--rb-text-3, #71717a)', fontWeight: 500 }}>{label}</span>
    <span style={{ color: accent ? 'var(--rb-accent, #3b82f6)' : 'var(--rb-text, #e4e4e7)', fontWeight: 600 }}>
      {value}
    </span>
  </div>
);

/* ─── Quick Actions ─────────────────────────────────────────── */

const QUICK_ACTIONS = [
  { id: 'logic-playground', label: 'New Circuit', icon: '\u229E', description: 'Open the freeform circuit editor' },
  { id: 'ece-lab', label: 'Lab Assignment', icon: '\u2394', description: 'Start a guided lab with verification' },
  { id: 'files', label: 'Files', icon: '\u229F', description: 'Browse project files' },
] as const;

/* ─── App Guide ─────────────────────────────────────────────── */

const APP_GUIDE = [
  { label: 'Logic Playground', desc: 'Build circuits freely' },
  { label: 'Lab', desc: 'Complete guided assignments with verification' },
  { label: 'Virtual Lab', desc: 'Test on 3D simulated boards' },
] as const;

/* ─── Component ─────────────────────────────────────────────── */

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenApp,
  onOpenExample,
  determinismMode,
  tickCount,
  isRecording,
  hasRecording,
  hasProofPack,
  logEntryCount,
  verificationStatus,
}) => {
  const starterExamples = useMemo(() => {
    const all = listExamples();
    const beginner = all.filter((e) => e.difficulty === 'beginner').slice(0, 3);
    const intermediate = all.filter((e) => e.difficulty === 'intermediate').slice(0, 2);
    return [...beginner, ...intermediate].slice(0, 4);
  }, []);

  /* Pipeline status derivation */
  const buildStatus: StepStatus = 'pending'; // no circuit on home screen
  const recordStatus: StepStatus = isRecording ? 'active' : hasRecording ? 'complete' : 'pending';
  const verifyStatus: StepStatus = verificationStatus === 'pass' ? 'complete' : 'pending';
  const exportStatus: StepStatus = hasProofPack ? 'complete' : 'pending';

  const buildSublabel = 'Open a circuit';
  const recordSublabel = isRecording ? 'Recording...' : hasRecording ? 'Recorded' : 'Not recorded';
  const verifySublabel = verificationStatus === 'pass' ? 'Proven' : verificationStatus === 'fail' ? 'Diverged' : 'Unverified';
  const exportSublabel = hasProofPack ? 'Ready' : 'No proof pack';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          maxWidth: 560,
          width: '90%',
          fontFamily: 'var(--rb-font-mono, monospace)',
        }}
      >
        {/* ── Branding & Purpose ── */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--rb-text, #e4e4e7)',
              letterSpacing: '-0.02em',
            }}
          >
            RedByte OS
          </div>
          <p
            style={{
              fontSize: 12,
              color: 'var(--rb-text-3, #71717a)',
              marginTop: 6,
              lineHeight: 1.5,
              maxWidth: 400,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            A deterministic engineering OS. Every circuit run can be recorded,
            replayed, and verified. Your submission is a proof pack, not a screenshot.
          </p>
        </div>

        {/* ── Quick Actions ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 20,
          }}
        >
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onOpenApp(action.id)}
              title={action.description}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '14px 8px',
                borderRadius: 10,
                border: '1px solid var(--rb-border, #333)',
                background: 'var(--rb-surface-1, #1e1e2e)',
                color: 'var(--rb-text, #e4e4e7)',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'inherit',
                transition: 'background 150ms, border-color 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--rb-surface-2, #252538)';
                e.currentTarget.style.borderColor = 'var(--rb-accent, #3b82f6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--rb-surface-1, #1e1e2e)';
                e.currentTarget.style.borderColor = 'var(--rb-border, #333)';
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{action.icon}</span>
              <span style={{ fontWeight: 600 }}>{action.label}</span>
            </button>
          ))}
        </div>

        {/* ── Pipeline Strip ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: 6,
            padding: '12px 0',
            marginBottom: 8,
          }}
        >
          <PipelineStep label="Build" status={buildStatus} sublabel={buildSublabel} />
          <PipelineArrow />
          <PipelineStep label="Record" status={recordStatus} sublabel={recordSublabel} />
          <PipelineArrow />
          <PipelineStep label="Verify" status={verifyStatus} sublabel={verifySublabel} />
          <PipelineArrow />
          <PipelineStep label="Export" status={exportStatus} sublabel={exportSublabel} />
        </div>

        {/* ── Current State ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <StateChip label="Mode" value={determinismMode.toUpperCase()} accent />
          <StateChip label="Ticks" value={String(tickCount)} />
          <StateChip label="Log" value={`${logEntryCount} entries`} />
        </div>

        {/* ── Example Circuits ── */}
        {starterExamples.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--rb-text-3, #71717a)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 8,
              }}
            >
              Example Circuits
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {starterExamples.map((ex: ExampleMetadata) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => onOpenExample(ex.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--rb-border, #333)',
                    background: 'var(--rb-surface-1, #1e1e2e)',
                    color: 'var(--rb-text, #e4e4e7)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--rb-surface-2, #252538)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--rb-surface-1, #1e1e2e)';
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>{ex.name}</span>
                    <span
                      style={{
                        marginLeft: 8,
                        color: 'var(--rb-text-3, #71717a)',
                        fontSize: 11,
                      }}
                    >
                      {ex.description}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: ex.difficulty === 'beginner'
                        ? 'rgba(34,197,94,0.15)'
                        : 'rgba(59,130,246,0.15)',
                      color: ex.difficulty === 'beginner'
                        ? '#22c55e'
                        : '#3b82f6',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {ex.difficulty}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── App Guide ── */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--rb-text-3, #71717a)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            Which app should I use?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {APP_GUIDE.map((item) => (
              <div
                key={item.label}
                style={{ fontSize: 11, color: 'var(--rb-text-3, #71717a)', lineHeight: 1.6 }}
              >
                <span style={{ color: 'var(--rb-text, #e4e4e7)', fontWeight: 600 }}>{item.label}</span>
                {' \u2014 '}
                {item.desc}
              </div>
            ))}
          </div>
        </div>

        {/* ── Keyboard Hint ── */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 16,
            fontSize: 11,
            color: 'var(--rb-text-3, #71717a)',
          }}
        >
          Ctrl/Cmd+K to search &middot; ? for shortcuts
        </div>
      </div>

      {/* Pulse animation for pipeline active state */}
      <style>{`
        @keyframes rbPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};
