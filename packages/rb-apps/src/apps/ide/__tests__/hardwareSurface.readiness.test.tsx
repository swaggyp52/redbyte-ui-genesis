// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ProjectHealth } from '../projectHealth';
import {
  deriveExportCurrent,
  deriveProjectWorkflowAuthority,
  deriveVerifyCurrent,
} from '../projectWorkflowAuthority';
import { buildCurrentVerifyProjectHash } from '../verifyProjectHash';
import { BoardSignalProvider } from '../BoardSignalContext';
import { HardwareSurface } from '../surfaces/HardwareSurface';

afterEach(() => {
  cleanup();
});

type HardwareSurfaceProps = React.ComponentProps<typeof HardwareSurface>;

const COMPLETE_MAPPING_ROWS: HardwareSurfaceProps['mappingRows'] = [
  {
    id: 'clk',
    label: 'CLK100MHZ',
    direction: 'in',
    pin: 'W5',
    required: true,
    timingRole: 'clock',
    boardResourceType: 'clock_pin',
  },
  {
    id: 'sw0',
    label: 'SW0',
    direction: 'in',
    pin: 'V17',
    required: true,
    boardResourceType: 'switch',
  },
  {
    id: 'ld0',
    label: 'LD0',
    direction: 'out',
    pin: 'U16',
    required: true,
    boardResourceType: 'led',
  },
];

function makeHealth(overrides: Partial<ProjectHealth> = {}): ProjectHealth {
  return {
    lastVerify: {
      status: 'pass',
      hash: 'verify-current-hash',
      reportHash: 'verify-report-hash',
      ranAtIso: '2026-03-08T00:00:00.000Z',
    },
    lastExport: {
      status: 'ok',
      hash: 'export-stale-hash',
      ranAtIso: '2026-03-08T00:10:00.000Z',
    },
    dirtySinceVerify: false,
    dirtySinceExport: true,
    blockingIssues: [
      {
        code: 'RBP2002',
        message: 'Project changed since last successful export.',
        fixPath: { mode: 'export', actionLabel: 'Build Submission Package' },
      },
    ],
    ...overrides,
  };
}

function makeHardwareWorkflowAuthority(
  health: ProjectHealth,
  overrides: {
    currentVerifyProjectHash?: string | null;
    currentExportHash?: string | null;
    hasIoMapping?: boolean;
    hasVectors?: boolean;
    hasBlockingDesignIssue?: boolean;
    blockingDesignIssueMessage?: string;
  } = {}
) {
  return deriveProjectWorkflowAuthority({
    projectHealthCore: health,
    readiness: {
      hasCircuit: true,
      hasIoMapping: overrides.hasIoMapping ?? true,
      hasVectors: overrides.hasVectors ?? true,
      hasBlockingDesignIssue: overrides.hasBlockingDesignIssue,
      blockingDesignIssueMessage: overrides.blockingDesignIssueMessage,
      verifyQualification: health.lastVerify?.qualification,
    },
    verifyLastRun: health.lastVerify,
    currentVerifyProjectHash: overrides.currentVerifyProjectHash,
    currentExportHash: overrides.currentExportHash,
  });
}

function makeVerifyRun(
  timingMode: 'synchronous_board_clock' | 'manual_event_driven_lab' | 'combinational',
  signalRoles: Record<string, 'clock' | 'reset' | 'input' | 'output'> = {}
) {
  return {
    scenarioId: `hardware-${timingMode}`,
    scenarioName: `Hardware ${timingMode}`,
    status: 'pass',
    deterministicHash: `det-${timingMode}`,
    reportHash: `rep-${timingMode}`,
    firstFailingTick: null,
    generatedAtIso: '2026-03-21T12:00:00.000Z',
    schedule: timingMode === 'combinational' ? 'combinational' : 'clocked_macro',
    scheduleContract: { timingMode },
    meta: {
      circuitKind: timingMode === 'combinational' ? 'combinational' : 'sequential',
      clockingProtocol: timingMode === 'combinational' ? 'none' : 'clocked_macro',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      clockSignalName: Object.entries(signalRoles).find(([, role]) => role === 'clock')?.[0],
    },
    report: {
      vectors: [],
      inputsAtTick: {},
      signalRoles,
      rows: [],
    },
    waveform: [],
  } as any;
}

function makeExportDiagnostic(
  code: string,
  title: string,
  message: string,
  actionLabel = 'Review diagnostic'
) {
  return {
    id: `diag-${code}`,
    code,
    title,
    message,
    hint: [],
    fix: message,
    severity: 'error' as const,
    owner: { kind: 'design' as const },
    actions: [{ label: actionLabel }],
    canonical: { id: `diag-${code}` } as any,
  } as any;
}

function renderHardware(overrides: Partial<HardwareSurfaceProps> = {}) {
  const health = overrides.health ?? makeHealth({ blockingIssues: [], dirtySinceExport: false });
  const props: HardwareSurfaceProps = {
    projectName: 'Hardware readiness fixture',
    expectedBehavior: 'Map pins, verify the design, and inspect the export handoff.',
    mappingRows: COMPLETE_MAPPING_ROWS,
    expectedIoRows: [],
    vectorsCount: 4,
    health,
    onGenerateBringUpVectors: vi.fn(),
    onOpenExport: vi.fn(),
    onOpenVerify: vi.fn(),
    ...overrides,
  };

  return render(
    <BoardSignalProvider>
      <HardwareSurface {...props} />
    </BoardSignalProvider>
  );
}

describe('HardwareSurface readiness', () => {
  it('renders the action-first mapping workspace without the superseded map rail or dock toggles', () => {
    const health = makeHealth({ blockingIssues: [], dirtySinceExport: false });
    const { getByTestId, queryByTestId } = renderHardware({
      health,
      workflowAuthority: makeHardwareWorkflowAuthority(health, {
        currentVerifyProjectHash: health.lastVerify?.hash ?? null,
        currentExportHash: health.lastExport?.hash ?? null,
      }),
    });

    const workspace = getByTestId('ide-hw-board-workspace');
    expect(workspace.textContent).toContain('Bind project signals to Basys3 resources');
    expect(getByTestId('ide-hardware-mapping-progress').textContent).toBe('MAPPING COMPLETE');
    expect(getByTestId('ide-hw-map-table')).toBeTruthy();
    expect(getByTestId('ide-hw-selected-mapping-editor')).toBeTruthy();
    expect(getByTestId('ide-hw-map-board')).toBeTruthy();
    expect(getByTestId('ide-hw-after-mapping-tools')).toBeTruthy();
    expect(getByTestId('ide-hw-workflow-ribbon')).toBeTruthy();
    expect(getByTestId('ide-hardware-dep-chain')).toBeTruthy();
    expect(getByTestId('ide-hardware-readiness-callout')).toBeTruthy();
    expect(getByTestId('ide-hw-map-row-ld0').textContent).toContain('LD0');
    expect(getByTestId('ide-hw-map-row-ld0').textContent).toContain('U16');
    expect(queryByTestId('ide-hw-stage-rail')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
    expect(queryByTestId('ide-workbench-console')).toBeNull();
  });

  it('makes mapping progress and the next unresolved signal immediately actionable', () => {
    const { getByTestId } = renderHardware({
      mappingRows: [
        { id: 'sw0', label: 'SW0', direction: 'in', pin: '', required: true, boardResourceType: 'switch' },
        { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16', required: true, boardResourceType: 'led' },
      ],
    });

    expect(getByTestId('ide-hardware-mapping-progress').textContent).toBe('1 / 2 REQUIRED MAPPED');
    expect(getByTestId('ide-hw-mapping-overview-assigned').textContent).toContain('1/2');
    expect(getByTestId('ide-hw-mapping-overview-unassigned').textContent).toContain('1');
    expect(getByTestId('ide-hw-mapping-overview-conflicts').textContent).toContain('0');
    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Assign SW0');

    fireEvent.click(getByTestId('ide-hw-select-next-mapping'));

    expect(getByTestId('ide-hw-map-row-sw0').getAttribute('aria-selected')).toBe('true');
    expect(getByTestId('ide-hw-selected-mapping-editor').textContent).toContain('SW0');
    expect(getByTestId('ide-hw-selected-mapping-status').textContent).toBe('Missing required');
  });

  it('treats export evidence as stale when mapping changes after export but verification is rerun', () => {
    const circuit = { nodes: [], connections: [] } as any;
    const vectors = [{ tick: 0, inputs: { in_a: '0' }, expected: { out_y: '0' } }] as any;
    const beforeRows = [
      { id: 'in_a', nodeId: 'in_a_node', port: 'out', label: 'in_a', direction: 'in', pin: 'V17', required: true },
      { id: 'out_y', nodeId: 'out_y_node', port: 'in', label: 'out_y', direction: 'out', pin: 'U16', required: true },
    ] as any;
    const afterRows = [
      { ...beforeRows[0] },
      { ...beforeRows[1], pin: 'E19' },
    ] as any;

    const exportedProjectHash = buildCurrentVerifyProjectHash({
      circuit,
      projectVectors: vectors,
      projectIoRows: beforeRows,
    });
    const verifiedProjectHash = buildCurrentVerifyProjectHash({
      circuit,
      projectVectors: vectors,
      projectIoRows: afterRows,
    });

    expect(verifiedProjectHash).not.toBe(exportedProjectHash);
    expect(
      deriveVerifyCurrent({
        hasVerifyRun: true,
        latestVerifyLedgerEntry: { projectHash: verifiedProjectHash },
        currentVerifyProjectHash: verifiedProjectHash,
        dirtySinceVerify: false,
      })
    ).toBe(true);
    expect(
      deriveExportCurrent({
        lastExport: {
          status: 'ok',
          hash: exportedProjectHash,
          ranAtIso: '2026-03-08T00:10:00.000Z',
        },
        currentExportHash: verifiedProjectHash,
        dirtySinceExport: true,
      })
    ).toBe(false);
  });

  it('keeps current Verify evidence distinct from a stale export bundle', () => {
    const { getByTestId } = renderHardware({ health: makeHealth() });

    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain(
      'no longer matches the current circuit'
    );
    expect(getByTestId('ide-hardware-dep-chain').textContent).toContain('Re-export needed');
    expect(getByTestId('ide-hardware-readiness-callout').textContent).not.toContain('BLOCKED');
  });

  it('does not call a required output assigned while its package pin is missing', () => {
    const { getByTestId } = renderHardware({
      mappingRows: [
        { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16', required: true, boardResourceType: 'led' },
        { id: 'ld1', label: 'LD1', direction: 'out', pin: '', required: true, boardResourceType: 'led' },
      ],
    });

    expect(getByTestId('ide-hw-map-row-status-ld0').textContent).toBe('Assigned');
    expect(getByTestId('ide-hw-map-row-status-ld1').textContent).toBe('Unassigned');
    expect(getByTestId('ide-hardware-mapping-progress').textContent).toBe('1 / 2 REQUIRED MAPPED');
  });

  it('routes an empty project boundary back to Design', () => {
    const onGoToDesign = vi.fn();
    const { getByTestId, queryByTestId } = renderHardware({
      mappingRows: [],
      vectorsCount: 0,
      health: makeHealth({
        lastVerify: undefined,
        lastExport: undefined,
        dirtySinceVerify: false,
        dirtySinceExport: false,
        blockingIssues: [],
      }),
      onGoToDesign,
    });

    expect(getByTestId('ide-hw-map-empty').textContent).toContain('No signals to map yet');
    expect(getByTestId('ide-hw-map-empty').textContent).toContain('Design');
    expect(queryByTestId('ide-hw-map-table')).toBeNull();
    fireEvent.click(getByTestId('ide-hardware-next-primary'));
    expect(onGoToDesign).toHaveBeenCalledTimes(1);
  });

  it('treats a combinational project as mapping-complete without a clock row', () => {
    const { getByTestId } = renderHardware({
      mappingRows: [
        { id: 'sw0', label: 'SW0', direction: 'in', pin: 'V17', required: true, boardResourceType: 'switch' },
        { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16', required: true, boardResourceType: 'led' },
      ],
      verifyLastRun: makeVerifyRun('combinational', { sw0: 'input', ld0: 'output' }),
    });

    expect(getByTestId('ide-hardware-mapping-progress').textContent).toBe('MAPPING COMPLETE');
    expect(getByTestId('ide-hw-mapping-overview-unassigned').textContent).toContain('0');
  });

  it('requires the board clock row for a synchronous board-clock project', () => {
    const { getByTestId } = renderHardware({
      mappingRows: [
        { id: 'phase_driver', label: 'phase_driver', direction: 'in', pin: '', required: true, timingRole: 'clock' },
        { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16', required: true, boardResourceType: 'led' },
      ],
      verifyLastRun: makeVerifyRun('synchronous_board_clock', {
        phase_driver: 'clock',
        ld0: 'output',
      }),
    });

    expect(getByTestId('ide-hardware-mapping-progress').textContent).toBe('1 / 2 REQUIRED MAPPED');
    expect(getByTestId('ide-hw-map-row-status-phase_driver').textContent).toBe('Unassigned');
    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Assign PHASE_DRIVER');
  });

  it('does not require a board oscillator for a manual-event lab', () => {
    const { getByTestId } = renderHardware({
      mappingRows: [
        { id: 'step', label: 'STEP', direction: 'in', pin: 'V17', required: true, boardResourceType: 'switch' },
        { id: 'q', label: 'Q', direction: 'out', pin: 'U16', required: true, boardResourceType: 'led' },
      ],
      verifyLastRun: makeVerifyRun('manual_event_driven_lab', { step: 'input', q: 'output' }),
    });

    expect(getByTestId('ide-hardware-mapping-progress').textContent).toBe('MAPPING COMPLETE');
    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Ready for export');
  });

  it('uses semantic Verify roles for non-regex clock signal names', () => {
    const { getByTestId } = renderHardware({
      mappingRows: [
        { id: 'phase_driver', label: 'phase_driver', direction: 'in', pin: 'W5', required: true },
        { id: 'data_in', label: 'data_in', direction: 'in', pin: 'V17', required: true },
        { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16', required: true },
      ],
      verifyLastRun: makeVerifyRun('synchronous_board_clock', {
        phase_driver: 'clock',
        data_in: 'input',
        ld0: 'output',
      }),
    });

    expect(getByTestId('ide-hardware-mapping-progress').textContent).toBe('MAPPING COMPLETE');
    expect(getByTestId('ide-hw-map-row-status-phase_driver').textContent).toBe('Assigned');
  });

  it('edits one selected signal through the direct Basys3 resource control', () => {
    const onSetMappingPin = vi.fn();
    const { getByTestId, queryByText } = renderHardware({
      mappingRows: [
        {
          id: 'iom-in0',
          label: 'IN0',
          direction: 'in',
          pin: 'V17',
          required: true,
          boardResourceType: 'switch',
        },
      ],
      onSetMappingPin,
    });

    const row = getByTestId('ide-hw-map-row-iom-in0');
    expect(row.textContent).toContain('IN0');
    expect(row.textContent).toContain('SW0');
    expect(row.textContent).toContain('V17');
    expect(queryByText('iom-in0')).toBeNull();

    fireEvent.click(getByTestId('ide-hw-map-row-action-iom-in0'));
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(getByTestId('ide-hardware-basys3-binding-chain').textContent).toContain('IN0');
    expect(getByTestId('ide-hardware-basys3-binding-chain').textContent).toContain('SW0');
    expect(getByTestId('ide-hardware-basys3-binding-xdc').textContent).toContain('PACKAGE_PIN V17');

    fireEvent.change(getByTestId('ide-hw-direct-resource-select'), { target: { value: 'SW1' } });
    expect(getByTestId('ide-hw-selected-mapping-consequence').textContent).toContain('pin V16');
    fireEvent.click(getByTestId('ide-hw-assign-selected-resource'));
    expect(onSetMappingPin).toHaveBeenCalledWith('iom-in0', 'V16');
  });

  it('keeps signal identity, purpose, board resource, package pin, status, and action distinct', () => {
    const { getByTestId } = renderHardware();
    const row = getByTestId('ide-hw-map-row-clk');

    expect(getByTestId('ide-hw-map-row-signal-clk').textContent).toBe('CLK100MHZ');
    expect(getByTestId('ide-hw-map-row-role-clk').textContent).toContain('Circuit input');
    expect(getByTestId('ide-hw-map-row-role-clk').textContent).toContain('Role: clock');
    expect(getByTestId('ide-hw-map-row-binding-clk').textContent).toContain('CLK100MHZ');
    expect(row.textContent).toContain('W5');
    expect(getByTestId('ide-hw-map-row-status-clk').textContent).toBe('Assigned');
    expect(getByTestId('ide-hw-map-row-action-clk').textContent).toBe('Edit mapping');
  });

  it('surfaces duplicate package pins as conflicts before export', () => {
    const { getByTestId } = renderHardware({
      mappingRows: [
        { id: 'a', label: 'A', direction: 'in', pin: 'V17', required: true, boardResourceType: 'switch' },
        { id: 'b', label: 'B', direction: 'in', pin: 'V17', required: true, boardResourceType: 'switch' },
        { id: 'y', label: 'Y', direction: 'out', pin: 'U16', required: true, boardResourceType: 'led' },
      ],
    });

    expect(getByTestId('ide-hw-mapping-overview-conflicts').textContent).toContain('2');
    expect(getByTestId('ide-hw-map-row-status-a').textContent).toBe('Conflict');
    expect(getByTestId('ide-hw-map-row-status-b').textContent).toBe('Conflict');
    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Resolve A');

    fireEvent.click(getByTestId('ide-hw-select-next-mapping'));
    expect(getByTestId('ide-hw-selected-mapping-conflict')).toBeTruthy();
  });

  it('asks for Verify evidence without describing an unbuilt export bundle as blocked', () => {
    const { getByTestId } = renderHardware({
      health: makeHealth({
        lastVerify: undefined,
        lastExport: undefined,
        dirtySinceVerify: false,
        dirtySinceExport: false,
        blockingIssues: [],
      }),
      vectorsCount: 0,
    });

    const readiness = getByTestId('ide-hardware-readiness-callout');
    expect(readiness.textContent).toContain('Run Verify before relying on this handoff');
    expect(readiness.textContent).toContain('Open Verify before you rely on the hardware or export handoff');
    expect(readiness.textContent).not.toContain('BLOCKED');
    expect(getByTestId('ide-hardware-dep-chain').textContent).toContain('Build needed');
  });

  it('keeps ready status at E0 and leaves Vivado, bitstream, and board proof external', () => {
    const health = makeHealth({ blockingIssues: [], dirtySinceExport: false });
    const { getByTestId } = renderHardware({
      health,
      workflowAuthority: makeHardwareWorkflowAuthority(health, {
        currentVerifyProjectHash: health.lastVerify?.hash ?? null,
        currentExportHash: health.lastExport?.hash ?? null,
      }),
    });

    const readiness = getByTestId('ide-hardware-readiness-callout');
    expect(readiness.textContent).toContain('E0 handoff ready');
    expect(readiness.textContent).toContain('external E1/E2/E3 evidence');
    expect(getByTestId('ide-hardware-dep-chain').textContent).toContain('Vivado proof pending');

    fireEvent.click(getByTestId('ide-hw-mode-btn-proof'));
    const handoff = getByTestId('ide-hardware-program-handoff-cta');
    expect(handoff.textContent).toContain('Vivado project ZIP');
    expect(handoff.textContent).toContain('Generate Bitstream');
    expect(handoff.textContent).toContain('Hardware Manager');
    expect(handoff.textContent).toContain('Program Device');
    expect(getByTestId('ide-hardware-submission-hint').textContent).toContain('export ZIP');
  });

  it('routes a current structural Design blocker back to Design instead of Export', () => {
    const onGoToDesign = vi.fn();
    const health = makeHealth({
      blockingIssues: [
        {
          code: 'RBP1006',
          message: 'Output LD2 is not driven by the circuit.',
          fixPath: { mode: 'design', actionLabel: 'Open Design' },
        },
      ],
      dirtySinceExport: false,
    });
    const { getByTestId, queryByTestId } = renderHardware({ health, onGoToDesign });

    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Design blocked');
    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Repair the circuit in Design');
    expect(queryByTestId('ide-hw-continue-export')).toBeNull();
    fireEvent.click(getByTestId('ide-hw-open-design-blocker'));
    expect(onGoToDesign).toHaveBeenCalledTimes(1);
  });

  it('keeps mapping-owned Export diagnostics out of a duplicated technical wall', () => {
    const onOpenExport = vi.fn();
    const onGoToDesign = vi.fn();
    const diagnostic = {
      ...makeExportDiagnostic(
        'RBEX1001',
        'Port mismatch',
        'Required input port SW0 has no mapping.',
        'Review mapping'
      ),
      port: 'sw0',
      owner: { kind: 'mapping' as const, portName: 'sw0' },
    } as any;
    const { getByTestId, queryByTestId } = renderHardware({
      mappingRows: [
        { id: 'sw0', label: 'SW0', direction: 'in', pin: '', required: true, nodeId: 'n1', port: 'out' },
      ],
      onOpenExport,
      onGoToDesign,
      exportViewStatus: 'blocked',
      exportBlockingDiagnostics: [diagnostic],
    });

    expect(queryByTestId('ide-hw-export-repair-callout')).toBeNull();
    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Assign SW0');
    fireEvent.click(getByTestId('ide-hw-select-next-mapping'));
    expect(getByTestId('ide-hw-selected-mapping-editor').textContent).toContain('SW0');
    expect(onOpenExport).not.toHaveBeenCalled();
    expect(onGoToDesign).not.toHaveBeenCalled();
  });

  it('treats RBEX4200 as a soft timing advisory for a manual-event lab', () => {
    const onGoToDesign = vi.fn();
    const onRepairExportDiagnostic = vi.fn();
    const diagnostic = makeExportDiagnostic(
      'RBEX4200',
      'Board clock not selected',
      'This lab advances state through a manual event input.',
      'Review timing guidance'
    );
    const { getByTestId, queryByTestId } = renderHardware({
      mappingRows: [
        { id: 'step', label: 'STEP', direction: 'in', pin: 'V17', required: true },
        { id: 'q', label: 'Q', direction: 'out', pin: 'U16', required: true },
      ],
      verifyLastRun: makeVerifyRun('manual_event_driven_lab', { step: 'input', q: 'output' }),
      exportViewStatus: 'blocked',
      exportBlockingDiagnostics: [diagnostic],
      onGoToDesign,
      onRepairExportDiagnostic,
    });

    expect(queryByTestId('ide-hw-export-repair-callout')).toBeNull();
    expect(getByTestId('ide-hw-mapping-next-action').textContent).not.toContain('Design blocked');
    expect(onRepairExportDiagnostic).not.toHaveBeenCalled();
    expect(onGoToDesign).not.toHaveBeenCalled();
  });

  it('treats RBEX4200 as Design-owned for a synchronous board-clock project', () => {
    const onGoToDesign = vi.fn();
    const onRepairExportDiagnostic = vi.fn();
    const diagnostic = makeExportDiagnostic(
      'RBEX4200',
      'Board clock is missing',
      'A synchronous board-clock design requires an explicit clock source.',
      'Review timing guidance'
    );
    const { getByTestId, queryByTestId } = renderHardware({
      mappingRows: [
        { id: 'phase_driver', label: 'phase_driver', direction: 'in', pin: '', required: true, timingRole: 'clock' },
        { id: 'q', label: 'Q', direction: 'out', pin: 'U16', required: true },
      ],
      verifyLastRun: makeVerifyRun('synchronous_board_clock', {
        phase_driver: 'clock',
        q: 'output',
      }),
      exportViewStatus: 'blocked',
      exportBlockingDiagnostics: [diagnostic],
      onGoToDesign,
      onRepairExportDiagnostic,
    });

    expect(queryByTestId('ide-hw-export-repair-callout')).toBeNull();
    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Assign PHASE_DRIVER');
    expect(onGoToDesign).not.toHaveBeenCalled();
    expect(onRepairExportDiagnostic).not.toHaveBeenCalled();
  });

  it('routes a mapped but undriven output to Design instead of calling it a mapping issue', () => {
    const onGoToDesign = vi.fn();
    const onRepairExportDiagnostic = vi.fn();
    const diagnostic = makeExportDiagnostic(
      'RBEX4103',
      'Floating output',
      'Output port LD2 has no driver.',
      'Review diagnostic'
    );
    const { getByTestId, queryByTestId } = renderHardware({
      exportViewStatus: 'blocked',
      exportBlockingDiagnostics: [diagnostic],
      onGoToDesign,
      onRepairExportDiagnostic,
    });

    expect(getByTestId('ide-hardware-mapping-progress').textContent).toBe('MAPPING COMPLETE');
    expect(queryByTestId('ide-hw-export-repair-callout')).toBeNull();
    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Design blocked');
    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Repair the circuit in Design');
    fireEvent.click(getByTestId('ide-hw-open-design-blocker'));
    expect(onGoToDesign).toHaveBeenCalledTimes(1);
    expect(onRepairExportDiagnostic).not.toHaveBeenCalled();
  });

  it('orders mapping summary, assignment workspace, after-mapping tools, and handoff ribbon', () => {
    const { getByTestId } = renderHardware();
    const summary = getByTestId('ide-hw-board-resource-summary');
    const table = getByTestId('ide-hw-map-table');
    const afterMapping = getByTestId('ide-hw-after-mapping-tools');
    const ribbon = getByTestId('ide-hw-workflow-ribbon');

    expect(summary.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(table.compareDocumentPosition(afterMapping) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(afterMapping.compareDocumentPosition(ribbon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
