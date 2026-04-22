// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { ProjectSurface, type ProjectSurfaceProps } from '../surfaces/ProjectSurface';
import { BoardSignalProvider } from '../BoardSignalContext';

function makeProps(overrides: Partial<ProjectSurfaceProps> = {}): ProjectSurfaceProps {
  return {
    projectName: 'Map UX',
    description: '',
    determinismHash: 'hash',
    topModuleName: 'top',
    lastSavedAt: '2026-04-21T12:00:00Z',
    simRunning: false,
    readiness: {
      hasCircuit: true,
      hasIoMapping: false,
      hasVectors: true,
      verifyPass: true,
      missingRequiredCount: 2,
    },
    health: {
      lastVerify: {
        status: 'pass',
        hash: 'verify-hash',
        reportHash: 'report-hash',
        ranAtIso: '2026-04-21T12:00:00.000Z',
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
    primaryCtaLabel: 'Map Pins',
    primaryCta: { label: 'Map Pins', mode: 'hardware', code: 'RBP1000' },
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

describe('ProjectSurface — mapping legitimacy (trust + workflow)', () => {
  it('shows pipeline header, export alignment, and post-verify hint when mapping incomplete after verify', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            mappingRows: [
              {
                id: 'clk',
                nodeId: 'clk_n',
                label: 'ENTER CLK',
                direction: 'in',
                pin: '',
                required: true,
                port: 'clk',
                timingRole: 'clock',
              },
            ],
          })}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-map-pins-header').textContent).toContain('Board pin mapping');
    expect(getByTestId('ide-project-map-pipeline-copy').textContent).toContain('Export and Hardware');
    expect(getByTestId('ide-project-map-export-alignment').textContent).toMatch(/Export/i);
    expect(getByTestId('ide-project-mapping-post-verify-hint').textContent).toContain('verified');
  });

  it('flags required vs optional, applies row emphasis classes, and shows role + clock tag', () => {
    const { container, getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            mappingRows: [
              {
                id: 'a',
                nodeId: 'a_n',
                label: 'CLK_IN',
                direction: 'in',
                pin: '',
                required: true,
                port: 'clk',
              },
              {
                id: 'b',
                nodeId: 'b_n',
                label: 'DBG',
                direction: 'out',
                pin: 'U16',
                required: false,
                port: 'dbg',
              },
              {
                id: 'c',
                nodeId: 'c_n',
                label: 'BUS',
                direction: 'in',
                pin: '',
                required: true,
                port: 'bus',
                mappingKind: 'bus',
              },
            ],
            ioSignalRolesByLabel: { CLK_IN: 'clock' },
          })}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-map-req-clk_in').textContent).toContain('Required');
    expect(getByTestId('ide-project-map-req-dbg').textContent).toContain('Optional');
    expect(getByTestId('ide-project-role-clk_in').textContent).toContain('Clock');

    const actionRow = container.querySelector('tr.ide-project-map-row--action');
    expect(actionRow).toBeTruthy();
    expect(container.querySelector('tr.ide-project-map-row--locked')).toBeTruthy();
  });

  it('shows persistence feedback after a scalar pin edit', () => {
    const onUpdateMappingPin = vi.fn();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            mappingRows: [
              {
                id: 'sw',
                nodeId: 'sw_n',
                label: 'SW0',
                direction: 'in',
                pin: '',
                required: true,
                port: 'sw',
              },
            ],
            onUpdateMappingPin,
          })}
        />
      </BoardSignalProvider>
    );

    const input = getByTestId('ide-project-map-input-sw0') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'V17' } });

    expect(onUpdateMappingPin).toHaveBeenCalledWith('sw', 'V17');
    expect(getByTestId('ide-project-mapping-saved-feedback').textContent).toContain('Saved');
  });
});
