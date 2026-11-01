import type { DeterministicVerifyResult } from './simEngineCore';
import type { VerificationComputeRequest } from './verificationCompute';

export interface VerificationWorkerResult {
  result: DeterministicVerifyResult | null;
  computeMs: number;
  startedAt: number;
  completedAt: number;
  receivedAt: number;
  requestTransferMs: number;
}
export interface VerificationJob { result: Promise<VerificationWorkerResult>; cancel: () => void }
export type VerificationWorkerFactory = () => Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;
const defaultFactory: VerificationWorkerFactory = () => {
  if (typeof Worker === 'undefined') throw new Error('Cancellable simulation is unavailable in this browser. Enable module workers and try again.');
  return new Worker(new URL('./verification.worker.ts', import.meta.url), { type: 'module', name: 'RedByte simulation' });
};

/** One dedicated worker per explicit Run. Termination interrupts its real synchronous loop. */
export function startVerificationWorker(requestId: string, request: VerificationComputeRequest, onStarted: (startedAt: number, completedCases?: number) => void,
  factory: VerificationWorkerFactory = defaultFactory): VerificationJob {
  let worker: ReturnType<VerificationWorkerFactory> | undefined;
  let settled = false;
  let rejectJob!: (reason: Error) => void;
  const dispose = () => { if (worker) { worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate(); } };
  const result = new Promise<VerificationWorkerResult>((resolve, reject) => {
    rejectJob = reject;
    const fail = (error: Error) => { if (settled) return; settled = true; dispose(); reject(error); };
    try {
      worker = factory();
      worker.onerror = event => { event.preventDefault?.(); fail(new Error(event.message || 'Simulation worker failed. Try Run again.')); };
      worker.onmessageerror = () => fail(new Error('Simulation result could not be transferred. Try Run again.'));
      let requestTransferMs = 0;
      worker.onmessage = ({ data }) => {
        if (settled || data?.requestId !== requestId) return;
        if (data.kind === 'started') { onStarted(data.startedAt); return; }
        if (data.kind === 'progress' && Number.isInteger(data.completedCases) && data.completedCases > 0) { onStarted(data.startedAt, data.completedCases); return; }
        if (data.kind === 'error') { fail(new Error(data.message || 'Simulation failed.')); return; }
        if (data.kind !== 'complete' || !Number.isFinite(data.computeMs) || !Number.isFinite(data.completedAt)
          || (data.result !== null && (!Array.isArray(data.result?.trace) || !Array.isArray(data.result?.rows) || !data.result?.evidence))) {
          fail(new Error('Simulation returned an invalid result. Try Run again.')); return;
        }
        settled = true;
        dispose();
        resolve({ ...data, receivedAt: performance.timeOrigin + performance.now(), requestTransferMs });
      };
      const before = performance.now();
      worker.postMessage({ requestId, request });
      requestTransferMs = performance.now() - before;
    } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  });
  return { result, cancel: () => {
    if (settled) return;
    settled = true; dispose(); rejectJob(new Error('Simulation cancelled.'));
  } };
}
