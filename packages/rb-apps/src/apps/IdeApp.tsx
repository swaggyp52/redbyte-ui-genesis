// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// IdeApp — Primary IDE surface with mode routing, top bar, left rail, center content, right dock.
// This is what boots instead of "Logic Playground" when in IDE mode.

import React, { useState, useEffect } from 'react';
import { IdeProvider, type IdeContextValue, type IDEMode } from './ide/IdeContext';
import { DesignMode } from './ide/modes/DesignMode';
import { ProjectMode } from './ide/modes/ProjectMode';
import { VerifyMode } from './ide/modes/VerifyMode';
import { ExportMode } from './ide/modes/ExportMode';
import { ImportMode } from './ide/modes/ImportMode';
import { installFatalCapture, pushMount } from '@redbyte/rb-utils';
import { toast } from '@redbyte/rb-primitives';
import { useUnifiedProjectStore } from '@redbyte/rb-lab-engine';
import {
  CircuitEngine,
  TickEngine,
  type Circuit,
  NodeRegistry,
} from '@redbyte/rb-logic-core';
import { useCircuitStore } from '../stores/circuitStore';
import type { ToolchainProjectInput } from '../fpga/toolchainBackend';
import type { RBFpgaConfig } from '../export/projectFormat';
import '../ide/ide-root.css';

/**
 * Minimal mode router component — renders the appropriate mode body
 */
const ModeBody: React.FC = () => {
  const ctx = React.useContext(IdeContext);
  if (!ctx) return null;

  switch (ctx.ideMode) {
    case 'project':
      return <ProjectMode />;
    case 'design':
      return <DesignMode />;
    case 'verify':
      return <VerifyMode />;
    case 'export':
      return <ExportMode />;
    case 'import':
      return <ImportMode />;
    default:
      return <div>Unknown mode</div>;
  }
};

/**
 * Top bar — project name, save state, board selector
 */
const IdeTopBar: React.FC = () => {
  const ctx = React.useContext(IdeContext);
  if (!ctx) return null;

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
      <div style={{ fontWeight: 600 }}>{ctx.projectName || 'Untitled Project'}</div>
      <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--rb-text-secondary, #999)' }}>
        {ctx.isDirty ? '● Unsaved' : '✓ Saved'} · Basys3
      </div>
    </div>
  );
};

/**
 * Left rail — mode selector (tab-like navigation)
 */
const IdeLeftRail: React.FC = () => {
  const ctx = React.useContext(IdeContext);
  if (!ctx) return null;

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
          onClick={() => ctx.setIdeMode(mode.id)}
          style={{
            background: ctx.ideMode === mode.id ? 'var(--rb-surface-secondary, #1a1a1a)' : 'transparent',
            border: ctx.ideMode === mode.id ? '1px solid var(--rb-accent, #4299e1)' : '1px solid transparent',
            color:
              ctx.ideMode === mode.id ? 'var(--rb-accent, #4299e1)' : 'var(--rb-text-secondary, #999)',
            padding: '8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: ctx.ideMode === mode.id ? 600 : 400,
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
 * Main IDE container — stitches together top bar, left rail, mode body
 */
const IdeContainer: React.FC = () => {
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
      data-testid="ide-container"
    >
      <IdeTopBar />
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <IdeLeftRail />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          <ModeBody />
        </div>
      </div>
    </div>
  );
};

/**
 * Stub IdeProvider wrapper — manages IDE state and context
 * For now, just passes through; full provider logic would be in a separate file.
 */
const IdeContext = React.createContext<IdeContextValue | null>(null);

/**
 * Stub provider — in production, this would use a proper Zustand store or similar
 */
const StubIdeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ideMode, setIdeMode] = useState<IDEMode>('design');
  const [projectName, setProjectName] = useState('Basys3 Design');
  const [isDirty, setIsDirty] = useState(false);

  // Stub engine refs (would be hooked up to actual CircuitEngine)
  const engine = undefined;
  const tickEngine = undefined;

  // Stub circuit state
  const [circuit, setCircuit] = useState<Circuit>({ nodes: [], connections: [] });

  // Stub context value
  const value: IdeContextValue = {
    ideMode,
    setIdeMode,
    engine,
    tickEngine,
    circuit,
    handleCircuitChange: setCircuit,
    projectName,
    setProjectName,
    projectId: 'default-project',
    isDirty,
    setIsDirty,
    isRunning: false,
    tickCount: 0,
    currentHz: 1,
    handleRun: () => {},
    handlePause: () => {},
    handleStep: () => {},
    handleHzChange: () => {},
    handleResetTickCount: () => {},
    hdlProject: undefined,
    setHdlProject: () => {},
    fpgaProject: undefined,
    setFpgaProject: () => {},
    enableHdlTab: false,
    buildProject: () => ({ circuit: { nodes: [], connections: [] }, ioMapping: {} }),
    applyProject: () => {},
    addToast: (message, kind, duration) => toast.show({ message, kind, durationMs: duration || 3000 }),
  };

  return <IdeContext.Provider value={value}>{children}</IdeContext.Provider>;
};

/**
 * Main IdeApp export — this is what gets rendered by ide-bootstrap.ts
 *
 * Usage: <IdeApp />
 *
 * This component:
 * 1. Provides IDE context to all child modes
 * 2. Renders top bar + left rail + mode body
 * 3. No Shell, no launcher, no OS chrome
 * 4. Minimal surface — just IDE, just logic design
 */
export const IdeApp: React.FC = () => {
  useEffect(() => {
    installFatalCapture({ force: true });
    pushMount('IdeApp: mounted');
    console.log('RB_IDE_APP_BOOT');
  }, []);

  return (
    <StubIdeProvider>
      <IdeContainer />
    </StubIdeProvider>
  );
};

export default IdeApp;
