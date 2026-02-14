import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialFirstRunState, resolveFirstRunTargetApp } from '../apps/firstRun/firstRunState';

vi.mock('../fpga/toolchainBackend', () => ({
  getToolchainBackendId: () => 'vivado',
  getToolchainBackend: () => ({
    detectBoards: vi.fn(async () => ({
      ok: true,
      boards: [{ type: 'basys3' }],
      tools: { openFPGALoader: { ok: true, version: '1.0.0' } },
    })),
    programBitstream: vi.fn(async () => ({ runId: 'run-1', artifactId: 'a-1', logs: [], state: 'done', nextOffset: 0 })),
    getRunStatus: vi.fn(async () => ({ runId: 'run-1', artifactId: 'a-1', state: 'done', ok: true, exitCode: 0, logs: [], nextOffset: 0 })),
    doctorReportV2: vi.fn(async () => ({
      schema_version: 'rb_doctor_report_v2',
      generatedAt: new Date().toISOString(),
      redbyte: { appVersion: 'test', buildHash: 'test', uiSurface: 'studio', wizardVersion: 'v1' },
      environment: {
        os: { platform: 'test', release: 'test', arch: 'x64' },
        node: { version: 'test' },
        paths: { workspaceRootHash: 'h1', tempDirHash: 'h2' },
      },
      bridge: { reachable: true },
      programmer: { name: 'openFPGALoader', found: true, capabilities: { program: true, detect: true } },
      board: { detected: true, boardModel: 'basys3' },
      programAttempt: {},
      capture: {},
      toolchain: { backendId: 'vivado', buildPathKind: 'local', farmStatus: 'local-only' },
      remediation: [],
    })),
  }),
}));

const { FirstRunWizardApp } = await import('../apps/FirstRunWizardApp');
const FirstRunWizardComponent = FirstRunWizardApp.component as React.ComponentType;

describe('FirstRunWizardApp', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders wizard stepper contract', () => {
    render(<FirstRunWizardComponent />);
    expect(screen.getByTestId('first-run-wizard-root')).toBeInTheDocument();
    expect(screen.getByTestId('first-run-stepper')).toBeInTheDocument();
    expect(screen.getByTestId('first-run-primary-cta')).toBeInTheDocument();
    expect(screen.getByTestId('first-run-export-doctor')).toBeInTheDocument();
  });

  it('routes home/studio to wizard when incomplete', () => {
    const state = createInitialFirstRunState();
    expect(resolveFirstRunTargetApp('home', state)).toBe('first-run-wizard');
    expect(resolveFirstRunTargetApp('lab-workspace', state)).toBe('first-run-wizard');
  });
});
