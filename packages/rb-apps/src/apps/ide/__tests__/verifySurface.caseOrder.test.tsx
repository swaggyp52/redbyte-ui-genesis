// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { VerifySurface } from '../surfaces/VerifySurface';
import { workspacePreferencesStore } from '../workspacePreferences';

/**
 * The case table has one order, and it is the order the experiment is in.
 *
 * The Case Lab was written for combinational circuits, where the input combination IS the row's
 * identity: a truth table sorted by input value is the specification, and the case number beside
 * it is only a label. The representation switch makes the same table reachable in front of a
 * clocked circuit, and there the same sort is wrong — a counter's cases are ticks in time and its
 * output depends on the state it is in, not only on the inputs applied at that tick.
 *
 * Measured on the two-bit counter at 1280x650, the seven cases were drawn `0, 1, 6, 2, 3, 4, 5`:
 * silently grouped by whether EN was low, with nothing on screen to say why 6 sits between 1 and
 * 2. This is the same error as counting input combinations for a counter, one instrument over.
 *
 * The second half of this file is the defect that ordering exposed: the table drew one order
 * while every way of moving through it walked another.
 */

const SEQ_SIGNALS = [
  { id: 'en', label: 'EN', direction: 'in' as const, nodeId: 'n-en' },
  { id: 'ld0', label: 'LD0', direction: 'out' as const, nodeId: 'n-ld0' },
];

/** EN low for t0/t1, high through t2..t5, low again at t6 — the shape the capture had. */
const SEQ_VECTORS = [
  { id: 'c0', tick: 0, inputs: { en: 0 as const }, expected: { ld0: 0 as const } },
  { id: 'c1', tick: 1, inputs: { en: 0 as const }, expected: { ld0: 0 as const } },
  { id: 'c2', tick: 2, inputs: { en: 1 as const }, expected: { ld0: 1 as const } },
  { id: 'c3', tick: 3, inputs: { en: 1 as const }, expected: { ld0: 0 as const } },
  { id: 'c4', tick: 4, inputs: { en: 1 as const }, expected: { ld0: 1 as const } },
  { id: 'c5', tick: 5, inputs: { en: 1 as const }, expected: { ld0: 0 as const } },
  { id: 'c6', tick: 6, inputs: { en: 0 as const }, expected: { ld0: 0 as const } },
];

const COMB_SIGNALS = [
  { id: 'a', label: 'A', direction: 'in' as const, nodeId: 'n-a' },
  { id: 'b', label: 'B', direction: 'in' as const, nodeId: 'n-b' },
  { id: 'y', label: 'Y', direction: 'out' as const, nodeId: 'n-y' },
];

/**
 * Authored in an order that is not the truth table's, so tick order and combination order are
 * genuinely different and a test cannot pass by accident on a set where they coincide.
 * Combination order is A,B = 00 (t3), 01 (t1), 10 (t2), 11 (t0) -> ticks 3, 1, 2, 0.
 */
const COMB_VECTORS = [
  { id: 'k0', tick: 0, inputs: { a: 1 as const, b: 1 as const }, expected: { y: 1 as const } },
  { id: 'k1', tick: 1, inputs: { a: 0 as const, b: 1 as const }, expected: { y: 0 as const } },
  { id: 'k2', tick: 2, inputs: { a: 1 as const, b: 0 as const }, expected: { y: 0 as const } },
  { id: 'k3', tick: 3, inputs: { a: 0 as const, b: 0 as const }, expected: { y: 0 as const } },
];

function renderSurface(kind: 'sequential' | 'combinational') {
  const sequential = kind === 'sequential';
  return render(
    <VerifySurface
      hasVectors
      vectors={sequential ? SEQ_VECTORS : COMB_VECTORS}
      mappedInputs={
        sequential
          ? [{ id: 'en', label: 'EN' }]
          : [
              { id: 'a', label: 'A' },
              { id: 'b', label: 'B' },
            ]
      }
      mappedSignals={sequential ? SEQ_SIGNALS : COMB_SIGNALS}
      onOpenProjectVectors={vi.fn()}
      onVectorsChange={vi.fn()}
      deterministicHash="case-order"
      verifyMode={kind}
    />
  );
}

/** The case numbers as they are painted, top to bottom. */
function renderedCaseNumbers(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.ide-case-lab-row')).map((row) =>
    (row.querySelector('.ide-case-lab-num')?.textContent ?? '').trim()
  );
}

function showTable(getByTestId: (id: string) => HTMLElement) {
  act(() => {
    fireEvent.click(getByTestId('ide-verify-view-table'));
  });
}

describe('Simulate case table — the rows are in the order the experiment is in', () => {
  beforeEach(() => {
    workspacePreferencesStore.resetSimulateLayout();
    try {
      window.sessionStorage.clear();
    } catch {
      /* jsdom without storage */
    }
    cleanup();
  });

  it('puts a clocked circuit on a time axis when the reader asks for the table', () => {
    const { getByTestId, container } = renderSurface('sequential');

    // Timeline is what a clocked circuit gets without asking; the table is a deliberate choice.
    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-representation')).toBe('timeline');
    showTable(getByTestId);
    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-representation')).toBe('table');

    // Not 0, 1, 6, 2, 3, 4, 5.
    expect(renderedCaseNumbers(container)).toEqual(['0', '1', '2', '3', '4', '5', '6']);
    // And the column says which axis it is, rather than claiming one that is not true here.
    const head = getByTestId('ide-case-lab-num-head');
    expect(head.getAttribute('data-case-order')).toBe('time');
    expect(head.getAttribute('title')).toContain('time order');
  });

  it('keeps the truth table in truth-table order for a combinational circuit', () => {
    const { getByTestId, container } = renderSurface('combinational');

    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-representation')).toBe('table');
    // A,B ascending: 00, 01, 10, 11 — which is ticks 3, 1, 2, 0 for this authored set.
    expect(renderedCaseNumbers(container)).toEqual(['3', '1', '2', '0']);
    const head = getByTestId('ide-case-lab-num-head');
    expect(head.getAttribute('data-case-order')).toBe('combination');
    expect(head.getAttribute('title')).toContain('input combination');
  });

  it('moves to the row below, in both orders, because there is one order', () => {
    // Combinational: rows are 3, 1, 2, 0. Stepping used to walk a tick-sorted list, so from the
    // first row (case 3) ArrowDown selected case 0 — the row at the BOTTOM of the table.
    const comb = renderSurface('combinational');
    const table = comb.getByTestId('ide-case-lab-table');
    act(() => {
      fireEvent.click(comb.getByTestId('ide-case-lab-row-3'));
    });
    expect(comb.getByTestId('ide-case-lab-row-3').getAttribute('aria-selected')).toBe('true');
    act(() => {
      fireEvent.keyDown(table, { key: 'ArrowDown' });
    });
    expect(comb.getByTestId('ide-case-lab-row-1').getAttribute('aria-selected')).toBe('true');

    // End goes to the last row that is drawn, not to the highest tick.
    act(() => {
      fireEvent.keyDown(table, { key: 'End' });
    });
    expect(comb.getByTestId('ide-case-lab-row-0').getAttribute('aria-selected')).toBe('true');
    act(() => {
      fireEvent.keyDown(table, { key: 'Home' });
    });
    expect(comb.getByTestId('ide-case-lab-row-3').getAttribute('aria-selected')).toBe('true');
    cleanup();

    // Sequential: rows are 0..6, so the row below case 1 is case 2.
    const seq = renderSurface('sequential');
    showTable(seq.getByTestId);
    act(() => {
      fireEvent.click(seq.getByTestId('ide-case-lab-row-1'));
    });
    act(() => {
      fireEvent.keyDown(seq.getByTestId('ide-case-lab-table'), { key: 'ArrowDown' });
    });
    expect(seq.getByTestId('ide-case-lab-row-2').getAttribute('aria-selected')).toBe('true');
  });

  it('says the count once — the label beside it is already the noun', () => {
    const { getByTestId } = renderSurface('combinational');
    expect(getByTestId('ide-case-lab-title').textContent).toContain('Test cases');
    // Was "Test cases 4 cases".
    expect(getByTestId('ide-case-lab-count').textContent?.trim()).toBe('4');
  });
});
