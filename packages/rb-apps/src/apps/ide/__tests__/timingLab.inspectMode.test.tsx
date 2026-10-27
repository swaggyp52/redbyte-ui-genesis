// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { TimingLab } from '../surfaces/verify/TimingLab';
import type { VerifyAuthorVector } from '../surfaces/ScenarioBuilderPanel';

// RB-DEBT-020: inspecting a recording never changes the authored stimulus. A click, Space or
// Enter on a stimulus cell edits only while "Edit stimulus" is on. It is on by default while no
// recording is on screen (one-click authoring), off whenever a recording is selected or
// inspected, and only the student switches it on.

afterEach(cleanup);

const inputFields = [{ id: 'en', label: 'EN' }, { id: 'rst', label: 'RST' }];
const outputFields = [{ id: 'q', label: 'Q' }];
const authored: VerifyAuthorVector[] = [
  { id: 'event-01', tick: 0, inputs: { en: 1, rst: 1 }, expected: {} },
  { id: 'event-02', tick: 1, inputs: { en: 1, rst: 0 }, expected: { q: 0 } },
  { id: 'event-03', tick: 2, inputs: { en: 1, rst: 0 }, expected: { q: 1 } },
  { id: 'event-04', tick: 3, inputs: { en: 1, rst: 0 }, expected: {} },
];
const recorded: Record<number, Record<string, string>> = {
  0: { en: '1', rst: '1', q: '0' },
  1: { en: '1', rst: '0', q: '0' },
  2: { en: '1', rst: '0', q: '1' },
  3: { en: '1', rst: '0', q: '0' },
};

interface LabProps {
  readonly onVectorsChange: (vectors: VerifyAuthorVector[]) => void;
  readonly recordingId?: string | null;
  readonly observed?: Record<number, Record<string, string>>;
  readonly inspecting?: boolean;
}

/** The lab as Simulate hosts it: selection and the authored vectors are owned outside it. */
function Lab({ onVectorsChange, recordingId, observed, inspecting }: LabProps) {
  const [vectors, setVectors] = useState<VerifyAuthorVector[]>(authored);
  const [tick, setTick] = useState<number | null>(null);
  const [signal, setSignal] = useState<string | null>(null);
  return (
    <TimingLab
      scenarioName="Counter"
      vectors={vectors}
      inputFields={inputFields}
      outputFields={outputFields}
      lens="scenario"
      selectedTick={tick}
      onSelectTick={setTick}
      selectedSignal={signal}
      onSelectSignal={setSignal}
      observedValuesByTick={observed}
      recordingId={recordingId}
      inspecting={inspecting}
      onVectorsChange={(next) => {
        onVectorsChange(next);
        setVectors(next);
      }}
    />
  );
}

const withRecording = { recordingId: 'run-a', observed: recorded };
const withoutRecording = { recordingId: null, observed: undefined };

function enAt(vectors: readonly VerifyAuthorVector[], tick: number): 0 | 1 | undefined {
  return vectors.find((vector) => vector.tick === tick)?.inputs.en;
}

function selection(view: ReturnType<typeof render>): string {
  return view.getByTestId('ide-time-selection').querySelector('strong')?.textContent ?? '';
}

function press(view: ReturnType<typeof render>, key: string) {
  fireEvent.keyDown(view.getByTestId('ide-timing-lanes'), { key });
}

describe('TimingLab inspection versus explicit stimulus editing (RB-DEBT-020)', () => {
  it('with a recording on screen, a click or Space/Enter on a stimulus cell selects and never edits', () => {
    const onVectorsChange = vi.fn();
    const view = render(<Lab onVectorsChange={onVectorsChange} {...withRecording} />);

    // The audit's gesture: one click on EN at t2 while the recording is inspected.
    fireEvent.click(view.getByTestId('ide-timing-cell-en-2'));
    expect(onVectorsChange).not.toHaveBeenCalled();
    expect(selection(view)).toBe('EN · t2');

    press(view, ' ');
    press(view, 'Enter');
    expect(onVectorsChange).not.toHaveBeenCalled();

    // Scrubbing and moving between lanes stay inspection.
    press(view, 'ArrowRight');
    expect(selection(view)).toBe('EN · t3');
    press(view, 'ArrowDown');
    press(view, 'Home');
    press(view, ' ');
    fireEvent.click(view.getByTestId('ide-timing-lanes-tick-1'));
    fireEvent.click(view.getByTestId('ide-timing-check-q-1'));
    expect(selection(view)).toBe('Q · t1');
    expect(onVectorsChange).not.toHaveBeenCalled();

    const toggle = view.getByTestId('ide-timing-edit-mode');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.textContent).toBe('Edit stimulus');
  });

  it('keeps Delete on the instrument from removing an event while inspecting', () => {
    const onVectorsChange = vi.fn();
    const view = render(<Lab onVectorsChange={onVectorsChange} {...withRecording} />);
    fireEvent.click(view.getByTestId('ide-timing-cell-en-2'));
    fireEvent.keyDown(view.getByTestId('ide-scenario-composer'), { key: 'Delete' });
    expect(onVectorsChange).not.toHaveBeenCalled();

    fireEvent.click(view.getByTestId('ide-timing-edit-mode'));
    fireEvent.keyDown(view.getByTestId('ide-scenario-composer'), { key: 'Delete' });
    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    expect(onVectorsChange.mock.calls[0][0].map((vector: VerifyAuthorVector) => vector.tick)).toEqual([0, 1, 3]);
  });

  it('with no recording, editing is on by default and one click or Space/Enter authors stimulus', () => {
    const onVectorsChange = vi.fn();
    const view = render(<Lab onVectorsChange={onVectorsChange} {...withoutRecording} />);
    expect(view.getByTestId('ide-timing-edit-mode').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(view.getByTestId('ide-timing-cell-en-2'));
    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    expect(enAt(onVectorsChange.mock.calls[0][0], 2)).toBe(0);
    expect(selection(view)).toBe('EN · t2');

    press(view, ' ');
    expect(onVectorsChange).toHaveBeenCalledTimes(2);
    expect(enAt(onVectorsChange.mock.calls[1][0], 2)).toBe(1);
    press(view, 'Enter');
    expect(onVectorsChange).toHaveBeenCalledTimes(3);
    expect(enAt(onVectorsChange.mock.calls[2][0], 2)).toBe(0);
  });

  it('edits only after the student turns Edit stimulus on, and inspects again once it is off', () => {
    const onVectorsChange = vi.fn();
    const view = render(<Lab onVectorsChange={onVectorsChange} {...withRecording} />);
    const toggle = view.getByRole('button', { name: 'Edit stimulus' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    // Switching the mode is not an edit.
    expect(onVectorsChange).not.toHaveBeenCalled();

    fireEvent.click(view.getByTestId('ide-timing-cell-en-2'));
    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    expect(enAt(onVectorsChange.mock.calls[0][0], 2)).toBe(0);
    press(view, ' ');
    expect(onVectorsChange).toHaveBeenCalledTimes(2);
    expect(enAt(onVectorsChange.mock.calls[1][0], 2)).toBe(1);
    press(view, 'Enter');
    expect(onVectorsChange).toHaveBeenCalledTimes(3);

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(view.getByTestId('ide-timing-cell-rst-1'));
    press(view, ' ');
    press(view, 'Enter');
    expect(onVectorsChange).toHaveBeenCalledTimes(3);
    expect(selection(view)).toBe('RST · t1');
  });

  it('returns to inspection when another recording is selected or the recording is inspected, and to authoring when none remains', () => {
    const onVectorsChange = vi.fn();
    const view = render(<Lab onVectorsChange={onVectorsChange} {...withRecording} />);
    const pressed = () => view.getByTestId('ide-timing-edit-mode').getAttribute('aria-pressed');

    fireEvent.click(view.getByTestId('ide-timing-edit-mode'));
    expect(pressed()).toBe('true');
    // The same recording, now stale after an edit, stays in the mode the student chose.
    fireEvent.click(view.getByTestId('ide-timing-cell-en-2'));
    view.rerender(<Lab onVectorsChange={onVectorsChange} {...withRecording} />);
    expect(pressed()).toBe('true');

    // Another recording (a new Run, Reproduce, or history selection) is inspected, not edited.
    view.rerender(<Lab onVectorsChange={onVectorsChange} recordingId="run-b" observed={recorded} />);
    expect(pressed()).toBe('false');
    fireEvent.click(view.getByTestId('ide-timing-cell-en-3'));
    expect(onVectorsChange).toHaveBeenCalledTimes(1);

    // Opening an investigation of the recording turns editing off.
    fireEvent.click(view.getByTestId('ide-timing-edit-mode'));
    expect(pressed()).toBe('true');
    view.rerender(<Lab onVectorsChange={onVectorsChange} recordingId="run-b" observed={recorded} inspecting />);
    expect(pressed()).toBe('false');
    fireEvent.click(view.getByTestId('ide-timing-cell-en-3'));
    expect(onVectorsChange).toHaveBeenCalledTimes(1);

    // With no recording on screen there is nothing to inspect: one-click authoring returns.
    view.rerender(<Lab onVectorsChange={onVectorsChange} recordingId={null} />);
    expect(pressed()).toBe('true');
    fireEvent.click(view.getByTestId('ide-timing-cell-en-3'));
    expect(onVectorsChange).toHaveBeenCalledTimes(2);
  });

  it('shows the draft cells as select-only while inspecting and as editable while editing', () => {
    const view = render(<Lab onVectorsChange={vi.fn()} {...withRecording} />);
    const lanes = view.getByTestId('ide-timing-lanes');
    const draftCell = view.getByTestId('ide-timing-cell-en-2');
    expect(lanes.getAttribute('data-stimulus-editing')).toBe('false');
    expect(draftCell.getAttribute('aria-readonly')).toBe('true');
    expect(view.getByTestId('ide-timing-stimulus-heading').textContent).toBe('Stimulus · current draft · cells select while inspecting');

    fireEvent.click(view.getByTestId('ide-timing-edit-mode'));
    expect(lanes.getAttribute('data-stimulus-editing')).toBe('true');
    expect(draftCell.getAttribute('aria-readonly')).toBeNull();
    expect(view.getByTestId('ide-timing-stimulus-heading').textContent).toBe('Stimulus · current draft · editing');
    // Recorded values stay read-only in every mode.
    expect(view.getByTestId('ide-timing-check-q-2').getAttribute('aria-readonly')).toBe('true');
  });

  it('keeps the labelled commands explicit while inspecting, so the heading never calls the whole draft read-only', () => {
    // The heading speaks for the cells. + Event, Duplicate, Delete and the event editor are
    // labelled commands in both modes; each is one deliberate edit, never a side effect of looking.
    const onVectorsChange = vi.fn();
    const view = render(<Lab onVectorsChange={onVectorsChange} {...withRecording} />);
    expect(view.getByTestId('ide-timing-edit-mode').getAttribute('aria-pressed')).toBe('false');
    expect(view.getByTestId('ide-timing-stimulus-heading').textContent).not.toMatch(/read-only/);

    fireEvent.click(view.getByTestId('ide-timing-cell-en-3'));
    expect(onVectorsChange).not.toHaveBeenCalled();
    fireEvent.click(view.getByTestId('ide-scenario-check-q'));
    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    expect(onVectorsChange.mock.calls[0][0].find((vector: VerifyAuthorVector) => vector.tick === 3)?.expected).toEqual({ q: 0 });

    fireEvent.click(view.getByTestId('ide-scenario-composer-add-event'));
    expect(onVectorsChange).toHaveBeenCalledTimes(2);
    expect(onVectorsChange.mock.calls[1][0].map((vector: VerifyAuthorVector) => vector.tick)).toEqual([0, 1, 2, 3, 4]);
    // Neither command switched the cells into editing.
    expect(view.getByTestId('ide-timing-edit-mode').getAttribute('aria-pressed')).toBe('false');
  });

  it('offers no editing at all when the scenario cannot be edited', () => {
    const view = render(
      <TimingLab scenarioName="Read-only" vectors={authored} inputFields={inputFields} outputFields={outputFields}
        lens="scenario" selectedTick={2} onSelectTick={vi.fn()} recordingId={null} />
    );
    const toggle = view.getByTestId('ide-timing-edit-mode') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(view.getByTestId('ide-timing-lanes').getAttribute('data-stimulus-editing')).toBe('false');
  });
});
