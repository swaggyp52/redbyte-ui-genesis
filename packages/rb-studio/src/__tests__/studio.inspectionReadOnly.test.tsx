// @vitest-environment jsdom
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { deriveIdeBlockingDesignIssue, useProjectRuntime } from '@redbyte/rb-apps/runtime';
import { getActiveScenario, planStudioRun } from '@redbyte/rb-apps/domain';
import { MeridianStudio } from '../MeridianStudio';

// RB-DEBT-020 for the Meridian studio: scrubbing the recording, selecting parts, lanes, checks and
// board resources, and switching lenses and stages are inspection. None of them may write the
// authored scenario, the design, the live inputs or the recording. The studio offers no
// stimulus editing at all (authoring cases belongs to Simulate), so the whole runtime document
// the studio could reach is compared before and after.

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalScrollIntoView = Element.prototype.scrollIntoView;
beforeAll(() => {
  // jsdom has no 2D canvas (the Time lens draws its traces only when one exists) and no
  // scrolling (the Source lens scrolls the selected part's lines into view).
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  Element.prototype.scrollIntoView = () => {};
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

function plan() {
  return planStudioRun(useProjectRuntime.getState(), { captureEvaluations: true, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
}

function documentNow() {
  const state = useProjectRuntime.getState();
  const scenario = getActiveScenario(state.scenarios, state.activeScenarioId);
  if (!scenario) throw new Error('no active scenario');
  // The version and content hash a Run would record for the active scenario.
  const { scenarioVersion, scenarioContentHash } = plan().input;
  expect(scenarioVersion).toBe(scenario.version);
  return {
    scenarioId: scenario.id,
    version: scenarioVersion,
    contentHash: scenarioContentHash,
    scenarios: JSON.stringify(state.scenarios),
    projectVectors: JSON.stringify(state.projectVectors),
    customVectors: JSON.stringify(state.customVectors),
    circuit: JSON.stringify(state.circuit),
    designRevision: state.designRevision,
    liveInputs: JSON.stringify(state.sim.inputs),
    recording: JSON.stringify(state.verifyLastRun ?? null),
    archive: JSON.stringify(state.verifyRunArchive),
    dirtySinceVerify: state.projectHealthCore.dirtySinceVerify,
  };
}

const key = (value: string) => fireEvent.keyDown(window, { key: value });

describe('Meridian studio inspection is read-only (RB-DEBT-020)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    window.history.replaceState({}, '', '/?studio=meridian&stage=simulate');
  });

  afterEach(() => {
    cleanup();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('scrubbing, selecting and switching lenses or stages leave the scenario version, content hash and recording unchanged', async () => {
    const view = render(<MeridianStudio />);
    await act(async () => {
      useProjectRuntime.getState().loadExample('two-bit-counter');
    });
    await act(async () => {
      useProjectRuntime.getState().runVerification(plan().input);
    });
    const runId = useProjectRuntime.getState().verifyLastRun?.runId;
    expect(runId).toBeTruthy();
    await waitFor(() => expect(view.getByTestId('meridian-time').getAttribute('data-run-id')).toBe(runId));
    const before = documentNow();
    const tick = () => view.getByTestId('meridian-time').getAttribute('data-tick');

    // Scrub: the ruler, the stepper, the checks row and the keyboard.
    fireEvent.click(view.getByTestId('meridian-tick-3'));
    expect(tick()).toBe('3');
    fireEvent.click(view.getByTestId('meridian-next-tick'));
    expect(tick()).toBe('4');
    fireEvent.click(view.getByTestId('meridian-prev-tick'));
    fireEvent.click(view.getByTestId('meridian-check-2'));
    expect(tick()).toBe('2');
    for (const value of ['ArrowRight', 'ArrowLeft', 'End', 'Home', ']', ']', '[', 'ArrowRight']) key(value);

    // Select: every lane of the Time lens, parts on the sheet (Enter and Space), and a board resource.
    for (const label of Array.from(view.getByTestId('meridian-time').querySelectorAll<HTMLButtonElement>('.mrd-time-label'))) {
      fireEvent.click(label);
    }
    for (const nodeId of ['en_node', 'rst_node', 'q0_ff']) {
      const node = view.container.querySelector(`[data-sheet-node="${nodeId}"]`);
      expect(node, nodeId).not.toBeNull();
      fireEvent.keyDown(node!, { key: 'Enter' });
      fireEvent.keyDown(node!, { key: ' ' });
    }
    expect(view.getByTestId('meridian-inspector').getAttribute('data-node-id')).toBe('q0_ff');
    const cause = view.queryByTestId('meridian-show-cause');
    if (cause) fireEvent.click(cause);
    const back = view.queryByTestId('meridian-back');
    if (back) fireEvent.click(back);

    // Lenses: keys and buttons, the inspector, and the other stages.
    for (const value of ['l', 'h', 'b', 't', 'l', 'h', 'b', 'i', 'i']) key(value);
    for (const lens of ['logic', 'source', 'board', 'time']) fireEvent.click(view.getByTestId(`meridian-lens-toggle-${lens}`));
    fireEvent.click(view.getByTestId('meridian-inspector-toggle'));
    fireEvent.click(view.getByTestId('meridian-inspector-toggle'));
    key('4');
    expect(view.getByTestId('meridian-work').getAttribute('data-preset')).toBe('board');
    const resource = view.container.querySelector<SVGGElement>('[data-board-resource="SW0"][data-mapped]');
    expect(resource).not.toBeNull();
    fireEvent.click(resource!);
    fireEvent.keyDown(resource!, { key: 'Enter' });
    fireEvent.keyDown(resource!, { key: ' ' });
    fireEvent.click(view.getByTestId('meridian-stage-simulate'));
    key('Escape');

    expect(documentNow()).toEqual(before);
    expect(useProjectRuntime.getState().verifyLastRun?.runId).toBe(runId);
  }, 60_000);
});
