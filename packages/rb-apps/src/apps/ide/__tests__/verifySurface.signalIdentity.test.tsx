// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import {
  VerifySurface,
  buildWaveformSignalAliasOwners,
  buildAmbiguousWaveformSignalKeys,
  buildCanonicalWaveformSignalAliases,
} from '../surfaces/VerifySurface';
import type { RuntimeVerifyRun } from '../projectRuntime';

afterEach(() => cleanup());

/**
 * A name that means two things.
 *
 * The two-bit counter ships an io row for the board pin as `{ id: 'q0', label: 'LD0' }` and drives
 * it from a D flip-flop instance the student sees labelled `Q0`. Normalised, the io row's ID and
 * the register's label are the same string. The direction map is keyed by both a row's id and its
 * label, so the register was credited to the boundary: the signal rail read
 * "Outputs 4 / Internal 0" for a circuit with two board outputs and two registers, while the
 * timeline - which draws the boundary from the io rows - drew two output lanes. Two representations
 * of one experiment disagreed about how many outputs the circuit has.
 */
const MAPPED_SIGNALS = [
  { id: 'clk', label: 'CLK', direction: 'in' as const, nodeId: 'clk_node' },
  { id: 'q0', label: 'LD0', direction: 'out' as const, nodeId: 'q0_out' },
];

const CIRCUIT = {
  nodes: [
    { id: 'clk_node', type: 'INPUT', label: 'CLK' },
    { id: 'q0_ff', type: 'DFlipFlop', label: 'Q0' },
    { id: 'q0_out', type: 'OUTPUT', label: 'LD0' },
  ],
  connections: [],
};

function makeRun(): RuntimeVerifyRun {
  return {
    projectId: 'rb-test',
    scenarioId: 'identity',
    scenarioName: 'Identity',
    runKind: 'verify',
    status: 'pass',
    firstFailingTick: null,
    deterministicHash: 'identity-hash',
    reportHash: 'identity-report',
    generatedAtIso: '2026-09-07T09:00:00.000Z',
    schedule: 'clocked_macro',
    meta: {} as RuntimeVerifyRun['meta'],
    report: {
      schemaVersion: 'rb.verify-report.v1',
      scenarioId: 'identity',
      scenarioName: 'Identity',
      status: 'pass',
      deterministicHash: 'identity-hash',
      firstFailingTick: null,
      rows: [],
      vectors: [
        { id: 'v0', tick: 0, inputs: { clk: 0 }, expected: {} },
        { id: 'v1', tick: 1, inputs: { clk: 1 }, expected: {} },
      ],
      inputsAtTick: { 0: { clk: 0 }, 1: { clk: 1 } },
      signalRoles: { clk: 'input', LD0: 'output' },
      generatedAtIso: '2026-09-07T09:00:00.000Z',
      reportHash: 'identity-report',
    },
    // The engine reports the pin and the register it is driven by as separate lanes, because they
    // are separate nets that happen to carry the same value here.
    waveform: [
      { tick: 0, signals: { CLK: '0', LD0: '0', Q0: '0' }, mismatches: [] },
      { tick: 1, signals: { CLK: '1', LD0: '1', Q0: '1' }, mismatches: [] },
    ],
  } as unknown as RuntimeVerifyRun;
}

describe('Verify signal identity — a name that means two things', () => {
  it('does not resolve an ambiguous name, and says which names are ambiguous', () => {
    const owners = buildWaveformSignalAliasOwners({
      inputFields: [{ id: 'clk', label: 'CLK' }],
      outputFields: [{ id: 'q0', label: 'LD0' }],
      mappedSignals: MAPPED_SIGNALS,
      circuitNodes: CIRCUIT.nodes,
    });

    // `q0` is claimed by the boundary output (through the io row's id) and by the register
    // (through its label). Both owners are recorded.
    expect(owners.get('q0')).toBeTruthy();
    expect((owners.get('q0') as Set<string>).size).toBeGreaterThan(1);

    const ambiguous = buildAmbiguousWaveformSignalKeys(owners);
    expect(ambiguous.has('q0')).toBe(true);
    // `ld0` names exactly one thing — the boundary output — so it stays resolvable.
    expect(ambiguous.has('ld0')).toBe(false);

    const aliases = buildCanonicalWaveformSignalAliases({
      inputFields: [{ id: 'clk', label: 'CLK' }],
      outputFields: [{ id: 'q0', label: 'LD0' }],
      mappedSignals: MAPPED_SIGNALS,
      circuitNodes: CIRCUIT.nodes,
    });
    // The ambiguous name resolves to nothing rather than to a guess.
    expect(aliases.get('q0')).toBeUndefined();
    expect(aliases.get('ld0')).toBe('LD0');
  });

  it('counts the register as internal and the pin as an output', () => {
    const view = render(
      <VerifySurface
        deterministicHash="identity-hash"
        hasVectors
        verifyMode="sequential"
        vectors={[
          { id: 'v0', tick: 0, inputs: { clk: 0 }, expected: {} },
          { id: 'v1', tick: 1, inputs: { clk: 1 }, expected: {} },
        ]}
        lastRun={makeRun()}
        mappedInputs={[{ id: 'clk', label: 'CLK' }]}
        mappedSignals={MAPPED_SIGNALS}
        circuitGraph={CIRCUIT}
        onVectorsChange={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    const outputs = view.getByTestId('ide-verify-group-outputs');
    const internal = view.getByTestId('ide-verify-group-internal');

    expect(within(outputs).getByText('LD0')).toBeTruthy();
    expect(within(outputs).queryByText('Q0')).toBeNull();
    expect(within(internal).getByText('Q0')).toBeTruthy();

    // And the counts the rail publishes agree with that.
    expect(outputs.textContent).toContain('Outputs1');
    expect(internal.textContent).toContain('Internal1');
    expect(internal.textContent).not.toContain('No internal lanes');
  });
});
