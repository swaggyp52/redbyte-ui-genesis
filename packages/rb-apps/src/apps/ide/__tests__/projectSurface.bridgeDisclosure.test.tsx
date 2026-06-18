// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ProjectSurface, type ProjectSurfaceProps } from '../surfaces/ProjectSurface';
import { BoardSignalProvider } from '../BoardSignalContext';

afterEach(() => {
  cleanup();
});

function makeProps(overrides: Partial<ProjectSurfaceProps> = {}): ProjectSurfaceProps {
  return {
    projectName: 'Test Project',
    description: '',
    determinismHash: 'abc123def456',
    topModuleName: 'top',
    lastSavedAt: 'Saved recently',
    simRunning: false,
    readiness: {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyPass: true,
      verifyQualification: undefined,
      missingRequiredCount: 0,
    },
    health: {
      lastVerify: {
        status: 'pass',
        hash: 'verify-hash',
        reportHash: 'report-hash',
        ranAtIso: '2026-02-27T00:00:00.000Z',
      },
      lastExport: undefined,
      dirtySinceVerify: false,
      dirtySinceExport: false,
      blockingIssues: [],
    },
    mappingRows: [],
    examples: [],
    activeExampleId: null,
    onOpenExample: vi.fn(),
    primaryCtaLabel: 'Verify',
    primaryCta: { label: 'Verify', mode: 'verify', code: 'RBP1002' },
    onPrimaryCta: vi.fn(),
    onUpdateMappingPin: vi.fn(),
    onAutoSuggestMapping: vi.fn(),
    onOpenDesign: vi.fn(),
    onOpenVerify: vi.fn(),
    onOpenExport: vi.fn(),
    onOpenHardware: vi.fn(),
    onOpenImport: vi.fn(),
    recentProjects: [],
    onOpenSavedProjects: vi.fn(),
    onOpenRecentProject: vi.fn(),
    studentName: 'Connor',
    onStudentNameChange: vi.fn(),
    hasVerifyRun: true,
    ...overrides,
  };
}

describe('ProjectSurface bridge disclosure contract', () => {
  it('keeps the dashboard primary while tucking bridge internals behind a closed disclosure', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps({ projectKind: 'custom' })} />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-projectx-identity').textContent).toContain('Test Project');
    expect(getByTestId('ide-project-command-strip').textContent).toContain('Continue to Verify');
    expect(getByTestId('ide-projectx-metrics')).toBeTruthy();

    const disclosure = getByTestId('ide-project-bridge-disclosure') as HTMLDetailsElement;
    expect(disclosure).toBeTruthy();
    expect(disclosure.open).toBe(false);
  });

  it('reveals the stable bridge content after the disclosure is opened', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps({ projectKind: 'custom' })} />
      </BoardSignalProvider>
    );

    const disclosure = getByTestId('ide-project-bridge-disclosure') as HTMLDetailsElement;
    const summary = disclosure.querySelector('summary');
    expect(summary?.textContent).toContain('Project bridge');

    fireEvent.click(summary as HTMLElement);

    expect(disclosure.open).toBe(true);
    expect(getByTestId('ide-project-bridge-subtitle').textContent).toContain('Custom Project');
  });
});
