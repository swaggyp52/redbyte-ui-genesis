// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { BoardSignalProvider } from '../BoardSignalContext';
import { HardwareSurface } from '../surfaces/HardwareSurface';
import type { ProjectHealth } from '../projectHealth';
import { deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';

afterEach(() => {
  cleanup();
});

function makeHealth(overrides: Partial<ProjectHealth> = {}): ProjectHealth {
  return {
    lastVerify: {
      status: 'pass',
      hash: 'verify-hash',
      reportHash: 'verify-report-hash',
      ranAtIso: '2026-03-08T00:00:00.000Z',
    },
    lastExport: {
      status: 'ok',
      hash: 'export-hash',
      ranAtIso: '2026-03-08T00:10:00.000Z',
    },
    dirtySinceVerify: false,
    dirtySinceExport: false,
    blockingIssues: [],
    ...overrides,
  };
}

function makeAuthority(health: ProjectHealth) {
  const designBlocker = health.blockingIssues.find((issue) => issue.code === 'RBP1006');
  return deriveProjectWorkflowAuthority({
    projectHealthCore: health,
    readiness: {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      hasBlockingDesignIssue: Boolean(designBlocker),
      blockingDesignIssueMessage: designBlocker?.message,
      verifyQualification: health.lastVerify?.qualification,
    },
    verifyLastRun: health.lastVerify,
    currentVerifyProjectHash: health.lastVerify?.hash ?? null,
    currentExportHash: health.lastExport?.hash ?? null,
  });
}

const BASE_ROWS = [
  { id: 'sw0', label: 'sw0', direction: 'in' as const, pin: 'V17', required: true },
  { id: 'ld0', label: 'ld0', direction: 'out' as const, pin: 'U16', required: true },
];

describe('HardwareSurface — mapping workflow primitives', () => {
  it('uses one headerless panel wrapper and a workspace-owned Map Pins header', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="AND Gate"
          expectedBehavior="sw0 drives ld0."
          mappingRows={BASE_ROWS}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hardware-panel').querySelector('[data-testid="ide-panel-title-row"]')).toBeNull();
    expect(getByTestId('ide-hardware-panel').querySelector('[data-testid="ide-hardware-command-strip"]')).toBeNull();
    expect(getByTestId('ide-hw-board-resource-summary').textContent).toContain(
      'Map a logical signal to a Basys3 control'
    );
  });

  it('shows Complete state and full count when all required signals are mapped', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Full Mapping"
          expectedBehavior="All mapped."
          mappingRows={BASE_ROWS}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hardware-mapping-progress').textContent).toBe('MAPPING COMPLETE');
    expect(getByTestId('ide-hw-map-table').getAttribute('data-work-priority')).toBe('primary');
    expect(getByTestId('ide-hw-mapping-overview-unassigned').textContent).toContain(
      'all required mappings assigned'
    );
  });

  it('shows Incomplete state when a required signal has no pin', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Partial Mapping"
          expectedBehavior="ld0 needs a pin."
          mappingRows={[
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: '', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hardware-mapping-progress').textContent).toContain('1 / 2 REQUIRED MAPPED');
    expect(getByTestId('ide-hw-map-row-status-ld0').textContent).toContain('Unassigned');
  });

  it('shows one task-first Open Design action when no boundary rows exist', () => {
    const health = makeHealth();
    const onGoToDesign = vi.fn();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Empty Design"
          expectedBehavior="No signals yet."
          mappingRows={[]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          onGoToDesign={onGoToDesign}
        />
      </BoardSignalProvider>
    );

    const emptyState = getByTestId('ide-hw-map-empty');
    expect(emptyState.textContent).toContain('No signals to map yet');
    expect(emptyState.querySelectorAll('button')).toHaveLength(1);
    expect(getByTestId('ide-hardware-next-primary').textContent).toBe('Open Design');
    fireEvent.click(getByTestId('ide-hardware-next-primary'));
    expect(onGoToDesign).toHaveBeenCalledTimes(1);
  });

  it('makes the semantic mapping table the first work object and demotes later modes', () => {
    // Guide is shown during active mapping work; it collapses once all required signals are bound.
    // Use an incomplete row set (ld0 has no pin yet) to preserve this test after the F-H2 fix.
    const health = makeHealth();
    const incompleteRows = [
      { id: 'sw0', label: 'sw0', direction: 'in' as const, pin: 'V17', required: true },
      { id: 'ld0', label: 'ld0', direction: 'out' as const, pin: '', required: true },
    ];
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Guide Check"
          expectedBehavior="Test guide steps."
          mappingRows={incompleteRows}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    const table = getByTestId('ide-hw-map-table');
    expect(table.getAttribute('data-columns')).toBe('Logical signal|Purpose|Board resource|Package pin|Status|Action');
    expect(table.textContent).toContain('Logical signal');
    expect(table.textContent).toContain('Purpose');
    expect(table.textContent).toContain('Board resource');
    const afterMapping = getByTestId('ide-hw-after-mapping-tools');
    expect(afterMapping.tagName).toBe('SECTION');
    expect(afterMapping.querySelector('details, summary')).toBeNull();
    expect(table.compareDocumentPosition(afterMapping) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('groups the primary mapping table into clock/reset, inputs, and outputs', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Grouped Counter Mapping"
          expectedBehavior="Counter controls and outputs stay visibly separated."
          mappingRows={[
            { id: 'clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5', required: true, timingRole: 'clock' },
            { id: 'rst', label: 'RST', direction: 'in', pin: 'BTNC', required: true, timingRole: 'reset' },
            { id: 'en', label: 'EN', direction: 'in', pin: 'SW0', required: true, timingRole: 'enable' },
            { id: 'ld0', label: 'LD0', direction: 'out', pin: 'LD0', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    const clockReset = getByTestId('ide-hw-map-group-clock-reset');
    const inputs = getByTestId('ide-hw-map-group-inputs');
    const outputs = getByTestId('ide-hw-map-group-outputs');

    expect(clockReset.textContent).toContain('Clock / Reset2 signals');
    expect(clockReset.querySelector('[data-testid="ide-hw-map-row-clk"]')).toBeTruthy();
    expect(clockReset.querySelector('[data-testid="ide-hw-map-row-rst"]')).toBeTruthy();
    expect(inputs.textContent).toContain('Inputs1 signal');
    expect(inputs.querySelector('[data-testid="ide-hw-map-row-en"]')).toBeTruthy();
    expect(outputs.textContent).toContain('Outputs1 signal');
    expect(outputs.querySelector('[data-testid="ide-hw-map-row-ld0"]')).toBeTruthy();
  });

  it('keeps the board as a secondary reference after the mapping table', () => {
    // Guide renders during active mapping (at least one row unmapped).
    // Use incomplete rows so mappingReady is false and guide is visible.
    const health = makeHealth();
    const incompleteRows = [
      { id: 'sw0', label: 'sw0', direction: 'in' as const, pin: 'V17', required: true },
      { id: 'ld0', label: 'ld0', direction: 'out' as const, pin: '', required: true },
    ];
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Step 1 Active"
          expectedBehavior="Step 1 should be active."
          mappingRows={incompleteRows}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    const table = getByTestId('ide-hw-map-table');
    const board = getByTestId('ide-hw-map-board');
    expect(board.getAttribute('data-work-priority')).toBe('reference');
    expect(table.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(getByTestId('ide-hw-board-task-copy').textContent).toContain('resource selector');
  });

  it('updates the visible signal-to-board-to-pin chain after a mapped row is selected', () => {
    // Use incomplete rows so guide renders (guide collapses when all rows are fully mapped).
    // sig-out0 has no pin so mappingReady is false — guide is visible during active mapping.
    const health = makeHealth();
    const onSetMappingPin = vi.fn();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Row Click Updates Guide"
          expectedBehavior="Clicking a row updates the guide."
          mappingRows={[
            { id: 'sig-in0', label: 'sig-in0', direction: 'in', pin: 'V17', required: true },
            { id: 'sig-out0', label: 'sig-out0', direction: 'out', pin: '', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          onSetMappingPin={onSetMappingPin}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getByTestId('ide-hw-map-row-sig-in0'));
    expect(getByTestId('ide-hardware-basys3-binding-chain').textContent).toContain('SIG-IN0');
    expect(getByTestId('ide-hardware-chain-board').textContent).toContain('SW0');
    expect(getByTestId('ide-hardware-chain-pin').textContent).toContain('V17');
  });

  it('labels logical and artifact-port identity separately without re-sanitizing EN', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Divergent semantic mapping"
          expectedBehavior="EN controls the generated switch port."
          mappingRows={[
            { id: 'en', label: 'SW0', direction: 'in', pin: 'SW0', required: true },
          ]}
          mappingProjection={[
            {
              logicalSignalId: 'en',
              logicalLabel: 'EN',
              direction: 'in',
              artifactPortName: 'SW',
              boardResourceId: 'switch-0',
              boardResourceLabel: 'Slide switch SW0',
              packagePin: 'V17',
              ioStandard: 'LVCMOS33',
              exactXdcLine: 'set_property PACKAGE_PIN V17 [get_ports {SW}]',
              required: true,
              conflictState: 'none',
            },
          ]}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-map-row-signal-en').textContent).toBe('ENArtifact port: SW');
    expect(getByTestId('ide-hw-map-row-binding-en').textContent).toBe('Slide switch SW0');
    fireEvent.click(getByTestId('ide-hw-map-row-en'));
    expect(getByTestId('ide-hardware-chain-artifact').textContent).toContain('SW');
    expect(getByTestId('ide-hardware-basys3-binding-xdc').textContent).toContain(
      'set_property PACKAGE_PIN V17 [get_ports {SW}]'
    );
  });

  it('keeps projection conflicts out of the overall Mapping Complete state', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Projection conflict"
          expectedBehavior="Every projected binding must be valid."
          mappingRows={BASE_ROWS}
          mappingProjection={[
            {
              logicalSignalId: 'sw0',
              logicalLabel: 'SW0',
              direction: 'in',
              artifactPortName: 'SW',
              boardResourceId: 'switch-0',
              boardResourceLabel: 'Slide switch SW0',
              packagePin: 'V17',
              ioStandard: 'LVCMOS33',
              exactXdcLine: 'set_property PACKAGE_PIN V17 [get_ports {SW}]',
              required: true,
              conflictState: 'direction-mismatch',
            },
            {
              logicalSignalId: 'ld0',
              logicalLabel: 'LD0',
              direction: 'out',
              artifactPortName: 'LED',
              boardResourceId: 'led-0',
              boardResourceLabel: 'LED LD0',
              packagePin: 'U16',
              ioStandard: 'LVCMOS33',
              exactXdcLine: 'set_property PACKAGE_PIN U16 [get_ports {LED}]',
              required: true,
              conflictState: 'none',
            },
          ]}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hardware-mapping-progress').textContent).not.toContain('MAPPING COMPLETE');
    expect(getByTestId('ide-hw-mapping-overview-conflicts').textContent).toContain('1');
    expect(getByTestId('ide-hw-map-row-status-sw0').textContent).toContain('Conflict');
  });

  it('turns the next unresolved row into a direct, explicit Basys3 assignment task', () => {
    const health = makeHealth();
    const onSetMappingPin = vi.fn();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Direct Assignment"
          expectedBehavior="Assign the output without hunting through the board reference."
          mappingRows={[
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: '', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          onSetMappingPin={onSetMappingPin}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-mapping-overview-assigned').textContent).toContain('1/2');
    expect(getByTestId('ide-hw-mapping-overview-unassigned').textContent).toContain('1');
    fireEvent.click(getByTestId('ide-hw-select-next-mapping'));

    expect(getByTestId('ide-hw-selected-mapping-editor').textContent).toContain('LD0');
    expect(getByTestId('ide-hw-selected-mapping-status').textContent).toBe('Missing required');
    fireEvent.change(getByTestId('ide-hw-direct-resource-select'), { target: { value: 'LD1' } });
    fireEvent.click(getByTestId('ide-hw-assign-selected-resource'));
    expect(onSetMappingPin).toHaveBeenCalledWith('ld0', 'E19');
    expect(getByTestId('ide-hw-selected-mapping-consequence').textContent).toContain('package pin E19');
  });

  it('counts one missing mapping once when the row and Export report the same gap', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Five Signal Mapping"
          expectedBehavior="Four signals are assigned; ld1 still needs a resource."
          mappingRows={[
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
            { id: 'sw1', label: 'sw1', direction: 'in', pin: 'V16', required: true },
            { id: 'sw2', label: 'sw2', direction: 'in', pin: 'W16', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
            { id: 'ld1', label: 'ld1', direction: 'out', pin: '', required: true },
          ]}
          missingRequiredPortsFromExport={1}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          onSetMappingPin={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-mapping-overview-assigned').textContent).toContain('4/5');
    const unassigned = getByTestId('ide-hw-mapping-overview-unassigned');
    expect(unassigned.querySelector('strong')?.textContent).toBe('1');
    expect(unassigned.textContent).toContain('mapping needs a resource');
  });

  it('keeps mapping-owned diagnostics in the row editor instead of a technical wall', () => {
    const health = makeHealth();
    const { getByTestId, queryByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Available Resource Guidance"
          expectedBehavior="ld1 must use a free LED resource."
          mappingRows={[
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
            { id: 'ld1', label: 'ld1', direction: 'out', pin: '', required: true },
          ]}
          missingRequiredPortsFromExport={1}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          onSetMappingPin={vi.fn()}
          exportViewStatus="blocked"
          exportBlockingDiagnostics={[
            {
              id: 'rbex-ld1-unmapped',
              code: 'RBEX1001',
              title: 'Unmapped required port',
              message: 'Unmapped required output port "ld1". Fix: map "ld1" to "LD0 / U16".',
              hint: ['map "ld1" to "LD0 / U16".'],
              fix: 'map "ld1" to "LD0 / U16".',
              port: 'ld1',
              severity: 'error',
              owner: { kind: 'mapping', mappingKey: 'ld1', portName: 'ld1' },
              actions: [],
              canonical: { id: 'rbex-ld1-unmapped' } as any,
            },
          ]}
        />
      </BoardSignalProvider>
    );

    expect(queryByTestId('ide-hw-export-repair-callout')).toBeNull();
    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Assign LD1');

    fireEvent.click(getByTestId('ide-hw-select-next-mapping'));
    const resourceSelect = getByTestId('ide-hw-direct-resource-select') as HTMLSelectElement;
    expect(resourceSelect.querySelector<HTMLOptionElement>('option[value="LD0"]')?.disabled).toBe(true);
    expect(resourceSelect.querySelector<HTMLOptionElement>('option[value="LD1"]')?.disabled).toBe(false);
  });

  it('keeps a duplicate package pin in a visible conflict state instead of reporting mapping complete', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Conflict Recovery"
          expectedBehavior="Each signal needs a unique package pin."
          mappingRows={[
            { id: 'en', label: 'EN', direction: 'in', pin: 'V17', required: true },
            { id: 'rst', label: 'RST', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          onSetMappingPin={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hardware-mapping-progress').textContent).not.toContain('MAPPING COMPLETE');
    expect(getByTestId('ide-hw-mapping-overview-conflicts').textContent).toContain('2');
    fireEvent.click(getByTestId('ide-hw-select-next-mapping'));
    expect(getByTestId('ide-hw-selected-mapping-status').textContent).toBe('Conflict');
    const conflict = getByTestId('ide-hw-selected-mapping-conflict');
    expect(conflict.textContent).toContain('EN and RST');
    expect(conflict.textContent).toContain('SW0');
    expect(conflict.textContent).toContain('V17');
  });

  it('ends a complete mapping task with one obvious handoff to Export', () => {
    const health = makeHealth();
    const onOpenExport = vi.fn();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Ready Mapping"
          expectedBehavior="All mappings are coherent."
          mappingRows={BASE_ROWS}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={onOpenExport}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain(
      'Inspect the package in Build & Export'
    );
    fireEvent.click(getByTestId('ide-hw-continue-export'));
    expect(onOpenExport).toHaveBeenCalledTimes(1);
  });

  it('routes a complete mapping back to Design when a structural output blocker remains', () => {
    const onGoToDesign = vi.fn();
    const onOpenExport = vi.fn();
    const health = makeHealth({
      blockingIssues: [
        {
          code: 'RBP1006',
          message: 'Output LD2 is not driven by the circuit.',
          fixPath: { mode: 'design', actionLabel: 'Open Design' },
        },
      ],
    });
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Blocked Design"
          expectedBehavior="LD2 must be driven before export."
          mappingRows={BASE_ROWS}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={onOpenExport}
          onOpenVerify={vi.fn()}
          onGoToDesign={onGoToDesign}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Design blocked');
    expect(getByTestId('ide-hw-mapping-next-action').textContent).toContain('Repair the circuit in Design');
    fireEvent.click(getByTestId('ide-hw-open-design-blocker'));
    expect(onGoToDesign).toHaveBeenCalledTimes(1);
    expect(onOpenExport).not.toHaveBeenCalled();
  });
});
