// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoardSignalProvider } from '../BoardSignalContext';
import { ProjectSurface, type ProjectSurfaceProps } from '../surfaces/ProjectSurface';

afterEach(cleanup);

function makeProps(): ProjectSurfaceProps {
  return {
    projectName: 'Half Adder Lab',
    description: 'Build and prove a one-bit half adder before mapping it to Basys3.',
    determinismHash: 'abc123def4567890',
    topModuleName: 'half_adder_top',
    lastSavedAt: new Date().toISOString(),
    simRunning: false,
    readiness: {
      hasCircuit: true,
      hasIoMapping: false,
      hasVectors: true,
      verifyPass: true,
      missingRequiredCount: 1,
    },
    health: {
      lastVerify: {
        status: 'pass',
        hash: 'verify-hash',
        reportHash: 'report-hash',
        ranAtIso: '2026-07-14T00:00:00.000Z',
      },
      lastExport: undefined,
      dirtySinceVerify: false,
      dirtySinceExport: false,
      blockingIssues: [],
    },
    mappingRows: [
      { id: 'a', label: 'A', port: 'A', direction: 'in', pin: 'V17', required: true },
      { id: 'b', label: 'B', port: 'B', direction: 'in', pin: 'V16', required: true },
      { id: 'sum', label: 'SUM', port: 'SUM', direction: 'out', pin: 'U16', required: true },
      { id: 'carry', label: 'CARRY', port: 'CARRY', direction: 'out', pin: '', required: true },
    ],
    examples: [],
    activeExampleId: null,
    onOpenExample: vi.fn(),
    primaryCtaLabel: 'Map Pins',
    primaryCta: { label: 'Map Pins', mode: 'hardware', code: 'RBP1001' },
    onPrimaryCta: vi.fn(),
    onUpdateMappingPin: vi.fn(),
    onAutoSuggestMapping: vi.fn(),
    onOpenDesign: vi.fn(),
    onOpenVerify: vi.fn(),
    onOpenExport: vi.fn(),
    onOpenHardware: vi.fn(),
    onOpenImport: vi.fn(),
    recentProjects: [
      {
        projectId: 'counter-lab',
        projectName: 'Counter Lab',
        savedAtIso: '2026-07-13T18:00:00.000Z',
        projectHash: 'counter-hash',
      },
    ],
    onOpenSavedProjects: vi.fn(),
    onOpenRecentProject: vi.fn(),
    onSaveNow: vi.fn(),
    saveState: 'unsaved',
    fpgaConfig: {
      board: 'Basys3',
      part: 'xc7a35tcpg236-1',
      top: 'half_adder_top',
    },
    onFpgaConfigChange: vi.fn(),
    outline: {
      nodeCount: 6,
      connectionCount: 4,
      boundaryInputCount: 2,
      boundaryOutputCount: 2,
      nodeTypeBreakdown: [
        { type: 'INPUT', count: 2 },
        { type: 'OUTPUT', count: 2 },
        { type: 'XOR', count: 1 },
        { type: 'AND', count: 1 },
      ],
      macros: [],
      customComponents: [],
      inputIoRows: [],
      outputIoRows: [],
    },
  };
}

describe('ProjectSurface Unified Workbench v3 overview', () => {
  it('shows the project workflow with one clear primary action and progressive disclosure', () => {
    const props = makeProps();
    const { container, getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...props} />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-identity-strip-title').textContent).toContain('Half Adder Lab');
    expect(getByTestId('ide-project-overview-summary').textContent).toContain('Build and prove');
    expect((getByTestId('ide-project-fpga-top') as HTMLInputElement).value).toBe('half_adder_top');
    expect(getByTestId('ide-project-overview-board').textContent).toBe('Basys3');
    expect(getByTestId('ide-project-overview-saved-state').textContent).toContain('Unsaved');

    expect(getByTestId('ide-project-summary-design').textContent).toContain('2 inputs and 2 outputs');
    expect(getByTestId('ide-project-design-io-summary').textContent).toContain('A, B');
    expect(getByTestId('ide-project-summary-verify').textContent).toContain('Latest Compare run matches');
    expect(getByTestId('ide-project-mapping-overview').textContent).toContain('CARRY');
    expect(getByTestId('ide-project-summary-export').textContent).toContain('Export remains blocked');
    expect(getByTestId('ide-project-recent-counter-lab').textContent).toContain('Counter Lab');

    expect(container.querySelectorAll('.ide-button-primary')).toHaveLength(1);
    expect(getByTestId('ide-project-command-strip-primary-cta').textContent).toContain('Map Pins');
    expect(container.querySelectorAll('details').length).toBeGreaterThan(0);
    expect(Array.from(container.querySelectorAll('summary')).map((summary) => summary.textContent)).toContain('Technical details');

    fireEvent.click(getByTestId('ide-project-command-strip-primary-cta'));
    expect(props.onPrimaryCta).toHaveBeenCalledTimes(1);
    fireEvent.click(getByTestId('ide-project-open-map-pins'));
    expect(props.onOpenHardware).toHaveBeenCalledTimes(1);
    fireEvent.click(getByTestId('ide-project-recent-counter-lab'));
    expect(props.onOpenRecentProject).toHaveBeenCalledWith('counter-lab');
  });

  it('keeps the first-run project entry direct with one primary path and ordinary sections', () => {
    const props = makeProps();
    props.readiness = {
      hasCircuit: false,
      hasIoMapping: false,
      hasVectors: false,
      verifyPass: false,
      missingRequiredCount: 0,
    };
    props.health = {
      lastVerify: undefined,
      lastExport: undefined,
      dirtySinceVerify: false,
      dirtySinceExport: false,
      blockingIssues: [],
    };
    props.examples = [
      {
        id: 'half-adder',
        name: 'Half Adder',
        summary: 'One-bit half adder starter.',
        expectedBehavior: 'SUM is XOR and CARRY is AND.',
        tags: ['starter'],
        course: 'Digital Logic',
        lab: 'Lab 1',
        concept: 'Combinational logic',
      },
    ];

    const { container, getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...props} />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-project-start-a-lab-primary').textContent).toContain('Start a Lab');
    expect(getByTestId('ide-project-build-fresh-primary').textContent).toContain('Build Fresh');
    expect(getByTestId('ide-project-import-primary').textContent).toContain('Import Project');
    expect(getByTestId('ide-project-recent-counter-lab').textContent).toContain('Counter Lab');
    expect(container.querySelectorAll('.ide-button-primary')).toHaveLength(1);
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('summary')).toBeNull();
  });

  it('uses a deterministic in-app confirmation before replacing populated work', () => {
    const props = makeProps();
    props.onStartBlankProject = vi.fn();
    const nativeConfirm = vi.spyOn(window, 'confirm');
    const { getByTestId, queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...props} />
      </BoardSignalProvider>
    );

    fireEvent.click(getByTestId('ide-project-change-project'));
    const buildFresh = getByTestId('ide-project-path-build-fresh');
    buildFresh.focus();
    fireEvent.click(buildFresh);

    const dialog = getByTestId('ide-project-build-fresh-dialog');
    expect(dialog.textContent).toContain('Start a new blank project?');
    expect(dialog.textContent).toContain('Your current project will remain unchanged until you confirm.');
    expect(dialog.textContent).toContain('Save or export it first if you need a backup.');
    expect(dialog.textContent).toContain('This workspace has unsaved changes.');
    expect(nativeConfirm).not.toHaveBeenCalled();
    expect(props.onStartBlankProject).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getByTestId('ide-project-build-fresh-cancel'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queryByTestId('ide-project-build-fresh-dialog')).toBeNull();
    expect(props.onStartBlankProject).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(buildFresh);

    nativeConfirm.mockRestore();
  });

  it('starts a blank project exactly once after explicit confirmation', () => {
    const props = makeProps();
    props.onStartBlankProject = vi.fn();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...props} />
      </BoardSignalProvider>
    );

    fireEvent.click(getByTestId('ide-project-change-project'));
    fireEvent.click(getByTestId('ide-project-path-build-fresh'));
    const confirm = getByTestId('ide-project-build-fresh-confirm');
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(props.onStartBlankProject).toHaveBeenCalledTimes(1);
  });
});
