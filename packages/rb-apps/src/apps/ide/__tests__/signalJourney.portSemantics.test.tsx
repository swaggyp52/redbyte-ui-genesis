// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { SignalJourney } from '../components/SignalJourney';
import { useEngineeringSelection } from '../engineeringSelection';
import { selectJourney } from '../signalJourney';

afterEach(cleanup);

function recording(type = 'AND', a = 1, b = 0): RuntimeVerifyRun {
  return {
    projectId: 'ports', runId: 'retained-ports', scenarioId: 'scenario', scenarioName: 'Ports',
    reportHash: 'retained-revision', schedule: 'combinational',
    status: 'pass', deterministicHash: 'ports', generatedAtIso: '2026-10-07T00:00:00Z',
    meta: { circuitKind: 'combinational', clockingProtocol: null, samplePoint: 'steady-state', tick0Meaning: null, clockSignalName: null },
    circuitSnapshot: { nodes: [
      { id: 'a', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
      { id: 'b', type: 'INPUT', label: 'B', position: { x: 0, y: 100 } },
      { id: 'g', type, label: 'Gate', position: { x: 200, y: 50 } },
    ], connections: [
      { id: 'a-g', from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'g', portName: 'a' } },
      { id: 'b-g', from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'g', portName: 'b' } },
    ] },
    waveform: [{ tick: 0, signals: { 'a.out': String(a), 'b.out': String(b),
      'g.a': String(a), 'g.b': String(b), 'g.out': type === 'AND' ? '0' : '1' }, mismatches: [] }],
    report: { schemaVersion: 'rb.verify-report.v1', scenarioId: 'scenario', scenarioName: 'Ports',
      status: 'pass', deterministicHash: 'ports', rows: [], vectors: [], inputsAtTick: {}, signalRoles: {},
      generatedAtIso: '2026-10-07T00:00:00Z', reportHash: 'retained-revision' },
  };
}

function Subject({ run }: { run: RuntimeVerifyRun }) {
  const selection = useEngineeringSelection(state => state.journey)!;
  return <SignalJourney run={run} selection={selection} onSignal={() => {}} onTick={() => {}} onReturn={() => {}} />;
}

describe('visible linked port semantics', () => {
  it('follows a load to its input value and exact driver while the gate output differs', () => {
    const run = recording();
    useEngineeringSelection.getState().inspectJourney(selectJourney(run, { nodeId: 'a', port: 'out' }, 0));
    const view = render(<Subject run={run} />);
    fireEvent.click(view.getByRole('button', { name: 'Gate · a' }));
    expect(useEngineeringSelection.getState().journey).toMatchObject({ nodeId: 'g', port: 'a' });
    const rule = view.container.querySelector('.rb-journey-rule')!;
    expect(rule.textContent).toContain('Gate.a = A1 = 1');
    expect(rule.textContent).not.toContain('∧');
    expect(view.getByRole('button', { name: 'A · out' })).toBeTruthy();
    expect(view.queryByRole('button', { name: 'B · out' })).toBeNull();
  });

  it.each(['NAND', 'NOR'])('groups the complete negated %s rule', type => {
    const run = recording(type, 0, 0);
    useEngineeringSelection.getState().inspectJourney(selectJourney(run, { nodeId: 'g', port: 'out' }, 0));
    const view = render(<Subject run={run} />);
    const equation = view.container.querySelector('.rb-journey-expression')!.textContent;
    expect(equation).toMatch(type === 'NAND' ? /Gate = ¬\(A0∧B0\) = 1/ : /Gate = ¬\(A0∨B0\) = 1/);
  });

  it('selects an actual connection with pointer and keyboard without changing the retained moment', () => {
    const run = recording();
    useEngineeringSelection.getState().inspectJourney(selectJourney(run, { nodeId: 'a', port: 'out' }, 0));
    const view = render(<Subject run={run} />);
    const wire = view.container.querySelector('[data-projection-wire="a.out-g.a"]')!;
    fireEvent.keyDown(wire, { key: 'Enter' });
    expect(useEngineeringSelection.getState().journey).toMatchObject({ nodeId: 'g', port: 'a', tick: 0, runId: run.runId, eventOrder: null });
    expect(view.getByTestId('ide-journey-understand').textContent).toContain('Input a = 1');
    fireEvent.click(view.getByRole('button', { name: 'Inspect gate output' }));
    expect(useEngineeringSelection.getState().journey).toMatchObject({ nodeId: 'g', port: 'out', tick: 0 });
    fireEvent.click(view.container.querySelector('[data-projection-wire="b.out-g.b"] .rb-net-hit')!);
    expect(useEngineeringSelection.getState().journey).toMatchObject({ nodeId: 'g', port: 'b', tick: 0 });
    expect(view.getByTestId('ide-journey-understand').textContent).toContain('Input b = 0');
  });
});
