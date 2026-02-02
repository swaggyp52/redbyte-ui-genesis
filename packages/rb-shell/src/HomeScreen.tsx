// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import { listExamples } from '@redbyte/rb-apps';
import { Icon } from '@redbyte/rb-icons';
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

/* ─── Sections ──────────────────────────────────────────────── */

const SECTIONS = [
  {
    title: 'Learning Tools',
    apps: [
      { id: 'logic-playground', label: 'Logic Playground', icon: 'logic', description: 'Freestyle circuit design' },
      { id: 'ece-lab', label: 'ECE Lab', icon: 'chip', description: 'Guided hardware labs' },
      { id: 'virtual-lab', label: 'Virtual Lab', icon: 'tool-build', description: 'Simulated breadboard' },
      { id: 'labs', label: 'Labs', icon: 'book', description: 'Course assignments' },
      { id: 'start-here', label: 'Start Here', icon: 'browser', description: 'Introduction & Basics' },
    ]
  },
  {
    title: 'System Tools',
    apps: [
      { id: 'files', label: 'Files', icon: 'files', description: 'Project management' },
      { id: 'terminal', label: 'Terminal', icon: 'terminal', description: 'Command line interface' },
      { id: 'settings', label: 'Settings', icon: 'settings', description: 'System configuration' },
      { id: 'system-log', label: 'Logs', icon: 'log', description: 'Debug logs' },
    ]
  },
  {
    title: 'Grading & Export',
    apps: [
      { id: 'submission-inspector', label: 'Inspector', icon: 'search', description: 'Verify submissions' },
      { id: 'fpga-proof-viewer', label: 'Proof Viewer', icon: 'shield-check', description: 'Analyze proofs' },
    ]
  }
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
  const buildStatus: StepStatus = 'complete';
  const buildSublabel = 'Ready';

  const recordStatus: StepStatus = isRecording ? 'active' : hasRecording ? 'complete' : 'pending';
  const recordSublabel = isRecording ? 'Recording...' : hasRecording ? 'Captured' : 'Waiting';

  const verifyStatus: StepStatus = verificationStatus ? 'complete' : 'pending';
  const verifySublabel = verificationStatus === 'pass' ? 'Passed' : verificationStatus === 'fail' ? 'Failed' : 'Untested';

  const exportStatus: StepStatus = hasProofPack ? 'complete' : 'pending';
  const exportSublabel = hasProofPack ? 'Packaged' : 'No Data';

  const starterExamples = useMemo(() => {
    const all = listExamples();
    // Prioritize basic gates and simpler circuits for the start screen
    const priority = ['basic-gates', 'full-adder', 'multiplexer', 'd-latch'];
    return all.filter(e => priority.includes(e.id)).slice(0, 4);
  }, []);

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
          maxWidth: 800,
          width: '90%',
          fontFamily: 'var(--rb-font-mono, monospace)',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          maxHeight: '80vh',
          overflowY: 'auto',
          padding: '24px',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(20px)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* ── Branding & Purpose ── */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
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
          <p style={{ fontSize: 12, color: 'var(--rb-text-3, #71717a)', marginTop: 4 }}>
            Deterministic Engineering Environment
          </p>
        </div>

        {/* ── Sections ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--rb-text-3)',
                marginBottom: 12,
                fontWeight: 600,
                borderBottom: '1px solid var(--rb-border-subtle)',
                paddingBottom: 4
              }}>
                {section.title}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {section.apps.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => onOpenApp(app.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      padding: '16px 8px',
                      borderRadius: 8,
                      border: '1px solid transparent',
                      background: 'var(--rb-surface-2)', // slight bg
                      color: 'var(--rb-text)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--rb-surface-3)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--rb-surface-2)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    {/* Use the Icon component if available, otherwise just text/emoji fallback if imports are tricky. 
                         Wait, I need to Import Icon. The instruction assumes I can default to text/emoji if I can't import easily?
                         No, I should import Icon. I'll add the import in a separate tool call if needed or use full file replace if safer.
                         Replacing just this block implies I have access to Icon.
                         I'll assume Icon is available in scope or I need to add it.
                         Actually, previous view_file showed NO Icon import.
                         So I need to add import { Icon } from '@redbyte/rb-icons'; at the top too.
                         I'll use a MULTI-REPLACE to handle both.
                      */}
                    {/* Using a placeholder rendering for now, assuming I will handle the import in the same turn via multi_replace */}
                    <div style={{ color: 'var(--rb-accent)' }}>
                      {/* @ts-ignore - dynamic icon lookup */}
                      <Icon name={app.icon as any} size={24} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{app.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--rb-text-2)', lineHeight: 1.2 }}>{app.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
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
