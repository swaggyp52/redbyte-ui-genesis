// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { TimingLanes } from '../surfaces/verify/TimingLanes';

afterEach(cleanup);

it('uses the selected lane and exact tick for keyboard authoring without editing generated clocks or recorded outputs', () => {
  const drive = vi.fn(); const select = vi.fn(); const tick = vi.fn();
  const props = { vectors: [{ id: 'v0', tick: 0, inputs: { en: 0 as const }, expected: {} }],
    inputFields: [{ id: 'clk', label: 'CLK' }, { id: 'en', label: 'EN' }], outputFields: [{ id: 'q', label: 'Q' }],
    generatedFieldIds: new Set(['clk']), clockFieldIds: new Set(['clk']), selectedTick: 2,
    onSelectSignal: select, editable: true, onSelectTick: tick, onDriveInput: drive, onCycleExpected: vi.fn() };
  const view = render(<TimingLanes {...props} selectedSignal="EN" />);
  fireEvent.keyDown(view.getByRole('grid'), { key: ' ' });
  expect(drive).toHaveBeenCalledWith(2, 'en', 1);
  drive.mockClear();
  for (const signal of ['CLK', 'Q']) {
    view.rerender(<TimingLanes {...props} selectedSignal={signal} />);
    fireEvent.keyDown(view.getByRole('grid'), { key: ' ' });
    expect(drive).not.toHaveBeenCalled();
  }
  fireEvent.keyDown(view.getByRole('grid'), { key: 'ArrowUp' });
  expect(select).toHaveBeenLastCalledWith('EN');
  view.rerender(<TimingLanes {...props} selectedSignal="EN" />);
  fireEvent.keyDown(view.getByText('Set A'), { key: 'Enter' });
  expect(drive).not.toHaveBeenCalled();
  fireEvent.keyDown(view.getByRole('grid'), { key: 'ArrowRight' });
  expect(tick).toHaveBeenLastCalledWith(3);
});
