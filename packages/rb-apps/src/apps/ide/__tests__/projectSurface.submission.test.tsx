// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ProjectSurface, type ProjectSurfaceProps } from '../surfaces/ProjectSurface';
import { BoardSignalProvider } from '../BoardSignalContext';

function makeProps(overrides: Partial<ProjectSurfaceProps> = {}): ProjectSurfaceProps {
  return {
    projectName: 'Submission Preview Project',
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
    studentName: '',
    onStudentNameChange: vi.fn(),
    hasVerifyRun: true,
    onExportSubmission: vi.fn(),
    submissionExportPending: false,
    submissionPreview: {
      lastStatus: 'pass',
      passes: 4,
      fails: 1,
      overallGateVerdict: 'warn',
      assignmentId: 'lab-7',
      labCode: 'ECE141-L7',
    },
    ...overrides,
  };
}

describe('ProjectSurface submission workflow hints', () => {
  it('shows a device-ID warning when student name is blank', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps({ studentName: '' })} />
      </BoardSignalProvider>
    );
    expect(getByTestId('ide-submission-student-name-warning').textContent).toContain('device ID only');
  });

  it('renders submission preview fields before export', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );
    const previewTable = getByTestId('ide-submission-preview-table');
    expect(previewTable.textContent).toContain('Last verify status');
    expect(previewTable.textContent).toContain('PASS');
    expect(previewTable.textContent).toContain('Gate verdict');
    expect(previewTable.textContent).toContain('WARN');
    expect(previewTable.textContent).toContain('lab-7');
    expect(previewTable.textContent).toContain('ECE141-L7');
  });
});

