// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import {
  ProjectSimulationSetsDocument,
  deriveSimulationSetEvidence,
  type ProjectSimulationSetsDocumentProps,
  type SimulationSetLastRun,
} from '../ProjectSimulationSetsDocument';
import { computeScenarioContentHash, type VerifyScenario } from '../../verifyScenario';

function makeScenario(id: string, name: string, overrides: Partial<VerifyScenario> = {}): VerifyScenario {
  return {
    id,
    name,
    vectors: [
      { tick: 0, inputs: { A: 0 }, expected: { Y: 0 } },
      { tick: 1, inputs: { A: 1 }, expected: {} },
    ],
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeLastRun(scenario: VerifyScenario, overrides: Partial<SimulationSetLastRun> = {}): SimulationSetLastRun {
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    status: 'pass',
    runKind: 'verify',
    scenarioContentHash: computeScenarioContentHash(scenario),
    generatedAtIso: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function makeProps(
  overrides: Partial<ProjectSimulationSetsDocumentProps> = {}
): ProjectSimulationSetsDocumentProps {
  const defaultScenario = makeScenario('default', 'Default');
  const walkthrough = makeScenario('walkthrough', 'Walkthrough');
  return {
    scenarios: [defaultScenario, walkthrough],
    activeScenarioId: 'default',
    dutName: 'top',
    lastRun: makeLastRun(defaultScenario),
    dirtySinceVerify: false,
    onOpenBench: vi.fn(),
    onSetActive: vi.fn(),
    onCreate: vi.fn(),
    onDuplicate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

describe('ProjectSimulationSetsDocument', () => {
  it('renders one row per set with active state, shared DUT, and honest counts', () => {
    const { getByTestId, queryByTestId } = render(<ProjectSimulationSetsDocument {...makeProps()} />);
    getByTestId('ide-project-simulation-sets');
    expect(getByTestId('ide-project-simsets-name-default').textContent).toContain('Default');
    expect(getByTestId('ide-project-simsets-name-default').textContent).toContain('v1');
    getByTestId('ide-project-simsets-active-default');
    expect(queryByTestId('ide-project-simsets-active-walkthrough')).toBeNull();
    expect(getByTestId('ide-project-simsets-dut-default').textContent).toBe('top');
    expect(getByTestId('ide-project-simsets-dut-walkthrough').textContent).toBe('top');
    expect(getByTestId('ide-project-simsets-coverage-default').textContent).toBe('2 events · 1 check');
  });

  it('shows run evidence only for the set the recorded run belongs to', () => {
    const { getByTestId } = render(<ProjectSimulationSetsDocument {...makeProps()} />);
    expect(getByTestId('ide-project-simsets-evidence-default').textContent).toContain('Checks passing');
    expect(getByTestId('ide-project-simsets-evidence-walkthrough').textContent).toBe(
      'No recorded evidence for this browser session'
    );
  });

  it('marks evidence stale when scenario content drifted or the design changed', () => {
    const drifted = makeProps();
    const driftedRun = { ...drifted.lastRun!, scenarioContentHash: 'scn_000000000000' };
    const view = render(<ProjectSimulationSetsDocument {...drifted} lastRun={driftedRun} />);
    expect(view.getByTestId('ide-project-simsets-evidence-default').textContent).toContain('Stale evidence');
    expect(view.getByTestId('ide-project-simsets-evidence-default').textContent).toContain(
      'Set edited since its last run'
    );
    view.unmount();

    const dirty = render(<ProjectSimulationSetsDocument {...makeProps({ dirtySinceVerify: true })} />);
    expect(dirty.getByTestId('ide-project-simsets-evidence-default').textContent).toContain(
      'Design or mapping changed since its last run'
    );
  });

  it('labels an observed trace run and a failing run honestly', () => {
    const props = makeProps();
    const traceRun = { ...props.lastRun!, runKind: 'trace' as const };
    const view = render(<ProjectSimulationSetsDocument {...props} lastRun={traceRun} />);
    expect(view.getByTestId('ide-project-simsets-evidence-default').textContent).toContain(
      'Observed — no checks'
    );
    view.unmount();

    const failRun = { ...props.lastRun!, status: 'fail' as const };
    const failView = render(<ProjectSimulationSetsDocument {...props} lastRun={failRun} />);
    expect(failView.getByTestId('ide-project-simsets-evidence-default').textContent).toContain(
      'Checks failing'
    );
  });

  it('disables rename and duplicate for non-active rows with the switch-first reason', () => {
    const { getByTestId } = render(<ProjectSimulationSetsDocument {...makeProps()} />);
    const rename = getByTestId('ide-project-simsets-rename-walkthrough') as HTMLButtonElement;
    const duplicate = getByTestId('ide-project-simsets-duplicate-walkthrough') as HTMLButtonElement;
    expect(rename.disabled).toBe(true);
    expect(rename.title).toContain('active set only');
    expect(duplicate.disabled).toBe(true);
    expect(duplicate.title).toContain('active set only');
    expect((getByTestId('ide-project-simsets-rename-default') as HTMLButtonElement).disabled).toBe(false);
    expect((getByTestId('ide-project-simsets-duplicate-default') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders capability-truthful disabled actions when callbacks are absent', () => {
    const props = makeProps({
      onOpenBench: undefined,
      onSetActive: undefined,
      onCreate: undefined,
      onDuplicate: undefined,
      onRename: undefined,
      onDelete: undefined,
    });
    const { getByTestId } = render(<ProjectSimulationSetsDocument {...props} />);
    for (const testId of [
      'ide-project-simsets-create',
      'ide-project-simsets-open-bench',
      'ide-project-simsets-open-default',
      'ide-project-simsets-activate-walkthrough',
      'ide-project-simsets-rename-default',
      'ide-project-simsets-duplicate-default',
      'ide-project-simsets-delete-default',
    ]) {
      const button = getByTestId(testId) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.title).toBe('Not available from this surface yet.');
    }
  });

  it('routes activate, create, duplicate, and open-bench through callbacks', () => {
    const props = makeProps();
    const { getByTestId } = render(<ProjectSimulationSetsDocument {...props} />);
    fireEvent.click(getByTestId('ide-project-simsets-activate-walkthrough'));
    expect(props.onSetActive).toHaveBeenCalledWith('walkthrough');
    fireEvent.click(getByTestId('ide-project-simsets-create'));
    expect(props.onCreate).toHaveBeenCalledTimes(1);
    fireEvent.click(getByTestId('ide-project-simsets-duplicate-default'));
    expect(props.onDuplicate).toHaveBeenCalledTimes(1);
    fireEvent.click(getByTestId('ide-project-simsets-open-default'));
    expect(props.onOpenBench).toHaveBeenCalledTimes(1);
  });

  it('surfaces the evidence-staling consequence on the activate affordance', () => {
    const { getByTestId } = render(<ProjectSimulationSetsDocument {...makeProps()} />);
    expect((getByTestId('ide-project-simsets-activate-walkthrough') as HTMLButtonElement).title).toContain(
      'stale'
    );
  });

  it('deletes only after confirmation and refuses to delete the last set', () => {
    const props = makeProps();
    const view = render(<ProjectSimulationSetsDocument {...props} />);
    fireEvent.click(view.getByTestId('ide-project-simsets-delete-walkthrough'));
    view.getByTestId('ide-project-simsets-delete-confirmation');
    expect(props.onDelete).not.toHaveBeenCalled();
    fireEvent.click(view.getByTestId('ide-project-simsets-delete-confirm'));
    expect(props.onDelete).toHaveBeenCalledWith('walkthrough');
    view.unmount();

    const single = makeProps({ scenarios: [makeScenario('default', 'Default')] });
    const singleView = render(<ProjectSimulationSetsDocument {...single} />);
    const deleteButton = singleView.getByTestId('ide-project-simsets-delete-default') as HTMLButtonElement;
    expect(deleteButton.disabled).toBe(true);
    expect(deleteButton.title).toBe('At least one simulation set must remain.');
  });

  it('renames the active set through an inline form', () => {
    const props = makeProps();
    const { getByTestId } = render(<ProjectSimulationSetsDocument {...props} />);
    fireEvent.click(getByTestId('ide-project-simsets-rename-default'));
    const input = getByTestId('ide-project-simsets-rename-input') as HTMLInputElement;
    expect(input.value).toBe('Default');
    fireEvent.change(input, { target: { value: '  Renamed set  ' } });
    fireEvent.submit(getByTestId('ide-project-simsets-rename-form'));
    expect(props.onRename).toHaveBeenCalledWith('Renamed set');
  });

  it('states that run history is project-wide, never per set', () => {
    const { getByTestId } = render(
      <ProjectSimulationSetsDocument {...makeProps({ runHistoryCount: 3 })} />
    );
    const footnote = getByTestId('ide-project-simsets-footnote').textContent ?? '';
    expect(footnote).toContain('3 runs this browser session');
    expect(footnote).toContain('not per set');
  });
});

describe('deriveSimulationSetEvidence', () => {
  const scenario = makeScenario('default', 'Default');

  it('returns none without a run or for a run that belongs to another set', () => {
    expect(deriveSimulationSetEvidence(scenario, null, false)).toEqual({ kind: 'none' });
    expect(
      deriveSimulationSetEvidence(scenario, makeLastRun(scenario, { scenarioId: 'other' }), false)
    ).toEqual({ kind: 'none' });
  });

  it('returns current with the run status and kind when hashes match', () => {
    expect(deriveSimulationSetEvidence(scenario, makeLastRun(scenario), false)).toEqual({
      kind: 'current',
      status: 'pass',
      runKind: 'verify',
    });
  });

  it('returns stale on content drift or design change', () => {
    expect(
      deriveSimulationSetEvidence(
        scenario,
        makeLastRun(scenario, { scenarioContentHash: 'scn_000000000000' }),
        false
      )
    ).toEqual({ kind: 'stale', reason: 'scenario-edited', status: 'pass' });
    expect(deriveSimulationSetEvidence(scenario, makeLastRun(scenario), true)).toEqual({
      kind: 'stale',
      reason: 'design-changed',
      status: 'pass',
    });
  });
});
