import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectRuntime, type RunVerificationInput, type RuntimeVerifyRun } from '../projectRuntime';
import { computeVerification } from '../sim/verificationCompute';
import { buildHierarchicalRippleAdder } from '../examples/hierarchicalRippleAdder';
import type { RBProject } from '../../../export/projectFormat';

const workers: ControlledWorker[] = [];
class ControlledWorker {
  onmessage: ((event: { data: any }) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  request: any;
  terminated = false;
  delivery: ((event: { data: any }) => void) | null = null;
  constructor() { workers.push(this); }
  postMessage(message: any) { this.request = structuredClone(message); this.delivery = this.onmessage; this.onmessage?.({ data: { kind: 'started', requestId: message.requestId, startedAt: performance.timeOrigin + performance.now() } }); }
  terminate() { this.terminated = true; }
  complete(late = false) {
    const completedAt = performance.timeOrigin + performance.now();
    (late ? this.delivery : this.onmessage)?.({ data: { kind: 'complete', requestId: this.request.requestId, result: computeVerification(this.request.request), startedAt: completedAt - 1, completedAt, computeMs: 1 } });
  }
}
const rt = () => useProjectRuntime.getState();
const input = (captureEvaluations = true): RunVerificationInput => ({ scenarioId: rt().activeScenarioId, scenarioName: 'test', deterministicHash: 'stable', vectors: rt().projectVectors, rows: [], captureEvaluations, ranAtIso: '2026-10-08T12:00:00.000Z' });
const evidence = () => JSON.stringify({ archive: rt().verifyRunArchive, history: rt().verifyRunHistory, last: rt().verifyLastRun, health: rt().projectHealthCore, authority: rt().scenarioAuthority });
const semantic = (run: RuntimeVerifyRun) => Object.fromEntries(['identity', 'outputDigest', 'runKind', 'status', 'simulationStatus', 'assertionStatus', 'scenarioContentHash', 'scenarioStimulusHash', 'mappingEvidenceHash', 'scheduleContract', 'clockPolicy', 'meta', 'report', 'waveform', 'nativeTrace', 'evidence', 'evaluationTrace', 'circuitSnapshot', 'elaborationSources', 'hierarchySnapshot', 'generatedSource', 'executionInput'].map(key => [key, run[key as keyof RuntimeVerifyRun]]));
async function started() { await vi.waitFor(() => expect(workers.length).toBeGreaterThan(0)); return workers.at(-1)!; }
async function completed(worker: ControlledWorker) { worker.complete(); await vi.waitFor(() => expect(rt().verificationExecution.status).toBe('complete')); }

beforeEach(() => { rt().cancelVerification(); workers.length = 0; vi.stubGlobal('Worker', ControlledWorker); rt().loadExample('half-adder'); });
afterEach(() => { rt().cancelVerification(); vi.unstubAllGlobals(); });

describe('worker computation and atomic recording admission', () => {
  for (const fixture of ['half-adder', 'counter', 'hierarchy']) for (const capture of [false, true]) {
    it(`matches reference outputs, verdict, phases and semantic artifacts: ${fixture}, capture ${capture}`, async () => {
      if (fixture === 'counter') rt().loadExample('two-bit-counter');
      if (fixture === 'hierarchy') {
        const f = buildHierarchicalRippleAdder();
        rt().loadFromProject({ kind: 'rb-project', version: 1, name: 'hierarchy', circuit: f.circuit, hierarchy: f.hierarchy,
          vectors: f.vectors, ioMapping: { inputs: f.ioRows.filter(row => row.direction === 'in'), outputs: f.ioRows.filter(row => row.direction === 'out') } } as any);
      }
      const request = input(capture);
      const reference = rt().runVerification(request);
      rt().startVerification(request);
      const worker = await started();
      expect(rt().verifyLastRun?.runId).toBe(reference.runId);
      await completed(worker);
      expect(semantic(rt().verifyLastRun!)).toEqual(semantic(reference));
      expect(rt().verifyLastRun?.sequence).toBe((reference.sequence ?? 0) + 1);
      expect(rt().verifyRunHistory.at(-1)?.runId).toBe(rt().verifyLastRun?.runId);
      expect(worker.terminated).toBe(true);
    });
  }

  it('single-flights duplicate Runs, interrupts computation, rejects delivery immediately before completion and recovers', async () => {
    rt().runVerification(input()); const before = evidence();
    rt().startVerification(input()); rt().startVerification(input());
    const worker = await started(); expect(workers).toHaveLength(1);
    rt().cancelVerification(); expect(worker.terminated).toBe(true);
    worker.complete(true); await Promise.resolve();
    expect(rt().verificationExecution.status).toBe('cancelled'); expect(evidence()).toBe(before);
    rt().startVerification(input()); await vi.waitFor(() => expect(workers).toHaveLength(2));
    worker.complete(true); expect(rt().verificationExecution.status).toBe('computing');
    await completed(workers[1]); expect(rt().verifyRunArchive).toHaveLength(2);
    rt().cancelVerification(); expect(rt().verificationExecution.status).toBe('complete');
  });

  for (const mutation of ['vectors', 'mapping', 'circuit replacement', 'scenario', 'clear', 'project']) {
    it(`rejects obsolete response after ${mutation} without admitting partial evidence`, async () => {
      rt().runVerification(input()); rt().startVerification(input()); const worker = await started();
      if (mutation === 'vectors') rt().setVectors(rt().projectVectors.map((v, i) => i ? v : { ...v, inputs: { ...v.inputs, SW0: 1 } }));
      if (mutation === 'mapping') useProjectRuntime.setState({ projectIoRows: rt().projectIoRows.map((r, i) => i ? r : { ...r, pin: 'V17' }) });
      if (mutation === 'scenario') useProjectRuntime.setState({ activeScenarioId: 'changed' });
      if (mutation === 'clear') rt().clearVerification();
      if (mutation === 'circuit replacement') useProjectRuntime.setState({ circuit: structuredClone(rt().circuit) });
      if (mutation === 'project') rt().loadExample('full-adder');
      const afterMutation = evidence(); worker.complete(true); await Promise.resolve();
      expect(evidence()).toBe(afterMutation); expect(worker.terminated).toBe(true); expect(rt().verificationExecution.status).toBe('cancelled');
    });
  }

  it('invalidates an actual same-ID loadFromProject, preserves restored evidence, and runs again', async () => {
    const original = rt().runVerification(input());
    const saved = rt();
    const project: RBProject = {
      kind: 'rb-project', version: 1, name: saved.projectName,
      createdAt: '2026-10-08T12:00:00.000Z', updatedAt: '2026-10-08T12:00:00.000Z',
      meta: { projectId: saved.projectId, projectKind: 'saved' },
      circuit: structuredClone(saved.circuit), hierarchy: structuredClone(saved.hierarchy),
      vectors: structuredClone(saved.projectVectors),
      ioMapping: { inputs: structuredClone(saved.projectIoRows.filter(row => row.direction === 'in')),
        outputs: structuredClone(saved.projectIoRows.filter(row => row.direction === 'out')) },
    };
    const testbench = structuredClone({ scenarios: saved.scenarios, activeScenarioId: saved.activeScenarioId });
    const workspace = structuredClone({ runEvidence: { lastRun: saved.verifyLastRun, archive: saved.verifyRunArchive,
      history: saved.verifyRunHistory, exportHistory: saved.exportHistory } });
    rt().startVerification(input());
    const obsoleteWorker = await started();
    rt().loadFromProject(project, testbench, workspace);
    expect(rt().projectId).toBe(saved.projectId);
    expect(rt().circuit).not.toBe(saved.circuit);
    expect(rt().verifyLastRun?.runId).toBe(original.runId);
    expect(rt().verifyRunArchive.map(run => run.runId)).toEqual([original.runId]);
    expect(rt().verificationExecution.status).toBe('cancelled');
    expect(obsoleteWorker.terminated).toBe(true);
    const restoredEvidence = evidence();
    obsoleteWorker.complete(true);
    await Promise.resolve();
    expect(evidence()).toBe(restoredEvidence);
    rt().startVerification(input());
    await vi.waitFor(() => expect(workers).toHaveLength(2));
    obsoleteWorker.complete(true);
    expect(rt().verificationExecution.status).toBe('computing');
    await completed(workers[1]);
    expect(rt().verifyRunArchive).toHaveLength(2);
    expect(rt().verifyLastRun?.projectId).toBe(saved.projectId);
    expect(rt().verifyLastRun?.sequence).toBe((original.sequence ?? 0) + 1);
  });

  it('keeps historical reproduction independent from current repaired design approval', async () => {
    const old = rt().runVerification(input());
    rt().setVectors(rt().projectVectors.map(v => ({ ...v, expected: {} })));
    const request = { ...input(), reproduceRunId: old.runId };
    const reference = rt().runVerification(request);
    rt().startVerification(request); await completed(await started());
    expect(semantic(rt().verifyLastRun!)).toEqual(semantic(reference)); expect(rt().projectHealthCore.dirtySinceVerify).toBe(true);
  });

  it('handles unavailable workers and execution failure distinctly, keeps evidence, and allows retry', async () => {
    rt().runVerification(input()); const before = evidence();
    vi.stubGlobal('Worker', undefined); rt().startVerification(input());
    await vi.waitFor(() => expect(rt().verificationExecution.status).toBe('error')); expect(evidence()).toBe(before);
    vi.stubGlobal('Worker', ControlledWorker); rt().startVerification(input()); const worker = await started();
    worker.onerror?.({ message: 'execution failed', preventDefault() {} });
    await vi.waitFor(() => expect(rt().verificationExecution.status).toBe('error')); expect(evidence()).toBe(before);
    rt().startVerification(input()); await vi.waitFor(() => expect(workers).toHaveLength(2)); await completed(workers[1]);
  });

  for (const fault of ['constructor', 'postMessage', 'messageerror', 'malformed completion', 'null completion']) {
    it(`keeps completed evidence and recovers after worker ${fault} failure`, async () => {
      const previous = rt().runVerification(input());
      const before = evidence();
      if (fault === 'constructor') vi.stubGlobal('Worker', class {
        constructor() { throw new Error('Module worker construction failed'); }
      });
      if (fault === 'postMessage') vi.stubGlobal('Worker', class extends ControlledWorker {
        postMessage() { throw new DOMException('Request could not be cloned', 'DataCloneError'); }
      });
      rt().startVerification(input());
      let failedWorker: ControlledWorker | undefined;
      if (fault !== 'constructor') {
        failedWorker = await started();
        if (fault === 'messageerror') failedWorker.onmessageerror?.();
        if (fault === 'malformed completion' || fault === 'null completion') {
          const now = performance.timeOrigin + performance.now();
          failedWorker.onmessage?.({ data: { kind: 'complete', requestId: failedWorker.request.requestId,
            computeMs: 1, startedAt: now - 1, completedAt: now,
            result: fault === 'null completion' ? null : { rows: [], trace: 'not-a-trace', evidence: {} } } });
        }
      }
      await vi.waitFor(() => expect(rt().verificationExecution.status).toBe('error'));
      expect(rt().verificationExecution.message).toMatch(/construction failed|could not be cloned|could not be transferred|invalid result|no completed samples/);
      expect(evidence()).toBe(before);
      if (failedWorker) {
        expect(failedWorker.terminated).toBe(true);
        if (fault !== 'postMessage') failedWorker.complete(true);
      }
      await Promise.resolve();
      expect(evidence()).toBe(before);
      expect(rt().verificationExecution.status).toBe('error');
      vi.stubGlobal('Worker', ControlledWorker);
      const previousWorkerCount = workers.length;
      rt().startVerification(input());
      await vi.waitFor(() => expect(workers).toHaveLength(previousWorkerCount + 1));
      await completed(workers.at(-1)!);
      expect(rt().verifyRunArchive).toHaveLength(2);
      expect(rt().verifyLastRun?.status).toBe('pass');
      expect(rt().verifyLastRun?.sequence).toBe((previous.sequence ?? 0) + 1);
    });
  }
});
