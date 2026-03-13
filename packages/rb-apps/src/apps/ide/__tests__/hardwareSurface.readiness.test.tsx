// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { ProjectHealth } from '../projectHealth';
import {
  buildCurrentVerifyProjectHash,
  deriveExportCurrent,
  deriveVerifyCurrent,
} from '../../IdeApp';
import { BoardSignalProvider } from '../BoardSignalContext';
import { HardwareSurface } from '../surfaces/HardwareSurface';

function makeHealth(overrides: Partial<ProjectHealth> = {}): ProjectHealth {
  return {
    lastVerify: {
      status: 'pass',
      hash: 'verify-current-hash',
      reportHash: 'verify-report-hash',
      ranAtIso: '2026-03-08T00:00:00.000Z',
    },
    lastExport: {
      status: 'ok',
      hash: 'export-stale-hash',
      ranAtIso: '2026-03-08T00:10:00.000Z',
    },
    dirtySinceVerify: false,
    dirtySinceExport: true,
    blockingIssues: [
      {
        code: 'RBP2002',
        message: 'Project changed since last successful export.',
        fixPath: { mode: 'export', actionLabel: 'Build Evidence Capsule' },
      },
    ],
    ...overrides,
  };
}

describe('HardwareSurface readiness', () => {
  it('treats export evidence as stale when the project changes after export but verification is rerun', () => {
    const circuit = { nodes: [], connections: [] } as any;
    const vectors = [{ tick: 0, inputs: { in_a: '0' }, expected: { out_y: '0' } }] as any;
    const beforeRows = [
      { id: 'in_a', nodeId: 'in_a_node', port: 'out', label: 'in_a', direction: 'in', pin: 'V17', required: true },
      { id: 'out_y', nodeId: 'out_y_node', port: 'in', label: 'out_y', direction: 'out', pin: 'U16', required: true },
    ] as any;
    const afterRows = [
      { ...beforeRows[0] },
      { ...beforeRows[1], pin: 'E19' },
    ] as any;

    const exportedProjectHash = buildCurrentVerifyProjectHash({
      circuit,
      projectVectors: vectors,
      projectIoRows: beforeRows,
    });
    const verifiedProjectHash = buildCurrentVerifyProjectHash({
      circuit,
      projectVectors: vectors,
      projectIoRows: afterRows,
    });

    expect(verifiedProjectHash).not.toBe(exportedProjectHash);
    expect(
      deriveVerifyCurrent({
        hasVerifyRun: true,
        latestVerifyLedgerEntry: { projectHash: verifiedProjectHash },
        currentVerifyProjectHash: verifiedProjectHash,
        dirtySinceVerify: true,
      })
    ).toBe(true);
    expect(
      deriveExportCurrent({
        lastExport: {
          status: 'ok',
          hash: exportedProjectHash,
          ranAtIso: '2026-03-08T00:10:00.000Z',
        },
        currentExportHash: verifiedProjectHash,
        dirtySinceExport: true,
      })
    ).toBe(false);
  });

  it('warns when verification is current but the export bundle is stale', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Fresh Verify, Stale Export"
          expectedBehavior="LED0 follows SW0."
          mappingRows={[
            { id: 'clk', label: 'clk', direction: 'in', pin: 'W5', required: true },
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={4}
          health={makeHealth()}
          verifyCurrent={true}
          exportCurrent={false}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getByTestId('ide-hw-mode-btn-proof'));

    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain(
      'bundle was built from an older version'
    );
    expect(getByTestId('ide-hardware-blocked-hero').textContent).toContain('Re-export this project now');
    expect(getByTestId('ide-hardware-blocked-primary').textContent).toContain('Re-export Current Bundle');
    expect(getByTestId('ide-hardware-build-export').textContent).toContain(
      'Re-export Current Bundle'
    );
    expect(getByTestId('ide-hardware-export-status').textContent).toContain('Export: STALE');
  });

  it('points students to Test first when hardware is blocked before any current pass', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Needs Verify"
          expectedBehavior="LED0 follows SW0."
          mappingRows={[]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={makeHealth({
            lastVerify: undefined,
            dirtySinceVerify: false,
            blockingIssues: [
              {
                code: 'RBP1004',
                message: 'Run Verify before programming the board.',
                fixPath: { mode: 'verify', actionLabel: 'Run Verify' },
              },
            ],
          })}
          verifyCurrent={false}
          exportCurrent={false}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          onGoToDesign={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hardware-blocked-hero').textContent).toContain('Pass Test before programming');
    expect(getByTestId('ide-hardware-blocked-hero').textContent).toContain('return here to program the board');
    expect(getByTestId('ide-hardware-blocked-primary').textContent).toContain('Open Verify');
    expect(getByTestId('ide-hardware-blocked-secondary').textContent).toContain('Open Design');
  });
});
