// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { ProjectSurface, type ProjectSurfaceProps } from '../surfaces/ProjectSurface';
import { BoardSignalProvider } from '../BoardSignalContext';
import { choosePrimaryProjectCta, deriveProjectHealth } from '../projectHealth';

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

describe('ProjectSurface workspace panels', () => {
  it('keeps the shared CTA and console aligned on incomplete-mapping trust blockers', () => {
    const health = deriveProjectHealth(
      {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          qualification: 'incomplete-mapping',
          ranAtIso: '2026-03-21T00:00:00.000Z',
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
    const primaryCta = choosePrimaryProjectCta(health, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: 'incomplete-mapping',
    });

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
            primaryCtaLabel: primaryCta.label,
            primaryCta,
          })}
        />
      </BoardSignalProvider>
    );

    const primaryCtas = getAllByTestId('ide-project-command-strip-primary-cta');
    expect(primaryCtas[primaryCtas.length - 1].textContent).toContain('Continue Design');
    // Reconciliation R2: ProjectWarningsPanel is the single blocker authority.
    const warningsLists = getAllByTestId('ide-project-warnings-list');
    expect(warningsLists[warningsLists.length - 1].textContent).toContain('Finish mapping before relying on hardware behavior');
  });

  it('keeps the hero CTA dominant while surfacing the active example context', () => {
    const { getAllByTestId, queryByTestId } = render(
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
            projectKind: 'example',
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

    // Reconciliation R2: the session narrative owns the example name + summary.
    // The command strip stays a stable launch point while warnings own blockers.
    // The Bridge owns the project-kind label.
    // NB: the Project surface renders twice in some test contexts (panel + shadow);
    // we read the last (live) instance to match existing test patterns.
    const narratives = getAllByTestId('ide-project-session-narrative');
    const narrative = narratives[narratives.length - 1];
    expect(narrative.textContent).toContain('Signal Tour: Switches -> LEDs');
    expect(narrative.textContent).toContain('Flip switches and the matching LEDs follow immediately.');
    const primaryCtas = getAllByTestId('ide-project-command-strip-primary-cta');
    expect(primaryCtas[primaryCtas.length - 1].textContent).toContain('Continue Design');
    const nextSteps = getAllByTestId('ide-project-command-strip-next-step-copy');
    expect(nextSteps[nextSteps.length - 1].textContent).toContain('Open the circuit canvas');
    expect(queryByTestId('ide-project-board-preview')).toBeNull();
    expect(queryByTestId('ide-project-context')).toBeNull();
    const bridgeSubtitles = getAllByTestId('ide-project-bridge-subtitle');
    expect(bridgeSubtitles[bridgeSubtitles.length - 1].textContent).toContain('Example Project');
  });

  it('shows open-existing and recent-work entry points on the empty project home', () => {
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
              ...makeProps().health,
              lastVerify: undefined,
              blockingIssues: [],
            },
            recentProjects: [
              {
                projectId: 'rb-counter',
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
    expect(getByTestId('ide-project-recent-rb-counter').textContent).toContain('Counter Lab');
  });

  it('keeps import as a secondary utility path instead of a peer project-home start card', () => {
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
              ...makeProps().health,
              lastVerify: undefined,
              blockingIssues: [],
            },
            recentProjects: [],
            examples: [
              {
                id: 'teacher-template',
                name: 'Teacher Template',
                summary: 'A starter teachers can hand to students.',
                expectedBehavior: 'Use this template as the classroom starting point.',
                tags: ['starter'],
                course: 'ECE 101',
                lab: 'Lab 1',
                concept: 'Combinational',
              },
            ],
          })}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-open-existing').textContent).toContain('Open existing project');
    expect(getByTestId('ide-project-import-primary').textContent).toContain('Import Project');
    expect(getByTestId('ide-project-landing-example-teacher-template').textContent).toContain('Teacher Template');
    expect(queryByTestId('ide-project-landing-import')).toBeNull();
  });

  it('shows the current primary target and missing pins inline when mapping is incomplete', () => {
    const { getAllByTestId } = render(
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

    // Reconciliation R2: command strip owns the "Continue to X" label.
    const targetList = getAllByTestId('ide-project-command-strip-primary-cta');
    expect(targetList[targetList.length - 1].textContent).toContain('Design');

    const missingPinsList = getAllByTestId('ide-project-mapping-missing-list');
    const missingPins = missingPinsList[missingPinsList.length - 1];
    expect(missingPins.textContent).toContain('SW0');
    expect(missingPins.textContent).toContain('LD0');
  });

  it('keeps mapping labels student-facing even when raw ports are generic', () => {
    const { getAllByTestId, getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            mappingRows: [
              {
                id: 'sw0',
                label: 'SW0',
                direction: 'in',
                pin: '',
                required: true,
                port: 'out',
              },
              {
                id: 'ld0',
                label: 'LD0',
                direction: 'out',
                pin: '',
                required: true,
                port: 'in',
              },
            ],
          })}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getByTestId('ide-project-mapping-expand-btn'));

    const portSw0List = getAllByTestId('ide-project-port-sw0');
    expect(portSw0List[portSw0List.length - 1].textContent).toContain('SW0');
    expect(portSw0List[portSw0List.length - 1].textContent).not.toContain('out');
    
    const portLd0List = getAllByTestId('ide-project-port-ld0');
    expect(portLd0List[portLd0List.length - 1].textContent).toContain('LD0');
    expect(portLd0List[portLd0List.length - 1].textContent).not.toContain('in');
  });

  it('surfaces FPGA config, fidelity, and a Map Pins handoff for lab-day export prep', () => {
    const onFpgaConfigChange = vi.fn();
    const onOpenHardware = vi.fn();
    const { getAllByTestId, getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            mappingRows: [
              {
                id: 'clk',
                label: 'clk',
                direction: 'in',
                pin: '',
                required: true,
                port: 'clk',
              },
              {
                id: 'seg0',
                label: 'seg0',
                direction: 'out',
                pin: '',
                required: true,
                port: 'seg0',
              },
            ],
            fpgaConfig: {
              board: 'basys3',
              top: 'student_top',
              part: 'xc7a35tcpg236-1',
            },
            importFidelity: 'reconstructed',
            onFpgaConfigChange,
            onOpenHardware,
          })}
        />
      </BoardSignalProvider>
    );

    const fidelityList = getAllByTestId('ide-project-import-fidelity');
    expect(fidelityList[fidelityList.length - 1].textContent).toContain('Reconstructed');
    // Reconciliation R2: the Bridge owns the canonical fidelity display (non-native only).
    expect(getByTestId('ide-project-bridge-fidelity').textContent).toContain('Reconstructed');
    
    const topList = getAllByTestId('ide-project-fpga-top');
    fireEvent.change(topList[topList.length - 1], { target: { value: 'lab_top' } });
    
    const partList = getAllByTestId('ide-project-fpga-part');
    fireEvent.change(partList[partList.length - 1], { target: { value: 'xc7a100tcsg324-1' } });

    fireEvent.click(getByTestId('ide-project-open-map-pins'));

    expect(onFpgaConfigChange).toHaveBeenCalledWith({ top: 'lab_top' });
    expect(onFpgaConfigChange).toHaveBeenCalledWith({ part: 'xc7a100tcsg324-1' });
    expect(onOpenHardware).toHaveBeenCalledTimes(1);
  });

  it('keeps the stable Project launch actions when Verify has not been trusted yet', () => {
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
              ...makeProps().health,
              lastVerify: undefined,
              dirtySinceVerify: false,
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
          })}
        />
      </BoardSignalProvider>
    );

    const primaryCtas = getAllByTestId('ide-project-command-strip-primary-cta');
    expect(primaryCtas[primaryCtas.length - 1]?.textContent).toContain('Continue Design');
    const verifyCtas = getAllByTestId('ide-project-command-strip-secondary-cta');
    expect(verifyCtas[verifyCtas.length - 1]?.textContent).toContain('Open Verify');
  });

  it('displays up to top 3 blocking issues with readable messages', () => {
    // Reconciliation R2: ProjectWarningsPanel is the single authority for the
    // top-N cap + overflow affordance. The old duplicate hero list was removed.
    const { getByTestId, queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            health: {
              lastVerify: { status: 'pass', hash: 'h', ranAtIso: '2026-02-27T00:00:00Z' },
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [
                { code: 'RBP1000', message: 'First issue' },
                { code: 'RBP1001', message: 'Second issue' },
                { code: 'RBP1002', message: 'Third issue' },
                { code: 'RBP1003', message: 'Fourth issue' },
              ],
            },
          })}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-warnings-item-RBP1000').textContent).toContain('First issue');
    expect(getByTestId('ide-project-warnings-item-RBP1001').textContent).toContain('Second issue');
    expect(getByTestId('ide-project-warnings-item-RBP1002').textContent).toContain('Third issue');

    // Fourth item is capped off; it must not render inside the warnings list.
    expect(queryByTestId('ide-project-warnings-item-RBP1003')).toBeNull();

    // Overflow affordance communicates the hidden remainder.
    expect(getByTestId('ide-project-warnings-overflow').textContent).toContain('...and 1 more');
  });

});
