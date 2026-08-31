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
    primaryCtaLabel: 'Board & Constraints',
    primaryCta: { label: 'Board & Constraints', mode: 'hardware', code: 'RBP1000' },
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
  it('shows Board & Constraints and the post-simulation hint without a duplicate Build & Export strip', () => {
    const { getByTestId, queryByTestId } = render(
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

    expect(getByTestId('ide-project-map-pins-header').textContent).toContain('Board assignments');
    expect(getByTestId('ide-project-map-pipeline-copy').textContent).toContain('building the Vivado package');
    expect(queryByTestId('ide-project-map-export-alignment')).toBeNull();
    expect(getByTestId('ide-project-mapping-post-verify-hint').textContent).toContain('verified');
  });

  it('summarizes missing mappings without rendering a second pin editor', () => {
    const { getByTestId, queryByTestId } = render(
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

    expect(getByTestId('ide-project-mapping-overview').textContent).toContain(
      '2 required signals still need a board resource'
    );
    expect(getByTestId('ide-project-mapping-missing-list').textContent).toContain('CLK_IN');
    expect(getByTestId('ide-project-mapping-missing-list').textContent).toContain('BUS');
    expect(queryByTestId('ide-project-mapping-table')).toBeNull();
    expect(queryByTestId('ide-project-mapping-expand-btn')).toBeNull();
    expect(queryByTestId('ide-project-map-req-clk_in')).toBeNull();
  });

  it('keeps Project mapping rows read-only and routes the student to Board & Constraints', () => {
    const onOpenHardware = vi.fn();
    const onUpdateMappingPin = vi.fn();
    const { getByTestId, queryByTestId } = render(
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
            onOpenHardware,
            onUpdateMappingPin,
          })}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-mapping-overview').textContent).toContain('SW0');
    expect(queryByTestId('ide-project-pin-field-sw0')).toBeNull();
    expect(queryByTestId('ide-project-map-input-sw0')).toBeNull();
    expect(queryByTestId('ide-project-mapping-table')).toBeNull();

    fireEvent.click(getByTestId('ide-project-open-map-pins'));
    expect(onOpenHardware).toHaveBeenCalledTimes(1);
    expect(onUpdateMappingPin).not.toHaveBeenCalled();
  });
});
