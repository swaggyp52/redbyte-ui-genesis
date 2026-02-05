export function decideExecutionSourceOnHardwareState(executionSource, connectionState) {
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

