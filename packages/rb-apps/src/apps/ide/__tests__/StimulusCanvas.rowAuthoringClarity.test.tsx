// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { StimulusCanvas } from '../components/StimulusCanvas';

const INPUTS = [{ id: 'sw0', label: 'SW0' }];
const OUTPUTS = [{ id: 'ld0', label: 'LD0' }];
const VECTORS = [
  { id: 'v0', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
  { id: 'v1', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
];

afterEach(() => {
  cleanup();
});

describe('StimulusCanvas row authoring clarity', () => {
  it('renders input values as text and accessible names instead of color-only cells', () => {
    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={INPUTS}
        outputFields={OUTPUTS}
        authoredVectors={VECTORS}
        onVectorsChange={vi.fn()}
      />
    );

    const lowCell = getByTestId('ide-stimulus-cell-sw0-t0');
    const highCell = getByTestId('ide-stimulus-cell-sw0-t1');
    expect(lowCell.textContent).toBe('0');
    expect(highCell.textContent).toBe('1');
    expect(lowCell.getAttribute('aria-label')).toContain('SW0 in Case 1 (t0): 0');
    expect(highCell.getAttribute('aria-label')).toContain('SW0 in Case 2 (t1): 1');
  });

  it('has a Cases toolbar group with data-testid ide-stimulus-case-actions', () => {
    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={INPUTS}
        outputFields={OUTPUTS}
        authoredVectors={VECTORS}
        onVectorsChange={vi.fn()}
      />
    );
    expect(getByTestId('ide-stimulus-case-actions')).toBeTruthy();
  });

  it('Add case button is inside the Cases group', () => {
    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={INPUTS}
        outputFields={OUTPUTS}
        authoredVectors={VECTORS}
        onVectorsChange={vi.fn()}
      />
    );
    const caseGroup = getByTestId('ide-stimulus-case-actions');
    const addBtn = getByTestId('ide-stimulus-add-tick');
    expect(caseGroup.contains(addBtn)).toBe(true);
  });

  it('keeps add, duplicate, and delete as usable routine controls in the Cases toolbar', () => {
    const { container, getByTestId } = render(
      <StimulusCanvas
        inputFields={INPUTS}
        outputFields={OUTPUTS}
        authoredVectors={VECTORS}
        onVectorsChange={vi.fn()}
      />
    );
    const caseGroup = getByTestId('ide-stimulus-case-actions');
    const controls = [
      getByTestId('ide-stimulus-add-tick'),
      getByTestId('ide-stimulus-duplicate-tick-0'),
      getByTestId('ide-stimulus-delete-tick-0'),
    ];

    expect(caseGroup.textContent).toContain('Add case');
    expect(caseGroup.textContent).toContain('Duplicate case');
    expect(caseGroup.textContent).toContain('Delete case');
    for (const control of controls) {
      expect(caseGroup.contains(control)).toBe(true);
      expect(control.tagName).toBe('BUTTON');
      expect((control as HTMLButtonElement).disabled).toBe(false);
      expect(control.classList.contains('ide-stimulus-mini-btn')).toBe(true);
    }
    expect(container.querySelector('.ide-stimulus-tick-actions')).toBeNull();
    expect(container.querySelector('.ide-stimulus-tick-header button')).toBeNull();
  });

  it('Cases group precedes the Advanced tools disclosure in DOM order', () => {
    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={INPUTS}
        outputFields={OUTPUTS}
        authoredVectors={VECTORS}
        onVectorsChange={vi.fn()}
      />
    );
    const caseGroup = getByTestId('ide-stimulus-case-actions');
    const advancedGroup = getByTestId('ide-stimulus-advanced-tools');
    const position = caseGroup.compareDocumentPosition(advancedGroup);
    // DOCUMENT_POSITION_FOLLOWING = 4 — advanced tools disclosure comes after case group
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('column header cells show "Case N" format not internal tick index', () => {
    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={INPUTS}
        outputFields={OUTPUTS}
        authoredVectors={VECTORS}
        onVectorsChange={vi.fn()}
      />
    );
    const toolbar = getByTestId('ide-stimulus-canvas');
    // Should contain "Case 1" and "Case 2" (tick 0 and tick 1)
    expect(toolbar.textContent).toContain('Case 1');
    expect(toolbar.textContent).toContain('Case 2');
    // Should NOT contain raw tick notation like " t0" or " t1" in column headers
    const headers = toolbar.querySelectorAll('.ide-stimulus-tick-header');
    expect(headers.length).toBeGreaterThan(0);
    for (const header of Array.from(headers)) {
      expect(header.textContent).not.toMatch(/^t\d+$/);
    }
  });

  it('retargets the visible toolbar actions when the selected case changes', () => {
    const { getByTestId, queryByTestId } = render(
      <StimulusCanvas
        inputFields={INPUTS}
        outputFields={OUTPUTS}
        authoredVectors={VECTORS}
        onVectorsChange={vi.fn()}
      />
    );

    expect(getByTestId('ide-stimulus-selected-case-chip').textContent).toContain('Case 1');
    expect(getByTestId('ide-stimulus-duplicate-tick-0')).toBeTruthy();
    expect(getByTestId('ide-stimulus-delete-tick-0')).toBeTruthy();

    fireEvent.change(getByTestId('ide-stimulus-tick-target'), { target: { value: '1' } });

    expect(getByTestId('ide-stimulus-selected-case-chip').textContent).toContain('Case 2');
    expect(getByTestId('ide-stimulus-duplicate-tick-1').textContent).toBe('Duplicate case');
    expect(getByTestId('ide-stimulus-delete-tick-1').textContent).toBe('Delete case');
    expect(queryByTestId('ide-stimulus-duplicate-tick-0')).toBeNull();
    expect(queryByTestId('ide-stimulus-delete-tick-0')).toBeNull();
  });

  it('keeps advanced tools hidden until the student opens the Advanced tools disclosure', () => {
    const { getByTestId, queryByRole } = render(
      <StimulusCanvas
        inputFields={INPUTS}
        outputFields={OUTPUTS}
        authoredVectors={VECTORS}
        onVectorsChange={vi.fn()}
      />
    );

    expect(queryByRole('button', { name: 'Binary count' })).toBeNull();
    expect(queryByRole('button', { name: 'Copy TSV' })).toBeNull();
    expect(queryByRole('button', { name: 'Paste TSV' })).toBeNull();

    fireEvent.click(getByTestId('ide-stimulus-advanced-tools-toggle'));

    expect(getByTestId('ide-stimulus-advanced-tools-panel')).toBeTruthy();
    expect(queryByRole('button', { name: 'Binary count' })).toBeTruthy();
    expect(queryByRole('button', { name: 'Copy TSV' })).toBeTruthy();
    expect(queryByRole('button', { name: 'Paste TSV' })).toBeTruthy();
  });

  it('shows expected-output lanes inline without a separate checks toggle', () => {
    const { getByText, queryByText, getByTestId } = render(
      <StimulusCanvas
        inputFields={INPUTS}
        outputFields={OUTPUTS}
        authoredVectors={VECTORS}
        onVectorsChange={vi.fn()}
      />
    );

    expect(getByText('Expected · Unset = no check')).toBeTruthy();
    expect(getByTestId('ide-stimulus-expected-ld0-t0')).toBeTruthy();
    expect(queryByText('Show checks')).toBeNull();
    expect(queryByText('Output assertions')).toBeNull();
  });

  it('names empty expected and observed evidence instead of showing ambiguous dashes', () => {
    const { getByTestId, getByText } = render(
      <StimulusCanvas
        inputFields={INPUTS}
        outputFields={OUTPUTS}
        authoredVectors={[{ id: 'v0', tick: 0, inputs: { sw0: 0 }, expected: {} }]}
        onVectorsChange={vi.fn()}
      />
    );

    expect(getByText('Expected · Unset = no check')).toBeTruthy();
    expect(getByTestId('ide-stimulus-expected-ld0-t0').textContent).toBe('Unset');
    expect(getByTestId('ide-stimulus-observed-ld0-t0').textContent).toBe('Not run');
    expect(getByTestId('ide-stimulus-observed-ld0-t0').getAttribute('data-value')).toBe('not-run');
  });

  it('renders a dedicated clock lane with inline pattern actions', () => {
    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={[
          { id: 'clk', label: 'CLK' },
          { id: 'sw0', label: 'SW0' },
        ]}
        outputFields={OUTPUTS}
        authoredVectors={[
          { id: 'v0', tick: 0, inputs: { clk: 0, sw0: 0 }, expected: { ld0: 0 } },
          { id: 'v1', tick: 1, inputs: { clk: 1, sw0: 1 }, expected: { ld0: 1 } },
        ]}
        onVectorsChange={vi.fn()}
        clockLane={{
          fieldId: 'clk',
          badge: 'Clock',
          detail: 'Add a rising edge directly in this lane.',
          count: 4,
          onCountChange: vi.fn(),
          onApplyPattern: vi.fn(),
        }}
      />
    );

    expect(getByTestId('ide-stimulus-clock-row')).toBeTruthy();
    expect(getByTestId('ide-stimulus-clock-badge').textContent).toContain('Clock');
    expect(getByTestId('ide-stimulus-clock-detail').textContent).toContain('rising edge');
    expect(getByTestId('ide-stimulus-clock-pattern-count')).toBeTruthy();
    expect(getByTestId('ide-stimulus-clock-pattern-alternating')).toBeTruthy();
    expect(getByTestId('ide-stimulus-clock-pattern-pulse').textContent).toContain('Add pulse');
    expect(getByTestId('ide-stimulus-clock-pattern-hold-low')).toBeTruthy();
    expect(getByTestId('ide-stimulus-clock-pattern-hold-high')).toBeTruthy();
  });

  it('keeps explicit edge and level controls outside the clock signal row', () => {
    const onAppendPulseBehavior = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <StimulusCanvas
        inputFields={[
          { id: 'clk', label: 'CLK' },
          { id: 'en', label: 'EN' },
          { id: 'rst', label: 'RST' },
        ]}
        outputFields={OUTPUTS}
        authoredVectors={[
          { id: 'v0', tick: 0, inputs: { clk: 0, en: 1, rst: 0 }, expected: {} },
        ]}
        onVectorsChange={vi.fn()}
        clockLane={{
          fieldId: 'clk',
          badge: 'Board clock',
          detail: 'Manual pulses',
          count: 4,
          onCountChange: vi.fn(),
          onApplyPattern: vi.fn(),
          onAppendPulseBehavior,
        }}
      />
    );

    const clockRow = getByTestId('ide-stimulus-clock-row');
    const clockTools = getByTestId('ide-stimulus-clock-tools');
    expect(clockRow.contains(clockTools)).toBe(false);
    expect(clockTools.compareDocumentPosition(clockRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(getByTestId('ide-stimulus-clock-behavior-rising'));
    fireEvent.click(getByTestId('ide-stimulus-clock-behavior-falling'));
    fireEvent.click(getByTestId('ide-stimulus-clock-behavior-high'));
    fireEvent.click(getByTestId('ide-stimulus-clock-behavior-low'));

    expect(onAppendPulseBehavior.mock.calls.map(([behavior]) => behavior)).toEqual([
      'rising',
      'falling',
      'high',
      'low',
    ]);
    expect(queryByTestId('ide-stimulus-clock-pattern-pulse')).toBeNull();
    expect(queryByTestId('ide-stimulus-clock-pattern-hold-high')).toBeNull();
    expect(queryByTestId('ide-stimulus-clock-pattern-hold-low')).toBeNull();
  });

  it('lets students hand-edit clock cells directly in the highlighted lane', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={[
          { id: 'clk', label: 'CLK' },
          { id: 'sw0', label: 'SW0' },
        ]}
        outputFields={OUTPUTS}
        authoredVectors={[
          { id: 'v0', tick: 0, inputs: { clk: 0, sw0: 0 }, expected: {} },
        ]}
        onVectorsChange={onVectorsChange}
        clockLane={{
          fieldId: 'clk',
          badge: 'Clock',
          count: 4,
          onCountChange: vi.fn(),
          onApplyPattern: vi.fn(),
        }}
      />
    );

    fireEvent.pointerDown(getByTestId('ide-stimulus-cell-clk-t0'));

    const nextVectors = onVectorsChange.mock.calls.at(-1)?.[0];
    expect(nextVectors).toEqual([
      expect.objectContaining({
        tick: 0,
        inputs: expect.objectContaining({ clk: 1 }),
      }),
    ]);
  });
});
