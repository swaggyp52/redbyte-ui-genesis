export function installE2EBridge() {
  if (typeof window === 'undefined') return;
  const win = window as any;
  if (win.__RB_E2E__) return;

  let storePromise: Promise<any> | null = null;
  
  const getStore = async () => {
    if (!storePromise) {
      storePromise = import('@redbyte/rb-apps/stores/circuitStore').then(m => m.useCircuitStore);
    }
    return storePromise;
  };

  const getNodeCount = async () => {
    const useCircuitStore = await getStore();
    return useCircuitStore.getState().circuit.nodes.length;
  };

  const addNodes = async (count: number) => {
    const useCircuitStore = await getStore();
    const store = useCircuitStore.getState();
    for (let i = 0; i < count; i += 1) {
      store.addNode('NOT', { x: 80 + i * 12, y: 120 });
    }
    return useCircuitStore.getState().circuit.nodes.length;
  };

  const resetWorkspace = async () => {
    const useCircuitStore = await getStore();
    const store = useCircuitStore.getState();
    if (typeof store.reset === 'function') {
      store.reset();
    } else {
      store.updateCircuit({ nodes: [], connections: [] }, true);
    }
    return useCircuitStore.getState().circuit.nodes.length;
  };

  const isReady = async () => {
    try {
      await getStore();
      return true;
    } catch {
      return false;
    }
  };

  win.__RB_E2E__ = {
    addNodes,
    getNodeCount,
    resetWorkspace,
    isReady,
  };

  console.log('RB_E2E_BRIDGE_INSTALLED');
}
