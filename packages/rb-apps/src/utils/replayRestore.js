// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
export const restoreReplayState = (state, setters, viewStore) => {
    setters.setEngine(state.engine);
    setters.setTickEngine(state.tickEngine);
    setters.setCircuit(state.circuit);
    setters.setCurrentHz(state.tickRate);
    setters.setTickCount(state.tickCount);
    setters.setIsRunning(state.isRunning);
    state.tickEngine.setTickRate(state.tickRate);
    if (state.isRunning) {
        state.tickEngine.start();
    }
    viewStore.setState({
        camera: state.viewState.camera,
        selection: {
            nodes: new Set(state.viewState.selection.nodes),
            wires: new Set(state.viewState.selection.wires),
        },
    });
};
