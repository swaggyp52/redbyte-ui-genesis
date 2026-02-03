// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// E2E-only debug bridge for exercising mutation guards in tests
export function installE2EBridge() {
    if (typeof window === 'undefined')
        return;
    const win = window;
    if (win.__RB_E2E__)
        return;
    let ready = false;
    let mod = null;
    const readyPromise = import('@redbyte/rb-apps/stores/circuitStore')
        .then((m) => {
        mod = m;
        ready = true;
        console.info('RB_E2E_STORE_READY');
    })
        .catch((err) => {
        console.error('RB_E2E_STORE_LOAD_ERROR', err);
        // keep ready=false
    });
    const getStore = () => {
        if (!mod)
            return null;
        return mod.useCircuitStore.getState();
    };
    const getNodeCount = () => {
        const s = getStore();
        return s ? s.circuit.nodes.length : -1;
    };
    const addNodes = (count) => {
        const s = getStore();
        if (!s)
            return -1;
        for (let i = 0; i < count; i++) {
            s.addNode('NOT', { x: 80 + i * 12, y: 120 });
        }
        return getNodeCount();
    };
    const resetWorkspace = () => {
        const s = getStore();
        if (!s)
            return -1;
        if (typeof s.reset === 'function')
            s.reset();
        else
            s.updateCircuit({ nodes: [], connections: [] }, true);
        return getNodeCount();
    };
    const loadCircuitForTest = (circuit) => {
        const s = getStore();
        if (!s)
            return -1;
        s.updateCircuit(circuit, true);
        return getNodeCount();
    };
    win.__RB_E2E__ = {
        // sync readiness
        isReady: () => ready,
        // async escape hatch if you ever want it
        readyPromise,
        // actions
        getNodeCount,
        addNodes,
        resetWorkspace,
        loadCircuitForTest,
    };
    console.info('RB_E2E_BRIDGE_INSTALLED');
}
