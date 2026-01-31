// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import { listExamples, type ExampleMetadata } from '@redbyte/rb-apps';

interface HomeScreenProps {
  onOpenApp: (appId: string, props?: any) => void;
  onOpenExample: (exampleId: string) => void;
}

const QUICK_ACTIONS = [
  { id: 'logic-playground', label: 'New Circuit', icon: '⊞', description: 'Start a blank logic circuit' },
  { id: 'ece-lab', label: 'Lab Assignment', icon: '⎔', description: 'Open ECE 347 lab' },
  { id: 'files', label: 'Files', icon: '⊟', description: 'Browse project files' },
  { id: 'launcher', label: 'All Apps', icon: '⋮⋮', description: 'Open the app launcher' },
] as const;

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenApp, onOpenExample }) => {
  const starterExamples = useMemo(() => {
    const all = listExamples();
    const beginner = all.filter((e) => e.difficulty === 'beginner').slice(0, 3);
    const intermediate = all.filter((e) => e.difficulty === 'intermediate').slice(0, 2);
    return [...beginner, ...intermediate].slice(0, 4);
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
          maxWidth: 520,
          width: '90%',
          fontFamily: 'var(--rb-font-mono, monospace)',
        }}
      >
        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
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
          <div
            style={{
              fontSize: 12,
              color: 'var(--rb-text-3, #71717a)',
              marginTop: 4,
            }}
          >
            Digital logic, from first principles.
          </div>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 24,
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

        {/* Example Circuits */}
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

        {/* Keyboard hint */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 20,
            fontSize: 11,
            color: 'var(--rb-text-3, #71717a)',
          }}
        >
          Ctrl/Cmd+K to search · Ctrl/Cmd+Space for quick launch
        </div>
      </div>
    </div>
  );
};
