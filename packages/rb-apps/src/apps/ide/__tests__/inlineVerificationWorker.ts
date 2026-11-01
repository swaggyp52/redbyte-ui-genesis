import { computeVerification } from '../sim/verificationCompute';

/**
 * A module-worker stand-in for jsdom, which has none: it runs the same computeVerification the
 * real worker runs and answers with the real worker's messages on a later task, so an app-level
 * test exercises Run end to end. Install with vi.stubGlobal('Worker', InlineVerificationWorker).
 */
export class InlineVerificationWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  private terminated = false;

  postMessage(message: { requestId: string; request: Parameters<typeof computeVerification>[0] }): void {
    const { requestId, request } = structuredClone(message);
    setTimeout(() => {
      if (this.terminated) return;
      const startedAt = performance.timeOrigin + performance.now();
      this.onmessage?.({ data: { kind: 'started', requestId, startedAt } });
      const result = computeVerification(request);
      const completedAt = performance.timeOrigin + performance.now();
      if (!this.terminated) this.onmessage?.({ data: { kind: 'complete', requestId, result, startedAt, completedAt, computeMs: completedAt - startedAt } });
    }, 0);
  }

  terminate(): void {
    this.terminated = true;
  }
}
