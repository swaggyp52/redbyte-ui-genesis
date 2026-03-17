// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { ExportSurface } from '../surfaces/ExportSurface';
import type { ProjectHealthVerifyResult } from '../projectHealth';

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

describe('ExportSurface trust clarity', () => {
  afterEach(() => { cleanup(); });

  it('trusted export state renders TRUSTED clearly', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={passResult}
        dirtySinceVerify={false}
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('TRUSTED');
    expect(banner.textContent).not.toContain('BLOCKED');
    expect(banner.textContent).not.toContain('NOT TRUSTED');
  });

  it('untrusted export state names the verify blocker', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        // No verifyResult → AVAILABLE, NOT TRUSTED
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('AVAILABLE');
    expect(banner.textContent).toContain('NOT TRUSTED');
    // Must name the verification reason, not just generic text
    expect(banner.textContent).toMatch(/[Vv]erif/);
  });

  it('mapping blocker points to Hardware', () => {
    const onGoToHardware = vi.fn();
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappingBlockedProject()}
        determinismHash="ide-hash"
        onGoToHardware={onGoToHardware}
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    // Trust banner must be in BLOCKED state
    expect(banner.textContent).toContain('BLOCKED');
    // Hardware routing button must be visible
    expect(getByTestId('ide-export-trust-go-hardware')).toBeTruthy();
  });

  it('verify blocker points to Verify', () => {
    const onOpenVerify = vi.fn();
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        onOpenVerify={onOpenVerify}
        // No verifyResult → unverified AVAILABLE state
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('AVAILABLE');
    // Verify routing button must be visible
    expect(getByTestId('ide-export-trust-go-verify')).toBeTruthy();
  });

  it('download-allowed-but-untrusted state is clearly labeled with consequence', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        // No verifyResult → AVAILABLE, NOT TRUSTED
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    // Must show AVAILABLE — not TRUSTED, not BLOCKED
    expect(banner.textContent).toContain('AVAILABLE');
    expect(banner.textContent).toContain('NOT TRUSTED');
    expect(banner.textContent).not.toContain('BLOCKED');
    // Consequence language must guide student to next action
    const consequence = getByTestId('ide-export-trust-consequence');
    expect(consequence.textContent).toMatch(/Test|PASS|trusted/i);
    // Download button must remain enabled (not disabled) in AVAILABLE state
    expect(getByTestId('ide-export-dock-download').hasAttribute('disabled')).toBe(false);
  });

  it('keeps export available when verify failed against the selected reference', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={failResult}
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('AVAILABLE');
    expect(banner.textContent).toContain('NOT TRUSTED');
    expect(banner.textContent).not.toContain('BLOCKED');
    expect(getByTestId('ide-export-dock-download').hasAttribute('disabled')).toBe(false);
  });
});
