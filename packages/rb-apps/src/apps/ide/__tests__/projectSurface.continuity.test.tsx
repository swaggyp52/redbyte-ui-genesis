// @vitest-environment jsdom

/**
 * Project surface cross-surface continuity tests.
 *
 * Verifies that every major blocker shown on Project:
 *   1. Tells the student which surface resolves it
 *   2. Offers a direct action button to that surface
 *   3. Export trust state is explained clearly
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { ProjectSurface, type ProjectSurfaceProps } from '../surfaces/ProjectSurface';
import { BoardSignalProvider } from '../BoardSignalContext';
import { deriveProjectHealth } from '../projectHealth';

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
    studentName: '',
    onStudentNameChange: vi.fn(),
    hasVerifyRun: true,
    ...overrides,
  };
}

describe('ProjectSurface — blocker-to-surface routing', () => {
  it('keeps the project console hidden by default so the landing workspace stays primary', () => {
    const { queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );

    expect(queryByTestId('ide-workbench-console')).toBeNull();
  });

  it('uses the shared project command strip so the next move is authoritative above the hero card', () => {
    const { getByTestId, queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-command-strip').textContent).toContain('Current focus: Continue to Verify');
    expect(getByTestId('ide-project-command-strip-primary-cta').textContent).toContain('Continue to Verify');
    expect(getByTestId('ide-project-command-strip-secondary-cta').textContent).toContain('Open Design');
    expect(queryByTestId('ide-project-context')).toBeNull();
    expect(queryByTestId('ide-project-utility-region')).toBeNull();
  });

  it('renders project status copy with plain ASCII separators instead of mojibake', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );

    const commandStrip = getByTestId('ide-project-command-strip');
    expect(commandStrip.textContent).toContain(
      'Compare results are current - open Export to build or refresh the submission package.'
    );
    expect(commandStrip.textContent).not.toContain('Ã');
  });

  it('renders landing and recovery affordances with plain ASCII CTA copy', () => {
    const { container, getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: false,
              hasIoMapping: false,
              hasVectors: false,
              verifyPass: false,
              missingRequiredCount: 0,
            },
            health: {
              lastVerify: undefined,
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [],
            },
            examples: [
              {
                id: 'signal-tour',
                name: 'Signal Tour',
                summary: 'Starter project',
                expectedBehavior: 'Flip switches and observe LEDs.',
                tags: ['starter'],
                course: 'ECE141',
                lab: 'Lab 1',
                concept: 'I/O mapping',
              },
            ],
            recentProjects: [
              {
                projectId: 'counter-lab',
                projectName: 'Counter Lab',
                savedAtIso: '2026-03-09T00:00:00.000Z',
                projectHash: 'saved-hash',
              },
            ],
          })}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-open-existing').textContent).toContain('Open existing project');
    expect(getByTestId('ide-project-landing-example-signal-tour').textContent).toContain('Load & Design ->');
    expect(getByTestId('ide-project-landing-fresh').textContent).toContain('Open blank Design ->');
    expect(container.querySelector('[data-testid^="ide-project-lab-card-"]')?.textContent).toContain('Start ->');
    expect(getByTestId('ide-project-landing').textContent).not.toContain('Ã');
  });

  it('renders blocker and mapping actions without mojibake suffixes', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
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
              blockingIssues: [
                {
                  code: 'RBP1999',
                  message: 'Submission package is out of date.',
                  fixPath: { mode: 'export', actionLabel: 'Build Submission Package' },
                },
              ],
            },
            mappingRows: [
              {
                id: 'out-led0',
                label: 'LED0',
                alias: '',
                pin: '',
                direction: 'output',
                required: true,
                mapped: false,
                source: 'design',
              },
            ],
          })}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-blocker-0-action').textContent).toContain('Build Submission Package');
    expect(getByTestId('ide-project-blocker-0-action').textContent).not.toContain('Ã');
    expect(getByTestId('ide-project-mapping-expand-btn').textContent).toContain('Mapping');
    expect(getByTestId('ide-project-mapping-expand-btn').textContent).not.toContain('Ã');
  });

  it('unmapped output blocker (RBP1005) includes an action button pointing to Map Pins', () => {
    const onOpenHardware = vi.fn();
    const health = deriveProjectHealth(
      {
        lastVerify: {
          status: 'pass',
          hash: 'h',
          qualification: 'incomplete-mapping',
          ranAtIso: '2026-02-27T00:00:00Z',
        },
        lastExport: undefined,
        dirtySinceVerify: false,
        dirtySinceExport: false,
      },
      {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
        verifyQualification: 'incomplete-mapping',
      }
    );
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: true,
              hasVectors: true,
              verifyPass: true,
              verifyQualification: 'incomplete-mapping',
              missingRequiredCount: 0,
            },
            health,
            onOpenHardware,
          })}
        />
      </BoardSignalProvider>
    );

    // RBP1005 is auto-generated when verifyPassIncomplete — fixPath mode: 'hardware'
    const actionBtns = getAllByTestId('ide-project-blocker-0-action');
    const lastBtn = actionBtns[actionBtns.length - 1];
    expect(lastBtn.textContent).toContain('Map Pins');
    fireEvent.click(lastBtn);
    expect(onOpenHardware).toHaveBeenCalled();
  });

  it('missing verify vectors blocker includes an action button pointing to Verify', () => {
    const onOpenVerify = vi.fn();
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: true,
              hasVectors: false,
              verifyPass: false,
              missingRequiredCount: 0,
            },
            health: {
              lastVerify: undefined,
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [
                {
                  code: 'RBP1002',
                  message: 'No verification vectors defined.',
                  fixPath: { mode: 'verify', actionLabel: 'Add Test Vectors' },
                },
              ],
            },
            primaryCtaLabel: 'Verify',
            primaryCta: { label: 'Verify', mode: 'verify', code: 'RBP1002' },
            onOpenVerify,
          })}
        />
      </BoardSignalProvider>
    );

    const actionBtns = getAllByTestId('ide-project-blocker-0-action');
    const lastBtn = actionBtns[actionBtns.length - 1];
    // Button says the fixPath actionLabel, which is "Add Test Vectors"
    expect(lastBtn.textContent).toContain('Vectors');
    fireEvent.click(lastBtn);
    expect(onOpenVerify).toHaveBeenCalled();
  });

  it('verify-failed blocker includes an action button pointing to Verify', () => {
    const onOpenVerify = vi.fn();
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: true,
              hasVectors: true,
              verifyPass: false,
              missingRequiredCount: 0,
            },
            health: {
              lastVerify: { status: 'fail', hash: 'h', ranAtIso: '2026-02-27T00:00:00Z' },
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [
                {
                  code: 'RBP1003',
                  message: 'Latest verification run failed.',
                  fixPath: { mode: 'verify', actionLabel: 'Run Verification' },
                },
              ],
            },
            primaryCtaLabel: 'Verify',
            primaryCta: { label: 'Verify', mode: 'verify', code: 'RBP1003' },
            onOpenVerify,
          })}
        />
      </BoardSignalProvider>
    );

    const actionBtns = getAllByTestId('ide-project-blocker-0-action');
    const lastBtn = actionBtns[actionBtns.length - 1];
    expect(lastBtn.textContent).toContain('Verification');
    fireEvent.click(lastBtn);
    expect(onOpenVerify).toHaveBeenCalled();
  });

  it('keeps Verify as the single dominant next step when compare evidence is missing', () => {
    const { getByTestId, queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: true,
              hasVectors: false,
              verifyPass: false,
              missingRequiredCount: 0,
            },
            health: {
              lastVerify: undefined,
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [],
            },
          })}
        />
      </BoardSignalProvider>
    );

    expect(queryByTestId('ide-project-readiness-goto-verify')).toBeNull();
    expect(queryByTestId('ide-project-showcase-primary-cta')).toBeNull();
    expect(queryByTestId('ide-project-board-preview')).toBeNull();
    expect(queryByTestId('ide-project-quick-stats')).toBeNull();
    expect(getByTestId('ide-project-command-strip-primary-cta').textContent).toContain('Continue to Verify');
    expect(getByTestId('ide-project-next-step').textContent).toContain('trusted comparison evidence');
    expect(getByTestId('ide-project-current-focus').textContent).toContain('Continue to Verify');
  });

  it('keeps export advisory states routed through the hero CTA instead of a duplicate row action', () => {
    const { getByTestId, queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: true,
              hasVectors: false,
              verifyPass: false,
              missingRequiredCount: 0,
            },
            health: {
              lastVerify: undefined,
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [],
            },
          })}
        />
      </BoardSignalProvider>
    );

    expect(queryByTestId('ide-project-readiness-goto-verify-for-export')).toBeNull();
    expect(queryByTestId('ide-project-showcase-primary-cta')).toBeNull();
    expect(getByTestId('ide-project-command-strip-primary-cta').textContent).toContain('Continue to Verify');
    expect(getByTestId('ide-project-current-focus').textContent).toContain('Continue to Verify');
  });

  it('removes blank-project framing from loaded blank-origin projects', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            projectKind: 'blank',
            scenarioAuthority: 'draft',
            description: '',
            topModuleName: 'top',
          })}
        />
      </BoardSignalProvider>
    );

    const currentFocus = getByTestId('ide-project-current-focus');
    expect(currentFocus.textContent).toContain('Fresh Project');
    expect(currentFocus.textContent).toContain('started from a blank canvas');
    expect(currentFocus.textContent).not.toContain('Blank Project');
    expect(currentFocus.textContent).not.toContain('Top module top is loaded and ready for setup.');
  });

  it('removes starter framing from detached custom projects', () => {
    const examples = [
      {
        id: 'signal-tour',
        name: 'Signal Tour: Switches → LEDs',
        summary: 'Four-wire passthrough. Learn mapping, run Verify, and see the board light up.',
        expectedBehavior: 'Starter guidance',
        tags: ['starter'],
        course: 'ECE 101',
        lab: 'Lab 1',
        concept: 'Combinational',
      },
    ];
    const { getByTestId, queryByText, queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            projectName: 'Untitled Project',
            description: '',
            examples,
            projectKind: 'custom',
            sourceExampleId: 'signal-tour',
            scenarioAuthority: 'stale',
            activeExampleId: null,
          })}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-current-focus').textContent).toContain('Custom Project');
    expect(getByTestId('ide-project-current-focus').textContent).toContain('Untitled Project');
    expect(getByTestId('ide-project-command-strip-secondary-cta').textContent).toContain('Open Design');
    expect(queryByText('From Signal Tour: Switches → LEDs')).toBeNull();
    expect(queryByTestId('ide-project-examples-disclosure')).toBeNull();
  });
});
