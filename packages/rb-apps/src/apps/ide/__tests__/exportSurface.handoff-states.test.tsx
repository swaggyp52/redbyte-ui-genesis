// @vitest-environment jsdom
/**
 * Export surface handoff-state tests.
 * Verifies that the four trust-condition states (trusted / advisory / blocked)
 * and the new primitive components (ExportReadinessHero, ExportVivadoInstructions,
 * ExportAdvancedDetails) render correctly via the full ExportSurface pipeline.
 */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
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
} = {}) {
  const { verifyResult, dirtySinceVerify = false, exportHash = 'exp-hash' } = opts;
  const verifyHash = verifyResult?.hash ?? null;
  return deriveProjectWorkflowAuthority({
    projectHealthCore: {
      lastVerify: verifyResult ?? undefined,
      lastExport: exportHash
        ? { status: 'ok', hash: exportHash, ranAtIso: '2026-03-12T00:10:00.000Z' }
        : undefined,
      dirtySinceVerify,
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
    currentExportHash: exportHash ?? undefined,
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ExportSurface handoff states', () => {
  afterEach(() => { cleanup(); });

  // ── Trusted state ────────────────────────────────────────────────────────────

  it('trusted: trust banner shows READY pill', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="abc999"
        verifyResult={passVerify}
        dirtySinceVerify={false}
        workflowAuthority={makeAuthority({ verifyResult: passVerify, exportHash: 'abc999' })}
      />
    );
    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('READY');
  });

  // ── Advisory state ───────────────────────────────────────────────────────────

  it('advisory: trust banner shows NEEDS REVIEW when verify not run', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('NEEDS REVIEW');
  });

  it('advisory: ide-export-trust-go-verify button is present when verify not run', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        onOpenVerify={() => undefined}
        workflowAuthority={makeAuthority()}
      />
    );
    expect(getByTestId('ide-export-trust-go-verify')).toBeTruthy();
  });

  it('advisory: trust banner shows NEEDS REVIEW when verify failed', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="abc888"
        verifyResult={failVerify}
        dirtySinceVerify={false}
        workflowAuthority={makeAuthority({ verifyResult: failVerify, exportHash: 'abc888' })}
      />
    );
    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('NEEDS REVIEW');
  });

  // ── Provenance rows ───────────────────────────────────────────────────────────

  it('provenance-verify shows Not run when verifyResult is absent', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    expect(getByTestId('ide-export-provenance-verify').textContent).toContain('Not run');
  });

  it('provenance-verify shows Checks match when verify passed and not stale', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="abc999"
        verifyResult={passVerify}
        dirtySinceVerify={false}
        workflowAuthority={makeAuthority({ verifyResult: passVerify, exportHash: 'abc999' })}
      />
    );
    expect(getByTestId('ide-export-provenance-verify').textContent).toContain('Checks match');
  });

  it('provenance-build shows Previous when export hash predates the current design hash', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="current-hash"
        verifyResult={passVerify}
        dirtySinceVerify={false}
        workflowAuthority={makeAuthority({ verifyResult: passVerify, exportHash: 'older-hash' })}
      />
    );
    expect(getByTestId('ide-export-provenance-build').textContent).toContain('Previous');
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

  it('ide-export-vivado-checklist has 3 items', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    const checklist = getByTestId('ide-export-vivado-checklist');
    expect(checklist.querySelectorAll('li')).toHaveLength(3);
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
