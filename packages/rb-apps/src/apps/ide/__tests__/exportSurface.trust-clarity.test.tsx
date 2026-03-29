// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
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

const traceResult: ProjectHealthVerifyResult = {
  status: 'pass',
  runKind: 'trace',
  hash: 'abc123trace',
  reportHash: 'rep-trace',
  ranAtIso: '2026-03-25T00:00:00.000Z',
};

describe('ExportSurface trust clarity', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function runProjectDownloadInView(
    ui: React.ReactElement,
    expectedHash?: string
  ): Promise<void> {
    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    }
    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export-test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const onExportResult = vi.fn();
    const view = render(React.cloneElement(ui, { onExportResult }));

    await act(async () => {
      fireEvent.click(view.getByTestId('ide-export-dock-download'));
    });

    await waitFor(() => {
      expect(onExportResult).toHaveBeenCalled();
    });

    const latestCall = onExportResult.mock.calls.at(-1)?.[0];
    expect(latestCall).toEqual(
      expect.objectContaining({
        status: 'ok',
      })
    );
    if (expectedHash !== undefined) {
      expect(latestCall).toEqual(
        expect.objectContaining({
          hash: expectedHash,
        })
      );
    }

    expect(view.queryByTestId('ide-export-capsule-error')).toBeNull();
  }

  it('compare-aligned export state renders as available without blocked copy', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={passResult}
        dirtySinceVerify={false}
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('EXPORT AVAILABLE');
    expect(banner.textContent).not.toContain('BLOCKED');
  });

  it('advisory export state names comparison status without blocking download', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        // No verifyResult -> available with advisory compare state
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('AVAILABLE');
    expect(banner.textContent).toContain('NOT COMPARED');
  });

  it('shows trace-only provenance instead of collapsing it into assertions match', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={traceResult}
        dirtySinceVerify={false}
      />
    );

    expect(getByTestId('ide-export-provenance-verify').textContent).toContain('Trace only');
    expect(getByTestId('ide-export-trust-reason').textContent).toContain('trace-only run');
    expect(getByTestId('ide-export-trust-consequence').textContent).toContain('assertion-backed evidence');
  });

  it('surfaces stale verify evidence instead of old comparison failure after the design changes', () => {
    const { getByTestId, queryByText } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={failResult}
        dirtySinceVerify={true}
      />
    );

    expect(getByTestId('ide-export-trust-banner').textContent).toContain('VERIFY STALE');
    expect(getByTestId('ide-export-trust-reason').textContent?.toLowerCase()).toContain('stale');
    expect(getByTestId('ide-export-trust-reason').textContent?.toLowerCase()).not.toContain(
      'differed at tick'
    );
    expect(getByTestId('ide-export-trust-consequence').textContent).toContain('Re-run Verify');
    expect(queryByText(/assertions differ from observed outputs/i)).toBeNull();
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
        // No verifyResult -> advisory AVAILABLE state
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('AVAILABLE');
    // Verify routing button must be visible
    expect(getByTestId('ide-export-trust-go-verify')).toBeTruthy();
  });

  it('download-allowed advisory state is clearly labeled with consequence', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        // No verifyResult -> available with advisory compare state
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    // Must show AVAILABLE, not BLOCKED
    expect(banner.textContent).toContain('AVAILABLE');
    expect(banner.textContent).not.toContain('BLOCKED');
    // Consequence language must guide student to next action
    const consequence = getByTestId('ide-export-trust-consequence');
    expect(consequence.textContent).toMatch(/Compare|expected-output|export/i);
    // Download button must remain enabled (not disabled) in AVAILABLE state
    expect(getByTestId('ide-export-dock-download').hasAttribute('disabled')).toBe(false);
  });

  it('lets project download complete when Verify has not run yet', async () => {
    const project = buildMappedProject();

    await runProjectDownloadInView(
      <ExportSurface project={project} determinismHash="ide-hash" />,
      undefined
    );
  });

  it('lets project download complete when Verify failed against the current reference', async () => {
    const project = buildMappedProject();

    await runProjectDownloadInView(
      <ExportSurface project={project} determinismHash="ide-hash" verifyResult={failResult} />,
      undefined
    );
  });

  it('lets project download complete when the last comparison-aligned run is stale', async () => {
    const project = buildMappedProject();

    await runProjectDownloadInView(
      <ExportSurface
        project={project}
        determinismHash="ide-hash"
        verifyResult={passResult}
        dirtySinceVerify={true}
      />,
      undefined
    );
  });

  it('does not claim the design is valid when live authority is incomplete', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        designReady={false}
      />
    );

    expect(getByTestId('ide-export-readiness-design').textContent).toContain('Design: incomplete');
    expect(getByTestId('ide-export-trust-banner').textContent).toContain('BLOCKED');
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
    expect(banner.textContent).toContain('ASSERTIONS DIFFER');
    expect(banner.textContent).not.toContain('BLOCKED');
    expect(getByTestId('ide-export-dock-download').hasAttribute('disabled')).toBe(false);
  });
});
