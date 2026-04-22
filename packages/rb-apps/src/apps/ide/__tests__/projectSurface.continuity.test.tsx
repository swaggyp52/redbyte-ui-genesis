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
  it('hides the extra project dock so the main workspace owns the shell on Project home', () => {
    const { queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );

    expect(queryByTestId('ide-left-dock')).toBeNull();
    expect(queryByTestId('ide-project-start-dock')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
  });

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
      'No successful export bundle yet. Open Export and use Build Current Bundle when Verify and Map Pins are satisfied.'
    );
    expect(getByTestId('ide-project-map-export-alignment').textContent).toContain(
      'No successful bundle in this project yet.'
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

  it('features the security lock bridge as the recommended student path and separates the advanced reference', () => {
    const { getByTestId } = render(
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
                id: '23_lab8-fsm-lock-starter-basys3',
                name: 'ECE141 Security Lock Starter - Lab 8 Bridge',
                summary: 'Recommended student path for the Digital Security Lock final project.',
                expectedBehavior: 'Build the lock one subsystem at a time.',
                tags: ['fsm', 'starter'],
                course: 'ECE141',
                lab: 'Lab 8',
                concept: 'Finite State Machines',
              },
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
          })}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-featured-security-lock').textContent).toContain('Load recommended starter ->');
    expect(getByTestId('ide-project-featured-security-lock').textContent).toContain('Lab 8 Bridge');
    expect(getByTestId('ide-project-security-lock-reference-note').textContent).toContain('labs/ece141-final-project');
    expect(getByTestId('ide-project-start-column').textContent).toContain('Other starting points');
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

    // Reconciliation R2: the Warnings panel is the canonical blocker authority.
    // The old `ide-project-hero-blocker` duplicate in the hero was removed.
    expect(getByTestId('ide-project-warnings-fix-RBP1999').textContent).toContain('Build Submission Package');
    expect(getByTestId('ide-project-warnings-fix-RBP1999').textContent).not.toContain('Ã');
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
    const { container } = render(
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

    // RBP1005 is auto-generated when verifyPassIncomplete — fixPath mode: 'hardware'.
    // Reconciliation R2: the Warnings panel owns blocker fix buttons.
    const fixBtn = container.querySelector('[data-testid^="ide-project-warnings-fix-"]') as HTMLButtonElement | null;
    expect(fixBtn).not.toBeNull();
    expect(fixBtn!.textContent).toContain('Map Pins');
    fireEvent.click(fixBtn!);
    expect(onOpenHardware).toHaveBeenCalled();
  });

  it('missing verify vectors blocker includes an action button pointing to Verify', () => {
    const onOpenVerify = vi.fn();
    const { getByTestId } = render(
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

    // Reconciliation R2: blocker fix buttons now live in ProjectWarningsPanel.
    const fixBtn = getByTestId('ide-project-warnings-fix-RBP1002');
    expect(fixBtn.textContent).toContain('Vectors');
    fireEvent.click(fixBtn);
    expect(onOpenVerify).toHaveBeenCalled();
  });

  it('verify-failed blocker includes an action button pointing to Verify', () => {
    const onOpenVerify = vi.fn();
    const { getByTestId } = render(
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

    // Reconciliation R2: blocker fix buttons now live in ProjectWarningsPanel.
    const fixBtn = getByTestId('ide-project-warnings-fix-RBP1003');
    expect(fixBtn.textContent).toContain('Verification');
    fireEvent.click(fixBtn);
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
    // Reconciliation R2: the command strip is the single authority for the primary
    // CTA label, next-step reason, and "Continue to X" narrative.
    expect(getByTestId('ide-project-command-strip-primary-cta').textContent).toContain('Continue to Verify');
    expect(getByTestId('ide-project-command-strip-next-step-copy').textContent).toContain('trusted comparison evidence');
    expect(getByTestId('ide-project-command-strip').textContent).toContain('Continue to Verify');
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
    // Reconciliation R2: command strip is the single authority for "Continue to X".
    expect(getByTestId('ide-project-command-strip-primary-cta').textContent).toContain('Continue to Verify');
    expect(getByTestId('ide-project-command-strip').textContent).toContain('Continue to Verify');
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

    // Reconciliation R2: the Bridge owns the project-kind label (single authority).
    // The session narrative owns the project summary/goal copy.
    const bridgeSubtitle = getByTestId('ide-project-bridge-subtitle');
    expect(bridgeSubtitle.textContent).toContain('Fresh Project');
    expect(bridgeSubtitle.textContent).not.toContain('Blank Project');

    const narrative = getByTestId('ide-project-session-narrative');
    expect(narrative.textContent).toContain('started from a blank canvas');
    expect(narrative.textContent).not.toContain('Top module top is loaded and ready for setup.');
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
            projectName: 'Signal Tour: Switches â†’ LEDs',
            description: 'Four-wire passthrough. Learn mapping, run Verify, and see the board light up.',
            examples,
            projectKind: 'custom',
            sourceExampleId: 'signal-tour',
            scenarioAuthority: 'stale',
            activeExampleId: null,
          })}
        />
      </BoardSignalProvider>
    );

    // Reconciliation R2: the Bridge owns kind framing; the session narrative owns name.
    expect(getByTestId('ide-project-bridge-subtitle').textContent).toContain('Custom Project');
    expect(getByTestId('ide-project-bridge-subtitle').textContent).not.toContain('signal-tour');
    expect(getByTestId('ide-project-session-narrative').textContent).toContain('Signal Tour: Switches â†’ LEDs');
    expect(getByTestId('ide-project-command-strip-secondary-cta').textContent).toContain('Open Design');
    expect(queryByText('From Signal Tour: Switches → LEDs')).toBeNull();
    expect(queryByTestId('ide-project-examples-disclosure')).toBeNull();
  });
});
