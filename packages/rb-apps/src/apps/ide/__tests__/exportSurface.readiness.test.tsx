// @vitest-environment jsdom
/**
 * Export surface readiness structure tests.
 * Verifies the five-zone layout and key structural invariants introduced
 * in the export handoff pass.
 */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
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
  runKind: 'compare',
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

  it('renders ide-export-readiness-hero as the outer hero section', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );
    expect(getByTestId('ide-export-readiness-hero')).toBeTruthy();
  });

  it('ide-export-summary-card is inside ide-export-readiness-hero', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );
    const hero = getByTestId('ide-export-readiness-hero');
    expect(within(hero).getByTestId('ide-export-summary-card')).toBeTruthy();
  });

  it('ide-export-checks-dock is inside ide-export-readiness-hero', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );
    const hero = getByTestId('ide-export-readiness-hero');
    expect(within(hero).getByTestId('ide-export-checks-dock')).toBeTruthy();
  });

  it('ide-export-design-summary is inside ide-export-readiness-hero', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );
    const hero = getByTestId('ide-export-readiness-hero');
    expect(within(hero).getByTestId('ide-export-design-summary')).toBeTruthy();
  });

  it('ide-export-summary-card eyebrow has no duplicate status pill', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="h1"
        verifyResult={passResult}
        dirtySinceVerify={false}
        workflowAuthority={makeWorkflowAuthority({ verifyResult: passResult })}
      />
    );
    const card = getByTestId('ide-export-summary-card');
    expect(card.textContent).toContain('Handoff summary');
    // Eyebrow has only the span, no pill
    const eyebrow = card.querySelector('.ide-export-summary-eyebrow');
    expect(eyebrow).toBeTruthy();
    expect(eyebrow!.children).toHaveLength(1);
  });

  it('ide-export-package-handoff is in the DOM (collapsed in details)', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );
    expect(getByTestId('ide-export-package-handoff')).toBeTruthy();
  });

  it('ide-export-build-output and ide-export-artifact-preview both exist', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );
    expect(getByTestId('ide-export-build-output')).toBeTruthy();
    expect(getByTestId('ide-export-artifact-preview')).toBeTruthy();
  });

  it('ide-export-mapping-table is in the DOM (collapsed in details)', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );
    expect(getByTestId('ide-export-mapping-table')).toBeTruthy();
  });

  it('ide-export-advanced-details wraps determinism-checks and evidence-details', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );
    const advanced = getByTestId('ide-export-advanced-details');
    expect(within(advanced).getByTestId('ide-export-determinism-checks')).toBeTruthy();
    expect(within(advanced).getByTestId('ide-export-evidence-details')).toBeTruthy();
  });

  it('readiness hero contains READY text when export is trusted', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="h1"
        verifyResult={passResult}
        dirtySinceVerify={false}
        workflowAuthority={makeWorkflowAuthority({ verifyResult: passResult })}
      />
    );
    expect(getByTestId('ide-export-readiness-hero').textContent).toContain('READY');
  });
});
