// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { deriveVerifySchedule, type VerifyScheduleContract } from '../../../fpga/boards/basys3/verifySchedule';
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

function buildMinimalVerifyRun(input: { deterministicHash: string; scheduleContract?: VerifyScheduleContract }): RuntimeVerifyRun {
  const contract = input.scheduleContract ?? manualLabContract;
  return {
    scenarioId: 'default',
    scenarioName: 'Default',
    status: 'pass',
    deterministicHash: input.deterministicHash,
    reportHash: 'rep-timing-auth',
    generatedAtIso: '2026-04-15T12:00:00.000Z',
    schedule: contract.schedule,
    scheduleContract: contract,
    meta: {
      circuitKind: contract.schedule === 'clocked_macro' ? 'sequential' : 'combinational',
      clockingProtocol: contract.schedule === 'clocked_macro' ? 'clocked_macro' : null,
      samplePoint: contract.samplePoint,
      tick0Meaning: contract.tick0Meaning,
      clockSignalName: contract.clockSignalName ?? null,
    },
    report: {
      schemaVersion: 'rb.verify-report.v1',
      scenarioId: 'default',
      scenarioName: 'Default',
      status: 'pass',
      deterministicHash: input.deterministicHash,
      generatedAtIso: '2026-04-15T12:00:00.000Z',
      reportHash: 'rep-timing-auth',
      vectors: [],
      inputsAtTick: {},
      signalRoles: {},
      rows: [],
    },
    waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
  };
}

describe('ExportSurface timing authority (Verify contract alignment)', () => {
  it('keeps live combinational timing authoritative against a poisoned matching-hash manual run', () => {
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

    fireEvent.click(screen.getByTestId('ide-export-open-technical-evidence'));
    const clockGate = screen.getByTestId('ide-export-gate-clock');
    // Matching a caller-supplied hash does not authorize a contradictory saved schedule.
    expect(clockGate.textContent).toMatch(/Combinational/i);
    expect(clockGate.textContent).not.toMatch(/Manual-event lab/i);
  });

  it('keeps actual authored manual-event sequential timing positive with matching live run metadata', () => {
    const project = buildCombinationalMappedProject();
    const source = project.hdl?.sources[0];
    if (!source) throw new Error('Manual-event fixture requires its authored VHDL source');
    source.text = source.text.replace('  ld0 <= sw0;', `  process (sw0) begin
    if rising_edge(sw0) then ld0 <= sw0; end if;
  end process;`);
    const liveContract = deriveVerifySchedule(project.circuit, project.ioMapping, project.hdl);
    expect(liveContract.schedule).toBe('clocked_macro');
    expect(liveContract.timingMode).toBe('manual_event_driven_lab');
    expect(liveContract.reason).toBe('hdl-sequential');
    const hash = 'actual-manual-live';
    const verifyLastRun = buildMinimalVerifyRun({ deterministicHash: hash, scheduleContract: liveContract });
    expect(verifyLastRun.scheduleContract).toEqual(liveContract);
    expect(verifyLastRun.meta).toEqual({
      circuitKind: 'sequential', clockingProtocol: 'clocked_macro',
      samplePoint: 'post-rising-edge', tick0Meaning: 'initial-state', clockSignalName: null,
    });
    render(<ExportSurface project={project} determinismHash={hash} verifyLastRun={verifyLastRun} designReady />);
    fireEvent.click(screen.getByTestId('ide-export-open-technical-evidence'));
    expect(screen.getByTestId('ide-export-gate-clock').textContent).toMatch(/Manual-event lab/i);
    // The historical run has no scenario/version qualification. Timing identity
    // does not silently upgrade it into trusted comparison/package evidence.
    expect(screen.getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-verification-trust')).not.toBe('trusted');
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

    fireEvent.click(screen.getByTestId('ide-export-open-technical-evidence'));
    const clockGate = screen.getByTestId('ide-export-gate-clock');
    expect(clockGate.textContent).toMatch(/Combinational/i);
  });
});
