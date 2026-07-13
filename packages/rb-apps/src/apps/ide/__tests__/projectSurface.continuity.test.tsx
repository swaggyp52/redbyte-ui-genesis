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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ProjectSurface, type ProjectSurfaceProps } from '../surfaces/ProjectSurface';
import { BoardSignalProvider } from '../BoardSignalContext';
import { FULL_ADDER_SCRATCH_LAB } from '../labTaskDefinition';

afterEach(() => {
  cleanup();
});
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

  it('uses one loaded-project launch group with Continue Design as the primary action', () => {
    const { getByTestId, queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-command-strip').textContent).toContain('Continue building Test Project');
    expect(getByTestId('ide-project-command-strip-primary-cta').textContent).toContain('Continue Design');
    expect(getByTestId('ide-project-command-strip-secondary-cta').textContent).toContain('Open Verify');
    expect(getByTestId('ide-project-change-project').textContent).toContain('Change Project');
    expect(queryByTestId('ide-project-context')).toBeNull();
    expect(queryByTestId('ide-project-utility-region')).toBeNull();
  });

  it('keeps engineering details collapsed while preserving their status copy', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );

    const commandStrip = getByTestId('ide-project-command-strip');
    expect(commandStrip.textContent).toContain('Open the circuit canvas to keep building');
    expect((getByTestId('ide-project-supporting-details') as HTMLDetailsElement).open).toBe(false);
    expect(getByTestId('ide-project-map-export-alignment').textContent).toContain(
      'No successful bundle in this project yet.'
    );
    expect(commandStrip.textContent).not.toContain('Ã');
  });

  it('renders landing and recovery affordances with plain ASCII CTA copy', () => {
    const { container, getByTestId, queryByTestId } = render(
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
            guidedLabTask: FULL_ADDER_SCRATCH_LAB,
            onStartGuidedLab: vi.fn(),
          })}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-open-existing').textContent).toContain('Open existing project');
    expect(getByTestId('ide-project-landing-example-signal-tour').textContent).toContain('Load & Design ->');
    expect(getByTestId('ide-project-build-fresh-primary').textContent).toContain('Build Fresh');
    expect(queryByTestId('ide-project-identity-strip')).toBeNull();
    const starterCatalog = getByTestId('ide-project-starter-catalog') as HTMLDetailsElement;
    expect(starterCatalog.open).toBe(false);
    expect(starterCatalog.contains(getByTestId('ide-project-guided-full-adder-lab'))).toBe(true);
    expect(container.querySelector('[data-testid^="ide-project-lab-card-"]')?.textContent).toContain('Start ->');
    expect(getByTestId('ide-project-landing').textContent).not.toContain('Ã');
  });

  it('keeps secondary starts available while the certified course path stays primary', () => {
    const { getByTestId, queryByTestId } = render(
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

    // Primary actions strip always present
    expect(getByTestId('ide-project-primary-actions')).toBeTruthy();
    expect(getByTestId('ide-project-build-fresh-primary').textContent).toContain('Build Fresh');
    // ECE141 course-specific featured panel is gone
    expect(queryByTestId('ide-project-recommended-security-lock')).toBeNull();
    expect(queryByTestId('ide-project-featured-security-lock')).toBeNull();
    // Security lock example appears as a regular example card, not a featured panel
    expect(getByTestId('ide-project-landing-example-23_lab8-fsm-lock-starter-basys3')).toBeTruthy();
    // Project Command Center: starters remain visible without making the surface course-first.
    expect(getByTestId('ide-project-start-column').textContent).toContain('Course starters');
    expect(getByTestId('ide-project-start-column').textContent).not.toContain('Other starting points');
  });

  it('renders the Gannon Pilot lab pack with expandable cards and explicit start paths', () => {
    const onOpenExample = vi.fn();
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
            onOpenExample,
          })}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-start-a-lab-primary').textContent).toContain('Start a Lab');
    expect(getByTestId('ide-project-gannon-lab-pack').textContent).toContain('Gannon Pilot lab pack');
    expect(getByTestId('ide-project-gannon-lab-card-logic-gates').textContent).toContain('Logic Gates');
    expect(getByTestId('ide-project-gannon-lab-card-half-adder').textContent).toContain('Half Adder');
    expect(getByTestId('ide-project-gannon-lab-card-full-adder').textContent).toContain('Full Adder');
    expect(getByTestId('ide-project-gannon-lab-card-four-bit-adder').textContent).toContain('4-Bit Adder');
    expect(getByTestId('ide-project-gannon-lab-card-counter-sequential').textContent).toContain('2-Bit Counter');
    expect(getByTestId('ide-instructor-note').textContent).toContain('For instructors');

    fireEvent.click(getByTestId('ide-project-gannon-lab-details-four-bit-adder'));
    expect(getByTestId('ide-project-gannon-lab-card-four-bit-adder').textContent).toContain('ripple-carry');
    fireEvent.click(getByTestId('ide-project-gannon-lab-start-four-bit-adder'));
    expect(onOpenExample).toHaveBeenCalledWith('four-bit-adder');
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

  it('keeps the loaded Project page a launch point even when Verify evidence is missing', () => {
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
    expect(getByTestId('ide-projectx-next-status').textContent).toBe('Project loaded');
    expect(getByTestId('ide-project-command-strip-primary-cta').textContent).toContain('Continue Design');
    expect(getByTestId('ide-project-command-strip-secondary-cta').textContent).toContain('Open Verify');
    expect(queryByTestId('ide-project-command-mode-actions')).toBeNull();
  });

  it('does not turn export advisory state into a duplicate Project-page command row', () => {
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
    expect(getByTestId('ide-project-command-strip-primary-cta').textContent).toContain('Continue Design');
    expect(getByTestId('ide-project-command-strip-secondary-cta').textContent).toContain('Open Verify');
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
    expect(getByTestId('ide-project-command-strip-secondary-cta').textContent).toContain('Open Verify');
    expect(queryByText('From Signal Tour: Switches → LEDs')).toBeNull();
    expect(queryByTestId('ide-project-examples-disclosure')).toBeNull();
  });
});
