// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { VerifySurface } from '../surfaces/VerifySurface';
import { DEFAULT_SIMULATE_LAYOUT, workspacePreferencesStore } from '../workspacePreferences';

/**
 * P2.5H Wave One — Cases and the evidence deck are one resizable composite:
 * an accessible splitter (pointer + keyboard), persisted share, collapse,
 * maximize either pane, reset. The state lives in the workspace preferences.
 */
const SIGNALS = [
  { id: 'a_0', label: 'A[0]', direction: 'in' as const, nodeId: 'a0' },
  { id: 'sum_0', label: 'SUM[0]', direction: 'out' as const, nodeId: 'sum0' },
];
const VECTORS = [
  { id: 'v0', tick: 0, inputs: { a_0: 0 as const }, expected: { sum_0: 0 as const } },
  { id: 'v1', tick: 1, inputs: { a_0: 1 as const }, expected: { sum_0: 1 as const } },
];

function renderSurface() {
  return render(
    <VerifySurface
      hasVectors
      vectors={VECTORS}
      mappedInputs={[{ id: 'a_0', label: 'A[0]' }]}
      mappedSignals={SIGNALS}
      onOpenProjectVectors={vi.fn()}
      onVectorsChange={vi.fn()}
      deterministicHash="evidence-deck"
      verifyMode="combinational"
    />
  );
}

describe('Simulate evidence deck composition', () => {
  beforeEach(() => {
    workspacePreferencesStore.resetSimulateLayout();
  });

  it('renders an accessible horizontal splitter that reports the deck share', () => {
    const { getByTestId } = renderSurface();
    const handle = getByTestId('ide-verify-deck-handle');
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
    expect(handle.getAttribute('tabindex')).toBe('0');
    expect(handle.getAttribute('aria-valuenow')).toBe(String(Math.round(DEFAULT_SIMULATE_LAYOUT.evidenceFraction * 100)));
    expect(getByTestId('ide-verify-lab-grid').style.getPropertyValue('--rb-sim-evidence-fr')).toBe('36.00%');
    expect(getByTestId('ide-verify-deck-reset').hasAttribute('disabled')).toBe(true);
  });

  it('resizes with the keyboard, clamps, and persists the share', () => {
    const { getByTestId } = renderSurface();
    const handle = getByTestId('ide-verify-deck-handle');
    act(() => {
      fireEvent.keyDown(handle, { key: 'ArrowUp' });
    });
    expect(workspacePreferencesStore.getSnapshot().simulate.evidenceFraction).toBeCloseTo(0.38, 5);
    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-evidence-fraction')).toBe('38');
    act(() => {
      fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true });
    });
    expect(workspacePreferencesStore.getSnapshot().simulate.evidenceFraction).toBeCloseTo(0.28, 5);
    act(() => {
      fireEvent.keyDown(handle, { key: 'End' });
    });
    expect(workspacePreferencesStore.getSnapshot().simulate.evidenceFraction).toBe(0.85);
    expect(getByTestId('ide-verify-deck-reset').hasAttribute('disabled')).toBe(false);
    act(() => {
      fireEvent.keyDown(handle, { key: 'Enter' });
    });
    expect(workspacePreferencesStore.getSnapshot().simulate).toEqual(DEFAULT_SIMULATE_LAYOUT);
  });

  it('collapses the deck to a strip with an Expand control and restores it', () => {
    const { getByTestId, queryByTestId } = renderSurface();
    act(() => {
      fireEvent.click(getByTestId('ide-verify-deck-collapse'));
    });
    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-evidence-collapsed')).toBe('true');
    expect(getByTestId('ide-verify-evidence-strip').textContent).toContain('Evidence deck collapsed');
    act(() => {
      fireEvent.click(getByTestId('ide-verify-evidence-expand'));
    });
    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-evidence-collapsed')).toBeNull();
    expect(queryByTestId('ide-verify-evidence-strip')).toBeNull();
  });

  it('maximizes either pane and restores the split', () => {
    const { getByTestId } = renderSurface();
    act(() => {
      fireEvent.click(getByTestId('ide-verify-deck-maximize-waveform'));
    });
    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-evidence-maximized')).toBe('waveform');
    expect(getByTestId('ide-verify-deck-handle').getAttribute('aria-disabled')).toBe('true');
    act(() => {
      fireEvent.click(getByTestId('ide-verify-deck-maximize-cases'));
    });
    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-evidence-maximized')).toBe('cases');
    act(() => {
      fireEvent.click(getByTestId('ide-verify-deck-maximize-cases'));
    });
    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-evidence-maximized')).toBeNull();
  });
});
