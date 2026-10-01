// @vitest-environment jsdom
/**
 * Export surface readiness structure tests.
 * Verifies the current package workspace, report, and requested technical evidence
 * while preserving identity, mapping, structural readiness, and receipt boundaries.
 */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { ExportSurface } from '../surfaces/ExportSurface';
import type { ProjectHealthVerifyResult } from '../projectHealth';
import { deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';

// ── fixture ─────────────────────────────────────────────────────────────────

function buildMappedProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-12T00:00:00.000Z',
    updatedAt: '2026-03-12T00:00:00.000Z',
    name: 'readiness-structure-mapped',
    description: 'Readiness structure fixture — all pins mapped',
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
      inputs: [{ id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', pin: 'V17' }],
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
            'entity top is',
            '  port ( sw0 : in std_logic; ld0 : out std_logic );',
            'end top;',
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
  runKind: 'verify',
  hash: 'abc123',
  reportHash: 'rep123',
  ranAtIso: '2026-03-25T00:00:00.000Z',
};

function makeWorkflowAuthority(options: { verifyResult?: ProjectHealthVerifyResult } = {}) {
  const verifyResult = options.verifyResult;
  const verifyHash = verifyResult?.hash ?? null;
  return deriveProjectWorkflowAuthority({
    projectHealthCore: {
      lastVerify: verifyResult ?? undefined,
      lastExport: {
        status: 'ok',
        hash: 'export-hash',
        ranAtIso: '2026-03-12T00:10:00.000Z',
      },
      dirtySinceVerify: false,
      dirtySinceExport: false,
    },
    readiness: {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: undefined,
    },
    verifyLastRun: verifyResult,
    verifyRunHistory: verifyHash ? [{ projectHash: verifyHash }] : undefined,
    currentVerifyProjectHash: verifyHash,
    currentExportHash: 'export-hash',
  });
}

// ── tests ───────────────────────────────────────────────────────────────────

describe('ExportSurface readiness structure', () => {
  afterEach(() => { cleanup(); });

  function renderMapped(checked = false) {
    return render(<ExportSurface project={buildMappedProject()} determinismHash="h1"
      verifyResult={checked ? passResult : undefined}
      workflowAuthority={makeWorkflowAuthority({ verifyResult: checked ? passResult : undefined })} />);
  }

  it('renders the readiness hero as the package workspace', () => {
    const view = renderMapped();
    expect(view.getByTestId('ide-export-readiness-hero').getAttribute('data-document')).toBe('artifacts');
  });

  it('keeps package identity and decision inside the readiness hero', () => {
    const view = renderMapped();
    const hero = view.getByTestId('ide-export-readiness-hero');
    const decision = within(hero).getByTestId('ide-export-package-inspector-v1');
    expect(within(decision).getByTestId('ide-export-package-identity').textContent).toBe('readiness-structure-mapped');
  });

  it('reveals readiness checks through the technical details interaction', () => {
    const view = renderMapped();
    expect(view.queryByTestId('ide-export-gate-stack')).toBeNull();
    fireEvent.click(view.getByTestId('ide-export-open-technical-evidence'));
    const dialog = view.getByTestId('ide-export-technical-dialog');
    expect(within(dialog).getByTestId('ide-export-gate-stack')).toBeTruthy();
    expect(within(dialog).getByTestId('ide-export-gate-mapping').textContent).toContain('2/2 required');
  });

  it('shows the current generated design source in the selected preview', () => {
    const view = renderMapped();
    fireEvent.click(view.getByTestId('ide-export-file-top-vhd'));
    expect(view.getByTestId('ide-export-preview-path').textContent).toBe('top.vhd');
    expect(view.getByTestId('ide-export-preview-code').textContent).toContain('entity top is');
  });

  it('keeps a single package eyebrow separate from the derived status', () => {
    const view = renderMapped(true);
    const decision = view.getByTestId('ide-export-package-inspector-v1');
    const eyebrows = decision.querySelectorAll('.ide-surface-block-label');
    expect(eyebrows).toHaveLength(1);
    expect(eyebrows[0].textContent).toBe('Vivado package');
    expect(within(decision).getByTestId('ide-export-derived-state').textContent).toBe('Package current');
  });

  it('offers role-specific submission handoff through its collapsed guidance disclosure', () => {
    const view = renderMapped();
    const disclosure = view.getByTestId('ide-export-readiness-disclosure');
    expect(disclosure.hasAttribute('open')).toBe(false);
    const summary = disclosure.querySelector('summary');
    if (!summary) throw new Error('Readiness disclosure must have an actionable summary');
    fireEvent.click(summary);
    for (const role of ['project', 'source', 'constraints', 'simulation', 'readme']) {
      expect(within(disclosure).getByTestId(`ide-export-submission-role-${role}`)).toBeTruthy();
    }
  });

  it('keeps generation and artifact preview as distinct work objects', () => {
    const view = renderMapped();
    expect(view.getByTestId('ide-export-draft-download-v1').textContent).toBe('Generate & download draft ZIP');
    expect(view.getByTestId('ide-export-artifact-preview')).toBeTruthy();
    expect(view.getByTestId('ide-export-primary-actions').contains(view.getByTestId('ide-export-artifact-preview'))).toBe(false);
  });

  it('shows read-only mapping in the explicit handoff report', () => {
    const view = render(<ExportSurface project={buildMappedProject()} determinismHash="h1" activeDocument={{ kind: 'handoff' }} />);
    const mapping = view.getByTestId('ide-package-handoff-mapping');
    expect(mapping.textContent).toContain('V17');
    expect(mapping.textContent).toContain('U16');
    expect(within(mapping).queryByRole('textbox')).toBeNull();
  });

  it('groups determinism checks and build identity in requested technical evidence', () => {
    const view = renderMapped();
    expect(view.queryByTestId('ide-export-deterministic-checks')).toBeNull();
    fireEvent.click(view.getByTestId('ide-export-open-technical-evidence'));
    const dialog = view.getByTestId('ide-export-technical-dialog');
    expect(within(dialog).getByTestId('ide-export-deterministic-checks')).toBeTruthy();
    expect(within(dialog).getByTestId('ide-export-trust-axes')).toBeTruthy();
    expect(dialog.textContent).toContain('Build identity');
    expect(dialog.textContent).toContain('Export hash');
  });

  it('shows current checked evidence without claiming a ready download receipt', () => {
    const view = renderMapped(true);
    const decision = view.getByTestId('ide-export-package-inspector-v1');
    expect(decision.getAttribute('data-export-verification-trust')).toBe('trusted');
    expect(decision.getAttribute('data-export-action-state')).toBe('not-downloaded');
    expect(decision.getAttribute('data-export-package-state')).toBe('draft');
    expect(view.getByTestId('ide-export-derived-state').textContent).toBe('Package current');
    expect(view.getByTestId('ide-export-package-build-v1').textContent).toBe('Generate & download checked ZIP');
  });
});
