// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { StimulusCanvas } from '../components/StimulusCanvas';

afterEach(() => {
  cleanup();
});

describe('StimulusCanvas bulk editing tools', () => {
  it('fills a selected stimulus row across all ticks', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={[{ id: 'sw0', label: 'SW0' }]}
        outputFields={[{ id: 'ld0', label: 'LD0' }]}
        authoredVectors={[
          { id: 'vec-0', tick: 0, inputs: { sw0: 0 }, expected: {} },
          { id: 'vec-1', tick: 1, inputs: { sw0: 0 }, expected: {} },
        ]}
        onVectorsChange={onVectorsChange}
      />
    );

    fireEvent.change(getByTestId('ide-stimulus-row-target'), {
      target: { value: 'input:sw0' },
    });
    fireEvent.click(getByTestId('ide-stimulus-row-fill-1'));

    const nextVectors = onVectorsChange.mock.calls[0]?.[0];
    expect(nextVectors).toEqual([
      { id: 'vec-0', tick: 0, inputs: { sw0: 1 }, expected: {} },
      { id: 'vec-1', tick: 1, inputs: { sw0: 1 }, expected: {} },
    ]);
  });

  it('builds a binary count pattern across the input rows', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={[
          { id: 'sw0', label: 'SW0' },
          { id: 'sw1', label: 'SW1' },
        ]}
        outputFields={[]}
        authoredVectors={[]}
        onVectorsChange={onVectorsChange}
      />
    );

    fireEvent.click(getByTestId('ide-stimulus-pattern-binary'));

    const nextVectors = onVectorsChange.mock.calls[0]?.[0];
    expect(nextVectors.map((vector: { tick: number; inputs: Record<string, 0 | 1> }) => ({
      tick: vector.tick,
      inputs: vector.inputs,
    }))).toEqual([
      { tick: 0, inputs: { sw0: 0, sw1: 0 } },
      { tick: 1, inputs: { sw0: 0, sw1: 1 } },
      { tick: 2, inputs: { sw0: 1, sw1: 0 } },
      { tick: 3, inputs: { sw0: 1, sw1: 1 } },
    ]);
  });

  it('duplicates the selected tick without touching verify runtime state', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={[{ id: 'sw0', label: 'SW0' }]}
        outputFields={[{ id: 'ld0', label: 'LD0' }]}
        authoredVectors={[
          { id: 'vec-0', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-1', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        onVectorsChange={onVectorsChange}
      />
    );

    fireEvent.change(getByTestId('ide-stimulus-tick-target'), {
      target: { value: '1' },
    });
    fireEvent.click(getByTestId('ide-stimulus-duplicate-tick'));

    const nextVectors = onVectorsChange.mock.calls[0]?.[0];
    expect(nextVectors).toEqual([
      { id: 'vec-0', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
      { id: 'vec-1', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
      { id: expect.any(String), tick: 2, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ]);
  });

  it('copies the testbench as tab-delimited text with blank assertions preserved', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={[{ id: 'sw0', label: 'SW0' }]}
        outputFields={[{ id: 'ld0', label: 'LD0' }]}
        authoredVectors={[
          { id: 'vec-0', tick: 0, inputs: { sw0: 0 }, expected: {} },
          { id: 'vec-1', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        onVectorsChange={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-stimulus-copy-grid'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('tick\tsw0\texpected:ld0\n0\t0\t\n1\t1\t1');
    });
  });

  it('pastes tab-delimited vectors and keeps blank expected cells unasserted', async () => {
    const onVectorsChange = vi.fn();
    const readText = vi
      .fn()
      .mockResolvedValue('tick\tsw0\texpected:ld0\n0\t0\t\n1\t1\t1');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText },
    });

    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={[{ id: 'sw0', label: 'SW0' }]}
        outputFields={[{ id: 'ld0', label: 'LD0' }]}
        authoredVectors={[]}
        onVectorsChange={onVectorsChange}
      />
    );

    fireEvent.click(getByTestId('ide-stimulus-paste-grid'));

    await waitFor(() => {
      expect(onVectorsChange).toHaveBeenCalledWith([
        { id: expect.any(String), tick: 0, inputs: { sw0: 0 }, expected: {} },
        { id: expect.any(String), tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
      ]);
    });
  });
});
