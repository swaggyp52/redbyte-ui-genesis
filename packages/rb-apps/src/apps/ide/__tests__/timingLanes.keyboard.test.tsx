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

it('keeps a recording\'s word lane, under its recorded names, after the design renames a member', async () => {
  const { deriveRecordedWordLanes } = await import('../surfaces/verify/recordedWordLanes');
  // Recorded with LD0 and LD1; the design has since renamed LD1 to RESULT.
  const recordedWords = deriveRecordedWordLanes({
    report: { signalRoles: { LD0: 'output', LD1: 'output' } },
    waveform: [{ tick: 0, signals: { LD0: '0', LD1: '0' } }, { tick: 1, signals: { LD0: '0', LD1: '1' } }],
  });
  const view = render(<TimingLanes vectors={[{ id: 'v0', tick: 0, inputs: {}, expected: {} }]} inputFields={[]}
    outputFields={[{ id: 'q0', label: 'LD0' }, { id: 'q1', label: 'RESULT' }]} clockFieldIds={new Set()} selectedTick={1}
    observedValuesByTick={{ 0: { q0: '0', q1: '0' }, 1: { q0: '0', q1: '1' } }} recordedWords={recordedWords}
    editable={false} onSelectTick={vi.fn()} onDriveInput={vi.fn()} onCycleExpected={vi.fn()} />);
  const lane = view.getByTestId('ide-timing-word-lane-LD');
  expect(lane.getAttribute('data-as-recorded')).toBe('true');
  expect(view.getByTestId('ide-timing-word-LD-1').getAttribute('data-word-value')).toBe('2');
  const readout = view.getByTestId('ide-time-selected-word');
  expect(readout.getAttribute('data-word')).toBe('LD[1:0]');
  expect(readout.textContent).toContain('as recorded');
  // With no recording-owned lanes, live labels alone never produce one.
  view.rerender(<TimingLanes vectors={[]} inputFields={[]} outputFields={[{ id: 'q0', label: 'LD0' }, { id: 'q1', label: 'LD1' }]}
    clockFieldIds={new Set()} selectedTick={0} observedValuesByTick={{ 0: { q0: '1', q1: '1' } }}
    editable={false} onSelectTick={vi.fn()} onDriveInput={vi.fn()} onCycleExpected={vi.fn()} />);
  expect(view.queryByTestId('ide-timing-word-lane-LD')).toBeNull();
});
