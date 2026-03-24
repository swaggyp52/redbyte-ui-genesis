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

    const { getByTestId, getAllByTestId } = render(
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

    expect(getAllByTestId('ide-project-showcase-primary-cta').at(-1)?.textContent).toContain('Continue to Hardware');
    expect(getByTestId('ide-project-console').textContent).toContain('Finish mapping before relying on hardware behavior');
  });

  it('keeps the hero CTA dominant while surfacing the active example context', () => {
    const { getByTestId, getAllByTestId } = render(
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

    const showcases = getAllByTestId('ide-project-showcase');
    const showcase = showcases[showcases.length - 1];
    expect(showcase.textContent).toContain('Signal Tour: Switches -> LEDs');
    expect(getAllByTestId('ide-project-showcase-primary-cta').at(-1)?.textContent).toContain('Continue to Verify');
    expect(getAllByTestId('ide-project-board-preview').at(-1)?.textContent).toContain(
      'Flip switches and the matching LEDs follow immediately.'
    );

    const context = getAllByTestId('ide-project-context').at(-1)!;
    expect(context.textContent).toContain('Signal Tour: Switches -> LEDs');
    expect(context.textContent).toContain('Flip switches and the matching LEDs follow immediately.');
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

    const targetList = getAllByTestId('ide-project-continue-target');
    expect(targetList[targetList.length - 1].textContent).toContain('Design');
    
    const missingPinsList = getAllByTestId('ide-project-mapping-missing-list');
    const missingPins = missingPinsList[missingPinsList.length - 1];
    expect(missingPins.textContent).toContain('SW0');
    expect(missingPins.textContent).toContain('LD0');
  });

  it('keeps mapping labels student-facing even when raw ports are generic', () => {
    const { getAllByTestId } = render(
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

    const expandBtnList = getAllByTestId('ide-project-mapping-expand-btn');
    fireEvent.click(expandBtnList[expandBtnList.length - 1]);

    const portSw0List = getAllByTestId('ide-project-port-sw0');
    expect(portSw0List[portSw0List.length - 1].textContent).toContain('SW0');
    expect(portSw0List[portSw0List.length - 1].textContent).not.toContain('out');
    
    const portLd0List = getAllByTestId('ide-project-port-ld0');
    expect(portLd0List[portLd0List.length - 1].textContent).toContain('LD0');
    expect(portLd0List[portLd0List.length - 1].textContent).not.toContain('in');
  });

  it('surfaces FPGA config, fidelity, and Project-side quick picks for lab-day export prep', () => {
    const onFpgaConfigChange = vi.fn();
    const onUpdateMappingPin = vi.fn();
    const { getAllByTestId } = render(
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
            onUpdateMappingPin,
          })}
        />
      </BoardSignalProvider>
    );

    const expandBtnList = getAllByTestId('ide-project-mapping-expand-btn');
    fireEvent.click(expandBtnList[expandBtnList.length - 1]);

    const fidelityList = getAllByTestId('ide-project-import-fidelity');
    expect(fidelityList[fidelityList.length - 1].textContent).toContain('Reconstructed');
    
    const topList = getAllByTestId('ide-project-fpga-top');
    fireEvent.change(topList[topList.length - 1], { target: { value: 'lab_top' } });
    
    const partList = getAllByTestId('ide-project-fpga-part');
    fireEvent.change(partList[partList.length - 1], { target: { value: 'xc7a100tcsg324-1' } });
    
    const clkList = getAllByTestId('ide-project-map-quick-clk-clk100mhz');
    fireEvent.click(clkList[clkList.length - 1]);
    
    const seg0List = getAllByTestId('ide-project-map-quick-seg0-seg0');
    fireEvent.click(seg0List[seg0List.length - 1]);

    expect(onFpgaConfigChange).toHaveBeenCalledWith({ top: 'lab_top' });
    expect(onFpgaConfigChange).toHaveBeenCalledWith({ part: 'xc7a100tcsg324-1' });
    expect(onUpdateMappingPin).toHaveBeenCalledWith('clk', 'CLK100MHZ');
    expect(onUpdateMappingPin).toHaveBeenCalledWith('seg0', 'SEG0');
    
  });

  it('keeps export available on Project even when Verify has not been trusted yet', () => {
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

    const readinessSummaryList = getAllByTestId('ide-project-readiness-summary');
    const readinessSummary = readinessSummaryList[readinessSummaryList.length - 1];
    expect(readinessSummary?.textContent).toContain('EXPORT AVAILABLE');
    expect(readinessSummary?.textContent).toContain(
      'Export can be opened now for file review'
    );
    const dockNavList = getAllByTestId('ide-project-dock-nav-export');
    expect(dockNavList[dockNavList.length - 1]?.textContent).toContain('Open now');
  });

  it('displays up to top 3 blocking issues with readable messages', () => {
    const { getAllByTestId, container } = render(
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

    // Should show exactly 3 blockers
    const blocker0 = getAllByTestId('ide-project-blocker-0');
    const blocker1 = getAllByTestId('ide-project-blocker-1');
    const blocker2 = getAllByTestId('ide-project-blocker-2');
    
    expect(blocker0[blocker0.length - 1].textContent).toContain('First issue');
    expect(blocker1[blocker1.length - 1].textContent).toContain('Second issue');
    expect(blocker2[blocker2.length - 1].textContent).toContain('Third issue');

    // Fourth blocker should not be rendered directly
    const blocker3List = container.querySelectorAll('[data-testid="ide-project-blocker-3"]');
    expect(blocker3List.length).toBe(0);

    // Should show "…and 1 more" overflow text
    const listElements = getAllByTestId('ide-project-blockers-list');
    const lastList = listElements[listElements.length - 1];
    expect(lastList.parentElement?.textContent).toContain('…and 1 more');
  });

  it('clearly explains AVAILABLE status means export files are already available when compare is advisory', () => {
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
          })}
        />
      </BoardSignalProvider>
    );

    // Check for the AVAILABLE explanation text (get last one in case others exist)
    const explanations = getAllByTestId('ide-project-export-explanation');
    const explanation = explanations[explanations.length - 1];
    expect(explanation?.textContent || '').toContain('AVAILABLE');
    expect(explanation?.textContent || '').toContain('reviewed or downloaded now');
    expect(explanation?.textContent || '').toContain('do not block export');
  });

  it('shows explicit trust blocker when verify passes but with incomplete mapping', () => {
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
          })}
        />
      </BoardSignalProvider>
    );

    // Verify row should show mapping-review advisory, not grading language
    const readinessItems = getAllByTestId('ide-project-readiness-summary');
    const lastReadiness = readinessItems[readinessItems.length - 1];
    expect(lastReadiness?.textContent || '').toContain('MATCH (MAPPING REVIEW)');

    // Export row should stay available
    expect(lastReadiness?.textContent || '').toContain('AVAILABLE');

    // RBP1005 blocker should appear in the list
    const blockerElements = getAllByTestId('ide-project-blocker-0');
    if (blockerElements && blockerElements.length > 0) {
      expect(blockerElements[blockerElements.length - 1].textContent).toContain('unmapped');
    }
  });

  it('uses consistent stable terminology for all readiness states - mapping blocked', () => {
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: false,
              hasVectors: true,
              verifyPass: false,
              verifyQualification: undefined,
              missingRequiredCount: 2,
            },
            health: {
              lastVerify: undefined,
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [
                { code: 'RBP1001', message: 'Required Basys3 I/O mappings are missing.' },
              ],
            },
          })}
        />
      </BoardSignalProvider>
    );

    const summaryElements = getAllByTestId('ide-project-readiness-summary');
    expect(summaryElements[summaryElements.length - 1].textContent).toContain('Mapping');
    expect(summaryElements[summaryElements.length - 1].textContent).toContain('BLOCKED');
  });

  it('uses consistent stable terminology for all readiness states - verify needed', () => {
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: true,
              hasVectors: true,
              verifyPass: false,
              verifyQualification: undefined,
              missingRequiredCount: 0,
            },
            health: {
              lastVerify: undefined,
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [
                { code: 'RBP1004', message: 'Need to run verification' },
              ],
            },
          })}
        />
      </BoardSignalProvider>
    );

    const summaryElements = getAllByTestId('ide-project-readiness-summary');
    expect(summaryElements[summaryElements.length - 1].textContent).toContain('Verify');
    expect(summaryElements[summaryElements.length - 1].textContent).toContain('NOT RUN');
  });

  it('uses consistent stable terminology for all readiness states - export available', () => {
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
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
                hash: 'h',
                ranAtIso: '2026-02-27T00:00:00Z',
              },
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [],
            },
          })}
        />
      </BoardSignalProvider>
    );

    const summaryElements = getAllByTestId('ide-project-readiness-summary');
    expect(summaryElements[summaryElements.length - 1].textContent).toContain('Export');
    expect(summaryElements[summaryElements.length - 1].textContent).toContain('AVAILABLE');
  });
});
