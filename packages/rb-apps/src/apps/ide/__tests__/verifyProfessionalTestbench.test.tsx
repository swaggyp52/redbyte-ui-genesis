// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { StimulusCanvas } from '../components/StimulusCanvas';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { ScenarioLibraryHeader } from '../surfaces/ScenarioLibraryHeader';
import { VerifySurface } from '../surfaces/VerifySurface';
import type { VerifyScenario } from '../verifyScenario';

afterEach(() => {
  cleanup();
});

const VECTORS = [
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
      vectors: [
        { id: 'vec-0', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 }, caseIndex: 0 },
        { id: 'vec-1', tick: 1, inputs: { sw0: 1 }, expected: {}, caseIndex: 1 },
      ],
      inputsAtTick: { 0: { sw0: 0 }, 1: { sw0: 1 } },
      inputsByVectorId: { 'vec-0': { sw0: 0 }, 'vec-1': { sw0: 1 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [
        { tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass', vectorId: 'vec-0', caseIndex: 0 },
        { tick: 1, signal: 'ld0', expected: undefined, actual: '1', status: 'pass', vectorId: 'vec-1', caseIndex: 1 },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] },
      { tick: 1, signals: { sw0: '1', ld0: '1' }, mismatches: [] },
    ],
  };
}

describe('professional Verify testbench workflow', () => {
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

    expect(getByTestId('ide-verify-context-scenario').textContent).toBe('Half adder behavior');
    expect(getByTestId('ide-verify-context-state').textContent).toContain('Checks aligned');
    expect(getByTestId('ide-verify-command-bar').getAttribute('data-run-mode')).toBe('compare');
    const primaryActions = within(getByTestId('ide-vcb-run-authority')).getAllByRole('button');
    expect(primaryActions[0]).toBe(getByTestId('ide-vcb-run'));
    expect(getByTestId('ide-stimulus-observed-ld0-t0').textContent).toBe('0');
    expect(getByTestId('ide-stimulus-case-status-t0').textContent).toBe('PASS');
    expect(getByTestId('ide-stimulus-case-status-t1').textContent).toBe('Observed');
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

    expect(getByTestId('ide-verify-context-state').textContent).toContain('Needs update');
    expect(getByTestId('ide-stimulus-case-status-t0').textContent).toBe('STALE');
    expect(getByTestId('ide-stimulus-case-status-t1').textContent).toBe('STALE');
    expect(getByTestId('ide-verify-results-summary')).toHaveAttribute('data-kind', 'stale');
    expect(getByTestId('ide-verify-workspace-waveform')).toHaveAttribute('data-state', 'stale');
  });

  it('does not project another testbench run into the active document', () => {
    const activeScenario = makeScenario('active-testbench', 'Active testbench');
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="professional-testbench"
        hasVectors
        vectors={VECTORS}
        lastRun={makePassRun()}
        scenarios={[activeScenario, makeScenario('half-adder-testbench', 'Half adder behavior')]}
        activeScenarioId={activeScenario.id}
        activeScenario={activeScenario}
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

    expect(getByTestId('ide-testbench-document-tab-active-testbench').textContent).toContain('Active testbench');
    expect(getByTestId('ide-testbench-document-tab-active-testbench')).toHaveAttribute('aria-selected', 'true');
    expect(getByTestId('ide-verify-primary-status').textContent).toContain(
      'Results belong to another scenario'
    );
    expect(getByTestId('ide-stimulus-observed-ld0-t0').textContent).toBe('-');
    expect(getByTestId('ide-verify-results-summary')).toHaveAttribute('data-kind', 'stale');
    expect(getByTestId('ide-verify-workspace-waveform')).toHaveAttribute('data-state', 'stale');
  });
});
