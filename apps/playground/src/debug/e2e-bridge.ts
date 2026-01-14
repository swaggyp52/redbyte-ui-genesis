// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// E2E-only debug bridge for exercising mutation guards in tests

type CircuitStoreModule = typeof import('@redbyte/rb-apps/stores/circuitStore');

export function installE2EBridge() {
  if (typeof window === 'undefined') return;
  const win = window as any;
  if (win.__RB_E2E__) return;

  let ready = false;
  let mod: CircuitStoreModule | null = null;

  const readyPromise: Promise<void> = import('@redbyte/rb-apps/stores/circuitStore')
    .then((m) => {
      mod = m as CircuitStoreModule;
      ready = true;
      console.info('RB_E2E_STORE_READY');
    })
    .catch((err) => {
      console.error('RB_E2E_STORE_LOAD_ERROR', err);
      // keep ready=false
    });

  const getStore = () => {
    if (!mod) return null;
    return mod.useCircuitStore.getState();
  };

  const getNodeCount = () => {
    const s = getStore();
    return s ? s.circuit.nodes.length : -1;
  };

  const addNodes = (count: number) => {
    const s = getStore();
    if (!s) return -1;
    for (let i = 0; i < count; i++) {
      s.addNode('NOT', { x: 80 + i * 12, y: 120 });
    }
    return getNodeCount();
  };

  const resetWorkspace = () => {
    const s = getStore();
    if (!s) return -1;
    if (typeof (s as any).reset === 'function') (s as any).reset();
    else s.updateCircuit({ nodes: [], connections: [] }, true);
    return getNodeCount();
  };

  const loadCircuitForTest = (circuit: any) => {
    const s = getStore();
    if (!s) return -1;
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
