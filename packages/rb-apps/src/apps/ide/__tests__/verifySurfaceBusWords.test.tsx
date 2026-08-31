// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { BusDeclaration } from '@redbyte/rb-logic-core';
import { VerifySurface } from '../surfaces/VerifySurface';
import type { RuntimeVerifyRun } from '../projectRuntime';

afterEach(() => cleanup());

const busA: BusDeclaration = {
  id: 'bus-in-A', name: 'A', direction: 'input', left: 1, right: 0,
  bits: [{ index: 1, nodeId: 'A1' }, { index: 0, nodeId: 'A0' }],
};
const busY: BusDeclaration = {
  id: 'bus-out-Y', name: 'Y', direction: 'output', left: 1, right: 0,
  bits: [{ index: 1, nodeId: 'Y1' }, { index: 0, nodeId: 'Y0' }],
};

const mappedInputs = [
  { id: 'A0', label: 'A[0]', pin: 'V17', nodeId: 'A0' },
  { id: 'A1', label: 'A[1]', pin: 'V16', nodeId: 'A1' },
];
const mappedSignals = [
  { id: 'A0', label: 'A[0]', direction: 'in' as const, pin: 'V17', nodeId: 'A0' },
  { id: 'A1', label: 'A[1]', direction: 'in' as const, pin: 'V16', nodeId: 'A1' },
  { id: 'Y0', label: 'Y[0]', direction: 'out' as const, pin: 'U16', nodeId: 'Y0' },
  { id: 'Y1', label: 'Y[1]', direction: 'out' as const, pin: 'E19', nodeId: 'Y1' },
];

function runWithSignals(signals: Record<string, string>): RuntimeVerifyRun {
  return {
    scenarioId: 'bus-words',
    scenarioName: 'Bus words',
    status: 'pass',
    simulationStatus: 'complete',
    assertionStatus: 'not-configured',
    deterministicHash: 'bus-words-hash',
    reportHash: 'bus-words-report-hash',
    generatedAtIso: '2026-08-30T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      schemaVersion: 'rb.verify-report.v1',
      scenarioId: 'bus-words',
      scenarioName: 'Bus words',
      status: 'pass',
      deterministicHash: 'bus-words-hash',
      rows: [],
      vectors: [],
      inputsAtTick: {},
      signalRoles: { 'A[0]': 'input', 'A[1]': 'input', 'Y[0]': 'output', 'Y[1]': 'output' },
      generatedAtIso: '2026-08-30T00:00:00.000Z',
      reportHash: 'bus-words-report-hash',
    },
    waveform: [{ tick: 0, signals, mismatches: [] }],
  };
}

function renderSurface(run: RuntimeVerifyRun) {
  return render(
    <VerifySurface
      deterministicHash="bus-words-hash"
      hasVectors
      verifyMode="combinational"
      vectors={[]}
      lastRun={run}
      buses={[busA, busY]}
      mappedInputs={mappedInputs}
      mappedSignals={mappedSignals}
      onVectorsChange={vi.fn()}
      onOpenProjectVectors={vi.fn()}
    />
  );
}

describe('VerifySurface bus word lanes', () => {
  it('collapses bus member lanes into an observed word (hex + binary + decimal)', async () => {
    // A[1]=1, A[0]=0 → 10b = 0x2 = 2; Y mirrors A.
    const view = renderSurface(
      runWithSignals({ 'A[0]': '0', 'A[1]': '1', 'Y[0]': '0', 'Y[1]': '1' })
    );
    await waitFor(() => {
      expect(view.getByTestId('ide-verify-bus-words')).toBeTruthy();
    });
    expect(view.getByTestId('ide-verify-bus-word-hex-a').textContent).toBe('0x2');
    expect(view.getByTestId('ide-verify-bus-word-hex-y').textContent).toBe('0x2');
    const laneA = view.getByTestId('ide-verify-bus-word-a');
    expect(laneA.textContent).toContain('A[1:0]');
    expect(laneA.textContent).toContain('10₂');
    expect(laneA.textContent).toContain('2');
  });

  it('preserves an unknown bit — the whole word reads unknown, not zero', async () => {
    // Y[1] = X → Y word unknown; A stays known (0x2).
    const view = renderSurface(
      runWithSignals({ 'A[0]': '0', 'A[1]': '1', 'Y[0]': '0', 'Y[1]': 'X' })
    );
    await waitFor(() => {
      expect(view.getByTestId('ide-verify-bus-words')).toBeTruthy();
    });
    expect(view.getByTestId('ide-verify-bus-word-hex-a').textContent).toBe('0x2');
    const hexY = view.getByTestId('ide-verify-bus-word-hex-y').textContent ?? '';
    expect(hexY).toContain('?');
  });
});
