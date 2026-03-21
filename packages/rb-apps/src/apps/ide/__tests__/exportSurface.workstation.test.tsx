// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { ExportSurface } from '../surfaces/ExportSurface';

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

describe('ExportSurface workstation redesign', () => {
  afterEach(() => { cleanup(); });

  it('shows the summary hero, grouped artifacts, key copy actions, and compact Vivado guidance', () => {
    const { getByTestId, getByText } = render(
      <ExportSurface project={buildProject()} determinismHash="ide-hash" />
    );

    expect(getByTestId('ide-export-summary-card').textContent).toContain('Engineering handoff');
    expect(getByTestId('ide-export-design-summary').textContent).toContain('Mapped Pins');
    expect(getByTestId('ide-export-design-summary').textContent).toContain('Gates');

    expect(getByTestId('ide-export-artifact-group-hdl')).toBeTruthy();
    expect(getByTestId('ide-export-artifact-group-constraints')).toBeTruthy();
    expect(getByTestId('ide-export-artifact-group-project')).toBeTruthy();

    expect(getByTestId('ide-export-copy-top-vhd')).toBeTruthy();
    expect(getByTestId('ide-export-copy-top-xdc')).toBeTruthy();
    expect(getByTestId('ide-export-copy-vivado-import')).toBeTruthy();
    expect(getByTestId('ide-export-copy-current')).toBeTruthy();

    const checklist = within(getByTestId('ide-export-vivado-checklist')).getAllByRole('listitem');
    expect(checklist).toHaveLength(3);
    expect(checklist[0].textContent).toContain('Open Vivado');
    expect(getByText('Advanced / full checklist')).toBeTruthy();
  });

  it('keeps project export available when verify has not run yet', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <ExportSurface project={buildProject()} determinismHash="ide-hash" />
    );

    expect(getByTestId('ide-export-dock-download').hasAttribute('disabled')).toBe(false);
    expect(getByTestId('ide-export-vivado-unverified-callout').textContent).toContain(
      'Artifacts available'
    );
    expect(getByTestId('ide-export-blockers-callout')).toBeTruthy();
    expect(getByTestId('ide-export-unverified-callout').textContent).toContain(
      'Verification is required before trusted handoff'
    );
    expect(getByText('Advisories')).toBeTruthy();
    expect(queryByTestId('ide-export-vivado-blocked-callout')).toBeNull();
  });

  // ─── Commit 1: pass-incomplete is not trusted ────────────────────────────

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
      />
    );

    // Handoff sidecard should NOT show READY — pass-incomplete is not a trusted export
    const pill = getByTestId('ide-export-checks-dock').querySelector('[data-testid]');
    const dockText = getByTestId('ide-export-checks-dock').textContent ?? '';
    expect(dockText).not.toContain('READY');
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
      />
    );

    expect(getByTestId('ide-export-trust-reason').textContent).toMatch(/mapped|mapping|unsealed/i);
    expect(getByTestId('ide-export-blockers-callout').textContent).toMatch(/mapping|unsealed|trusted/i);
    expect(getByTestId('ide-export-gate-verify').textContent).not.toContain('Outputs differ');
  });

  it('hero has exactly one primary handoff CTA — no competing secondary download in the hero zone', () => {
    const { getByTestId, queryByTestId } = render(
      <ExportSurface project={buildProject()} determinismHash="ide-hash" />
    );

    // The primary CTA wrapper must exist in the hero
    expect(getByTestId('ide-export-primary-handoff-cta')).toBeTruthy();
    // The primary rebuild button inside the hero must be enabled (no blockers in this project)
    expect(getByTestId('ide-export-rebuild-btn').hasAttribute('disabled')).toBe(false);

    // The kit download is absent from the summary hero — it lives in the right-column
    // "Other outputs" collapsed section so it never visually competes with the primary CTA.
    const hero = getByTestId('ide-export-summary-card');
    expect(hero.querySelector('[data-testid="ide-export-download-kit-btn"]')).toBeNull();
    // The ghost Design-back button is also absent from the hero CTA zone
    expect(hero.querySelector('[data-testid="ide-export-go-design-header"]')).toBeNull();

    // The kit button still exists on the page — in the download block, collapsed under Other outputs
    expect(getByTestId('ide-export-download-kit-btn')).toBeTruthy();
    expect(getByTestId('ide-export-other-outputs')).toBeTruthy();
  });
});
