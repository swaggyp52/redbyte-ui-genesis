// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifySurface } from '../surfaces/VerifySurface';
import { workspacePreferencesStore } from '../workspacePreferences';
import { useEngineeringSelection } from '../engineeringSelection';
import { readScenarioViewState, scenarioViewStorageKey } from '../scenarioViewState';
import { buildVerifyReport } from '../verifyReport';
import type { RuntimeVerifyRun } from '../projectRuntime';

const signals = [
  { id: 'a', label: 'A', direction: 'in' as const, nodeId: 'input' },
  { id: 'y', label: 'Y', direction: 'out' as const, nodeId: 'output' },
];
const aVectors = [
  { id: 'a0', tick: 0, inputs: { a: 0 as const }, expected: {} },
  { id: 'a1', tick: 1, inputs: { a: 1 as const }, expected: {} },
];
const bVectors = [
  { id: 'b0', tick: 0, inputs: { a: 1 as const }, expected: {} },
  { id: 'b1', tick: 1, inputs: { a: 0 as const }, expected: {} },
];

describe('Simulate scenario selection integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useEngineeringSelection.getState().clear();
    workspacePreferencesStore.resetSimulateLayout();
  });
  afterEach(cleanup);

  it('restores independent representation and selected case after switching and remounting', () => {
    const surface = (id: string) => <VerifySurface
      projectId="scenario-isolation-project" activeScenarioId={id}
      hasVectors vectors={id === 'a' ? aVectors : bVectors}
      mappedInputs={[{ id: 'a', label: 'A' }]} mappedSignals={signals}
      deterministicHash="same-circuit" onOpenProjectVectors={vi.fn()} onVectorsChange={vi.fn()}
    />;
    const rendered = render(surface('a'));
    fireEvent.click(rendered.getByTestId('ide-case-lab-row-1'));
    expect(rendered.getByTestId('ide-case-lab-row-1').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(rendered.getByTestId('ide-verify-view-timeline'));
    expect(readScenarioViewState(sessionStorage, scenarioViewStorageKey({ projectId: 'scenario-isolation-project', scenarioId: 'a' })).selectedTick).toBe(1);
    rendered.rerender(surface('b'));
    expect(rendered.getByTestId('ide-verify-lab-grid').getAttribute('data-representation')).toBe('table');
    fireEvent.click(rendered.getByTestId('ide-case-lab-row-0'));
    rendered.rerender(surface('a'));
    expect(readScenarioViewState(sessionStorage, scenarioViewStorageKey({ projectId: 'scenario-isolation-project', scenarioId: 'a' })).selectedTick).toBe(1);
    expect(rendered.getByTestId('ide-verify-lab-grid').getAttribute('data-representation')).toBe('timeline');
    fireEvent.click(rendered.getByTestId('ide-verify-view-table'));
    expect(rendered.getByTestId('ide-case-lab-row-1').getAttribute('aria-selected')).toBe('true');
    rendered.unmount();
    const reopened = render(surface('b'));
    expect(reopened.getByTestId('ide-verify-lab-grid').getAttribute('data-representation')).toBe('table');
    expect(reopened.getByTestId('ide-case-lab-row-0').getAttribute('aria-selected')).toBe('true');
  });

  it('keeps a recorded internal signal selected when the normal waveform only shows boundary lanes', () => {
    const report = buildVerifyReport({
      scenarioId: 'a', scenarioName: 'Two instances', status: 'pass', deterministicHash: 'internal-recording',
      generatedAtIso: '2026-09-08T00:00:00.000Z',
      rows: [{ tick: 0, signal: 'y', expected: '1', actual: '1' }], vectors: [],
      signalRoles: { a: 'input', y: 'output' },
    });
    const run: RuntimeVerifyRun = {
      projectId: 'internal-project', scenarioId: 'a', scenarioName: 'Two instances', runKind: 'verify',
      status: 'pass', deterministicHash: 'internal-recording', reportHash: report.reportHash,
      generatedAtIso: report.generatedAtIso, schedule: 'combinational', report,
      meta: { circuitKind: 'combinational', clockingProtocol: null, samplePoint: 'steady-state', tick0Meaning: null, clockSignalName: null },
      waveform: [{ tick: 0, signals: { a: '0', y: '1', 'left__x1.out': '0', 'right__x1.out': '1' }, mismatches: [] }],
      circuitSnapshot: {
        nodes: [
          { id: 'left__x1', type: 'XOR', label: 'x1', position: { x: 0, y: 0 }, config: { hierarchyPath: 'top.left' } },
          { id: 'right__x1', type: 'XOR', label: 'x1', position: { x: 0, y: 0 }, config: { hierarchyPath: 'top.right' } },
        ], connections: [],
      },
    };
    const view = render(<VerifySurface
      projectId="internal-project" activeScenarioId="a" hasVectors vectors={aVectors}
      lastRun={run} mappedInputs={[{ id: 'a', label: 'A' }]} mappedSignals={signals}
      deterministicHash="internal-recording" onOpenProjectVectors={vi.fn()}
    />);
    const drawerToggle = view.getByTestId('ide-verify-drawer-toggle');
    if (drawerToggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(drawerToggle);
    expect(view.queryByTestId('ide-verify-region-inspector')).not.toBeNull();
    fireEvent.click(view.getAllByRole('button', { name: 'Inspect with circuit' })[0]);
    expect(view.queryByTestId('ide-verify-drawer-toggle')).toBeNull();
    expect(view.queryByTestId('ide-verify-region-inspector')).toBeNull();
    // Duplicate labels retain the exact instance node IDs as their canonical display names.
    fireEvent.change(view.getByLabelText('Recorded circuit signal'), { target: { value: 'left__x1' } });
    expect(view.getByTestId('ide-recorded-circuit-context').textContent).toContain('left__x1 = 0');
    fireEvent.change(view.getByLabelText('Recorded circuit signal'), { target: { value: 'right__x1' } });
    expect(view.getByTestId('ide-recorded-circuit-context').textContent).toContain('right__x1 = 1');
    fireEvent.click(view.getByRole('button', { name: 'Close circuit investigation' }));
    expect(view.getByTestId('ide-verify-drawer-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(view.queryByTestId('ide-verify-region-inspector')).not.toBeNull();
  });

  it('shows recorded output values in Observe cases without grading the saved expectations', () => {
    const report = buildVerifyReport({ scenarioId: 'a', scenarioName: 'Observation', status: 'pass',
      deterministicHash: 'observed-recording', generatedAtIso: '2026-09-08T00:00:00.000Z',
      rows: [], vectors: [], signalRoles: { a: 'input', q0: 'output' } });
    const run: RuntimeVerifyRun = {
      projectId: 'observed-project', scenarioId: 'a', scenarioName: 'Observation', runKind: 'trace',
      assertionStatus: 'not-configured', status: 'pass', deterministicHash: 'observed-recording', reportHash: report.reportHash,
      generatedAtIso: report.generatedAtIso, schedule: 'combinational', report,
      meta: { circuitKind: 'combinational', clockingProtocol: null, samplePoint: 'steady-state', tick0Meaning: null, clockSignalName: null },
      waveform: [{ tick: 0, signals: { 'input.out': '0', 'q0_out.in': '0', 'q0_ff.out': '1' }, mismatches: [] }],
      circuitSnapshot: { nodes: [
        { id: 'q0_out', type: 'OUTPUT', label: 'LD0', position: { x: 200, y: 0 }, config: {} },
        { id: 'q0_ff', type: 'DFlipFlop', label: 'Q0', position: { x: 0, y: 0 }, config: {} },
      ], connections: [] },
    };
    const view = render(<VerifySurface projectId="observed-project" activeScenarioId="a" hasVectors
      vectors={[{ id: 'a0', tick: 0, inputs: { a: 0 }, expected: { q0: 1 } }]}
      lastRun={run} mappedInputs={[{ id: 'a', label: 'A' }]} mappedSignals={[
        signals[0], { id: 'q0', label: 'LD0', direction: 'out', nodeId: 'q0_out' },
      ]}
      runHistory={[{ runId: 'observation-run', runKind: 'trace', ranAtIso: run.generatedAtIso, status: 'pass',
        passedRows: 0, failedRows: 0, firstFailure: null, circuitHash: '', vectorsHash: '', mappingHash: '', projectHash: '',
        didCircuitChangeSinceLast: false, didVectorsChangeSinceLast: false, didMappingChangeSinceLast: false }]}
      deterministicHash="observed-recording" onOpenProjectVectors={vi.fn()} />);
    const expectedCell = view.getByTestId('ide-case-lab-exp-0-q0');
    expect(expectedCell.textContent).toBe('1');
    expect(expectedCell.closest('td')?.nextElementSibling?.textContent).toBe('0');
    expect(view.getByTestId('ide-case-lab-row-0').className).toContain('is-observed');
    expect(view.getByTestId('ide-case-lab-row-0').className).not.toMatch(/is-pass|is-fail/);
    expect(view.queryByTestId('ide-case-lab-history')).toBeNull();
    fireEvent.click(view.getByTestId('ide-case-lab-row-0'));
    expect(view.getByTestId('ide-sim-context-inspector').textContent).toContain('Not evaluated');
    expect(view.getByTestId('ide-sim-context-inspector').textContent).not.toContain('Passing');
    expect(run.report.rows).toHaveLength(0);
  });
});
