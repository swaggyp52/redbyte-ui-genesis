// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ProjectHealth } from '../projectHealth';
import {
  deriveProjectWorkflowAuthority,
  deriveExportCurrent,
  deriveVerifyCurrent,
} from '../projectWorkflowAuthority';
import { buildCurrentVerifyProjectHash } from '../verifyProjectHash';
import { BoardSignalProvider } from '../BoardSignalContext';
import { HardwareSurface } from '../surfaces/HardwareSurface';
import { deriveTimingGuidance } from '../timingGuidance';

afterEach(() => {
  cleanup();
});

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

function makeHardwareWorkflowAuthority(
  health: ProjectHealth,
  overrides: {
    currentVerifyProjectHash?: string | null;
    currentExportHash?: string | null;
    hasIoMapping?: boolean;
    hasVectors?: boolean;
  } = {}
) {
  return deriveProjectWorkflowAuthority({
    projectHealthCore: health,
    readiness: {
      hasCircuit: true,
      hasIoMapping: overrides.hasIoMapping ?? true,
      hasVectors: overrides.hasVectors ?? true,
      verifyQualification: health.lastVerify?.qualification,
    },
    verifyLastRun: health.lastVerify,
    currentVerifyProjectHash: overrides.currentVerifyProjectHash,
    currentExportHash: overrides.currentExportHash,
  });
}

describe('HardwareSurface readiness', () => {
  it('places the verify/export/program workflow ribbon in the main workspace and hides the bottom console', () => {
    const health = makeHealth({
      blockingIssues: [],
      dirtySinceExport: false,
    });
    const { getAllByTestId, getByTestId, queryByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Hardware Layout Defaults"
          expectedBehavior="Map pins, then program the board."
          mappingRows={[
            { id: 'clk', label: 'clk', direction: 'in', pin: 'W5', required: true },
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeHardwareWorkflowAuthority(health, {
            currentVerifyProjectHash: health.lastVerify?.hash ?? null,
            currentExportHash: health.lastExport?.hash ?? null,
          })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hardware-command-strip').textContent).toContain('Hardware');
    expect(getByTestId('ide-hw-workflow-ribbon')).toBeTruthy();
    expect(getByTestId('ide-hardware-dep-chain')).toBeTruthy();
    expect(getByTestId('ide-hardware-readiness-callout')).toBeTruthy();
    expect(queryByTestId('ide-hw-callout')).toBeNull();
    expect(getByTestId('ide-inspector')).toBeTruthy();
    expect(getByTestId('ide-hw-map-row-binding-ld0').textContent).toContain('LD0');
    expect(getByTestId('ide-hw-map-row-binding-ld0').textContent).toContain('pin U16');
    expect(getByTestId('ide-workbench-dock-collapse-right')).toBeTruthy();
    expect(queryByTestId('ide-workbench-console')).toBeNull();
  });

  it('shows a stage rail, framed board workspace, and map caption when mapping is incomplete', () => {
    const health = makeHealth({
      blockingIssues: [],
      dirtySinceExport: false,
    });
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="HW Stage Shell"
          expectedBehavior="Test expected copy."
          mappingRows={[
            { id: 'clk', label: 'clk', direction: 'in', pin: '', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeHardwareWorkflowAuthority(health, {
            currentVerifyProjectHash: health.lastVerify?.hash ?? null,
            currentExportHash: health.lastExport?.hash ?? null,
          })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-stage-rail')).toBeTruthy();
    expect(getByTestId('ide-hw-stage-caption').textContent).toMatch(/required pin.*board assignments/i);
    expect(getByTestId('ide-hw-board-workspace')).toBeTruthy();
    expect(getByTestId('ide-hw-board-chrome-stage').textContent).toContain('Map Pins');
    expect(getByTestId('ide-hw-mode-btn-map').getAttribute('aria-selected')).toBe('true');
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
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-proof').at(-1)!);

    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain(
      'no longer matches the current circuit'
    );
    expect(getByTestId('ide-hardware-command-strip').textContent).toContain('Rebuild the current bundle');
    expect(getByTestId('ide-hardware-command-strip').textContent).toContain('STALE');
    expect(getByTestId('ide-hardware-command-strip').textContent).not.toContain('BLOCKED');
    expect(getByTestId('ide-hardware-next-primary').textContent).toContain('Rebuild Current Bundle');
    expect(getByTestId('ide-hardware-build-export').textContent).toContain(
      'Rebuild Current Bundle'
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
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getAllByText('Outputs').at(-1)?.parentElement?.textContent).toContain('Missing');
  });

  it('opens in map mode and points back to Design when no boundary rows exist yet', () => {
    const { getAllByTestId, getByTestId, queryByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Empty hardware flow"
          expectedBehavior="Add boundary IO before mapping pins."
          mappingRows={[]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={makeHealth({
            lastVerify: undefined,
            lastExport: undefined,
            dirtySinceVerify: false,
            dirtySinceExport: false,
            blockingIssues: [],
          })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          onGoToDesign={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-map-dock')).toBeTruthy();
    expect(queryByTestId('ide-hw-proof-dock')).toBeNull();
    expect(getByTestId('ide-hardware-command-strip').textContent).toContain('Add boundary I/O in Design first');
    expect(getByTestId('ide-hw-map-dock').textContent).not.toContain('0 left');
    expect(getAllByTestId('ide-hw-map-empty').at(-1)?.textContent).toContain(
      'Add inputs and outputs in Design'
    );
  });

  it('treats combinational projects as timing-ready when no control signal is required', () => {
    const { getAllByTestId, getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Combinational Mapping"
          expectedBehavior="LED0 follows SW0."
          mappingRows={[
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={2}
          health={makeHealth({
            dirtySinceVerify: true,
            dirtySinceExport: true,
          })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-map').at(-1)!);

    expect(getByTestId('ide-hw-map-dock').textContent).toContain('Combinational');
    expect(getByTestId('ide-hw-map-dock').textContent).toContain('Mapped');
    expect(getByTestId('ide-hw-map-dock').textContent).toContain('Complete');
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
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-map').at(-1)!);
    expect(getByTestId('ide-hw-map-dock').textContent).toContain('Clock');
    expect(getByTestId('ide-hw-map-dock').textContent).toContain('Needs clock pin');
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

    const clockGroup = getAllByText('Clock / reset').at(-1)?.closest('details');
    expect(clockGroup?.textContent).toContain('PHASE_DRIVER');
  });

  it('keeps map mode blocked when export reports required unmapped ports', () => {
    const { getAllByTestId, getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Export mapping gap"
          expectedBehavior="Map all required ports before handoff."
          mappingRows={[
            { id: 'clk', label: 'clk', direction: 'in', pin: 'W5', required: true },
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          missingRequiredPortsFromExport={1}
          expectedIoRows={[]}
          vectorsCount={2}
          health={makeHealth({
            dirtySinceVerify: true,
            dirtySinceExport: true,
          })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-map').at(-1)!);

    expect(getByTestId('ide-hw-map-dock').textContent).toContain('1 left');
    expect(getByTestId('ide-hardware-map-export-gap').textContent).toContain('required port');
  });

  it('shows Map Pins Complete when only inputs are required (no output rows) and pins are set', () => {
    const health = makeHealth({
      blockingIssues: [],
      dirtySinceExport: false,
    });
    const { getAllByTestId, getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Inputs-only boundary"
          expectedBehavior="Combinational in-only fixture for mapping coherence."
          mappingRows={[
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
          ]}
          missingRequiredPortsFromExport={0}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeHardwareWorkflowAuthority(health, {
            currentVerifyProjectHash: health.lastVerify?.hash ?? null,
            currentExportHash: health.lastExport?.hash ?? null,
          })}
          timingGuidance={deriveTimingGuidance(undefined)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-map').at(-1)!);
    expect(getByTestId('ide-hw-map-dock').textContent).toContain('Complete');
    expect(getByTestId('ide-hw-map-dock').textContent).not.toContain('0 left');
  });

  it('makes the default Map Pins row read as signal to board control to physical pin', () => {
    const onSetMappingPin = vi.fn();
    const { getByTestId, queryByText } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Student mapping loop"
          expectedBehavior="IN0 drives LOCK."
          mappingRows={[
            { id: 'iom-in0', label: 'iom-in0', direction: 'in', pin: 'V17', required: true },
            { id: 'lock', label: 'LOCK', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={makeHealth({ blockingIssues: [], dirtySinceExport: true })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          onSetMappingPin={onSetMappingPin}
        />
      </BoardSignalProvider>
    );

    const row = getByTestId('ide-hw-map-row-iom-in0');
    expect(row.textContent).toContain('IN0');
    expect(row.textContent).toContain('SW0');
    expect(row.textContent).toContain('V17');
    expect(queryByText('iom-in0')).toBeNull();
    expect(getByTestId('ide-hw-map-loop-card').textContent).toContain('Select a signal row');

    fireEvent.click(row);
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(getByTestId('ide-hw-map-loop-card').textContent).toContain('IN0');
    expect(getByTestId('ide-hw-map-loop-card').textContent).toContain('SW0');
    expect(getByTestId('ide-hw-selected-signal-card').textContent).toContain('V17');
    fireEvent.click(getByTestId('ide-hw-map-sw-1'));

    expect(onSetMappingPin).toHaveBeenCalledWith('iom-in0', 'SW1');
  });

  it('shows board planner clock truth, supported resources, and xdc preview in Hardware', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Clock planner"
          expectedBehavior="CLK drives the sequential design."
          mappingRows={[
            { id: 'clk', label: 'clk', direction: 'in', pin: 'W5', required: true, timingRole: 'clock', boardResourceType: 'clock_pin' },
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true, boardResourceType: 'switch' },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true, boardResourceType: 'led' },
          ]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={makeHealth({ blockingIssues: [], dirtySinceExport: true })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-clock-resource-card').textContent).toContain('CLK100MHZ');
    expect(getByTestId('ide-hw-clock-resource-card').textContent).toContain('W5');
    expect(getByTestId('ide-hw-board-resource-summary').textContent).toContain('SW0-SW15');
    expect(getByTestId('ide-hw-selected-resource-card').textContent).toContain('100 MHz oscillator');
    expect(getByTestId('ide-hw-clock-truth').textContent).toContain('W5');
    expect(getByTestId('ide-hw-clock-truth').textContent).toContain('10 ns');
    expect(getByTestId('ide-hw-xdc-preview').textContent).toContain('PACKAGE_PIN W5');
    expect(getByTestId('ide-hw-xdc-preview').textContent).toContain('create_clock -period 10.000');
    expect(getByTestId('ide-hw-resource-catalog').textContent).toContain('Supported Basys3 resource catalog');
    expect(getByTestId('ide-hw-resource-catalog').textContent).toContain('Expanded official XDC catalog');
  });

  it('keeps the structured mapping editor collapsed behind an advanced affordance', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Advanced contained"
          expectedBehavior="Advanced data stays available but not dominant."
          mappingRows={[
            { id: 'reset', label: 'RESET', direction: 'in', pin: '', required: true, timingRole: 'reset' },
          ]}
          hardwareMappingV2={{
            schemaVersion: '2.0',
            boardId: 'basys3',
            entries: [
              {
                kind: 'scalar',
                id: 'reset',
                direction: 'in',
                width: 1,
                portName: 'reset',
                nodeId: 'reset_node',
                port: 'out',
                label: 'RESET',
                timingRole: 'reset',
                pin: '',
              },
            ],
          }}
          onApplyHardwareMappingEdit={vi.fn()}
          expectedIoRows={[]}
          vectorsCount={0}
          health={makeHealth({ lastVerify: undefined, lastExport: undefined, blockingIssues: [] })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    const advanced = getByTestId('ide-hw-structured-editor') as HTMLDetailsElement;
    expect(advanced.tagName.toLowerCase()).toBe('details');
    expect(advanced.open).toBe(false);
    expect(advanced.querySelector('summary')?.textContent).toContain('Advanced mapping editor');
  });

  it('points students to Verify first without calling a missing bundle blocked', () => {
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Needs Verify"
          expectedBehavior="LED0 follows SW0."
          mappingRows={[
            { id: 'clk', label: 'clk', direction: 'in', pin: 'W5', required: true },
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={makeHealth({
            lastExport: undefined,
            lastVerify: undefined,
            dirtySinceVerify: false,
            dirtySinceExport: false,
            blockingIssues: [],
          })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          onGoToDesign={vi.fn()}
        />
      </BoardSignalProvider>
    );

    const commandText = getAllByTestId('ide-hardware-command-strip').at(-1)?.textContent ?? '';
    expect(commandText).toContain('Map project signals to Basys3 controls');
    expect(commandText).toContain('MAPPING COMPLETE');
    expect(commandText).not.toContain('Build the current bundle');
    expect(commandText).not.toContain('BLOCKED');
    expect(getAllByTestId('ide-hardware-readiness-callout').at(-1)?.textContent).toContain(
      'Run Verify before relying on this handoff'
    );
    expect(getAllByTestId('ide-hardware-readiness-callout').at(-1)?.textContent).toContain(
      'Open Verify before you rely on the hardware or export handoff'
    );
    expect(getAllByTestId('ide-hardware-readiness-callout').at(-1)?.textContent).not.toContain('BLOCKED');
  });

  it('shows program handoff CTA when export is current', () => {
    const health = makeHealth({
      blockingIssues: [],
      dirtySinceExport: false,
    });
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
          health={health}
          workflowAuthority={makeHardwareWorkflowAuthority(health, {
            currentVerifyProjectHash: health.lastVerify?.hash ?? null,
            currentExportHash: health.lastExport?.hash ?? null,
          })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-proof').at(-1)!);

    // When export is current the program handoff CTA must be present and must not imply a .bit ships from RedByte.
    const cta = getByTestId('ide-hardware-program-handoff-cta');
    expect(cta).toBeDefined();
    expect(cta.textContent).toContain('Vivado project ZIP');
    expect(cta.textContent).toContain('Generate Bitstream');
    expect(cta.textContent).toContain('Hardware Manager');
    expect(cta.textContent).toContain('Program Device');
    expect(getByTestId('ide-hardware-submission-hint').textContent).toContain('export ZIP');
  });

  it('applies structured hardware mapping pin edits from map mode', () => {
    const onApplyHardwareMappingEdit = vi.fn();
    const { getByTestId, getAllByText } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Structured map editor"
          expectedBehavior="Map structured entries"
          mappingRows={[
            { id: 'reset', label: 'reset', direction: 'in', pin: '', required: true, timingRole: 'reset' },
          ]}
          hardwareMappingV2={{
            schemaVersion: '2.0',
            boardId: 'basys3',
            entries: [
              {
                kind: 'scalar',
                id: 'reset',
                direction: 'in',
                width: 1,
                portName: 'reset',
                nodeId: 'reset_node',
                port: 'out',
                label: 'reset',
                timingRole: 'reset',
                pin: '',
              },
            ],
          }}
          onApplyHardwareMappingEdit={onApplyHardwareMappingEdit}
          expectedIoRows={[]}
          vectorsCount={0}
          health={makeHealth({
            lastVerify: undefined,
            lastExport: undefined,
            dirtySinceVerify: false,
            dirtySinceExport: false,
            blockingIssues: [],
          })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    fireEvent.change(getByTestId('ide-hw-structured-pins-reset'), { target: { value: 'V17' } });
    fireEvent.click(getAllByText('Apply pins')[0]!);

    expect(onApplyHardwareMappingEdit).toHaveBeenCalledWith({
      type: 'map_entry_pins',
      entryId: 'reset',
      pins: ['V17'],
    });
  });

  it('shows export repair callout when Basys3 validation errors are passed in', () => {
    const onOpenExport = vi.fn();
    const onGoToDesign = vi.fn();
    const { getByTestId, getAllByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Export blocked"
          expectedBehavior="Repair mapping"
          mappingRows={[
            { id: 'sw0', label: 'sw0', direction: 'in', pin: '', required: true, nodeId: 'n1', port: 'out' },
          ]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={makeHealth({ blockingIssues: [], dirtySinceExport: true })}
          workflowAuthority={makeHardwareWorkflowAuthority(makeHealth({ blockingIssues: [] }), {
            currentVerifyProjectHash: null,
            currentExportHash: null,
          })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={onOpenExport}
          onOpenVerify={vi.fn()}
          onGoToDesign={onGoToDesign}
          exportViewStatus="blocked"
          exportBlockingDiagnostics={[
            {
              id: 'exp-diag-1',
              code: 'RBP_TEST',
              title: 'Port mismatch',
              message: 'Required input port "sw0" has no mapping.',
              hint: ['Open Map Pins and assign a structured entry.'],
              fix: 'Add or fix hardwareMappingV2 for sw0.',
              port: 'sw0',
              severity: 'error' as const,
              owner: { kind: 'mapping' as const },
              actions: [],
              canonical: { id: 'exp-diag-1' } as any,
            },
          ]}
        />
      </BoardSignalProvider>,
    );

    fireEvent.click(getAllByTestId('ide-hw-mode-btn-map').at(-1)!);
    const callout = getByTestId('ide-hw-export-repair-callout');
    expect(callout.textContent).toContain('Port mismatch');
    expect(callout.textContent).toContain('sw0');
    fireEvent.click(getByTestId('ide-hw-export-repair-open-export'));
    expect(onOpenExport).toHaveBeenCalled();
    fireEvent.click(getByTestId('ide-hw-export-repair-open-design'));
    expect(onGoToDesign).toHaveBeenCalled();
  });

  it('shows Map Pins authority callout when onGoToProject is wired', () => {
    const onGoToProject = vi.fn();
    const health = makeHealth({ blockingIssues: [], dirtySinceExport: false });
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Authority UX"
          expectedBehavior="Test"
          mappingRows={[
            { id: 'sw0', label: 'SW0', direction: 'in', pin: '', required: true, port: 'out' },
          ]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeHardwareWorkflowAuthority(health, {
            currentVerifyProjectHash: health.lastVerify?.hash ?? null,
            currentExportHash: health.lastExport?.hash ?? null,
          })}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          onGoToProject={onGoToProject}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-map-authority-callout').textContent).toMatch(/Map Pins owns board binding/);
    expect(getByTestId('ide-hw-map-dock-authority-sub').textContent).toMatch(/saved board bindings live here/i);
    expect(getByTestId('ide-hw-map-dock-authority-sub').textContent).toMatch(/export reads these pins/i);
    expect(onGoToProject).not.toHaveBeenCalled();
  });
});
