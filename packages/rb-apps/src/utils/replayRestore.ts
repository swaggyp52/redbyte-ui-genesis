// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, CircuitEngine, TickEngine } from '@redbyte/rb-logic-core';
import type { Camera, Selection } from '@redbyte/rb-logic-view';

export interface ReplayRestoreState {
  circuit: Circuit;
  engine: CircuitEngine;
  tickEngine: TickEngine;
  tickRate: number;
  isRunning: boolean;
  tickCount: number;
  viewState: {
    camera: Camera;
    selection: Selection;
  };
}

export interface ReplayRestoreSetters {
  setEngine: (engine: CircuitEngine) => void;
  setTickEngine: (tickEngine: TickEngine) => void;
  setCircuit: (circuit: Circuit) => void;
  setCurrentHz: (hz: number) => void;
  setTickCount: (tick: number) => void;
  setIsRunning: (running: boolean) => void;
}

export const restoreReplayState = (
  state: ReplayRestoreState,
  setters: ReplayRestoreSetters,
  viewStore: { setState: (partial: { camera: Camera; selection: Selection }) => void }
) => {
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
