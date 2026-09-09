// @vitest-environment jsdom
import React from 'react';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { ExportSurface } from '../surfaces/ExportSurface';
import type { ProjectHealthVerifyResult } from '../projectHealth';
import { deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';

/** Fully mapped project — produces no RBEX errors. */
function buildMappedProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-12T00:00:00.000Z',
    updatedAt: '2026-03-12T00:00:00.000Z',
    name: 'export-trust-clarity-mapped',
    description: 'Trust clarity fixture — all pins mapped',
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

/**
 * Project where ld0 is declared in HDL but absent from ioMapping.outputs.
 * Causes exportProjectAsBasys3 to report RBEX1001 → BLOCKED state.
 */
function buildMappingBlockedProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-12T00:00:00.000Z',
    updatedAt: '2026-03-12T00:00:00.000Z',
    name: 'export-trust-clarity-blocked',
    description: 'Trust clarity fixture — ld0 unmapped to trigger RBEX1001',
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
      // ld0 deliberately absent — expected to trigger RBEX1001
      outputs: [],
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

const passResult: ProjectHealthVerifyResult = {
  status: 'pass',
  hash: 'abc123pass',
  reportHash: 'rep-pass',
  ranAtIso: '2026-03-12T00:00:00.000Z',
};

const failResult: ProjectHealthVerifyResult = {
  status: 'fail',
  hash: 'abc123fail',
  reportHash: 'rep-fail',
  failingTick: 3,
  ranAtIso: '2026-03-12T00:00:00.000Z',
};

const traceResult: ProjectHealthVerifyResult = {
  status: 'pass',
  runKind: 'trace',
  hash: 'abc123trace',
  reportHash: 'rep-trace',
  ranAtIso: '2026-03-25T00:00:00.000Z',
};

function makeWorkflowAuthority(options: {
  verifyResult?: ProjectHealthVerifyResult;
  verifyQualification?: 'complete' | 'incomplete-mapping';
  hasSuccessfulExportBundle?: boolean;
  exportCurrent?: boolean;
  dirtySinceVerify?: boolean;
  designReady?: boolean;
} = {}) {
  const verifyResult = options.verifyResult;
  const exportHash = options.exportCurrent === false ? 'export-old-hash' : 'export-current-hash';
  const currentExportHash = options.exportCurrent === false ? 'export-new-hash' : exportHash;
  const verifyHash = verifyResult?.hash ?? null;
  const currentVerifyProjectHash =
    options.dirtySinceVerify && verifyHash ? `${verifyHash}-current` : verifyHash;

  return deriveProjectWorkflowAuthority({
    projectHealthCore: {
      lastVerify: verifyResult
        ? {
            ...verifyResult,
            qualification: options.verifyQualification === 'incomplete-mapping' ? 'incomplete-mapping' : undefined,
          }
        : undefined,
      lastExport: options.hasSuccessfulExportBundle === false
        ? undefined
        : {
            status: 'ok',
            hash: exportHash,
            ranAtIso: '2026-03-12T00:10:00.000Z',
          },
      dirtySinceVerify: options.dirtySinceVerify ?? false,
      dirtySinceExport: options.exportCurrent === false,
    },
    readiness: {
      hasCircuit: true,
      hasIoMapping: options.designReady ?? true,
      hasVectors: true,
      verifyQualification:
        options.verifyQualification === 'incomplete-mapping' ? 'incomplete-mapping' : undefined,
    },
    verifyLastRun: verifyResult,
    verifyRunHistory: verifyHash ? [{ projectHash: verifyHash }] : undefined,
    currentVerifyProjectHash,
    currentExportHash,
  });
}

type SurfaceProps = React.ComponentProps<typeof ExportSurface>;

function renderPackage(overrides: Partial<SurfaceProps> = {}) {
  return render(<ExportSurface project={buildMappedProject()} determinismHash="ide-hash"
    activeDocument={{ kind: 'package' }} {...overrides} />);
}

function primaryDownload(view: ReturnType<typeof render>) {
  return view.getByRole('button', { name: /Generate & download (draft|checked) ZIP/ });
}

function openTechnical(view: ReturnType<typeof render>) {
  fireEvent.click(view.getByTestId('ide-export-open-technical-evidence'));
}

describe('ExportSurface trust clarity', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:export-test') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('offers a checked package for a current passing comparison without claiming a download occurred', () => {
    const view = renderPackage({ verifyResult: passResult, workflowAuthority: makeWorkflowAuthority({ verifyResult: passResult }) });
    expect(primaryDownload(view).textContent).toContain('checked ZIP');
    expect(primaryDownload(view).hasAttribute('disabled')).toBe(false);
    expect(view.getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-verification-trust')).toBe('trusted');
    expect(view.getByTestId('ide-export-state-summary').textContent).toContain('current comparison evidence agree');
    expect(view.queryByTestId('ide-export-download-success')).toBeNull();
    expect(view.getByTestId('ide-export-download-record').textContent).toContain('requests a browser download');
  });

  it('keeps an unverified draft available and routes the next comparison action to Simulate', () => {
    const onOpenVerify = vi.fn();
    const view = renderPackage({ onOpenVerify, workflowAuthority: makeWorkflowAuthority() });
    expect(view.getByTestId('ide-export-state-summary').textContent).toContain('Expected-output comparison has not run');
    expect(primaryDownload(view).textContent).toContain('draft ZIP');
    fireEvent.click(view.getByRole('button', { name: 'Open Simulate' }));
    expect(onOpenVerify).toHaveBeenCalledOnce();
  });

  it('names trace-only evidence without upgrading it to a checked package', () => {
    const view = renderPackage({ verifyResult: traceResult, workflowAuthority: makeWorkflowAuthority({ verifyResult: traceResult }) });
    expect(view.getByTestId('ide-export-state-summary').textContent).toContain('trace-only run');
    expect(primaryDownload(view).textContent).toContain('draft ZIP');
    openTechnical(view);
    expect(view.getByTestId('ide-export-gate-verify').textContent).toContain('Trace only');
    expect(view.getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-verification-trust')).toBe('unverified');
  });

  it('explains stale evidence instead of presenting an old mismatch as the current failure', () => {
    const view = renderPackage({ verifyResult: failResult, dirtySinceVerify: true,
      workflowAuthority: makeWorkflowAuthority({ verifyResult: failResult, dirtySinceVerify: true }) });
    const state = view.getByTestId('ide-export-state-summary').textContent ?? '';
    expect(state).toContain('stale');
    expect(state).not.toContain('differed at tick');
    expect(primaryDownload(view).textContent).toContain('draft ZIP');
    openTechnical(view);
    expect(view.getByTestId('ide-export-gate-verify').textContent).toContain('Stale');
  });

  it('blocks an unmapped package and sends the primary repair action to Board & Constraints', () => {
    const onGoToHardware = vi.fn();
    const view = renderPackage({ project: buildMappingBlockedProject(), onGoToHardware });
    expect(view.getByTestId('ide-export-state-summary').textContent).toMatch(/mapping|pin assignments/i);
    expect(view.queryByRole('button', { name: /Generate & download (draft|checked) ZIP/ })).toBeNull();
    fireEvent.click(view.getByTestId('ide-export-blocked-open-map-pins'));
    expect(onGoToHardware).toHaveBeenCalledOnce();
  });

  it('does not claim a live structurally blocked design is valid', () => {
    const onGoToDesign = vi.fn();
    const view = renderPackage({ designReady: false, onGoToDesign });
    expect(view.getByTestId('ide-export-derived-state').textContent).toContain('Design blocks export');
    fireEvent.click(view.getByTestId('ide-export-blocked-open-design'));
    expect(onGoToDesign).toHaveBeenCalledOnce();
    openTechnical(view);
    expect(view.getByTestId('ide-export-structural-axis').textContent).toContain('Blocked');
  });

  it('does not turn a successful package structure check into behavioral or Vivado evidence', () => {
    const view = renderPackage({ workflowAuthority: makeWorkflowAuthority() });
    openTechnical(view);
    fireEvent.click(view.getByTestId('ide-export-validate-package'));
    expect(view.getByTestId('ide-export-validation-result').textContent).toContain('files structurally valid');
    expect(view.getByTestId('ide-export-validation-result').textContent).toContain('Vivado external');
    expect(view.getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-verification-trust')).toBe('unverified');
    expect(view.getByTestId('ide-export-action-axis').textContent).toContain('No download recorded');
  });

  it.each([
    ['not run', undefined, false, 'unverified'],
    ['failed comparison', failResult, false, 'draft'],
    ['stale passing comparison', passResult, true, 'draft'],
    ['current passing comparison', passResult, false, 'trusted'],
  ] as const)('completes real package generation for %s with the correct receipt trust', async (_label, verifyResult, dirtySinceVerify, trust) => {
    const onExportResult = vi.fn();
    const view = renderPackage({ verifyResult, dirtySinceVerify, onExportResult,
      workflowAuthority: makeWorkflowAuthority({ verifyResult, dirtySinceVerify }) });
    await act(async () => { fireEvent.click(primaryDownload(view)); });
    await waitFor(() => expect(onExportResult).toHaveBeenCalledOnce(), { timeout: 5000 });
    const receipt = onExportResult.mock.calls[0][0];
    expect(receipt).toMatchObject({ status: 'ok', downloadKind: 'project', verificationTrust: trust,
      sourceHashes: { project: 'ide-hash' }, sourceCurrentness: { project: 'current', export: 'current', mapping: 'current' } });
    expect(receipt.packageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(view.getByTestId('ide-export-download-success').textContent).toContain('browser download requested');
    expect(view.queryByTestId('ide-export-capsule-error')).toBeNull();
  });

  it('keeps generation retryable after a download failure without inventing a successful receipt', async () => {
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => { throw new Error('Browser download unavailable'); });
    const onExportResult = vi.fn();
    const view = renderPackage({ onExportResult });
    fireEvent.click(primaryDownload(view));
    await waitFor(() => expect(onExportResult).toHaveBeenCalledOnce(), { timeout: 5000 });
    expect(onExportResult.mock.calls[0][0]).toMatchObject({ status: 'blocked' });
    expect(onExportResult.mock.calls[0][0].packageHash).toBeUndefined();
    expect(view.getByTestId('ide-export-capsule-error').textContent).toContain('Browser download unavailable');
    expect(view.queryByTestId('ide-export-download-success')).toBeNull();
    expect(view.getByTestId('ide-export-download-record').textContent).not.toContain('Previous ZIP');
    expect(primaryDownload(view).hasAttribute('disabled')).toBe(false);
    fireEvent.click(primaryDownload(view));
    await waitFor(() => expect(onExportResult).toHaveBeenCalledTimes(2), { timeout: 5000 });
    expect(onExportResult.mock.calls[1][0]).toMatchObject({ status: 'ok', verificationTrust: 'unverified' });
    expect(view.getByTestId('ide-export-download-success')).toBeTruthy();
  });

  it('keeps a current mismatch visible while leaving structurally valid draft generation enabled', () => {
    const view = renderPackage({ verifyResult: failResult, workflowAuthority: makeWorkflowAuthority({ verifyResult: failResult }) });
    expect(view.getByTestId('ide-export-state-summary').textContent).toMatch(/differ|mismatch/i);
    expect(primaryDownload(view).textContent).toContain('draft ZIP');
    expect(primaryDownload(view).hasAttribute('disabled')).toBe(false);
    openTechnical(view);
    expect(view.getByTestId('ide-export-gate-verify').textContent).toContain('t3');
  });

  it('keeps a mapping-qualified passing run as draft evidence rather than fully checked', () => {
    const view = renderPackage({ verifyResult: passResult,
      workflowAuthority: makeWorkflowAuthority({ verifyResult: passResult, verifyQualification: 'incomplete-mapping' }) });
    expect(primaryDownload(view).textContent).toContain('draft ZIP');
    expect(view.getByTestId('ide-export-state-summary').textContent).toContain('mapping review');
    expect(view.getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-verification-trust')).toBe('draft');
  });

  it('routes the named technical mapping gate to the same Board owner', () => {
    const onGoToHardware = vi.fn();
    const view = renderPackage({ project: buildMappingBlockedProject(), verifyResult: passResult, onGoToHardware,
      workflowAuthority: makeWorkflowAuthority({ verifyResult: passResult }) });
    openTechnical(view);
    const mappingAction = view.getByTestId('ide-export-gate-action-mapping');
    expect(mappingAction.textContent).toBe('Open Board & Constraints');
    fireEvent.click(mappingAction);
    expect(onGoToHardware).toHaveBeenCalledOnce();
  });

  it('keeps report access secondary to generation and file work', () => {
    const onOpenDocument = vi.fn();
    const view = renderPackage({ onOpenDocument });
    expect(primaryDownload(view).className).toContain('ide-button-primary');
    expect(view.getByTestId('ide-export-open-handoff').className).not.toContain('ide-button-primary');
    expect(view.queryByTestId('ide-package-handoff-document')).toBeNull();
    expect(view.getByTestId('ide-export-preview-code').textContent).toContain('entity top');
    fireEvent.click(view.getByRole('button', { name: 'Open report' }));
    expect(onOpenDocument).toHaveBeenCalledWith({ kind: 'handoff' });
  });

  it('does not describe an unsuccessful prior export as an out-of-date downloaded ZIP', () => {
    const view = renderPackage({ lastExport: { status: 'blocked', hash: 'failed-generation', ranAtIso: '2026-09-08T00:00:00.000Z' } });
    expect(view.getByTestId('ide-export-download-record').textContent).not.toContain('Previous ZIP');
    openTechnical(view);
    expect(view.getByTestId('ide-export-action-axis').textContent).toContain('No download recorded');
  });

  it('generates a flat kit only through technical details and records the actual download kind', async () => {
    const onExportResult = vi.fn();
    const view = renderPackage({ onExportResult });
    expect(view.queryByTestId('ide-export-kit-download-v1')).toBeNull();
    openTechnical(view);
    fireEvent.click(view.getByTestId('ide-export-kit-download-v1'));
    await waitFor(() => expect(onExportResult).toHaveBeenCalledOnce(), { timeout: 5000 });
    expect(onExportResult.mock.calls[0][0]).toMatchObject({ status: 'ok', downloadKind: 'kit', verificationTrust: 'unverified' });
    expect(onExportResult.mock.calls[0][0].packageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(view.getByTestId('ide-export-download-success').textContent).toContain('browser download requested');
  });
});
