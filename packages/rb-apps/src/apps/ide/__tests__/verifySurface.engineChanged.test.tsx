// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifySurface } from '../surfaces/VerifySurface';
import { workspacePreferencesStore } from '../workspacePreferences';
import { useEngineeringSelection } from '../engineeringSelection';
import { buildVerifyReport } from '../verifyReport';
import { BROWSER_ENGINE_VERSION } from '../runDeterminism';
import type { RuntimeVerifyRun } from '../projectRuntime';

/**
 * Engine v3 (RB-DEBT-014/016/028) records some designs differently from v2. A v2 recording a
 * student reopens stays on screen as it was recorded, says the engine changed, and Reproduce
 * explains why it cannot run instead of silently re-executing it under v3.
 */
const signals = [
  { id: 'a', label: 'A', direction: 'in' as const, nodeId: 'input' },
  { id: 'y', label: 'Y', direction: 'out' as const, nodeId: 'output' },
];
const vectors = [
  { id: 'a0', tick: 0, inputs: { a: 0 as const }, expected: {} },
  { id: 'a1', tick: 1, inputs: { a: 1 as const }, expected: {} },
];

function recording(engine: string): RuntimeVerifyRun {
  const report = buildVerifyReport({ scenarioId: 'a', scenarioName: 'Default', status: 'pass', deterministicHash: 'design',
    generatedAtIso: '2026-10-27T00:00:00.000Z', rows: [], vectors, signalRoles: { a: 'input', y: 'output' } });
  return {
    runId: `run-${engine}`, sequence: 1, projectId: 'engine-project', scenarioId: 'a', scenarioName: 'Default',
    runKind: 'trace', assertionStatus: 'not-configured', status: 'pass', deterministicHash: 'design',
    reportHash: report.reportHash, generatedAtIso: report.generatedAtIso, schedule: 'combinational', report,
    meta: { circuitKind: 'combinational', clockingProtocol: null, samplePoint: 'steady-state', tick0Meaning: null, clockSignalName: null },
    identity: { design: 'd', stimulus: 's', engine }, outputDigest: 'aaaaaaaa',
    executionInput: { ioRows: [], vectors, projectHash: 'h' },
    circuitSnapshot: { nodes: [], connections: [] },
    waveform: vectors.map((vector) => ({ tick: vector.tick, signals: { a: String(vector.inputs.a), y: '0' }, mismatches: [] })),
  };
}

function surface(run: RuntimeVerifyRun) {
  return render(<VerifySurface
    projectId="engine-project" activeScenarioId="a" hasVectors vectors={vectors}
    mappedInputs={[{ id: 'a', label: 'A' }]} mappedSignals={signals}
    deterministicHash="design" lastRun={run} runArchive={[run]}
    onOpenProjectVectors={vi.fn()} onRunVerification={vi.fn()}
  />);
}

describe('a recording from another engine version', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useEngineeringSelection.getState().clear();
    workspacePreferencesStore.resetSimulateLayout();
  });
  afterEach(cleanup);

  it('reads "Engine changed", keeps its recorded engine, and is not reproduced under v3', () => {
    const view = surface(recording('redbyte-browser-v2'));
    expect(view.getByTestId('ide-run-input-changes').textContent).toContain('Engine changed');
    expect(view.getByTestId('ide-run-engine-digest').getAttribute('data-digest')).toBe('redbyte-browser-v2');
    const reproduce = view.getByTestId('ide-vcb-reproduce') as HTMLButtonElement;
    expect(reproduce.disabled).toBe(true);
    expect(reproduce.title).toBe('The recorded engine is unavailable.');
  });

  it('says nothing changed for a recording made by today\'s engine', () => {
    const view = surface(recording(BROWSER_ENGINE_VERSION));
    expect(view.queryByTestId('ide-run-input-changes')?.textContent ?? '').not.toContain('Engine changed');
    expect((view.getByTestId('ide-vcb-reproduce') as HTMLButtonElement).disabled).toBe(false);
  });
});
