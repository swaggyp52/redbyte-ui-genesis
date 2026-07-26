// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
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

describe('ProjectSurface engineering record contract', () => {
  it('keeps one launch point primary while presenting the engineering record without disclosure chrome', () => {
    const { getByTestId, queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps({ projectKind: 'custom' })} />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-identity-strip-title').textContent).toContain('Test Project');
    expect(getByTestId('ide-project-command-strip').textContent).toContain('Next: Verify');
    expect(getByTestId('ide-project-command-strip-primary-cta').textContent).toContain('Verify');
    expect(queryByTestId('ide-project-command-strip-secondary-cta')).toBeNull();
    expect(getByTestId('ide-project-professional-overview')).toBeTruthy();
    expect(queryByTestId('ide-projectx-metrics')).toBeNull();

    const record = getByTestId('ide-project-bridge-disclosure');
    expect(record).toBeTruthy();
    expect(record.querySelector('details')).toBeNull();
    expect(record.querySelector('summary')).toBeNull();
    expect(getByTestId('ide-project-bridge-subtitle').textContent).toContain('Custom Project');
  });

  it('keeps the stable engineering identity visible without another click', () => {
    const { container, getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps({ projectKind: 'custom' })} />
      </BoardSignalProvider>
    );

    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('summary')).toBeNull();
    expect(getByTestId('ide-project-bridge-subtitle').textContent).toContain('Custom Project');
    expect(getByTestId('ide-project-hash-short').textContent).toContain('abc123def456');
  });
});
