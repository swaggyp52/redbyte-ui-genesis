// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

// ─── Shared fixture helpers ───────────────────────────────────────────────────

const BASE_SIGNALS = [
  { id: 'sw0', direction: 'in' as const, label: 'SW0' },
  { id: 'ld0', direction: 'out' as const, label: 'LD0' },
];

const BASE_INPUTS = [{ id: 'sw0', label: 'SW0' }];

const BASE_VECTORS = [
  { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
];

function makePassRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'authoring-pass',
    scenarioName: 'Authoring Pass',
    status: 'pass',
    deterministicHash: 'abc123',
    reportHash: 'rep-authoring-pass',
    generatedAtIso: '2026-03-23T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      vectors: [
        { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 }, caseIndex: 0 },
      ],
      inputsAtTick: { 0: { sw0: 0 } },
      inputsByVectorId: { 'vec-01': { sw0: 0 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [{ tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass', vectorId: 'vec-01', caseIndex: 0 }],
    } as RuntimeVerifyRun['report'],
    waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
  };
}

// ─── Add Case — expected output authoring ────────────────────────────────────

describe('VerifySurface authoring — Add Case expected outputs', () => {
  it('shows expected output lanes inline for each mapped output signal', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={BASE_VECTORS}
        lastRun={makePassRun()}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={vi.fn()}
      />
    );

    expect(getByTestId('ide-stimulus-expected-ld0-t0')).toBeTruthy();
  });

  it('keeps expected unset when Add case is added without editing any checks', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={[]}
        lastRun={makePassRun()}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={onVectorsChange}
      />
    );

    fireEvent.click(getByTestId('ide-stimulus-add-tick'));

    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    const newVectors = onVectorsChange.mock.calls[0]?.[0] as Array<{
      expected: Record<string, 0 | 1>;
    }>;
    expect(newVectors[0]?.expected).toEqual({});
  });

  it('lets students author expected outputs directly in the stimulus canvas', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={BASE_VECTORS}
        lastRun={makePassRun()}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={onVectorsChange}
      />
    );

    fireEvent.pointerDown(getByTestId('ide-stimulus-expected-ld0-t0'));

    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    const firstEdit = onVectorsChange.mock.calls[0]?.[0] as Array<{
      expected: Record<string, 0 | 1>;
    }>;
    expect(firstEdit[0]?.expected).toEqual({ ld0: 1 });
  });

  it('preserves imported/example vector expectations that still use io-row node ids', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0_node: 0 }, expected: { ld0_node: 1 } },
        ]}
        lastRun={makePassRun()}
        mappedInputs={[{ id: 'sw0', label: 'SW0', nodeId: 'sw0_node' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' as const, label: 'SW0', nodeId: 'sw0_node' },
          { id: 'ld0', direction: 'out' as const, label: 'LD0', nodeId: 'ld0_node' },
        ]}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={vi.fn()}
      />
    );

    expect(getByTestId('ide-vcb-use-saved-checks')).toHaveAttribute('aria-pressed', 'true');
    expect(getByTestId('ide-stimulus-expected-ld0-t0').getAttribute('title')).toContain(
      '1'
    );
  });

  it('does not show expected grid when no output signals are mapped', () => {
    const { queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={BASE_VECTORS}
        lastRun={makePassRun()}
        mappedInputs={BASE_INPUTS}
        mappedSignals={[{ id: 'sw0', direction: 'in' as const }]}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={vi.fn()}
      />
    );

    expect(queryByTestId('ide-stimulus-expected-ld0-t0')).toBeNull();
  });

  it('does not invent fallback input ports when no authoritative inputs exist', () => {
    const { queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={false}
        vectors={[]}
        lastRun={makePassRun()}
        mappedInputs={[]}
        mappedSignals={[{ id: 'ld0', direction: 'out' as const, label: 'LD0' }]}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={vi.fn()}
      />
    );

    expect(queryByTestId('ide-verify-add-vector-input-in_a')).toBeNull();
    expect(queryByTestId('ide-verify-add-vector-input-in_b')).toBeNull();
  });
});

// ─── Auto-generated vector disclosure ────────────────────────────────────────

describe('VerifySurface authoring — auto-generated vector disclosure', () => {
  it('shows auto-vector disclosure callout when vectorsAreAutoGenerated is true', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={BASE_VECTORS}
        lastRun={makePassRun()}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        vectorsAreAutoGenerated={true}
        onOpenProjectVectors={vi.fn()}
      />
    );

    const notice = getByTestId('ide-verify-auto-vector-notice');
    expect(notice.textContent).toContain('auto-generated');
  });

  it('does NOT show auto-vector notice when vectorsAreAutoGenerated is false', () => {
    const { queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={BASE_VECTORS}
        lastRun={makePassRun()}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        vectorsAreAutoGenerated={false}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(queryByTestId('ide-verify-auto-vector-notice')).toBeNull();
  });

  it('does NOT show auto-vector notice when vectorsAreAutoGenerated is omitted', () => {
    const { queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={BASE_VECTORS}
        lastRun={makePassRun()}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(queryByTestId('ide-verify-auto-vector-notice')).toBeNull();
  });
});

// ─── Dismiss persistence ──────────────────────────────────────────────────────

describe('VerifySurface authoring — dismiss persistence across renders', () => {
  it('hides auto-vector notice after dismiss button is clicked', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={BASE_VECTORS}
        lastRun={makePassRun()}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        vectorsAreAutoGenerated={true}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-auto-vector-notice')).toBeTruthy();
    fireEvent.click(getByTestId('ide-verify-auto-vector-dismiss'));
    expect(queryByTestId('ide-verify-auto-vector-notice')).toBeNull();
  });

  it('keeps notice hidden on re-render if same hash was dismissed (sessionStorage)', () => {
    // First render: dismiss
    const { unmount } = render(
      <VerifySurface
        deterministicHash="hash-xyz"
        hasVectors={true}
        vectors={BASE_VECTORS}
        lastRun={makePassRun()}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        vectorsAreAutoGenerated={true}
        onOpenProjectVectors={vi.fn()}
      />
    );
    fireEvent.click(
      document.querySelector('[data-testid="ide-verify-auto-vector-dismiss"]')!
    );
    unmount();

    // Second render with same hash: notice should stay hidden
    const { queryByTestId } = render(
      <VerifySurface
        deterministicHash="hash-xyz"
        hasVectors={true}
        vectors={BASE_VECTORS}
        lastRun={makePassRun()}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        vectorsAreAutoGenerated={true}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(queryByTestId('ide-verify-auto-vector-notice')).toBeNull();
  });

  it('re-shows notice when deterministicHash changes after dismiss', () => {
    // First render: dismiss
    const { unmount } = render(
      <VerifySurface
        deterministicHash="hash-old"
        hasVectors={true}
        vectors={BASE_VECTORS}
        lastRun={makePassRun()}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        vectorsAreAutoGenerated={true}
        onOpenProjectVectors={vi.fn()}
      />
    );
    fireEvent.click(
      document.querySelector('[data-testid="ide-verify-auto-vector-dismiss"]')!
    );
    unmount();

    // Second render with different hash: notice should re-appear
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="hash-new"
        hasVectors={true}
        vectors={BASE_VECTORS}
        lastRun={makePassRun()}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        vectorsAreAutoGenerated={true}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-auto-vector-notice')).toBeTruthy();
  });
});
