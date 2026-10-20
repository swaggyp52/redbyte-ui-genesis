// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { ExportSurface } from '../surfaces/ExportSurface';
import { getIdeExampleById } from '../examplesCatalog';
import { deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';

function buildProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-08T00:00:00.000Z',
    updatedAt: '2026-03-08T00:00:00.000Z',
    name: 'export-surface-mapping-trust',
    description: 'Regression fixture for export mapping trust',
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', x: 120, y: 120, label: 'sw0', config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', x: 320, y: 120, label: 'ld0', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', pin: 'V17' },
      ],
      outputs: [
        { id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'ld0', pin: 'U16' },
      ],
    },
    vectors: [],
    hdl: {
      top: 'top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: [
            'library IEEE;',
            'use IEEE.STD_LOGIC_1164.ALL;',
            '',
            'entity top is',
            '  port (',
            '    sw0 : in std_logic;',
            '    ld0 : out std_logic',
            '  );',
            'end top;',
            '',
            'architecture rtl of top is',
            'begin',
            '  ld0 <= sw0;',
            'end rtl;',
          ].join('\n'),
        },
      ],
    },
    fpga: { board: 'basys3', top: 'top' },
  };
}

function buildExampleProject(exampleId: string): RBProject {
  const example = getIdeExampleById(exampleId);
  if (!example) {
    throw new Error(`Missing example fixture: ${exampleId}`);
  }

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-08T00:00:00.000Z',
    updatedAt: '2026-03-08T00:00:00.000Z',
    name: example.name,
    description: example.summary,
    circuit: {
      nodes: example.circuit.nodes.map((node) => ({ ...node })),
      connections: example.circuit.connections.map((connection) => ({
        ...connection,
        from: typeof connection.from === 'string' ? connection.from : { ...connection.from },
        to: typeof connection.to === 'string' ? connection.to : { ...connection.to },
      })),
    },
    ioMapping: {
      inputs: example.ioRows
        .filter((row) => row.direction === 'in')
        .map((row) => ({
          id: row.id,
          nodeId: row.nodeId,
          port: row.port,
          label: row.label,
          pin: row.pin,
        })),
      outputs: example.ioRows
        .filter((row) => row.direction === 'out')
        .map((row) => ({
          id: row.id,
          nodeId: row.nodeId,
          port: row.port,
          label: row.label,
          pin: row.pin,
        })),
    },
    vectors: example.vectors.map((vector) => ({
      tick: vector.tick,
      inputs: { ...vector.inputs },
      expected: { ...(vector.expected ?? {}) },
    })),
    fpga: { board: 'basys3', top: 'top' },
  };
}

function withUpdatedPin(project: RBProject, rowId: string, pin: string): RBProject {
  const mapping = project.ioMapping;
  if (!mapping) throw new Error('The export mapping fixture must contain IO mappings');
  const updateEntries = <T extends { id: string; pin?: string }>(entries: T[]): T[] =>
    entries.map((entry) =>
      entry.id === rowId
        ? {
            ...entry,
            pin,
          }
        : entry
    );

  return {
    ...project,
    ioMapping: {
      inputs: updateEntries(mapping.inputs),
      outputs: updateEntries(mapping.outputs),
    },
  };
}

function reportRow(view: ReturnType<typeof render>, logicalLabel: string): HTMLElement {
  const table = view.getByTestId('ide-package-handoff-mapping');
  // Linked report data rows intentionally expose role=button for navigation.
  // Inspect actual table cells so both linked and static rows retain one identity.
  const row = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr')).find((entry) =>
    entry.cells[0]?.textContent?.trim().toLowerCase() === logicalLabel.toLowerCase());
  if (!row) throw new Error(`Missing live report mapping for ${logicalLabel}`);
  return row;
}

describe('ExportSurface mapping trust', () => {
  it('rebuilds previewed constraints and report bindings after upstream Board mapping changes', () => {
    let currentProject = buildProject();
    const view = render(<ExportSurface project={currentProject} determinismHash="ide-hash" />);
    fireEvent.click(view.getByTestId('ide-export-file-top-xdc'));
    expect(view.getByTestId('ide-export-preview-code').textContent).toContain('PACKAGE_PIN V17');
    currentProject = withUpdatedPin(currentProject, 'sw0', 'W16');
    view.rerender(<ExportSurface project={currentProject} determinismHash="ide-hash" />);
    expect(view.getByTestId('ide-export-preview-code').textContent).toContain('PACKAGE_PIN W16');
    expect(view.getByTestId('ide-export-preview-code').textContent).not.toContain('PACKAGE_PIN V17');
    view.rerender(<ExportSurface project={currentProject} determinismHash="ide-hash" activeDocument={{ kind: 'handoff' }} />);
    const cells = within(reportRow(view, 'sw0')).getAllByRole('cell');
    expect(cells[3].textContent).toContain('SW2');
    expect(cells[4].textContent).toBe('W16');
  });

  it('renders report mappings as read-only even when a parent updater exists', () => {
    const onUpdateMappingPin = vi.fn();
    const view = render(<ExportSurface project={buildProject()} determinismHash="ide-hash"
      activeDocument={{ kind: 'handoff' }} onUpdateMappingPin={onUpdateMappingPin} />);
    const row = reportRow(view, 'sw0');
    expect(within(row).queryByRole('textbox')).toBeNull();
    const cells = within(row).getAllByRole('cell');
    expect(cells[3].textContent).toContain('SW0');
    expect(cells[4].textContent).toBe('V17');
    expect(onUpdateMappingPin).not.toHaveBeenCalled();
  });

  it('routes mapping review to the owning Board document and reconciles upstream changes', () => {
    const onOpenDocument = vi.fn();
    const onUpdateMappingPin = vi.fn();
    let currentProject = buildProject();
    const view = render(<ExportSurface project={currentProject} determinismHash="ide-hash"
      activeDocument={{ kind: 'handoff' }} onOpenDocument={onOpenDocument} onUpdateMappingPin={onUpdateMappingPin} />);
    fireEvent.click(view.getByTestId('ide-package-handoff-open-board'));
    expect(onOpenDocument).toHaveBeenLastCalledWith({ kind: 'board-io', constraintSetId: 'default' });
    currentProject = withUpdatedPin(currentProject, 'sw0', 'W16');
    view.rerender(<ExportSurface project={currentProject} determinismHash="ide-hash"
      activeDocument={{ kind: 'handoff' }} onOpenDocument={onOpenDocument} onUpdateMappingPin={onUpdateMappingPin} />);
    const row = reportRow(view, 'sw0');
    expect(within(row).getAllByRole('cell')[4].textContent).toBe('W16');
    fireEvent.click(row);
    expect(onOpenDocument).toHaveBeenLastCalledWith({ kind: 'board-io', constraintSetId: 'default' });
    expect(onUpdateMappingPin).not.toHaveBeenCalled();
  });

  it('keeps Board ownership and the read-only report when no mapping updater is wired', () => {
    const onOpenDocument = vi.fn();
    const view = render(<ExportSurface project={buildProject()} determinismHash="ide-hash"
      activeDocument={{ kind: 'handoff' }} onOpenDocument={onOpenDocument} />);
    const row = reportRow(view, 'sw0');
    expect(within(row).queryByRole('textbox')).toBeNull();
    fireEvent.click(row);
    expect(onOpenDocument).toHaveBeenLastCalledWith({ kind: 'board-io', constraintSetId: 'default' });
    expect(view.getByTestId('ide-export-upstream-mapping').getAttribute('data-owner')).toBe('Board');
  });

  it('keeps live boundary rows visible when labels sanitize differently in artifacts', () => {
    const view = render(<ExportSurface project={buildExampleProject('two-bit-counter')} determinismHash="ide-hash"
      activeDocument={{ kind: 'handoff' }} />);
    const enable = reportRow(view, 'EN');
    const reset = reportRow(view, 'RST');
    expect(within(enable).getAllByRole('cell')[3].textContent).toContain('SW0');
    expect(within(enable).getAllByRole('cell')[4].textContent).toBe('V17');
    expect(within(reset).getAllByRole('cell')[3].textContent).toContain('BTNC');
    expect(within(reset).getAllByRole('cell')[4].textContent).toBe('U18');
    expect(within(enable).queryByRole('textbox')).toBeNull();
    expect(within(reset).queryByRole('textbox')).toBeNull();
  });

  it('shows a generatable missing-bundle state when prerequisites are satisfied', () => {
    const verifyResult = { status: 'pass' as const, runKind: 'verify' as const, hash: 'verify-pass-hash',
      reportHash: 'verify-report-hash', ranAtIso: '2026-04-23T12:00:00.000Z' };
    const workflowAuthority = deriveProjectWorkflowAuthority({
      projectHealthCore: { lastVerify: verifyResult, lastExport: undefined, dirtySinceVerify: false, dirtySinceExport: false },
      readiness: { hasCircuit: true, hasIoMapping: true, hasVectors: true },
      verifyLastRun: verifyResult, verifyRunHistory: [{ projectHash: 'verify-pass-hash' }],
      currentVerifyProjectHash: 'verify-pass-hash', currentExportHash: 'current-export-hash',
    });
    const view = render(<ExportSurface project={buildProject()} determinismHash="current-export-hash"
      verifyResult={verifyResult} workflowAuthority={workflowAuthority} />);
    expect(view.getByTestId('ide-export-derived-state').textContent).toBe('Package not built yet — the current simulation passes its checks');
    const action = view.getByTestId('ide-export-package-build-v1');
    expect(action.textContent).toBe('Generate & download checked ZIP');
    expect(action.hasAttribute('disabled')).toBe(false);
    const inspector = view.getByTestId('ide-export-package-inspector-v1');
    expect(inspector.getAttribute('data-export-structural-state')).toBe('downloadable');
    expect(inspector.getAttribute('data-export-action-state')).toBe('not-downloaded');
    expect(view.getByTestId('ide-export-panel').textContent).not.toContain('Export Blocked');
  });
});
