// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { ExportSurface } from '../surfaces/ExportSurface';
import type { ProjectHealthVerifyResult } from '../projectHealth';
import { deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';

function buildProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-08T00:00:00.000Z',
    updatedAt: '2026-03-08T00:00:00.000Z',
    name: 'export-surface-workstation',
    description: 'Regression fixture for export workstation redesign',
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', x: 120, y: 120, label: 'sw0', config: {}, state: {} },
        { id: 'sw1_node', type: 'INPUT', x: 120, y: 240, label: 'sw1', config: {}, state: {} },
        { id: 'g1', type: 'AND', x: 320, y: 180, label: 'and0', config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', x: 520, y: 180, label: 'ld0', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'g1', portName: 'a' } },
        { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'g1', portName: 'b' } },
        { from: { nodeId: 'g1', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', pin: 'V17' },
        { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'sw1', pin: 'V16' },
      ],
      outputs: [{ id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'ld0', pin: 'U16' }],
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
            '    sw1 : in std_logic;',
            '    ld0 : out std_logic',
            '  );',
            'end top;',
            '',
            'architecture rtl of top is',
            'begin',
            '  ld0 <= sw0 and sw1;',
            'end rtl;',
          ].join('\n'),
        },
      ],
    },
    fpga: { board: 'basys3', top: 'top' },
  };
}

function buildRawFourNandLatchProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-27T00:00:00.000Z',
    updatedAt: '2026-03-27T00:00:00.000Z',
    name: 'supported-four-nand-latch',
    description: 'Supported exact 4-NAND latch fixture',
    circuit: {
      nodes: [
        { id: 'd_in', type: 'INPUT', x: 0, y: 0, label: 'D', config: {}, state: {} },
        { id: 'en_in', type: 'INPUT', x: 0, y: 120, label: 'EN', config: {}, state: {} },
        { id: 'n1', type: 'NAND', x: 180, y: 0, label: 'n1', config: {}, state: {} },
        { id: 'n2', type: 'NAND', x: 180, y: 120, label: 'n2', config: {}, state: {} },
        { id: 'n3', type: 'NAND', x: 360, y: 0, label: 'n3', config: {}, state: {} },
        { id: 'n4', type: 'NAND', x: 360, y: 120, label: 'n4', config: {}, state: {} },
        { id: 'q_out', type: 'OUTPUT', x: 560, y: 0, label: 'Q', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'd_in', portName: 'out' }, to: { nodeId: 'n1', portName: 'a' } },
        { from: { nodeId: 'en_in', portName: 'out' }, to: { nodeId: 'n1', portName: 'b' } },
        { from: { nodeId: 'n1', portName: 'out' }, to: { nodeId: 'n2', portName: 'a' } },
        { from: { nodeId: 'en_in', portName: 'out' }, to: { nodeId: 'n2', portName: 'b' } },
        { from: { nodeId: 'n1', portName: 'out' }, to: { nodeId: 'n3', portName: 'a' } },
        { from: { nodeId: 'n4', portName: 'out' }, to: { nodeId: 'n3', portName: 'b' } },
        { from: { nodeId: 'n2', portName: 'out' }, to: { nodeId: 'n4', portName: 'a' } },
        { from: { nodeId: 'n3', portName: 'out' }, to: { nodeId: 'n4', portName: 'b' } },
        { from: { nodeId: 'n3', portName: 'out' }, to: { nodeId: 'q_out', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'd', nodeId: 'd_in', port: 'out', label: 'D', pin: 'V17' },
        { id: 'en', nodeId: 'en_in', port: 'out', label: 'EN', pin: 'W16' },
      ],
      outputs: [{ id: 'q', nodeId: 'q_out', port: 'in', label: 'Q', pin: 'U16' }],
    },
    vectors: [],
    hdl: {
      top: 'top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: 'entity top is end top; architecture rtl of top is begin end rtl;',
        },
      ],
    },
    fpga: { board: 'basys3', top: 'top' },
  };
}

function makeWorkflowAuthority(options: {
  verifyResult?: ProjectHealthVerifyResult;
  verifyQualification?: 'complete' | 'incomplete-mapping';
  hasSuccessfulExportBundle?: boolean;
  hasBlockingDesignIssue?: boolean;
} = {}) {
  const verifyResult = options.verifyResult;
  const verifyHash = verifyResult?.hash ?? null;
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
            hash: 'export-current-hash',
            ranAtIso: '2026-03-12T00:10:00.000Z',
          },
      dirtySinceVerify: false,
      dirtySinceExport: false,
    },
    readiness: {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      hasBlockingDesignIssue: options.hasBlockingDesignIssue,
      blockingDesignIssueMessage: options.hasBlockingDesignIssue
        ? 'Output LD2 has no Design driver.'
        : undefined,
      verifyQualification:
        options.verifyQualification === 'incomplete-mapping' ? 'incomplete-mapping' : undefined,
    },
    verifyLastRun: verifyResult,
    verifyRunHistory: verifyHash ? [{ projectHash: verifyHash }] : undefined,
    currentVerifyProjectHash: verifyHash,
    currentExportHash: 'export-current-hash',
  });
}

describe('ExportSurface workstation redesign', () => {
  afterEach(() => { cleanup(); });

  it('starts as one unobstructed Export workspace without support docks or a console', () => {
    const { getByTestId, queryByTestId } = render(
      <ExportSurface project={buildProject()} determinismHash="ide-hash" />
    );

    expect(getByTestId('ide-export-readiness-hero').textContent).toContain('Export');
    expect(getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-package-state')).toBe('draft');
    expect(getByTestId('ide-mode-export').getAttribute('data-left-dock-state')).toBe('hidden');
    expect(getByTestId('ide-mode-export').getAttribute('data-right-dock-state')).toBe('hidden');
    expect(getByTestId('ide-mode-export').getAttribute('data-console-state')).toBe('hidden');
    expect(getByTestId('ide-mode-body').getAttribute('aria-label')).toBe('export workspace');
    expect(queryByTestId('ide-inspector')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
    expect(queryByTestId('ide-workbench-console')).toBeNull();
  });

  it('shows readiness-first package contents with a direct file browser and preview actions', () => {
    const { getByTestId } = render(
      <ExportSurface project={buildProject()} determinismHash="ide-hash" />
    );

    expect(getByTestId('ide-export-package-inspector-v1').textContent).toContain('Draft export available');
    expect(getByTestId('ide-export-package-contents').textContent).toContain('top.vhd');
    expect(getByTestId('ide-export-package-contents').textContent).toContain('top.xdc');
    expect(getByTestId('ide-export-package-contents').textContent).toContain('testbench.vhd');
    expect(getByTestId('ide-export-e0-boundary-summary').textContent).toContain('Browser E0');

    expect(getByTestId('ide-export-file-browser')).toBeTruthy();
    expect(getByTestId('ide-export-file-top-vhd')).toBeTruthy();
    expect(getByTestId('ide-export-file-top-xdc')).toBeTruthy();
    expect(getByTestId('ide-export-file-vivado-import-tcl')).toBeTruthy();

    fireEvent.click(getByTestId('ide-export-file-top-vhd'));
    expect(getByTestId('ide-export-preview-path').textContent).toBe('top.vhd');
    expect(getByTestId('ide-export-preview-code').textContent).toContain('entity top is');
    expect(getByTestId('ide-export-copy-current-file')).toBeTruthy();
    expect(getByTestId('ide-export-download-current-file')).toBeTruthy();
    expect(getByTestId('ide-export-open-technical-evidence').textContent).toBe('Open technical evidence');
    fireEvent.click(getByTestId('ide-export-validate-package'));
    expect(getByTestId('ide-export-validation-result').textContent).toContain('files structurally valid');
    expect(getByTestId('ide-export-validation-result').textContent).toContain('Vivado external');
  });

  it('keeps upstream ownership and the generated package workspace visible without opening a support drawer', () => {
    const { getByTestId } = render(
      <ExportSurface project={buildProject()} determinismHash="ide-hash" />
    );

    const readiness = getByTestId('ide-export-upstream-readiness');
    expect(readiness.textContent).toContain('What owns this package state');
    expect(getByTestId('ide-export-upstream-design').getAttribute('data-owner')).toBe('Design');
    expect(getByTestId('ide-export-upstream-design').textContent).toContain('Ready');
    expect(getByTestId('ide-export-upstream-verify').getAttribute('data-owner')).toBe('Simulate');
    expect(getByTestId('ide-export-upstream-verify').textContent).toContain('Draft');
    expect(getByTestId('ide-export-upstream-mapping').getAttribute('data-owner')).toBe('Board & Constraints');
    expect(getByTestId('ide-export-upstream-mapping').textContent).toContain('Ready');

    const packageFiles = getByTestId('ide-export-package-files');
    expect(packageFiles.tagName).toBe('DIV');
    expect(getByTestId('ide-export-file-top-vhd').textContent).toContain('top.vhd');
    expect(getByTestId('ide-export-file-top-xdc').textContent).toContain('top.xdc');
    expect(getByTestId('ide-export-file-browser')).toBeTruthy();
    expect(getByTestId('ide-export-selected-preview-v1')).toBeTruthy();
  });

  it('names Map Pins as the blocker owner and routes the one recovery action back to that workspace', () => {
    const project = buildProject();
    project.ioMapping!.outputs[0].pin = '';
    const onGoToHardware = vi.fn();
    const { getByTestId } = render(
      <ExportSurface
        project={project}
        determinismHash="ide-hash"
        onGoToHardware={onGoToHardware}
      />
    );

    const mappingRow = getByTestId('ide-export-upstream-mapping');
    expect(mappingRow.getAttribute('data-owner')).toBe('Board & Constraints');
    expect(mappingRow.textContent).toContain('1 required missing');
    expect(mappingRow.textContent).toContain('Board & Constraints');
    fireEvent.click(getByTestId('ide-export-blocked-open-map-pins'));
    expect(onGoToHardware).toHaveBeenCalledTimes(1);
  });

  it('keeps duplicate package-pin conflicts owned by Map Pins instead of reporting mapping as ready', () => {
    const project = buildProject();
    project.ioMapping!.outputs[0].pin = 'V17';
    const { getByTestId } = render(
      <ExportSurface
        project={project}
        determinismHash="ide-hash"
        onGoToHardware={vi.fn()}
      />
    );

    const mappingRow = getByTestId('ide-export-upstream-mapping');
    expect(mappingRow.getAttribute('data-owner')).toBe('Board & Constraints');
    expect(mappingRow.textContent).toContain('Resolve mapping blocker');
    expect(mappingRow.textContent).toMatch(/Duplicate pin assignment/i);
    expect(getByTestId('ide-export-blocked-open-map-pins')).toBeTruthy();
  });

  it('keeps draft state, package inspection, and the Verify next action as distinct work objects', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildProject()}
        determinismHash="ide-hash"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );

    const inspector = getByTestId('ide-export-package-inspector-v1');
    const packageContents = getByTestId('ide-export-package-contents');
    const verifyReadiness = getByTestId('ide-export-upstream-verify');

    expect(inspector.getAttribute('data-export-package-state')).toBe('draft');
    expect(inspector.textContent).toContain('Draft export available');
    expect(packageContents.textContent).not.toContain('Draft export available');
    expect(packageContents.textContent).toContain('Inspect the generated handoff');
    expect(verifyReadiness.textContent).toContain('Draft');
    expect(verifyReadiness.textContent).toContain('Run the current scenario');
    expect(getByTestId('ide-export-package-build-v1').textContent).toBe('Open Simulate');
    expect(getByTestId('ide-export-draft-download-v1').textContent).toBe('Download draft');
    expect(getByTestId('ide-export-e0-boundary-summary').textContent).toContain(
      'Browser E0 confirms package generation only'
    );
  });

  it('publishes Design-blocked Compare evidence as inconclusive instead of a prior FAIL', () => {
    const onGoToDesign = vi.fn();
    const failedVerify: ProjectHealthVerifyResult = {
      status: 'fail',
      hash: 'verify-fail-hash',
      ranAtIso: '2026-07-15T17:00:00.000Z',
      failingTick: 0,
    };
    const view = render(
      <ExportSurface
        project={buildProject()}
        determinismHash="ide-hash"
        verifyResult={failedVerify}
        designReady={false}
        designBlockingIssue={{
          title: 'Output LD2 is not driven',
          message: 'Connect a Design driver to LD2 before checking behavior.',
        }}
        workflowAuthority={makeWorkflowAuthority({
          verifyResult: failedVerify,
          hasBlockingDesignIssue: true,
        })}
        onGoToDesign={onGoToDesign}
      />
    );

    expect(view.getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-package-state')).toBe('blocked');
    const visibleVerifyAuthority = view.getByTestId('ide-export-upstream-verify');
    expect(visibleVerifyAuthority.textContent).toContain(
      'Inconclusive - Design blocked'
    );
    expect(visibleVerifyAuthority.textContent).toContain('Design blocked');
    expect(view.container.textContent).not.toContain('Compare FAIL');
    expect(view.container.textContent).not.toContain('Checks differ');

    fireEvent.click(view.getByTestId('ide-export-open-technical-evidence'));
    expect(view.getByTestId('ide-export-gate-verify').textContent).toContain(
      'Inconclusive - Design blocked'
    );
    expect(view.getByTestId('ide-export-gate-verify').textContent).not.toContain('Outputs differ');

    fireEvent.click(view.getByTestId('ide-export-blocked-open-design'));
    expect(onGoToDesign).toHaveBeenCalledTimes(1);
  });

  it('keeps draft package inspection available and offers Verify when Compare has not run yet', () => {
    const onOpenVerify = vi.fn();
    const { getByTestId } = render(
      <ExportSurface
        project={buildProject()}
        determinismHash="ide-hash"
        workflowAuthority={makeWorkflowAuthority()}
        onOpenVerify={onOpenVerify}
      />
    );

    expect(getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-package-state')).toBe('draft');
    expect(getByTestId('ide-export-package-build-v1').hasAttribute('disabled')).toBe(false);
    expect(getByTestId('ide-export-upstream-verify').textContent).toContain('Draft');
    expect(getByTestId('ide-export-file-browser')).toBeTruthy();
    fireEvent.click(getByTestId('ide-export-package-build-v1'));
    expect(onOpenVerify).toHaveBeenCalledTimes(1);
    fireEvent.click(getByTestId('ide-export-open-technical-evidence'));
    expect(getByTestId('ide-export-gate-verify').textContent).toContain('Not run yet');
    expect(getByTestId('ide-export-blockers-list').textContent).toContain('No comparison run found');
  });

  // ─── Commit 1: pass-incomplete is not trusted ────────────────────────────

  it('keeps the browser-E0 package boundary explicit without claiming external hardware proof', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildProject()}
        determinismHash="ide-hash"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );

    const boundary = getByTestId('ide-export-e0-boundary-summary');
    expect(boundary.textContent).toContain('Browser E0 confirms package generation only');
    expect(boundary.textContent).toContain('Vivado build');
    expect(boundary.textContent).toContain('bitstream');
    expect(boundary.textContent).toContain('programming');
    expect(boundary.textContent).toContain('physical board behavior remain external');
    expect(getByTestId('ide-export-package-inspector-v1').textContent).toContain('Draft export available');
    expect(getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-package-state')).toBe('draft');
    expect(getByTestId('ide-export-package-inspector-v1').textContent).not.toContain('Trusted E0 package');
  });

  it('treats pass-with-incomplete-mapping as unverified: export is NOT trusted', () => {
    const incompletePassRun: Parameters<typeof ExportSurface>[0]['verifyLastRun'] = {
      scenarioId: 'pass-scenario',
      scenarioName: 'Pass Scenario',
      status: 'pass',
      qualification: 'incomplete-mapping',
      deterministicHash: 'abc123',
      reportHash: 'rep-pass',
      generatedAtIso: '2026-02-27T00:00:00.000Z',
      schedule: 'combinational',
      meta: {
        circuitKind: 'combinational',
        clockingProtocol: null,
        samplePoint: 'steady-state',
        tick0Meaning: null,
        clockSignalName: null,
      },
      report: {
        vectors: [],
        inputsAtTick: {},
        inputsByVectorId: {},
        signalRoles: {},
        rows: [],
      } as Parameters<typeof ExportSurface>[0]['verifyLastRun']['report'],
      waveform: [],
    };

    const { getByTestId } = render(
      <ExportSurface
        project={buildProject()}
        determinismHash="ide-hash"
        verifyLastRun={incompletePassRun}
        verifyResult={{ status: 'pass', hash: 'abc123', reportHash: 'rep-pass' }}
        dirtySinceVerify={false}
        workflowAuthority={makeWorkflowAuthority({
          verifyResult: { status: 'pass', hash: 'abc123', reportHash: 'rep-pass' },
          verifyQualification: 'incomplete-mapping',
        })}
      />
    );

    // Readiness-first package state must remain a draft when Compare passed with incomplete mapping.
    expect(getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-package-state')).toBe('draft');
    expect(getByTestId('ide-export-package-inspector-v1').textContent).toContain('mapping review pending');
    expect(getByTestId('ide-export-package-build-v1').textContent).toBe('Open Map Pins');
    expect(getByTestId('ide-export-upstream-verify').textContent).toContain('Simulated');
    expect(getByTestId('ide-export-upstream-verify').textContent).toContain('A current simulation');
    expect(getByTestId('ide-export-upstream-mapping').textContent).toContain('Ready');
    expect(getByTestId('ide-export-readiness-hero').textContent).not.toContain('Trusted E0 package');
  });

  it('explains pass-with-incomplete-mapping as a mapping-trust problem, not a generic verify failure', () => {
    const incompletePassRun: Parameters<typeof ExportSurface>[0]['verifyLastRun'] = {
      scenarioId: 'pass-scenario',
      scenarioName: 'Pass Scenario',
      status: 'pass',
      qualification: 'incomplete-mapping',
      deterministicHash: 'abc123',
      reportHash: 'rep-pass',
      generatedAtIso: '2026-02-27T00:00:00.000Z',
      schedule: 'combinational',
      meta: {
        circuitKind: 'combinational',
        clockingProtocol: null,
        samplePoint: 'steady-state',
        tick0Meaning: null,
        clockSignalName: null,
      },
      report: {
        vectors: [],
        inputsAtTick: {},
        inputsByVectorId: {},
        signalRoles: {},
        rows: [],
      } as Parameters<typeof ExportSurface>[0]['verifyLastRun']['report'],
      waveform: [],
    };

    const { getByTestId } = render(
      <ExportSurface
        project={buildProject()}
        determinismHash="ide-hash"
        verifyLastRun={incompletePassRun}
        verifyResult={{ status: 'pass', hash: 'abc123', reportHash: 'rep-pass' }}
        dirtySinceVerify={false}
        workflowAuthority={makeWorkflowAuthority({
          verifyResult: { status: 'pass', hash: 'abc123', reportHash: 'rep-pass' },
          verifyQualification: 'incomplete-mapping',
        })}
      />
    );

    expect(getByTestId('ide-export-package-inspector-v1').textContent).toMatch(/mapping review pending/i);
    expect(getByTestId('ide-export-upstream-verify').textContent).toContain('Simulated');
    expect(getByTestId('ide-export-upstream-verify').textContent).toContain('A current simulation');
    expect(getByTestId('ide-export-package-build-v1').textContent).toBe('Open Map Pins');
    expect(getByTestId('ide-export-upstream-verify').textContent).not.toContain('Compare FAIL');
    fireEvent.click(getByTestId('ide-export-open-technical-evidence'));
    expect(getByTestId('ide-export-gate-verify').textContent).toContain('Pass incomplete - mapping');
    expect(getByTestId('ide-export-gate-verify').textContent).not.toContain('Outputs differ');
    expect(getByTestId('ide-export-blockers-list').textContent).toContain(
      'required output mapping was incomplete'
    );
  });

  it('readiness header keeps one primary repair CTA plus a clearly secondary draft download', () => {
    const onOpenVerify = vi.fn();
    const { getByTestId } = render(
      <ExportSurface project={buildProject()} determinismHash="ide-hash" onOpenVerify={onOpenVerify} />
    );

    const primaryActions = getByTestId('ide-export-primary-actions');
    const primaryButtons = within(primaryActions).getAllByRole('button');
    expect(primaryButtons).toHaveLength(3);
    expect(getByTestId('ide-export-validate-package').textContent).toBe('Validate package');
    expect(getByTestId('ide-export-package-build-v1').textContent).toBe('Open Simulate');
    expect(getByTestId('ide-export-draft-download-v1').textContent).toBe('Download draft');
    expect(getByTestId('ide-export-package-build-v1').hasAttribute('disabled')).toBe(false);

    // File inspection remains a separate work object and does not compete in the readiness action slot.
    expect(primaryActions.querySelector('[data-testid^="ide-export-file-"]')).toBeNull();
    expect(getByTestId('ide-export-package-files').tagName).toBe('DIV');
    expect(getByTestId('ide-export-file-browser')).toBeTruthy();
  });

  it('labels supported 4-NAND latches as latch-controlled and counts them as stateful', () => {
    const { getByTestId } = render(
      <ExportSurface project={buildRawFourNandLatchProject()} determinismHash="ide-hash" />
    );

    fireEvent.click(getByTestId('ide-export-open-technical-evidence'));
    expect(getByTestId('ide-export-gate-stack').textContent).toContain('Latch control');
    expect(getByTestId('ide-export-deterministic-checks').textContent).toContain('Supported latch control');
  });
});
