// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// IdeApp — Primary IDE surface with mode routing, top bar, and left rail.
// Minimal bootstrap that renders the IDE UI.

import React, { useState, useEffect } from 'react';
import { installFatalCapture, pushMount } from '@redbyte/rb-utils';
import './ide/ide-root.css';

type IDEMode = 'project' | 'design' | 'verify' | 'export' | 'import';

/**
 * Top bar — project name, save state, board selector
 */
const IdeTopBar: React.FC<{ projectName: string; isDirty: boolean }> = ({ projectName, isDirty }) => {
  return (
    <div
      style={{
        height: '56px',
        background: 'var(--rb-surface-secondary, #1a1a1a)',
        borderBottom: '1px solid var(--rb-border-subtle, #333)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '16px',
        color: 'var(--rb-text-primary, #e5e5e5)',
        fontSize: '14px',
      }}
      data-testid="ide-top-bar"
    >
      <div style={{ fontWeight: 600 }}>{projectName || 'Untitled Project'}</div>
      <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--rb-text-secondary, #999)' }}>
        {isDirty ? '● Unsaved' : '✓ Saved'} · Basys3
      </div>
    </div>
  );
};

/**
 * Left rail — mode selector (tab-like navigation)
 */
const IdeLeftRail: React.FC<{ currentMode: IDEMode; onModeChange: (mode: IDEMode) => void }> = ({
  currentMode,
  onModeChange,
}) => {
  const modes: Array<{ id: IDEMode; label: string; icon: string }> = [
    { id: 'project', label: 'Project', icon: '📋' },
    { id: 'design', label: 'Design', icon: '✎' },
    { id: 'verify', label: 'Verify', icon: '✓' },
    { id: 'export', label: 'Export', icon: '↗' },
    { id: 'import', label: 'Import', icon: '↙' },
  ];

  return (
    <div
      style={{
        width: '120px',
        background: 'var(--rb-surface-primary, #0f0f0f)',
        borderRight: '1px solid var(--rb-border-subtle, #333)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '8px',
        overflowY: 'auto',
      }}
      data-testid="ide-left-rail"
    >
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id)}
          style={{
            background: currentMode === mode.id ? 'var(--rb-surface-secondary, #1a1a1a)' : 'transparent',
            border: currentMode === mode.id ? '1px solid var(--rb-accent, #4299e1)' : '1px solid transparent',
            color: currentMode === mode.id ? 'var(--rb-accent, #4299e1)' : 'var(--rb-text-secondary, #999)',
            padding: '8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: currentMode === mode.id ? 600 : 400,
            transition: 'all 0.2s',
          }}
          data-testid={`mode-button-${mode.id}`}
        >
          <div style={{ fontSize: '16px', marginBottom: '4px' }}>{mode.icon}</div>
          {mode.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Mode body — renders placeholder for each mode
 * (Will integrate real mode components later)
 */
const ModeBody: React.FC<{ mode: IDEMode }> = ({ mode }) => {
  const modeLabel: Record<IDEMode, string> = {
    project: 'Project Management',
    design: 'Logic Design Canvas',
    verify: 'Verification & Simulation',
    export: 'Export to FPGA',
    import: 'Import from Vivado',
  };

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--rb-bg-dark, #0f0f0f)',
        color: 'var(--rb-text-secondary, #999)',
        fontSize: '18px',
      }}
      data-testid="ide-mode-body"
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
        <div>{modeLabel[mode]}</div>
        <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--rb-text-tertiary, #666)' }}>
          Coming soon
        </div>
      </div>
    </div>
  );
};

/**
 * Main IdeApp export — this is what gets rendered by ide-bootstrap.ts
 *
 * This component:
 * 1. Renders top bar + left rail + mode body
 * 2. Manages IDE mode state locally
 * 3. No Shell, no launcher, no OS chrome
 * 4. Minimal surface — just IDE layout
 */
export const IdeApp: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<IDEMode>('design');
  const [projectName] = useState('Basys3 Design');
  const [isDirty] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.redbyteMode = 'ide';
    }
    installFatalCapture({ force: true });
    pushMount('IdeApp: mounted');
    console.log('RB_IDE_APP_BOOT');
    return () => {
      if (typeof document !== 'undefined' && document.documentElement.dataset.redbyteMode === 'ide') {
        delete document.documentElement.dataset.redbyteMode;
      }
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        background: 'var(--rb-bg-dark, #0f0f0f)',
        color: 'var(--rb-text-primary, #e5e5e5)',
      }}
      data-testid="ide-root"
      data-redbyte-mode="ide"
    >
      <IdeTopBar projectName={projectName} isDirty={isDirty} />
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <IdeLeftRail currentMode={currentMode} onModeChange={setCurrentMode} />
        <ModeBody mode={currentMode} />
      </div>
    </div>
  );
};

export default IdeApp;
