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
import { deriveTimingGuidance } from '../timingGuidance';

function makeVerifyRunWithRoles(
  signalRoles: Record<string, 'clock' | 'reset' | 'input' | 'output'>
) {
  return {
    scenarioId: 'hardware-semantic-roles',
    scenarioName: 'Hardware semantic roles',
    status: 'pass',
    deterministicHash: 'det_hardware_semantic_roles',
    reportHash: 'rep_hardware_semantic_roles',
    firstFailingTick: null,
    generatedAtIso: '2026-03-21T12:00:00.000Z',
    schedule: 'clocked_macro',
    meta: {
      circuitKind: 'sequential',
      clockingProtocol: 'clocked_macro',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      clockSignalName: 'phase_driver',
    },
    report: {
      vectors: [],
      inputsAtTick: {},
      signalRoles,
      rows: [],
    },
    waveform: [],
  } as any;
}

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
        fixPath: { mode: 'export', actionLabel: 'Build Submission Package' },
      },
    ],
    ...overrides,
  };
}

describe('HardwareSurface readiness', () => {
  it('starts with the inspector collapsed and the console minimized so mapping stays central', () => {
    const { getByTestId, queryByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Hardware Layout Defaults"
          expectedBehavior="Map pins, then program the board."
          mappingRows={[
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={1}
          health={makeHealth({ blockingIssues: [] })}
          verifyCurrent={true}
          exportCurrent={true}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(queryByTestId('ide-inspector')).toBeNull();
    expect(getByTestId('ide-workbench-dock-toggle-right')).toBeTruthy();
    expect(getByTestId('ide-workbench-console')).toHaveAttribute('data-console-state', 'collapsed');
  });

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
    const { getAllByTestId, getByTestId } = render(
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

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-proof').at(-1)!);

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

  it('does not claim outputs are mapped when a required output row is still missing a pin', () => {
    const { getAllByText } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Partially Mapped Outputs"
          expectedBehavior="Both LEDs should follow switches."
          mappingRows={[
            { id: 'clk', label: 'clk', direction: 'in', pin: 'W5', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
            { id: 'ld1', label: 'ld1', direction: 'out', pin: '', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={2}
          health={makeHealth({
            dirtySinceVerify: true,
            dirtySinceExport: true,
          })}
          verifyCurrent={false}
          exportCurrent={false}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getAllByText('Outputs').at(-1)?.parentElement?.textContent).toContain('Missing');
  });

  it('does not claim clock is mapped when a required clock row is still missing a pin', () => {
    const { getAllByTestId, getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Partially Mapped Clocks"
          expectedBehavior="LED0 follows the clocked design."
          mappingRows={[
            { id: 'clk', label: 'clk', direction: 'in', pin: 'W5', required: true },
            { id: 'clk_aux', label: 'clock_aux', direction: 'in', pin: '', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={2}
          health={makeHealth({
            dirtySinceVerify: true,
            dirtySinceExport: true,
          })}
          verifyCurrent={false}
          exportCurrent={false}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-map').at(-1)!);
    expect(getByTestId('ide-hw-map-dock').textContent).toContain('Clock');
    expect(getByTestId('ide-hw-map-dock').textContent).toContain('Missing');
  });

  it('claims clock is mapped when all required clock rows have pins', () => {
    const { getAllByTestId, getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Fully Mapped Clocks"
          expectedBehavior="LED0 follows the fully mapped clocked design."
          mappingRows={[
            { id: 'clk', label: 'clk', direction: 'in', pin: 'W5', required: true },
            { id: 'clk_aux', label: 'clock_aux', direction: 'in', pin: 'V10', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={2}
          health={makeHealth({
            dirtySinceVerify: true,
            dirtySinceExport: true,
          })}
          verifyCurrent={false}
          exportCurrent={false}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-map').at(-1)!);
    expect(getByTestId('ide-hw-map-dock').textContent).toContain('Clock');
    expect(getByTestId('ide-hw-map-dock').textContent).toContain('Mapped');
  });

  it('labels supported latch control explicitly instead of generic clock wording', () => {
    const latchGuidance = deriveTimingGuidance({
      schedule: 'clocked_macro',
      reason: 'circuit-sequential',
      analysis: {
        hasClockedMacros: true,
        hasClockNet: true,
        sequentialNodes: [{ id: 'dl0', type: 'DLatch', clockPort: 'EN' }],
        clockSource: 'circuit',
        clockNetName: 'EN',
      },
      needsSimClockInjection: false,
      clockSignalName: 'EN',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      hasUnsupportedTemporal: false,
      temporalIssues: [],
    });

    const { getAllByTestId, getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Latch Hardware"
          expectedBehavior="Q holds its last value when EN is low."
          mappingRows={[
            { id: 'd', label: 'D', direction: 'in', pin: 'V17', required: true },
            { id: 'en', label: 'EN', direction: 'in', pin: 'W16', required: true },
            { id: 'q', label: 'Q', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={4}
          health={makeHealth()}
          verifyCurrent={true}
          exportCurrent={false}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          signalRoles={{ d: 'input', en: 'clock', q: 'output' }}
          timingGuidance={latchGuidance}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-live').at(-1)!);
    expect(getByTestId('ide-hw-live-dock').textContent).toContain('Latch control');
  });

  it('uses semantic verify signal roles so non-regex clock labels still count as clock mapping', () => {
    const { getAllByTestId, getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Semantic Clock Role"
          expectedBehavior="LED0 follows the sequential design."
          mappingRows={[
            { id: 'phase_driver', label: 'phase_driver', direction: 'in', pin: 'W5', required: true },
            { id: 'data_in', label: 'data_in', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={2}
          health={makeHealth({
            dirtySinceVerify: true,
            dirtySinceExport: true,
          })}
          verifyCurrent={false}
          exportCurrent={false}
          verifyLastRun={makeVerifyRunWithRoles({
            phase_driver: 'clock',
            data_in: 'input',
            ld0: 'output',
          })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-map').at(-1)!);
    expect(getByTestId('ide-hw-map-dock').textContent).toContain('Clock');
    expect(getByTestId('ide-hw-map-dock').textContent).toContain('Mapped');
  });

  it('groups semantic clock rows into the Clock section in map mode even before a pin is assigned', () => {
    const { getAllByTestId, getAllByText } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Semantic Clock Map Group"
          expectedBehavior="Clock row should stay grouped semantically."
          mappingRows={[
            { id: 'phase_driver', label: 'phase_driver', direction: 'in', pin: '', required: true },
            { id: 'data_in', label: 'data_in', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={makeHealth({
            dirtySinceVerify: true,
            dirtySinceExport: true,
          })}
          verifyCurrent={false}
          exportCurrent={false}
          signalRoles={{
            phase_driver: 'clock',
            data_in: 'input',
            ld0: 'output',
          }}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-map').at(-1)!);

    const clockGroup = getAllByText('Clock').at(-1)?.closest('details');
    expect(clockGroup?.textContent).toContain('phase_driver');
  });

  it('points students to Export first when hardware is blocked before a current bundle exists', () => {
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Needs Verify"
          expectedBehavior="LED0 follows SW0."
          mappingRows={[]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={makeHealth({
            lastExport: undefined,
            lastVerify: undefined,
            dirtySinceVerify: false,
            dirtySinceExport: false,
            blockingIssues: [
              {
                code: 'RBP1004',
                message: 'Build the hardware bundle before programming the board.',
                fixPath: { mode: 'export', actionLabel: 'Open Export' },
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

    expect(getAllByTestId('ide-hardware-blocked-hero').at(-1)?.textContent).toContain('Build the hardware bundle first');
    expect(getAllByTestId('ide-hardware-blocked-hero').at(-1)?.textContent).toContain('return here to program the board');
    expect(getAllByTestId('ide-hardware-blocked-primary').at(-1)?.textContent).toContain('Open Export');
    expect(getAllByTestId('ide-hardware-blocked-secondary').at(-1)?.textContent).toContain('Open Design');
  });

  it('shows program handoff CTA when export is current', () => {
    const { getAllByTestId, getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Ready to Program"
          expectedBehavior="LED0 follows SW0."
          mappingRows={[
            { id: 'clk', label: 'clk', direction: 'in', pin: 'W5', required: true },
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={4}
          health={makeHealth({ blockingIssues: [] })}
          verifyCurrent={true}
          exportCurrent={true}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-proof').at(-1)!);

    // When export is current the program handoff CTA must be present.
    const cta = getByTestId('ide-hardware-program-handoff-cta');
    expect(cta).toBeDefined();
    expect(cta.textContent).toContain('Vivado Hardware Manager');
    expect(cta.textContent).toContain('Program Device');
  });
});
