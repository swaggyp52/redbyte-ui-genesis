/**
 * Phase 4 — Custom Test Vector Editor unit tests
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VectorEditor, type CustomTestVector, type VectorEditorField } from '../apps/ide/components/VectorEditor';

const INPUT_FIELDS: VectorEditorField[] = [
  { id: 'A', label: 'A' },
  { id: 'B', label: 'B' },
];

const OUTPUT_FIELDS: VectorEditorField[] = [
  { id: 'Y', label: 'Y' },
];

function makeVector(id: string, tick: number): CustomTestVector {
  return { id, tick, inputs: { A: 0, B: 0 }, expected: { Y: 0 } };
}

describe('VectorEditor', () => {
  it('renders add button when empty', () => {
    render(
      <VectorEditor
        inputFields={INPUT_FIELDS}
        outputFields={OUTPUT_FIELDS}
        vectors={[]}
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('ide-vector-add-row')).toBeTruthy();
  });

  it('calls onChange with appended row when Add is clicked', () => {
    const onChange = vi.fn();
    render(
      <VectorEditor
        inputFields={INPUT_FIELDS}
        outputFields={OUTPUT_FIELDS}
        vectors={[]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId('ide-vector-add-row'));
    expect(onChange).toHaveBeenCalledOnce();
    const newVectors: CustomTestVector[] = onChange.mock.calls[0][0];
    expect(newVectors).toHaveLength(1);
    expect(newVectors[0].inputs).toEqual({ A: 0, B: 0 });
    expect(newVectors[0].expected).toEqual({ Y: 0 });
  });

  it('new row tick is max(existing) + 1', () => {
    const onChange = vi.fn();
    const existing = [makeVector('v1', 5), makeVector('v2', 8)];
    render(
      <VectorEditor
        inputFields={INPUT_FIELDS}
        outputFields={OUTPUT_FIELDS}
        vectors={existing}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId('ide-vector-add-row'));
    const newVectors: CustomTestVector[] = onChange.mock.calls[0][0];
    expect(newVectors[newVectors.length - 1].tick).toBe(9);
  });

  it('select change calls onChange with immutable updated copy', () => {
    const onChange = vi.fn();
    const vectors = [makeVector('v1', 1)];
    render(
      <VectorEditor
        inputFields={INPUT_FIELDS}
        outputFields={OUTPUT_FIELDS}
        vectors={vectors}
        onChange={onChange}
      />
    );
    const select = screen.getByTestId('ide-vector-input-v1-A');
    fireEvent.change(select, { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledOnce();
    const updated: CustomTestVector[] = onChange.mock.calls[0][0];
    // Original must not be mutated
    expect(vectors[0].inputs.A).toBe(0);
    // Updated copy must have the new value
    expect(updated[0].inputs.A).toBe(1);
  });

  it('delete button calls onChange without the deleted row', () => {
    const onChange = vi.fn();
    const vectors = [makeVector('v1', 1), makeVector('v2', 2)];
    render(
      <VectorEditor
        inputFields={INPUT_FIELDS}
        outputFields={OUTPUT_FIELDS}
        vectors={vectors}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId('ide-vector-delete-v1'));
    expect(onChange).toHaveBeenCalledOnce();
    const result: CustomTestVector[] = onChange.mock.calls[0][0];
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('v2');
  });

  it('renders empty message when no fields provided', () => {
    render(
      <VectorEditor
        inputFields={[]}
        outputFields={[]}
        vectors={[]}
        onChange={() => {}}
      />
    );
    expect(screen.getByText(/No IO mapping/i)).toBeTruthy();
  });

  it('renders custom-vectors-panel testid in VerifySurface integration position (smoke)', () => {
    render(
      <VectorEditor
        inputFields={INPUT_FIELDS}
        outputFields={OUTPUT_FIELDS}
        vectors={[makeVector('v1', 1)]}
        onChange={() => {}}
      />
    );
    // Panel is rendered and contains the row
    expect(screen.getByTestId('ide-vector-row-v1')).toBeTruthy();
  });
});
