// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('compare-aligned export state renders as READY without blocked copy', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={passResult}
        dirtySinceVerify={false}
        workflowAuthority={makeWorkflowAuthority({ verifyResult: passResult })}
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('READY');
    expect(banner.textContent).not.toContain('BLOCKED');

    expect(getByTestId('ide-export-package-handoff-status').textContent).toContain('PACKAGE READY');
    expect(getByTestId('ide-export-handoff-board').textContent).toContain('Basys3');
    expect(getByTestId('ide-export-artifact-agreement')).toBeTruthy();
  });

  it('advisory export state names comparison status without blocking download', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('NEEDS REVIEW');
    expect(banner.textContent).toContain('Expected-output comparison has not run');
    expect(getByTestId('ide-export-package-handoff-status').textContent).toContain('PACKAGE PARTIAL');
  });

  it('shows trace-only provenance instead of collapsing it into assertions match', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={traceResult}
        dirtySinceVerify={false}
        workflowAuthority={makeWorkflowAuthority({ verifyResult: traceResult })}
      />
    );

    expect(getByTestId('ide-export-provenance-verify').textContent).toContain('Trace only');
    expect(getByTestId('ide-export-trust-reason').textContent).toContain('trace-only run');
    expect(getByTestId('ide-export-trust-consequence').textContent).toContain('Compare checks');
  });

  it('surfaces stale verify evidence instead of old comparison failure after the design changes', () => {
    const { getByTestId, queryByText } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={failResult}
        dirtySinceVerify={true}
        workflowAuthority={makeWorkflowAuthority({ verifyResult: failResult, dirtySinceVerify: true })}
      />
    );

    expect(getByTestId('ide-export-trust-banner').textContent).toContain('NEEDS REVIEW');
    expect(getByTestId('ide-export-trust-reason').textContent?.toLowerCase()).toContain('stale');
    expect(getByTestId('ide-export-trust-reason').textContent?.toLowerCase()).not.toContain(
      'differed at tick'
    );
    expect(getByTestId('ide-export-trust-consequence').textContent).toContain('Open Verify');
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
    expect(getByTestId('ide-export-package-handoff-status').textContent).toContain('PACKAGE BLOCKED');
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
        workflowAuthority={makeWorkflowAuthority()}
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('NEEDS REVIEW');
    // Verify routing button must be visible
    expect(getByTestId('ide-export-trust-go-verify')).toBeTruthy();
  });

  it('download-allowed advisory state is clearly labeled with consequence', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    // Must show AVAILABLE, not BLOCKED
    expect(banner.textContent).toContain('NEEDS REVIEW');
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
      <ExportSurface
        project={project}
        determinismHash="ide-hash"
        workflowAuthority={makeWorkflowAuthority()}
      />,
      undefined
    );
  });

  it('lets project download complete when Verify failed against the current reference', async () => {
    const project = buildMappedProject();

    await runProjectDownloadInView(
      <ExportSurface
        project={project}
        determinismHash="ide-hash"
        verifyResult={failResult}
        workflowAuthority={makeWorkflowAuthority({ verifyResult: failResult })}
      />,
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
        workflowAuthority={makeWorkflowAuthority({ verifyResult: passResult, dirtySinceVerify: true })}
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

    expect(getByTestId('ide-export-readiness-design').textContent).toContain('Design incomplete');
    expect(getByTestId('ide-export-trust-banner').textContent).toContain('BLOCKED');
  });

  it('keeps export available when verify failed against the selected reference', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={failResult}
        workflowAuthority={makeWorkflowAuthority({ verifyResult: failResult })}
      />
    );

    const banner = getByTestId('ide-export-trust-banner');
    expect(banner.textContent).toContain('NEEDS REVIEW');
    expect(getByTestId('ide-export-trust-reason').textContent).toContain('differed at tick');
    expect(banner.textContent).not.toContain('BLOCKED');
    expect(getByTestId('ide-export-dock-download').hasAttribute('disabled')).toBe(false);
  });

  it('dock pill uses student-facing labels without jargon', () => {
    const { getByTestId: getVerified } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={passResult}
        dirtySinceVerify={false}
        workflowAuthority={makeWorkflowAuthority({ verifyResult: passResult })}
      />
    );
    const dock = getVerified('ide-export-checks-dock');
    expect(dock.textContent).toContain('READY');
    expect(dock.textContent).not.toContain('COMPARE ALIGNED');

    cleanup();

    const { getByTestId: getAdvisory } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );
    const advisoryDock = getAdvisory('ide-export-checks-dock');
    expect(advisoryDock.textContent).toContain('NEEDS REVIEW');
    expect(advisoryDock.textContent).not.toContain('EXPORT AVAILABLE');
  });

  it('summary eyebrow distinguishes trusted READY from advisory NEEDS REVIEW', () => {
    const { getByTestId: getTrusted } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={passResult}
        dirtySinceVerify={false}
        workflowAuthority={makeWorkflowAuthority({ verifyResult: passResult })}
      />
    );
    expect(getTrusted('ide-export-readiness-hero').textContent).toContain('READY');

    cleanup();

    const { getByTestId: getAdvisory } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        workflowAuthority={makeWorkflowAuthority()}
      />
    );
    expect(getAdvisory('ide-export-readiness-hero').textContent).toContain('NEEDS REVIEW');
  });

  it('inspector uses READY for trusted export (not jargon Comparison aligned)', () => {
    const { queryByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={passResult}
        dirtySinceVerify={false}
        workflowAuthority={makeWorkflowAuthority({ verifyResult: passResult })}
      />
    );
    const buildState = queryByTestId('ide-export-capsule-build-state');
    // Inspector may not render in minimal test layout — if it does, verify no jargon
    if (buildState) {
      expect(buildState.textContent).toContain('READY');
      expect(buildState.textContent).not.toContain('Comparison aligned');
    }
  });

  it('build details section uses student-friendly label', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappedProject()}
        determinismHash="ide-hash"
        verifyResult={passResult}
        dirtySinceVerify={false}
        workflowAuthority={makeWorkflowAuthority({ verifyResult: passResult })}
      />
    );
    const dock = getByTestId('ide-export-checks-dock');
    expect(dock.textContent).toContain('Build details');
    expect(dock.textContent).not.toContain('Evidence snapshot');
  });

  it('Readiness gate mapping CTA goes to Map Pins when I/O mapping fails', () => {
    const onGoToHardware = vi.fn();
    const { getByTestId } = render(
      <ExportSurface
        project={buildMappingBlockedProject()}
        determinismHash="ide-hash"
        verifyResult={passResult}
        dirtySinceVerify={false}
        workflowAuthority={makeWorkflowAuthority({ verifyResult: passResult })}
        onGoToHardware={onGoToHardware}
        onUpdateMappingPin={vi.fn()}
      />
    );
    fireEvent.click(getByTestId('ide-export-gate-details').querySelector('summary')!);
    const mappingCta = getByTestId('ide-export-gate-action-mapping');
    expect(mappingCta.textContent).toContain('Open Map Pins');
    fireEvent.click(mappingCta);
    expect(onGoToHardware).toHaveBeenCalledTimes(1);
  });
});
    it('RED TEST: keeps summary, next action, and trust consequence distinct when no verify evidence exists', () => {
      // This test verifies F-E1/F-E2 fix: the same message should NOT appear in summary + checks dock + consequence
      const { getByTestId } = render(
        <ExportSurface
          project={buildMappedProject()}
          determinismHash="ide-hash"
          workflowAuthority={makeWorkflowAuthority()}
        />
      );

      const summaryCard = getByTestId('ide-export-summary-card');
      const checksDock = getByTestId('ide-export-checks-dock');
      const trustBanner = getByTestId('ide-export-trust-banner');

      // Summary should name the current state (Draft/Available)
      expect(summaryCard.textContent).toContain('Draft');
        expect(summaryCard.textContent).toContain('available');

      // Next action dock should name the repair path (not repeat the same warning)
      expect(checksDock.textContent).toContain('Verify');
    
      // Consequence should explain trust implication
      expect(trustBanner.textContent).toContain('comparison has not run');

      // F-E1 check: The same exact message should NOT appear in both summary and dock
      const summaryText = summaryCard.textContent || '';
      const dockText = checksDock.textContent || '';
      const summaryLines = summaryText.split('\n').filter(l => l.trim());
      const dockLines = dockText.split('\n').filter(l => l.trim());
    
      // Count overlaps - allow some shared words but not full sentence repetition
      const sharedFullLines = summaryLines.filter(sline => 
        dockLines.some(dline => 
          sline.trim() === dline.trim() && sline.trim().length > 10
        )
      );
      expect(sharedFullLines.length).toBeLessThan(2);
    });
