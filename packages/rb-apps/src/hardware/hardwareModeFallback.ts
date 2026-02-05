import type { ExecutionSource } from './capsuleFormat';

export type HardwareConnectionState =
  | 'disconnected'
  | 'discovering'
  | 'connecting'
  | 'ready'
  | 'error';

export type HardwareFallbackToast = {
  title: string;
  message: string;
};

export type HardwareFallbackDecision = {
  nextSource: ExecutionSource;
  shouldFallback: boolean;
  toast?: HardwareFallbackToast;
};

export function decideExecutionSourceOnHardwareState(
  executionSource: ExecutionSource,
  connectionState: HardwareConnectionState,
): HardwareFallbackDecision {
  if (executionSource !== 'hardware') {
    return { nextSource: executionSource, shouldFallback: false };
  }

  if (connectionState === 'disconnected' || connectionState === 'error') {
    return {
      nextSource: 'sim',
      shouldFallback: true,
      toast: {
        title: 'Bridge disconnected',
        message: 'Bridge disconnected — returned to Simulation.',
      },
    };
  }

  return { nextSource: executionSource, shouldFallback: false };
}

