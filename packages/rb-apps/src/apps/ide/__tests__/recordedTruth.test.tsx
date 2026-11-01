// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { RunIdentityStrip } from '../surfaces/verify/RunIdentityStrip';
import { createRecordedPortResolver } from '../surfaces/verify/recordedCircuitGeometry';
afterEach(cleanup);

describe('one recorded truth and visible divergence', () => {
  it('uses exact endpoint identity and refuses an ambiguous driver or other instance', () => {
    const circuit = { nodes: [], connections: [
      { from: { nodeId: 'fa0/q', portName: 'out' }, to: { nodeId: 'led', portName: 'in' } },
    ] } as unknown as Circuit;
    const samples = [{ signals: { 'fa0/q.out': '0', 'fa1/q.out': '1' } }];
    expect(createRecordedPortResolver(circuit, samples)('led', 'in')).toBe('fa0/q.out');
    expect(createRecordedPortResolver(circuit, [{ signals: { 'fa1/q.out': '1' } }])('led', 'in')).toBeNull();
    const ambiguous = { ...circuit, connections: [...circuit.connections,
      { from: { nodeId: 'fa1/q', portName: 'out' }, to: { nodeId: 'led', portName: 'in' } }] };
    expect(createRecordedPortResolver(ambiguous, samples)('led', 'in')).toBeNull();
  });
  it('raises a clickable sample-level alarm even if compact digests collide', () => {
    const baseline = { runId: 'r1', projectId: 'p', scenarioId: 's', sequence: 1,
      identity: { design: 'd', stimulus: 's', engine: 'redbyte-browser-v1' }, outputDigest: 'collision',
      runKind: 'trace', assertionStatus: 'not-configured', report: { rows: [] },
      waveform: [{ tick: 5, signals: { 'fa0/q.out': '0' }, mismatches: [] }],
    } as unknown as RuntimeVerifyRun;
    const divergent = { ...baseline, runId: 'r2', sequence: 2,
      waveform: [{ tick: 5, signals: { 'fa0/q.out': '1' }, mismatches: [] }] };
    const select = vi.fn();
    render(<RunIdentityStrip run={divergent} archive={[baseline, divergent]} changes={[]} onDifference={select} />);
    expect(screen.getByRole('alert').textContent).toContain('Same configuration produced different outputs');
    expect(screen.getByTestId('ide-run-repetition').textContent).toBe('2 runs · 1 identical');
    fireEvent.click(screen.getByRole('button', { name: /First difference: fa0\/q.out at t5/ }));
    expect(select).toHaveBeenCalledWith('fa0/q.out', 5);
    expect(screen.getByTestId('ide-run-check-result').textContent).not.toMatch(/pass/i);
  });
});
