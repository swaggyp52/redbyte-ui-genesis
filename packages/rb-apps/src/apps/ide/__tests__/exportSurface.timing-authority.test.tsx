// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { ExportSurface } from '../surfaces/ExportSurface';

/** Combinational pass-through — live schedule is combinational. */
function buildCombinationalMappedProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    name: 'export-timing-authority',
    description: 'Combinational mapping for timing authority test',
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

const manualLabContract: VerifyScheduleContract = {
  schedule: 'clocked_macro',
  timingMode: 'manual_event_driven_lab',
  reason: 'circuit-sequential',
  analysis: {
    hasClockedMacros: true,
    hasClockNet: false,
    sequentialNodes: [{ id: 'ff1', type: 'Register1', clockPort: 'CLK' }],
    clockSource: undefined,
    clockNetName: undefined,
  },
  needsSimClockInjection: true,
  clockSignalName: '__sim_clk__',
  samplePoint: 'post-rising-edge',
  tick0Meaning: 'initial-state',
  hasUnsupportedTemporal: false,
  temporalIssues: [],
};

function buildMinimalVerifyRun(input: { deterministicHash: string }): RuntimeVerifyRun {
  return {
    scenarioId: 'default',
    scenarioName: 'Default',
    status: 'pass',
    deterministicHash: input.deterministicHash,
    reportHash: 'rep-timing-auth',
    generatedAtIso: '2026-04-15T12:00:00.000Z',
    schedule: 'clocked_macro',
    scheduleContract: manualLabContract,
    meta: {
      circuitKind: 'sequential',
      clockingProtocol: 'clocked_macro',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      clockSignalName: '__sim_clk__',
    },
    report: {
      vectors: [],
      inputsAtTick: {},
      signalRoles: {},
      rows: [],
    },
    waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
  };
}

describe('ExportSurface timing authority (Verify contract alignment)', () => {
  it('uses the last Verify run schedule contract when deterministic hashes match (manual-event lab)', () => {
    const project = buildCombinationalMappedProject();
    const hash = 'det-align-001';
    const verifyLastRun = buildMinimalVerifyRun({ deterministicHash: hash });

    render(
      <ExportSurface
        project={project}
        determinismHash={hash}
        verifyLastRun={verifyLastRun}
        designReady
      />
    );

    const clockGate = screen.getByTestId('ide-export-gate-clock');
    expect(clockGate.textContent).toMatch(/Manual-event lab/i);
  });

  it('falls back to live structural timing when Verify run is stale (hash mismatch)', () => {
    const project = buildCombinationalMappedProject();
    const verifyLastRun = buildMinimalVerifyRun({ deterministicHash: 'old-hash' });

    render(
      <ExportSurface
        project={project}
        determinismHash="new-hash"
        verifyLastRun={verifyLastRun}
        designReady
      />
    );

    const clockGate = screen.getByTestId('ide-export-gate-clock');
    expect(clockGate.textContent).toMatch(/Combinational/i);
  });
});
