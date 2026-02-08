export const createLogicPlaygroundSignalSource = () => ({
    listSignals: () => [],
    resolveSignal: () => null,
    sample: () => 0,
    getHistory: (_signal, _tickFrom, _tickTo, _stride) => [],
    getMetadata: () => undefined,
    locate: () => undefined,
});
