import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ScenarioComposerWorkbench,
  ScenarioTestbenchPreview,
} from '../surfaces/verify/ScenarioComposerWorkbench';

const inputFields = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
];
const outputFields = [{ id: 'sum', label: 'SUM' }];
const vectors = [
  { id: 'event-a', tick: 0, inputs: { a: 0 as const, b: 0 as const }, expected: {} },
  { id: 'event-b', tick: 1, inputs: { a: 1 as const, b: 0 as const }, expected: { sum: 1 as const } },
];

function renderComposer(
  onVectorsChange = vi.fn(),
  lens: 'scenario' | 'checks' = 'scenario'
) {
  return {
    onVectorsChange,
    view: render(
      <ScenarioComposerWorkbench
        scenarioName="Full Adder truth table"
        vectors={vectors}
        inputFields={inputFields}
        outputFields={outputFields}
        selectedTick={0}
        lens={lens}
        onSelectTick={vi.fn()}
        onVectorsChange={onVectorsChange}
        caseEvidenceByTick={{ 0: 'observed', 1: 'pass' }}
        observedValuesByTick={{ 0: { sum: '0' } }}
      />
    ),
  };
}

describe('ScenarioComposerWorkbench', () => {
  it('adds a stable event at the next time and carries forward the current stimulus', () => {
    const { onVectorsChange, view } = renderComposer();
    fireEvent.click(view.getByTestId('ide-scenario-composer-add-event'));

    expect(onVectorsChange).toHaveBeenCalledWith([
      ...vectors,
      { id: 'event-03', tick: 2, inputs: { a: 1, b: 0 }, expected: {} },
    ]);
  });

  it('edits an input in place without replacing the event identity', () => {
    const { onVectorsChange, view } = renderComposer();
    fireEvent.click(view.getByTestId('ide-scenario-input-a'));

    expect(onVectorsChange).toHaveBeenCalledWith([
      { ...vectors[0], inputs: { a: 1, b: 0 } },
      vectors[1],
    ]);
  });

  it('rejects an event-time collision instead of silently reordering ambiguous events', () => {
    const { onVectorsChange, view } = renderComposer();
    fireEvent.change(view.getByTestId('ide-scenario-event-time'), { target: { value: '1' } });

    expect(view.getByRole('alert').textContent).toContain('t1 already contains an event');
    expect(onVectorsChange).not.toHaveBeenCalled();
  });

  it('authors an optional expected-output check from the same selected event', () => {
    const { onVectorsChange, view } = renderComposer(vi.fn(), 'checks');
    fireEvent.click(view.getByTestId('ide-scenario-check-sum'));

    expect(onVectorsChange).toHaveBeenCalledWith([
      { ...vectors[0], expected: { sum: 0 } },
      vectors[1],
    ]);
  });

  it('keeps the generated testbench visibly tied to the active scenario and package source', () => {
    const view = render(
      <ScenarioTestbenchPreview
        scenarioName="Full Adder truth table"
        source={'library ieee;\nentity testbench is\nend entity;'}
      />
    );

    expect(view.getByText('testbench.vhd')).toBeTruthy();
    expect(view.getByText('Full Adder truth table')).toBeTruthy();
    expect(view.getByText('Same source packaged by Build & Export')).toBeTruthy();
    expect(view.getByText('entity testbench is')).toBeTruthy();
  });
});
