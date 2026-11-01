// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import type { RBProject } from '../../../export/projectFormat';
import { ExportSurface } from '../surfaces/ExportSurface';
import { HandoffWaveformFigure } from '../surfaces/export/HandoffWaveformFigure';
import type { RuntimeVerifyRun } from '../projectRuntime';

const project = (): RBProject => ({
  kind: 'rb-project', version: 1, name: 'Operational package',
  createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z',
  circuit: { nodes: [
    { id: 'input', type: 'INPUT', label: 'A', x: 0, y: 0, config: {}, state: {} },
    { id: 'output', type: 'OUTPUT', label: 'Q', x: 200, y: 0, config: {}, state: {} },
  ], connections: [{ from: { nodeId: 'input', portName: 'out' }, to: { nodeId: 'output', portName: 'in' } }] },
  ioMapping: { inputs: [{ id: 'a', nodeId: 'input', port: 'out', label: 'A', pin: 'V17' }],
    outputs: [{ id: 'q', nodeId: 'output', port: 'in', label: 'Q', pin: 'U16' }] },
  vectors: [], fpga: { board: 'basys3', top: 'top' },
  hdl: { top: 'top', sources: [{ path: 'top.vhd', language: 'vhdl', text: 'entity top is port(A: in std_logic; Q: out std_logic); end top; architecture rtl of top is begin Q <= A; end rtl;' }] },
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('operational Package outcome', () => {
  it('lands on identity, an allowed draft generation action and actual generated files; report is deliberate', () => {
    const onOpenDocument = vi.fn();
    const props = { project: project(), determinismHash: 'current-design', onOpenDocument };
    const view = render(<ExportSurface {...props} activeDocument={{ kind: 'package' }} />);
    expect(view.queryByTestId('ide-package-handoff-document')).toBeNull();
    expect(view.getByTestId('ide-export-package-identity').textContent).toBe('Operational package');
    expect(view.getByTestId('ide-export-draft-download-v1').className).toContain('ide-button-primary');
    expect(view.getByTestId('ide-export-draft-download-v1').hasAttribute('disabled')).toBe(false);
    expect(view.getByTestId('ide-export-vivado-next-step').textContent).toContain('.xpr');
    fireEvent.click(view.getByTestId('ide-export-file-top-xdc'));
    expect(view.getByTestId('ide-export-preview-code').textContent).toContain('PACKAGE_PIN V17');
    fireEvent.click(view.getByTestId('ide-export-open-handoff'));
    expect(onOpenDocument).toHaveBeenLastCalledWith({ kind: 'handoff' });
    view.rerender(<ExportSurface {...props} activeDocument={{ kind: 'handoff' }} />);
    expect(view.getByTestId('ide-package-handoff-document')).toBeTruthy();
    fireEvent.click(view.getByTestId('ide-export-open-handoff'));
    expect(onOpenDocument).toHaveBeenLastCalledWith({ kind: 'package' });
  });

  it('generates an unverified ZIP without checks, prevents repeat activation while generating, then preserves an older record as stale', async () => {
    vi.stubGlobal('crypto', webcrypto);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:package-test') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const onExportResult = vi.fn();
    const initial = project();
    const view = render(<ExportSurface project={initial} determinismHash="current-design" onExportResult={onExportResult} activeDocument={{ kind: 'package' }} />);
    fireEvent.click(view.getByTestId('ide-export-draft-download-v1'));
    expect(view.getByTestId('ide-export-draft-download-v1').hasAttribute('disabled')).toBe(true);
    await waitFor(() => expect(onExportResult).toHaveBeenCalled(), { timeout: 5000 });
    expect(onExportResult.mock.calls[0][0]).toMatchObject({ status: 'ok', verificationTrust: 'unverified', downloadKind: 'project' });
    expect(onExportResult.mock.calls[0][0].packageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(click).toHaveBeenCalledOnce();
    expect(view.getByTestId('ide-export-download-success').textContent).toContain('browser download requested');
    const edited = { ...initial, name: 'Changed package' };
    view.rerender(<ExportSurface project={edited} determinismHash="changed-design" onExportResult={onExportResult} activeDocument={{ kind: 'package' }} />);
    expect(view.queryByTestId('ide-export-download-success')).toBeNull();
    expect(view.getByTestId('ide-export-download-record').textContent).toContain('Previous ZIP is out of date');
    expect(view.getByTestId('ide-export-draft-download-v1').hasAttribute('disabled')).toBe(false);
  });

  it('keeps trust axes and structural validation in named technical details', () => {
    const view = render(<ExportSurface project={project()} determinismHash="current-design" activeDocument={{ kind: 'package' }} />);
    expect(view.queryByTestId('ide-export-trust-axes')).toBeNull();
    fireEvent.click(view.getByTestId('ide-export-open-technical-evidence'));
    expect(view.getByTestId('ide-export-structural-axis').textContent).toContain('Downloadable');
    fireEvent.click(view.getByTestId('ide-export-validate-package'));
    expect(view.getByTestId('ide-export-validation-result').textContent).toContain('files structurally valid');
    expect(view.getByTestId('ide-export-validation-result').textContent).toContain('Vivado external');
  });

  it('draws actual report samples from a named run and leaves missing history unavailable', () => {
    const run = { runId: 'recording-42', reportHash: 'report-42', waveform: [
      { tick: 0, signals: { Q: 1 } }, { tick: 1, signals: {} }, { tick: 2, signals: { Q: 0 } },
    ], report: { rows: [], signalRoles: { Q: 'output' } } } as unknown as RuntimeVerifyRun;
    const view = render(<HandoffWaveformFigure run={run} figureNumber={1} />);
    expect(view.getByTestId('ide-package-handoff-waveform').getAttribute('data-run-id')).toBe('recording-42');
    const lane = view.container.querySelector('[data-signal="Q"]');
    expect(lane?.querySelector('title')?.textContent).toBe('Q: t0=1, t1=unavailable, t2=0');
    expect(lane?.querySelector('path')?.getAttribute('d')?.match(/M /g)).toHaveLength(2);
    expect(lane?.textContent).toContain('?');
  });
});
