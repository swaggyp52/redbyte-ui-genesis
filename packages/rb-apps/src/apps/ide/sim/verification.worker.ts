import { computeVerification, type VerificationComputeRequest } from './verificationCompute';

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<{ requestId: string; request: VerificationComputeRequest }>) => void;
  postMessage: (message: unknown) => void;
};
scope.onmessage = ({ data }) => {
  const startedAt = performance.timeOrigin + performance.now();
  scope.postMessage({ kind: 'started', requestId: data.requestId, startedAt });
  try {
    const result = computeVerification(data.request, completedCases => {
      if (completedCases === 1 || completedCases % 64 === 0) scope.postMessage({kind: 'progress', requestId: data.requestId, startedAt, completedCases});
    });
    const completedAt = performance.timeOrigin + performance.now();
    scope.postMessage({ kind: 'complete', requestId: data.requestId, result, startedAt, completedAt, computeMs: completedAt - startedAt });
  } catch (error) {
    scope.postMessage({ kind: 'error', requestId: data.requestId, message: error instanceof Error ? error.message : String(error) });
  }
};
