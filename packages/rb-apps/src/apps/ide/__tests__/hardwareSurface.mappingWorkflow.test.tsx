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
  return deriveProjectWorkflowAuthority({
    projectHealthCore: health,
    readiness: {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
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
  it('uses one headerless panel wrapper and one Map Pins command header', () => {
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
    expect(getByTestId('ide-hardware-command-strip').textContent).toContain('Map project signals to Basys3 controls');
    expect(getByTestId('ide-hardware-command-strip').textContent).toContain('Basys3');
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
    expect(getByTestId('ide-hw-map-row-status-ld0').textContent).toContain('Missing');
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
    expect(table.getAttribute('data-columns')).toBe('Signal|Purpose|Board resource|Pin|Status');
    expect(table.textContent).toContain('Signal');
    expect(table.textContent).toContain('Purpose');
    expect(table.textContent).toContain('Board resource');
    const afterMapping = getByTestId('ide-hw-after-mapping-tools');
    expect(afterMapping.hasAttribute('open')).toBe(false);
    expect(table.compareDocumentPosition(afterMapping) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    expect(getByTestId('ide-hw-board-task-copy').textContent).toContain('Select a signal row');
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
});
