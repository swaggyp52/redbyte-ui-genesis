// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { StimulusCanvas } from '../components/StimulusCanvas';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { ScenarioLibraryHeader } from '../surfaces/ScenarioLibraryHeader';
import { VerifySurface } from '../surfaces/VerifySurface';
import { TestbenchDocumentTabs } from '../surfaces/verify/TestbenchDocumentTabs';
import type { VerifyScenario } from '../verifyScenario';
import type { VerifyAuthorVector } from '../surfaces/ScenarioBuilderPanel';
import { workspacePreferencesStore } from '../workspacePreferences';

beforeEach(() => workspacePreferencesStore.reset());

afterEach(() => {
  cleanup();
});

const VECTORS: VerifyAuthorVector[] = [
  { id: 'vec-0', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
  { id: 'vec-1', tick: 1, inputs: { sw0: 1 }, expected: {} },
];

function makeScenario(id: string, name: string): VerifyScenario {
  return {
    id,
    name,
    vectors: VECTORS,
    version: 2,
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
  };
}

function makePassRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'half-adder-testbench',
    scenarioName: 'Half adder behavior',
    runKind: 'verify',
    simulationStatus: 'complete',
    assertionStatus: 'passing',
    status: 'pass',
    deterministicHash: 'professional-testbench',
    reportHash: 'professional-testbench-report',
    generatedAtIso: '2026-07-14T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      schemaVersion: 'rb.verify-report.v1',
      scenarioId: 'half-adder-testbench',
      scenarioName: 'Half adder behavior',
      status: 'pass',
      deterministicHash: 'professional-testbench',
      generatedAtIso: '2026-07-14T00:00:00.000Z',
      reportHash: 'professional-testbench-report',
      vectors: [
        { id: 'vec-0', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 }, caseIndex: 0 },
        { id: 'vec-1', tick: 1, inputs: { sw0: 1 }, expected: {}, caseIndex: 1 },
      ],
      inputsAtTick: { 0: { sw0: 0 }, 1: { sw0: 1 } },
      inputsByVectorId: { 'vec-0': { sw0: 0 }, 'vec-1': { sw0: 1 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [
        { tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass', vectorId: 'vec-0', caseIndex: 0 },
      ],
    },
    waveform: [
      { tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] },
      { tick: 1, signals: { sw0: '1', ld0: '1' }, mismatches: [] },
    ],
  };
}

describe('professional Verify testbench workflow', () => {
  it('summarizes real scenario stimulus and checks as a visual library card', () => {
    const scenario: VerifyScenario = {
      ...makeScenario('counter-sequence', 'Counter sequence'),
      vectors: [
        { tick: 0, inputs: { clk: 0, en: 1 }, expected: { q0: 0, q1: 0 } },
        { tick: 1, inputs: { clk: 1, en: 1 }, expected: { q0: 1, q1: 0 } },
      ],
    };
    const view = render(
      <TestbenchDocumentTabs
        scenarios={[scenario, makeScenario('other-scenario', 'Other scenario')]}
        activeScenarioId={scenario.id}
        onSwitch={vi.fn()}
        onCreate={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const card = view.getByTestId('ide-testbench-document-tab-counter-sequence');
    expect(card.textContent).toContain('Sequential');
    expect(card.textContent).toContain('2 events');
    expect(card.textContent).toContain('4 checks');
    expect(view.getByTestId('ide-testbench-document-preview-counter-sequence')).toBeTruthy();
    expect(view.getByTestId('ide-scenario-create-btn').textContent).toContain('New scenario');
  });

  it('keeps stimulus, expected, observed, and per-case evidence in one work object', () => {
    const { getByTestId } = render(
      <StimulusCanvas
        inputFields={[{ id: 'sw0', label: 'SW0' }]}
        outputFields={[{ id: 'ld0', label: 'LD0' }]}
        authoredVectors={VECTORS}
        observedValuesByTick={{ 0: { ld0: '0' }, 1: { ld0: '1' } }}
        caseEvidenceByTick={{ 0: 'pass', 1: 'fail' }}
        onVectorsChange={vi.fn()}
      />
    );

    const canvas = getByTestId('ide-stimulus-canvas');
    expect(canvas.getAttribute('data-work-object')).toBe('testbench-cases');
    expect(canvas.getAttribute('aria-label')).toContain('observed outputs');
    expect(getByTestId('ide-stimulus-expected-ld0-t0').textContent).toContain('0');
    expect(getByTestId('ide-stimulus-observed-ld0-t0').textContent).toBe('0');
    expect(getByTestId('ide-stimulus-observed-ld0-t1').textContent).toBe('1');
    expect(getByTestId('ide-stimulus-case-status-t0').textContent).toBe('PASS');
    expect(getByTestId('ide-stimulus-case-status-t1').textContent).toBe('FAIL');
  });

  it('requires confirmation before deleting a case and preserves the other case', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <StimulusCanvas
        inputFields={[{ id: 'sw0', label: 'SW0' }]}
        outputFields={[{ id: 'ld0', label: 'LD0' }]}
        authoredVectors={VECTORS}
        onVectorsChange={onVectorsChange}
      />
    );

    fireEvent.click(getByTestId('ide-stimulus-delete-tick-0'));
    expect(getByTestId('ide-stimulus-delete-confirmation').textContent).toContain('Case 1');
    expect(onVectorsChange).not.toHaveBeenCalled();

    fireEvent.click(getByTestId('ide-stimulus-cancel-delete'));
    expect(queryByTestId('ide-stimulus-delete-confirmation')).toBeNull();
    expect(onVectorsChange).not.toHaveBeenCalled();

    fireEvent.click(getByTestId('ide-stimulus-delete-tick-0'));
    fireEvent.click(getByTestId('ide-stimulus-confirm-delete-tick-0'));
    expect(onVectorsChange).toHaveBeenCalledWith([VECTORS[1]]);
  });

  it('treats named testbench lifecycle operations as explicit document management', () => {
    const onCreate = vi.fn();
    const onDuplicate = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const scenarios = [
      makeScenario('half-adder-testbench', 'Half adder behavior'),
      makeScenario('edge-cases', 'Boundary cases'),
    ];
    const { getByTestId, getByText, queryByTestId } = render(
      <ScenarioLibraryHeader
        scenarios={scenarios}
        activeScenarioId="half-adder-testbench"
        onSwitch={vi.fn()}
        onCreate={onCreate}
        onDuplicate={onDuplicate}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    expect(getByTestId('ide-scenario-library-header').textContent).toContain('Half adder behavior');
    fireEvent.click(getByText('Manage testbenches'));
    fireEvent.click(getByTestId('ide-scenario-create-btn'));
    fireEvent.click(getByTestId('ide-scenario-duplicate-btn'));
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onDuplicate).toHaveBeenCalledOnce();

    fireEvent.click(getByTestId('ide-scenario-rename-btn'));
    const renameInput = getByTestId('ide-scenario-rename-input');
    fireEvent.change(renameInput, { target: { value: '  Core behavior  ' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Core behavior');

    fireEvent.click(getByTestId('ide-scenario-delete-btn'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(getByTestId('ide-scenario-delete-confirmation').textContent).toContain(
      'Half adder behavior'
    );

    fireEvent.click(getByTestId('ide-scenario-delete-cancel'));
    expect(queryByTestId('ide-scenario-delete-confirmation')).toBeNull();
    fireEvent.click(getByTestId('ide-scenario-delete-btn'));
    fireEvent.click(getByTestId('ide-scenario-delete-confirm'));
    expect(onDelete).toHaveBeenCalledWith('half-adder-testbench');
  });

  it('projects a current Compare run into the named testbench document and case grid', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="professional-testbench"
        projectName="Half adder"
        hasVectors
        vectors={VECTORS}
        lastRun={makePassRun()}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'ld0', label: 'LD0', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={vi.fn()}
        verifyMode="combinational"
      />
    );

    fireEvent.click(getByTestId('ide-verify-view-table'));
    expect(getByTestId('ide-verify-context-scenario').textContent).toBe('Half adder behavior');
    expect(getByTestId('ide-verify-context-state').textContent).toContain('Checks passing');
    expect(getByTestId('ide-verify-command-bar').getAttribute('data-run-mode')).toBe('simulation');
    const primaryActions = within(getByTestId('ide-vcb-run-authority')).getAllByRole('button');
    expect(primaryActions[0]).toBe(getByTestId('ide-vcb-run'));
    expect(getByTestId('ide-case-lab-row-0').querySelector('.ide-case-lab-obs')?.textContent).toBe('0');
    expect(getByTestId('ide-case-lab-row-0').querySelector('.ide-case-lab-verdict')?.textContent).toBe('pass');
    expect(getByTestId('ide-case-lab-row-1').querySelector('.ide-case-lab-verdict')?.textContent).toBe('observed');
  });

  it('marks the testbench document and every case stale when the circuit changed after Compare', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="newer-circuit-build"
        hasVectors
        vectors={VECTORS}
        lastRun={makePassRun()}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'ld0', label: 'LD0', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={vi.fn()}
        verifyMode="combinational"
      />
    );

    fireEvent.click(getByTestId('ide-verify-view-table'));
    expect(getByTestId('ide-verify-context-state').textContent).toContain('Simulation stale');
    expect(getByTestId('ide-case-lab-row-0').querySelector('.ide-case-lab-verdict')?.textContent).toBe('stale');
    expect(getByTestId('ide-case-lab-row-1').querySelector('.ide-case-lab-verdict')?.textContent).toBe('stale');
    expect(getByTestId('ide-run-identity')).toHaveAttribute('data-currency', 'differs');
    expect(getByTestId('ide-run-currency').textContent).toBe('Current work differs');
    fireEvent.click(getByTestId('ide-verify-view-waveform'));
    expect(getByTestId('ide-verify-workspace-waveform')).toHaveAttribute('data-state', 'stale');
  });

  it.each(['verify', 'trace'] as const)(
    'does not project another %s testbench recording into the active document',
    (runKind) => {
      const activeScenario = makeScenario('active-testbench', 'Active testbench');
      const recordedScenario = makeScenario('half-adder-testbench', 'Half adder behavior');
      const checkedRun = makePassRun();
      const retainedRun: RuntimeVerifyRun = runKind === 'verify' ? checkedRun : {
        ...checkedRun,
        runKind: 'trace',
        assertionStatus: 'not-evaluated',
        report: { ...checkedRun.report, rows: [] },
      };
      const commonProps: React.ComponentProps<typeof VerifySurface> = {
        deterministicHash: 'professional-testbench',
        hasVectors: true,
        vectors: VECTORS,
        lastRun: retainedRun,
        scenarios: [activeScenario, recordedScenario],
        mappedInputs: [{ id: 'sw0', label: 'SW0' }],
        mappedSignals: [
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'ld0', label: 'LD0', direction: 'out' },
        ],
        onOpenProjectVectors: vi.fn(),
        onVectorsChange: vi.fn(),
        verifyMode: 'combinational',
      };
      const view = render(
        <VerifySurface {...commonProps} activeScenarioId={activeScenario.id} activeScenario={activeScenario} />
      );
      const { getByTestId } = view;

      fireEvent.click(getByTestId('ide-verify-view-table'));
      fireEvent.click(getByTestId('ide-show-left-dock'));
      expect(getByTestId('ide-testbench-document-tab-active-testbench').textContent).toContain('Active testbench');
      expect(getByTestId('ide-testbench-document-tab-active-testbench')).toHaveAttribute('aria-selected', 'true');
      expect(getByTestId('ide-verify-primary-status').textContent).toContain(
        'Results belong to another scenario'
      );
      // Tick 0 can leak through a checked report row; tick 1 has no report row
      // and can leak through the waveform fallback. Neither belongs to this scenario.
      for (const tick of [0, 1]) {
        const row = getByTestId(`ide-case-lab-row-${tick}`);
        const observedCell = row.querySelector('.ide-case-lab-obs');
        if (!observedCell) throw new Error('The active case must expose its observed output cell');
        expect(observedCell.textContent).toBe('\u00b7');
        expect(observedCell.querySelector('button, input')).toBeNull();
        expect(row.querySelector('.ide-case-lab-verdict')?.textContent).toBe('stale');
      }
      expect(getByTestId('ide-run-identity')).toHaveAttribute('data-currency', 'differs');
      expect(getByTestId('ide-run-currency').textContent).toBe('Current work differs');
      fireEvent.click(getByTestId('ide-verify-view-waveform'));
      expect(getByTestId('ide-verify-workspace-waveform')).toHaveAttribute('data-state', 'stale');

      // Switching back to the recording's own scenario restores its observations.
      // This also proves scenario changes invalidate the memoized case projection.
      view.rerender(
        <VerifySurface {...commonProps} activeScenarioId={recordedScenario.id} activeScenario={recordedScenario} />
      );
      fireEvent.click(getByTestId('ide-verify-view-table'));
      expect(getByTestId('ide-case-lab-row-0').querySelector('.ide-case-lab-obs')?.textContent).toBe('0');
      expect(getByTestId('ide-case-lab-row-1').querySelector('.ide-case-lab-obs')?.textContent).toBe('1');
      expect(getByTestId('ide-case-lab-row-0').querySelector('.ide-case-lab-verdict')?.textContent).toBe(
        runKind === 'verify' ? 'pass' : 'observed'
      );
      expect(getByTestId('ide-case-lab-row-1').querySelector('.ide-case-lab-verdict')?.textContent).toBe('observed');
      expect(getByTestId('ide-run-identity')).toHaveAttribute('data-currency', 'current');
    }
  );
});
