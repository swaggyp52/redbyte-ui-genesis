// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { Circuit, CircuitEngine } from '@redbyte/rb-logic-core';
import type { TickEngine } from '@redbyte/rb-logic-core';

interface CircuitState {
  circuit: Circuit;
  engine: CircuitEngine | null;
  tickEngine: TickEngine | null;
  updateCircuit: (circuit: Circuit) => void;
  setEngine: (engine: CircuitEngine) => void;
  setTickEngine: (tickEngine: TickEngine) => void;
}

export const useCircuitStore = create<CircuitState>((set, get) => ({
  circuit: { nodes: [], connections: [] },
  engine: null,
  tickEngine: null,

  updateCircuit: (circuit: Circuit) => {
    const { engine, tickEngine } = get();
    set({ circuit });
    engine?.setCircuit(circuit);
    tickEngine?.setCircuit(circuit);
  },

  setEngine: (engine: CircuitEngine) => set({ engine }),
  setTickEngine: (tickEngine: TickEngine) => set({ tickEngine }),
}));
