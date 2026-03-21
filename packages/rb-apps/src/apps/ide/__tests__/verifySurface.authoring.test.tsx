// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
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

// ─── Add Case — expected output authoring ────────────────────────────────────

describe('VerifySurface authoring — Add Case expected outputs', () => {
  it('shows expected output select for each output signal in Add Case form', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={BASE_VECTORS}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={vi.fn()}
      />
    );

    const expectedSelect = getByTestId('ide-verify-add-vector-expected-ld0');
    expect(expectedSelect).toBeTruthy();
    expect((expectedSelect as HTMLSelectElement).value).toBe('0');
  });

  it('populates expected field in the authored vector when Add Case is submitted', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={BASE_VECTORS}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={onVectorsChange}
      />
    );

    // Author sw0=1, expected ld0=1
    fireEvent.change(getByTestId('ide-verify-add-vector-input-sw0'), {
      target: { value: '1' },
    });
    fireEvent.change(getByTestId('ide-verify-add-vector-expected-ld0'), {
      target: { value: '1' },
    });
    fireEvent.click(getByTestId('ide-verify-add-vector-submit'));

    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    const newVectors = onVectorsChange.mock.calls[0]?.[0] as Array<{
      expected: Record<string, 0 | 1>;
    }>;
    const addedCase = newVectors.find((v) => v.expected['ld0'] !== undefined);
    expect(addedCase?.expected['ld0']).toBe(1);
  });

  it('defaults expected to 0 when Add Case is submitted without changing expected', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={[]}
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={onVectorsChange}
      />
    );

    fireEvent.click(getByTestId('ide-verify-add-vector-submit'));

    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    const newVectors = onVectorsChange.mock.calls[0]?.[0] as Array<{
      expected: Record<string, 0 | 1>;
    }>;
    expect(newVectors[0]?.expected['ld0']).toBe(0);
  });

  it('does not show expected grid when no output signals are mapped', () => {
    const { queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={BASE_VECTORS}
        mappedInputs={BASE_INPUTS}
        mappedSignals={[{ id: 'sw0', direction: 'in' as const }]}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={vi.fn()}
      />
    );

    expect(queryByTestId('ide-verify-add-vector-expected-ld0')).toBeNull();
  });

  it('does not invent fallback input ports when no authoritative inputs exist', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={false}
        vectors={[]}
        mappedInputs={[]}
        mappedSignals={[{ id: 'ld0', direction: 'out' as const, label: 'LD0' }]}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={onVectorsChange}
      />
    );

    expect(queryByTestId('ide-verify-add-vector-input-in_a')).toBeNull();
    expect(queryByTestId('ide-verify-add-vector-input-in_b')).toBeNull();

    fireEvent.click(getByTestId('ide-verify-empty-generate-basics'));

    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    expect(onVectorsChange.mock.calls[0]?.[0]).toEqual([
      { id: 'vec-01', tick: 0, inputs: {}, expected: {} },
    ]);
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
        mappedInputs={BASE_INPUTS}
        mappedSignals={BASE_SIGNALS}
        vectorsAreAutoGenerated={true}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-auto-vector-notice')).toBeTruthy();
  });
});
