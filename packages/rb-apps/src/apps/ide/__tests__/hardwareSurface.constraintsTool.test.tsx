// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { BoardSignalProvider } from '../BoardSignalContext';
import { HardwareSurface } from '../surfaces/HardwareSurface';
import type { ProjectHealth } from '../projectHealth';
import { deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';
import { addConstraintSet, createEmptyConstraintSets } from '../constraintSets';

/**
 * P2.5H Wave Two — Constraints is a tool in the Board side panel: every
 * signal's exact XDC lines (the package's own projection), selection-synced
 * both ways, with the named sets inside it. The permanent footer is gone.
 */
afterEach(() => {
  cleanup();
});

const ROWS = [
  { id: 'sw0', label: 'SW0', direction: 'in' as const, pin: 'V17', required: true },
  { id: 'ld0', label: 'LD0', direction: 'out' as const, pin: 'U16', required: true },
  { id: 'ld1', label: 'LD1', direction: 'out' as const, pin: '', required: true },
];
const PROJECTION = [
  {
    logicalSignalId: 'sw0',
    logicalLabel: 'SW0',
    direction: 'in' as const,
    artifactPortName: 'SW0',
    boardResourceId: 'SW0',
    boardResourceLabel: 'Switch 0',
    packagePin: 'V17',
    ioStandard: 'LVCMOS33' as const,
    exactXdcLine: 'set_property PACKAGE_PIN V17 [get_ports {SW0}]',
    required: true,
    conflictState: 'none' as const,
  },
  {
    logicalSignalId: 'ld0',
    logicalLabel: 'LD0',
    direction: 'out' as const,
    artifactPortName: 'LD0',
    boardResourceId: 'LD0',
    boardResourceLabel: 'LED 0',
    packagePin: 'U16',
    ioStandard: 'LVCMOS33' as const,
    exactXdcLine: 'set_property PACKAGE_PIN U16 [get_ports {LD0}]',
    required: true,
    conflictState: 'none' as const,
  },
];

function health(): ProjectHealth {
  return { lastVerify: undefined, lastExport: undefined, dirtySinceVerify: false, dirtySinceExport: true, blockingIssues: [] };
}

function renderBoard(constraintDoc = createEmptyConstraintSets()) {
  const h = health();
  return render(
    <BoardSignalProvider>
      <HardwareSurface
        projectName="Constraints tool"
        expectedBehavior="sw0 drives ld0."
        mappingRows={ROWS}
        mappingProjection={PROJECTION}
        expectedIoRows={[]}
        vectorsCount={0}
        health={h}
        workflowAuthority={deriveProjectWorkflowAuthority({
          projectHealthCore: h,
          readiness: { hasCircuit: true, hasIoMapping: true, hasVectors: true, verifyQualification: undefined },
          verifyLastRun: undefined,
          currentVerifyProjectHash: null,
          currentExportHash: null,
        })}
        constraintSets={{
          doc: constraintDoc,
          liveXdcText: 'create_clock -name sys_clk -period 10.000 [get_ports clk]\nset_property PACKAGE_PIN V17 [get_ports {SW0}]',
          onAdd: vi.fn(),
          onRemove: vi.fn(),
          onRename: vi.fn(),
          onSetActive: vi.fn(),
        }}
        onGenerateBringUpVectors={vi.fn()}
        onOpenExport={vi.fn()}
        onOpenVerify={vi.fn()}
      />
    </BoardSignalProvider>
  );
}

describe('Board — Constraints tool', () => {
  it('lists the clock line and every signal\'s exact XDC lines, pending ones included', () => {
    const { getByTestId } = renderBoard();
    expect(getByTestId('ide-hw-xdc-line-clock').textContent).toContain('create_clock -name sys_clk');
    expect(getByTestId('ide-hw-xdc-line-sw0').textContent).toContain('set_property PACKAGE_PIN V17 [get_ports {SW0}]');
    expect(getByTestId('ide-hw-xdc-line-sw0').textContent).toContain('set_property IOSTANDARD LVCMOS33 [get_ports {SW0}]');
    expect(getByTestId('ide-hw-xdc-line-ld1').className).toContain('is-pending');
    expect(getByTestId('ide-hw-constraints-active').textContent).toBe('Live mapping');
  });

  it('selecting a line selects its signal, and the selection marks the line', () => {
    const { getByTestId } = renderBoard();
    fireEvent.click(getByTestId('ide-hw-xdc-select-ld0'));
    expect(getByTestId('ide-hw-xdc-line-ld0').getAttribute('aria-current')).toBe('true');
    expect(getByTestId('ide-hw-xdc-line-sw0').getAttribute('aria-current')).toBeNull();
  });

  it('keeps the named sets inside the tool and names the active set', () => {
    const doc = addConstraintSet(createEmptyConstraintSets(), 'Lab 3 pins', 'set_property PACKAGE_PIN V17 [get_ports {SW0}]');
    const { getByTestId } = renderBoard(doc);
    const tool = getByTestId('ide-hw-constraints-tool');
    expect(tool.querySelector('[data-testid="ide-constraint-sets"]')).toBeTruthy();
    expect(getByTestId('ide-hw-constraints-active').textContent).toBe('Lab 3 pins');
  });
});
