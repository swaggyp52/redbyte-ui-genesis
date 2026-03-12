// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { ProjectSurface, type ProjectSurfaceProps } from '../surfaces/ProjectSurface';
import { BoardSignalProvider } from '../BoardSignalContext';

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
  it('keeps the hero CTA dominant while surfacing the active example context', () => {
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

    const showcase = getByTestId('ide-project-showcase');
    expect(showcase.textContent).toContain('Build it, prove it, and light it up on the board.');
    expect(getByTestId('ide-project-showcase-primary-cta').textContent).toContain('Continue to Verify');
    expect(getByTestId('ide-project-board-preview').textContent).toContain(
      'Flip switches and the matching LEDs follow immediately.'
    );

    const context = getByTestId('ide-project-context');
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

  it('keeps mapping labels student-facing even when raw ports are generic', () => {
    const { getByTestId } = render(
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

    expect(getByTestId('ide-project-port-sw0').textContent).toContain('SW0');
    expect(getByTestId('ide-project-port-sw0').textContent).not.toContain('out');
    expect(getByTestId('ide-project-port-ld0').textContent).toContain('LD0');
    expect(getByTestId('ide-project-port-ld0').textContent).not.toContain('in');
  });

  it('surfaces FPGA config, fidelity, and Project-side quick picks for lab-day export prep', () => {
    const onFpgaConfigChange = vi.fn();
    const onUpdateMappingPin = vi.fn();
    const { getByTestId } = render(
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

    fireEvent.click(getByTestId('ide-project-mapping-expand-btn'));

    expect(getByTestId('ide-project-import-fidelity').textContent).toContain('Reconstructed');
    fireEvent.change(getByTestId('ide-project-fpga-top'), { target: { value: 'lab_top' } });
    fireEvent.change(getByTestId('ide-project-fpga-part'), { target: { value: 'xc7a100tcsg324-1' } });
    fireEvent.click(getByTestId('ide-project-map-quick-clk-clk100mhz'));
    fireEvent.click(getByTestId('ide-project-map-quick-seg0-seg0'));

    expect(onFpgaConfigChange).toHaveBeenCalledWith({ top: 'lab_top' });
    expect(onFpgaConfigChange).toHaveBeenCalledWith({ part: 'xc7a100tcsg324-1' });
    expect(onUpdateMappingPin).toHaveBeenCalledWith('clk', 'CLK100MHZ');
    expect(onUpdateMappingPin).toHaveBeenCalledWith('seg0', 'SEG0');
    expect(getByTestId('ide-project-supported-scope-callout').textContent).toContain('FullAdder');
  });

  it('keeps export available on Project even when Verify has not been trusted yet', () => {
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

    expect(getByTestId('ide-project-readiness-summary').textContent).toContain('EXPORT AVAILABLE');
    expect(getByTestId('ide-project-readiness-summary').textContent).toContain(
      'Export can be opened now for file review'
    );
    expect(getByTestId('ide-project-dock-nav-export').textContent).toContain('Open now');
  });
});
