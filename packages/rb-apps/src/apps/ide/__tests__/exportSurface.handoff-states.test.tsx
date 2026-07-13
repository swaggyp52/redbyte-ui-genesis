// @vitest-environment jsdom
/**
 * Export surface handoff-state tests.
 * Verifies that the four trust-condition states (trusted / advisory / blocked)
 * and the new primitive components (ExportReadinessHero, ExportVivadoInstructions,
 * ExportAdvancedDetails) render correctly via the full ExportSurface pipeline.
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { ExportSurface } from '../surfaces/ExportSurface';
import type { ProjectHealthVerifyResult } from '../projectHealth';
import { deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';

// ── fixtures ──────────────────────────────────────────────────────────────────

function baseMappedProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-12T00:00:00.000Z',
    updatedAt: '2026-03-12T00:00:00.000Z',
    name: 'handoff-states-fixture',
    description: 'Handoff state test fixture',
    circuit: {
      nodes: [
        { id: 'sw0', type: 'INPUT', x: 100, y: 100, label: 'SW0', config: {}, state: {} },
        { id: 'ld0', type: 'OUTPUT', x: 300, y: 100, label: 'LD0', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'sw0', nodeId: 'sw0', port: 'out', label: 'SW0', pin: 'V17' }],
      outputs: [{ id: 'ld0', nodeId: 'ld0', port: 'in', label: 'LD0', pin: 'U16' }],
    },
    vectors: [],
    hdl: {
      top: 'top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: 'entity top is port(sw0:in bit;ld0:out bit); end top;',
        },
      ],
    },
    fpga: { board: 'basys3', top: 'top' },
  };
}

const passVerify: ProjectHealthVerifyResult = {
  status: 'pass',
  runKind: 'compare',
  hash: 'abc999',
  reportHash: 'rep999',
  ranAtIso: '2026-03-25T00:00:00.000Z',
};

const failVerify: ProjectHealthVerifyResult = {
  status: 'fail',
  runKind: 'compare',
  hash: 'abc888',
  reportHash: 'rep888',
  ranAtIso: '2026-03-25T00:00:00.000Z',
};

function makeAuthority(opts: {
  verifyResult?: ProjectHealthVerifyResult;
  dirtySinceVerify?: boolean;
  exportHash?: string;
  currentExportHash?: string;
} = {}) {
  const { verifyResult, dirtySinceVerify = false, exportHash = 'exp-hash', currentExportHash = exportHash } = opts;
  const verifyHash = verifyResult?.hash ?? null;
  return deriveProjectWorkflowAuthority({
    projectHealthCore: {
      lastVerify: verifyResult ?? undefined,
      lastExport: exportHash
        ? { status: 'ok', hash: exportHash, ranAtIso: '2026-03-12T00:10:00.000Z' }
        : undefined,
      dirtySinceVerify,
      dirtySinceExport: Boolean(exportHash && currentExportHash && exportHash !== currentExportHash),
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
    currentExportHash: currentExportHash ?? undefined,
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ExportSurface handoff states', () => {
  afterEach(() => { cleanup(); });

  // ── Trusted state ────────────────────────────────────────────────────────────

  it('trusted: readiness hero owns the ready status and sole Download Package action', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="abc999"
        verifyResult={passVerify}
        dirtySinceVerify={false}
        workflowAuthority={makeAuthority({ verifyResult: passVerify, exportHash: 'abc999' })}
      />
    );
    const hero = getByTestId('ide-export-readiness-hero');
    expect(hero.textContent).toContain('E0 export package ready');
    expect(hero.textContent).toContain('READY');
    const actions = getByTestId('ide-export-primary-actions');
    expect(actions.querySelectorAll('button')).toHaveLength(1);
    expect(getByTestId('ide-export-package-download-v1').textContent).toBe('Download Package');
    expect(getByTestId('ide-export-panel').querySelector('[data-testid="ide-panel-title-row"]')).toBeNull();
  });

  // ── Advisory state ───────────────────────────────────────────────────────────

  it('advisory: readiness hero shows a draft when Verify has not run', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    const hero = getByTestId('ide-export-readiness-hero');
    expect(hero.textContent).toContain('Draft export available');
    expect(hero.textContent).toContain('No expected-output comparison');
  });

  it('advisory: the sole readiness action routes to Verify when Verify has not run', () => {
    const onOpenVerify = vi.fn();
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        onOpenVerify={onOpenVerify}
        workflowAuthority={makeAuthority()}
      />
    );
    const actions = getByTestId('ide-export-primary-actions');
    expect(actions.querySelectorAll('button')).toHaveLength(1);
    expect(getByTestId('ide-export-package-build-v1').textContent).toBe('Open Verify');
    fireEvent.click(getByTestId('ide-export-package-build-v1'));
    expect(onOpenVerify).toHaveBeenCalledTimes(1);
  });

  it('advisory: readiness hero names a failed Compare as draft evidence', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="abc888"
        verifyResult={failVerify}
        dirtySinceVerify={false}
        workflowAuthority={makeAuthority({ verifyResult: failVerify, exportHash: 'abc888' })}
      />
    );
    expect(getByTestId('ide-export-readiness-hero').textContent).toContain('Draft export available');
    expect(getByTestId('ide-export-confidence-verify').textContent).toContain('Compare FAIL');
  });

  it('blocked: hides generated files and offers one truthful Map Pins repair', () => {
    const project = baseMappedProject();
    project.ioMapping!.outputs[0] = { ...project.ioMapping!.outputs[0], pin: '' };
    const onGoToHardware = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <ExportSurface
        project={project}
        determinismHash="blocked-map"
        verifyResult={passVerify}
        workflowAuthority={makeAuthority({ verifyResult: passVerify, exportHash: 'blocked-map' })}
        onGoToHardware={onGoToHardware}
      />
    );

    expect(getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-package-state')).toBe('blocked');
    expect(queryByTestId('ide-export-file-browser-v1')).toBeNull();
    const actions = getByTestId('ide-export-primary-actions');
    expect(actions.querySelectorAll('button')).toHaveLength(1);
    expect(getByTestId('ide-export-blocked-open-map-pins').textContent).toBe('Open Mapping');
    fireEvent.click(getByTestId('ide-export-blocked-open-map-pins'));
    expect(onGoToHardware).toHaveBeenCalledTimes(1);
  });

  // ── Provenance rows ───────────────────────────────────────────────────────────

  it('readiness details show Not run when verifyResult is absent', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    expect(getByTestId('ide-export-confidence-verify').textContent).toContain('Not run');
  });

  it('readiness details show current Compare PASS when verify passed and not stale', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="abc999"
        verifyResult={passVerify}
        dirtySinceVerify={false}
        workflowAuthority={makeAuthority({ verifyResult: passVerify, exportHash: 'abc999' })}
      />
    );
    expect(getByTestId('ide-export-confidence-verify').textContent).toContain('Current Compare PASS');
  });

  it('shows a truthful rebuild action when export hash predates the current design hash', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="current-hash"
        verifyResult={passVerify}
        dirtySinceVerify={false}
        workflowAuthority={makeAuthority({ verifyResult: passVerify, exportHash: 'older-hash', currentExportHash: 'current-hash' })}
      />
    );
    expect(getByTestId('ide-export-readiness-hero').textContent).toMatch(/stale|build/i);
    expect(getByTestId('ide-export-package-build-v1').textContent).toMatch(/build|rebuild/i);
  });

  // ── ExportVivadoInstructions ──────────────────────────────────────────────────

  it('ide-export-vivado-ready section renders (ExportVivadoInstructions)', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    expect(getByTestId('ide-export-vivado-ready')).toBeTruthy();
  });

  it('ide-export-vivado-checklist has 8 numbered steps', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    const checklist = getByTestId('ide-export-vivado-checklist');
    expect(checklist.querySelectorAll('li')).toHaveLength(8);
  });

  // ── ExportAdvancedDetails ─────────────────────────────────────────────────────

  it('ide-export-advanced-details renders (ExportAdvancedDetails)', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    expect(getByTestId('ide-export-advanced-details')).toBeTruthy();
  });

  it('ide-export-determinism-checks is inside ide-export-advanced-details', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    const advanced = getByTestId('ide-export-advanced-details');
    expect(within(advanced).getByTestId('ide-export-determinism-checks')).toBeTruthy();
  });
});
