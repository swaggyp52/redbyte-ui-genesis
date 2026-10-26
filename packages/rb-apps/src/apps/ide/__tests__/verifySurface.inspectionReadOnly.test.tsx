// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@redbyte/rb-theme';
import { IdeApp } from '../../IdeApp';
import { deriveIdeBlockingDesignIssue } from '../ideDesignBlocking';
import { useProjectRuntime } from '../projectRuntime';
import { planStudioRun } from '../studioRunInput';
import { computeScenarioContentHash, getActiveScenario } from '../verifyScenario';
import { workspacePreferencesStore } from '../workspacePreferences';

// RB-DEBT-020 in the workbench as students use it: the shipped 2-Bit Up Counter, one retained
// recording, and Simulate wired to the project runtime by IdeApp. Inspecting the recording must
// leave the authored scenario exactly as it was; editing it is an explicit mode.

function scenarioNow() {
  const state = useProjectRuntime.getState();
  const scenario = getActiveScenario(state.scenarios, state.activeScenarioId);
  if (!scenario) throw new Error('no active scenario');
  return {
    id: scenario.id,
    version: scenario.version,
    contentHash: computeScenarioContentHash(scenario),
    vectors: JSON.stringify(scenario.vectors),
    projectVectors: JSON.stringify(state.projectVectors),
  };
}

/** The retained recordings, as saved: optional undefined properties do not alter them. */
function recordingNow(): string {
  const state = useProjectRuntime.getState();
  return JSON.stringify({ selected: state.verifyLastRun ?? null, archive: state.verifyRunArchive });
}

function enAt(tick: number): unknown {
  const state = useProjectRuntime.getState();
  return getActiveScenario(state.scenarios, state.activeScenarioId)?.vectors.find((vector) => vector.tick === tick)?.inputs.en;
}

async function openCounterRecording() {
  const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);
  await act(async () => {
    useProjectRuntime.getState().loadExample('two-bit-counter');
  });
  await act(async () => {
    // The Run a student makes for the active scenario (the studio and Simulate plan it alike).
    const plan = planStudioRun(useProjectRuntime.getState(), {
      captureEvaluations: true,
      resolveBlockingIssue: deriveIdeBlockingDesignIssue,
    });
    useProjectRuntime.getState().runVerification(plan.input);
  });
  expect(useProjectRuntime.getState().verifyLastRun?.status).toBe('pass');
  fireEvent.click(await view.findByTestId('mode-button-verify'));
  await view.findByTestId('ide-timing-cell-en-2', {}, { timeout: 15000 });
  return view;
}

describe('Simulate inspection never edits the authored scenario (RB-DEBT-020)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    workspacePreferencesStore.reset();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    window.history.replaceState({}, '', '/os/?mode=project');
  });

  afterEach(() => {
    cleanup();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('scrubbing, selecting, Space/Enter and opening the recorded circuit keep the scenario version and content hash', async () => {
    const view = await openCounterRecording();
    const before = scenarioNow();
    const recording = recordingNow();
    const dirty = useProjectRuntime.getState().projectHealthCore.dirtySinceVerify;
    const currency = view.getByTestId('ide-run-identity').getAttribute('data-currency');
    expect(currency).toBe('current');
    expect(enAt(2)).toBe(1);

    // Select a stimulus cell, then scrub and move between lanes from the keyboard.
    fireEvent.click(view.getByTestId('ide-timing-cell-en-2'));
    const grid = view.getByTestId('ide-timing-lanes');
    for (const key of [' ', 'Enter', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'ArrowUp', 'ArrowDown', 'ArrowUp', ' ', 'Enter']) {
      fireEvent.keyDown(grid, { key });
    }
    fireEvent.click(view.getByTestId('ide-timing-lanes-tick-3'));
    fireEvent.click(view.getByTestId('ide-timing-check-q0-3'));
    fireEvent.click(view.getByTestId('ide-timing-cell-en-3'));
    fireEvent.keyDown(grid, { key: ' ' });

    // Another lens on the same recording: the recorded circuit, then a click on the lanes while it is open.
    fireEvent.click(view.getByTestId('ide-verify-inspect-circuit'));
    await view.findByLabelText('Close circuit investigation');
    fireEvent.click(view.getByTestId('ide-timing-cell-en-2'));
    fireEvent.keyDown(view.getByTestId('ide-timing-lanes'), { key: 'Enter' });
    fireEvent.click(view.getByLabelText('Close circuit investigation'));

    expect(scenarioNow()).toEqual(before);
    expect(recordingNow()).toBe(recording);
    expect(useProjectRuntime.getState().projectHealthCore.dirtySinceVerify).toBe(dirty);
    expect(view.getByTestId('ide-run-identity').getAttribute('data-currency')).toBe(currency);
    expect(view.queryByTestId('ide-run-input-changes')).toBeNull();
    expect(enAt(2)).toBe(1);
    expect(view.getByTestId('ide-timing-edit-mode').getAttribute('aria-pressed')).toBe('false');
  }, 60_000);

  it('Edit stimulus makes one revision per edit, leaves the recording immutable but stale, and design undo/redo keep that revision', async () => {
    const view = await openCounterRecording();
    // A design history entry that does not change behaviour: moving one part.
    const moved = useProjectRuntime.getState().circuit.nodes[0];
    const start = { x: moved.position?.x ?? 0, y: moved.position?.y ?? 0 };
    expect(moved.position).toEqual(start);
    const position = { x: start.x + 40, y: start.y };
    await act(async () => {
      const state = useProjectRuntime.getState();
      state.applyCircuitMutation({
        ...state.circuit,
        nodes: state.circuit.nodes.map((node) => (node.id === moved.id ? { ...node, position, x: position.x, y: position.y } : node)),
      });
    });
    const positionOf = () => useProjectRuntime.getState().circuit.nodes.find((node) => node.id === moved.id)?.position;
    expect(positionOf()).toEqual(position);

    const before = scenarioNow();
    const recording = recordingNow();
    const toggle = view.getByTestId('ide-timing-edit-mode');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    // Choosing to edit is not an edit.
    expect(scenarioNow()).toEqual(before);

    fireEvent.click(view.getByTestId('ide-timing-cell-en-2'));
    await waitFor(() => expect(scenarioNow().version).toBe(before.version + 1));
    const edited = scenarioNow();
    expect(enAt(2)).toBe(0);
    expect(edited.id).toBe(before.id);
    expect(edited.contentHash).not.toBe(before.contentHash);

    // The recording is never edited; it describes the scenario it was made from, now stale.
    expect(recordingNow()).toBe(recording);
    const run = useProjectRuntime.getState().verifyLastRun!;
    expect(run.scenarioContentHash).toBe(before.contentHash);
    expect(run.scenarioVersion).toBe(before.version);
    expect(useProjectRuntime.getState().projectHealthCore.dirtySinceVerify).toBe(true);
    await waitFor(() => expect(view.getByTestId('ide-run-identity').getAttribute('data-currency')).toBe('differs'));
    expect(view.getByTestId('ide-run-input-changes')).toBeTruthy();
    // The same (now stale) recording keeps the mode the student chose.
    expect(view.getByTestId('ide-timing-edit-mode').getAttribute('aria-pressed')).toBe('true');

    // Design undo and redo move the part; neither rewinds nor restamps the authored scenario.
    await act(async () => useProjectRuntime.getState().undoProjectEdit());
    expect(positionOf()).toEqual(start);
    expect(scenarioNow()).toEqual(edited);
    expect(recordingNow()).toBe(recording);
    await act(async () => useProjectRuntime.getState().redoProjectEdit());
    expect(positionOf()).toEqual(position);
    expect(scenarioNow()).toEqual(edited);
    expect(recordingNow()).toBe(recording);

    // A second explicit edit is a second revision, restoring the authored value.
    fireEvent.click(view.getByTestId('ide-timing-cell-en-2'));
    await waitFor(() => expect(scenarioNow().version).toBe(before.version + 2));
    expect(enAt(2)).toBe(1);
    expect(recordingNow()).toBe(recording);
  }, 60_000);
});
