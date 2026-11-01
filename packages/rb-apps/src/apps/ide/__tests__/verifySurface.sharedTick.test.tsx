// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifySurface } from '../surfaces/VerifySurface';
import { workspacePreferencesStore } from '../workspacePreferences';
import { useEngineeringSelection } from '../engineeringSelection';
import { defaultScenarioViewState, scenarioViewStorageKey } from '../scenarioViewState';

/**
 * Simulate's selected tick is shared with the rest of the workbench in both directions: a tick
 * chosen elsewhere (Board stepping a recording, Design stepping a trace) is adopted, and a tick
 * chosen here is reported back. IdeApp wires the two together, so whatever Simulate reports
 * becomes the next override it receives.
 *
 * Measured in the running workbench: step the recorded Board from t2 to t3, return to Simulate,
 * and the workspace failed with "Maximum update depth exceeded". On mount Simulate restored t2
 * from the scenario's session, adopted the inbound t3, and in the same commit reported the
 * restored t2 back - which flipped the override to t2, which was adopted, which reported t3...
 * The host below is IdeApp's wiring, reduced to the one piece of state it contributes.
 */
const PROJECT = 'shared-tick-project';
const SCENARIO = 'a';
const signals = [
  { id: 'a', label: 'A', direction: 'in' as const, nodeId: 'input' },
  { id: 'y', label: 'Y', direction: 'out' as const, nodeId: 'output' },
];
const vectors = [0, 1, 2, 3].map((tick) => ({
  id: `v${tick}`, tick, inputs: { a: (tick % 2) as 0 | 1 }, expected: {},
}));

function seedRestoredTick(tick: number) {
  sessionStorage.setItem(
    scenarioViewStorageKey({ projectId: PROJECT, scenarioId: SCENARIO }),
    JSON.stringify({ ...defaultScenarioViewState(), selectedTick: tick }),
  );
}

function Host({ initialOverride, reports }: { initialOverride: number | null; reports: (number | null)[] }) {
  const [override, setOverride] = useState<number | null>(initialOverride);
  return (
    <>
      <output data-testid="host-override">{String(override)}</output>
      <VerifySurface
        projectId={PROJECT} activeScenarioId={SCENARIO}
        hasVectors vectors={vectors}
        mappedInputs={[{ id: 'a', label: 'A' }]} mappedSignals={signals}
        deterministicHash="shared-tick" onOpenProjectVectors={vi.fn()} onVectorsChange={vi.fn()}
        selectedTickOverride={override}
        onSelectedTickChange={(tick) => { reports.push(tick); setOverride(tick); }}
      />
    </>
  );
}

describe('Simulate and the workbench share one selected tick without chasing each other', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useEngineeringSelection.getState().clear();
    workspacePreferencesStore.resetSimulateLayout();
  });
  afterEach(cleanup);

  it('adopts a tick chosen elsewhere over the one its session restored, and does not echo the stale one', () => {
    seedRestoredTick(1);
    const loops = vi.spyOn(console, 'error');
    const reports: (number | null)[] = [];
    const view = render(<Host initialOverride={2} reports={reports} />);

    expect(loops.mock.calls.some((call) => String(call[0]).includes('Maximum update depth'))).toBe(false);
    // The inbound tick wins and stays: on screen, and in the owner that sent it.
    expect(view.getByTestId('ide-case-lab-row-2').getAttribute('aria-selected')).toBe('true');
    expect(view.getByTestId('host-override').textContent).toBe('2');
    // The restored tick was never sent back as if the reader had chosen it.
    expect(reports).not.toContain(1);
    loops.mockRestore();
  });

  it('still reports a tick the reader chooses here after an adoption', () => {
    seedRestoredTick(1);
    const reports: (number | null)[] = [];
    const view = render(<Host initialOverride={2} reports={reports} />);
    act(() => {
      fireEvent.click(view.getByTestId('ide-case-lab-row-3'));
    });
    expect(view.getByTestId('ide-case-lab-row-3').getAttribute('aria-selected')).toBe('true');
    expect(reports[reports.length - 1]).toBe(3);
    expect(view.getByTestId('host-override').textContent).toBe('3');
  });
});
