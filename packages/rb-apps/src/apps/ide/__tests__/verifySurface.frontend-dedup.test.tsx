// @vitest-environment jsdom
// B-13 Phase 2 — Verify frontend dedup
// Contracts: one canonical Run button, one canonical sequential helper surface.
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

function makePassRun(): RuntimeVerifyRun {
  return {
    scenarioId: 's1',
    scenarioName: 'Scenario',
    status: 'pass',
    deterministicHash: 'det-pass',
    reportHash: 'rep-pass',
    generatedAtIso: '2026-04-08T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: ({
      vectors: [{ id: 'v0', tick: 0, inputs: { sw0: 0 }, expected: {} }],
      inputsAtTick: { 0: { sw0: 0 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [],
    } as unknown) as RuntimeVerifyRun['report'],
    waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
  };
}

function makeFailRun(): RuntimeVerifyRun {
  return {
    scenarioId: 's1',
    scenarioName: 'Scenario',
    status: 'fail',
    deterministicHash: 'det-fail',
    reportHash: 'rep-fail',
    generatedAtIso: '2026-04-08T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: ({
      vectors: [{ id: 'v0', tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } }],
      inputsAtTick: { 0: { sw0: 1 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [{ tick: 0, signal: 'ld0', expected: '1', actual: '0', status: 'fail', vectorId: 'v0', caseIndex: 0 }],
    } as unknown) as RuntimeVerifyRun['report'],
    waveform: [{ tick: 0, signals: { sw0: '1', ld0: '0' }, mismatches: [{ signal: 'ld0', expected: '1', actual: '0' }] }],
  };
}

const baseProps = {
  hasVectors: true,
  vectors: [{ id: 'v0', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }],
  mappedInputs: [{ id: 'sw0', label: 'SW0' }],
  mappedSignals: [
    { id: 'sw0', label: 'SW0', direction: 'in' as const },
    { id: 'ld0', label: 'LD0', direction: 'out' as const },
  ],
  onOpenProjectVectors: vi.fn(),
  onVectorsChange: vi.fn(),
};

describe('Verify frontend — single canonical Run button (B-13 Phase 2)', () => {
  it('shows ide-vcb-run and hides ide-vfr-run in combinational first-run state with vectors', () => {
    // First-run state: no lastRun, hasVectors=true
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        {...baseProps}
        deterministicHash="det-abc"
        verifyMode="combinational"
      />
    );

    // Canonical run button exists
    expect(getByTestId('ide-vcb-run')).toBeTruthy();
    // Duplicate first-run panel run button must be absent
    expect(queryByTestId('ide-vfr-run')).toBeNull();
  });

  it('hides ide-verify-workbench-run after a pass run — Run stays in header', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        {...baseProps}
        deterministicHash="det-pass"
        lastRun={makePassRun()}
        verifyMode="combinational"
      />
    );

    // Header run is canonical
    expect(getByTestId('ide-vcb-run')).toBeTruthy();
    // Workbench run button must not be present
    expect(queryByTestId('ide-verify-workbench-run')).toBeNull();
  });

  it('hides ide-verify-workbench-run after a fail run', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        {...baseProps}
        deterministicHash="det-fail"
        lastRun={makeFailRun()}
        verifyMode="combinational"
      />
    );

    expect(getByTestId('ide-vcb-run')).toBeTruthy();
    expect(queryByTestId('ide-verify-workbench-run')).toBeNull();
  });
});

describe('Verify frontend — single canonical Run button, Phase 3 (B-13 Phase 3)', () => {
  it('hides ide-verify-run footer button in first-run state with vectors ready', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        {...baseProps}
        deterministicHash="det-p3a"
        verifyMode="combinational"
      />
    );

    // Canonical run button present
    expect(getByTestId('ide-vcb-run')).toBeTruthy();
    // Competing first-run footer Run button must be absent
    expect(queryByTestId('ide-verify-run')).toBeNull();
    // Its wrapper must also be absent
    expect(queryByTestId('ide-verify-empty-run')).toBeNull();
  });

  it('hides ide-verify-empty-run wrapper in observation-mode first-run state', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="det-p3b"
        verifyMode="combinational"
        hasVectors={true}
        vectors={[{ id: 'v0', tick: 0, inputs: { sw0: 1 }, expected: {} }]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' as const },
          { id: 'ld0', label: 'LD0', direction: 'out' as const },
        ]}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={vi.fn()}
      />
    );

    expect(getByTestId('ide-vcb-run')).toBeTruthy();
    expect(queryByTestId('ide-verify-run')).toBeNull();
    expect(queryByTestId('ide-verify-empty-run')).toBeNull();
  });
});

describe('Verify frontend — single canonical sequential helper (B-13 Phase 2)', () => {
  it('shows ide-verify-sequential-helper callout and no ide-vfr-seq-presets in first-run sequential', () => {
    const seqProps = {
      ...baseProps,
      hasVectors: false,
      vectors: [],
      liveSignalRoles: { clk: 'clock' as const, d: 'input' as const, q: 'output' as const },
      mappedInputs: [{ id: 'clk', label: 'CLK' }, { id: 'd', label: 'D' }],
      mappedSignals: [
        { id: 'clk', label: 'CLK', direction: 'in' as const },
        { id: 'd', label: 'D', direction: 'in' as const },
        { id: 'q', label: 'Q', direction: 'out' as const },
      ],
    };

    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        {...seqProps}
        deterministicHash="det-seq"
        verifyMode="sequential"
      />
    );

    // Canonical sequential helper present
    expect(getByTestId('ide-verify-sequential-helper')).toBeTruthy();
    // Duplicate seq presets in VerifyFirstRunPanel must be absent
    expect(queryByTestId('ide-vfr-seq-presets')).toBeNull();
  });

  it('sequential helper clock patterns work via ide-verify-sequential-helper only', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="det-seq-clk"
        hasVectors={false}
        vectors={[]}
        verifyMode="sequential"
        liveSignalRoles={{ clk: 'clock', d: 'input', q: 'output' }}
        mappedInputs={[{ id: 'clk', label: 'CLK' }, { id: 'd', label: 'D' }]}
        mappedSignals={[
          { id: 'clk', label: 'CLK', direction: 'in' },
          { id: 'd', label: 'D', direction: 'in' },
          { id: 'q', label: 'Q', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={onVectorsChange}
      />
    );

    // Clock actions available via canonical helper
    expect(getByTestId('ide-verify-insert-clock-pattern')).toBeTruthy();
    expect(getByTestId('ide-verify-insert-clock-hold-low')).toBeTruthy();
    expect(getByTestId('ide-verify-insert-clock-hold-high')).toBeTruthy();
    expect(getByTestId('ide-verify-insert-clock-pulse')).toBeTruthy();
  });
});
