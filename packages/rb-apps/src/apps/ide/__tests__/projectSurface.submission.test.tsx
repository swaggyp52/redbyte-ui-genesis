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
    expect(getByTestId('ide-submission-student-name-warning').textContent).toContain('device ID');
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

  it('surfaces the next action and active example context in the main workspace', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            health: {
              ...makeProps().health,
              dirtySinceVerify: true,
              blockingIssues: [
                {
                  code: 'RBP1004',
                  message: 'Design changed since last verification run.',
                  fixPath: { mode: 'verify', actionLabel: 'Run Verification' },
                },
              ],
            },
            primaryCtaLabel: 'Verify',
            primaryCta: { label: 'Verify', mode: 'verify', code: 'RBP1004' },
            examples: [
              {
                id: 'signal-tour',
                name: 'Signal Tour: Switches -> LEDs',
                summary: 'A starter project for the full classroom flow.',
                expectedBehavior: 'Flip switches and the matching LEDs follow immediately.',
                tags: ['starter'],
                course: 'ECE141',
                lab: 'Lab 1',
                concept: 'I/O mapping',
              },
            ],
            activeExampleId: 'signal-tour',
          })}
        />
      </BoardSignalProvider>
    );

    const nextAction = getByTestId('ide-project-next-action');
    expect(nextAction.textContent).toContain('RBP1004');
    expect(nextAction.textContent).toContain('Design changed since last verification run.');

    const showcase = getByTestId('ide-project-showcase');
    expect(showcase.textContent).toContain('Build it, prove it, and light it up on the board.');
    expect(getByTestId('ide-project-board-preview').textContent).toContain(
      'Flip switches and the matching LEDs follow immediately.'
    );
    expect(getByTestId('ide-project-example-signal-tour').textContent).toContain('Switch map');

    const context = getByTestId('ide-project-context');
    expect(context.textContent).toContain('Signal Tour: Switches -> LEDs');
    expect(context.textContent).toContain('Flip switches and the matching LEDs follow immediately.');
  });

  it('shows the current primary target and missing pins inline when mapping is incomplete', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: false,
              hasVectors: false,
              verifyPass: false,
              missingRequiredCount: 2,
            },
            health: {
              ...makeProps().health,
              lastVerify: undefined,
              dirtySinceVerify: false,
              blockingIssues: [
                {
                  code: 'RBP1001',
                  message: 'Required Basys3 I/O mappings are missing.',
                  fixPath: { mode: 'project', actionLabel: 'Fix Mapping' },
                },
              ],
            },
            primaryCtaLabel: 'Design',
            primaryCta: { label: 'Design', mode: 'design', code: 'RBP1001' },
            mappingRows: [
              {
                id: 'sw0',
                label: 'SW0',
                direction: 'in',
                pin: '',
                required: true,
                port: 'SW0',
              },
              {
                id: 'ld0',
                label: 'LD0',
                direction: 'out',
                pin: '',
                required: true,
                port: 'LD0',
              },
            ],
          })}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-continue-target').textContent).toContain('Design');
    const missingPins = getByTestId('ide-project-mapping-missing-list');
    expect(missingPins.textContent).toContain('SW0');
    expect(missingPins.textContent).toContain('LD0');
  });
});
