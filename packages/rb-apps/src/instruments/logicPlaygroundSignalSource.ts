import type { SignalSample, SignalSource } from '@redbyte/rb-instruments';

export const createLogicPlaygroundSignalSource = (): SignalSource => ({
    listSignals: () => [],
    resolveSignal: () => null,
    sample: () => 0,
    getHistory: (_signal, _tickFrom, _tickTo, _stride): SignalSample[] => [],
    getMetadata: () => undefined,
    locate: () => undefined,
});
