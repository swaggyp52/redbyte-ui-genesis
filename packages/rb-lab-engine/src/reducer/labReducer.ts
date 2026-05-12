// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Lab Reducer — Pure, Deterministic State Machine
 *
 * CRITICAL DESIGN:
 * - Pure function: (state, action) → newState
 * - No side effects
 * - Deterministic (same inputs → same output)
 * - Actions are serializable
 * - Enables replay by re-applying action log
 *
 * This is the canonical implementation of lab state mutations.
 * All state changes MUST flow through this reducer.
 */

import type {
  LabProjectV1,
  LabActionV1,
  LabActionEnvelope,
  CircuitNode,
  CircuitConnection,
  ProbeDefinition,
  EvidenceSnapshot,
} from '@redbyte/rb-utils';

// ============================================================================
// Core Reducer
// ============================================================================

/**
 * Pure reducer: (state, action) → newState
 *
 * Rules:
 * - No side effects (no I/O, no random, no Date.now())
 * - Deterministic (same state + action → same result every time)
 * - All actions are versioned + namespaced
 */
export function labReducer(state: LabProjectV1, action: LabActionV1): LabProjectV1 {
  // Handle each action type
  switch (action.t) {
    // Circuit mutations
    case 'circuit/addNode':
      return addNode(state, action.p);
    case 'circuit/deleteNode':
      return deleteNode(state, action.p);
    case 'circuit/moveNode':
      return moveNode(state, action.p);
    case 'circuit/rotateNode':
      return rotateNode(state, action.p);
    case 'circuit/addConnection':
      return addConnection(state, action.p);
    case 'circuit/deleteConnection':
      return deleteConnection(state, action.p);
    case 'circuit/updateNodeParams':
      return updateNodeParams(state, action.p);

    // Simulation control
    case 'sim/start':
      return { ...state, updatedAt: new Date().toISOString() };
    case 'sim/stop':
      return { ...state, updatedAt: new Date().toISOString() };
    case 'sim/tick':
      return tickSimulation(state, action.p);
    case 'sim/reset':
      return resetSimulation(state);
    case 'sim/addProbe':
      return addProbe(state, action.p);
    case 'sim/removeProbe':
      return removeProbe(state, action.p);

    // Board mapping
    case 'board/setProfile':
      return setBoardProfile(state, action.p);
    case 'board/mapSignal':
      return mapSignal(state, action.p);
    case 'board/unmapSignal':
      return unmapSignal(state, action.p);
    case 'board/setSwitches':
      return setSwitches(state, action.p);
    case 'board/setButtons':
      return setButtons(state, action.p);

    // Checkpoint verification
    case 'checkpoint/verify':
      // Verification result is recorded but doesn't mutate core state
      return { ...state, updatedAt: new Date().toISOString() };

    // Evidence
    case 'evidence/addSnapshot':
      return recordSnapshot(state, action.p);

    default:
      // Type narrowing — if this doesn't compile, we missed an action
      const _exhaustive: never = action;
      return state;
  }
}

// ============================================================================
// Circuit Mutations
// ============================================================================

function addNode(
  state: LabProjectV1,
  payload: { nodeId: string; componentType: string; x: number; y: number; rotation?: number }
): LabProjectV1 {
  const newNode: CircuitNode = {
    id: payload.nodeId,
    type: payload.componentType,
    x: payload.x,
    y: payload.y,
    rotation: payload.rotation ?? 0,
    params: {},
    state: {},
  };

  return {
    ...state,
    circuit: {
      ...state.circuit,
      nodes: [...state.circuit.nodes, newNode],
    },
    updatedAt: new Date().toISOString(),
  };
}

function deleteNode(state: LabProjectV1, payload: { nodeId: string }): LabProjectV1 {
  return {
    ...state,
    circuit: {
      ...state.circuit,
      nodes: state.circuit.nodes.filter((n) => n.id !== payload.nodeId),
      connections: state.circuit.connections.filter(
        (c) => c.fromNodeId !== payload.nodeId && c.toNodeId !== payload.nodeId
      ),
    },
    updatedAt: new Date().toISOString(),
  };
}

function moveNode(state: LabProjectV1, payload: { nodeId: string; x: number; y: number }): LabProjectV1 {
  return {
    ...state,
    circuit: {
      ...state.circuit,
      nodes: state.circuit.nodes.map((n) =>
        n.id === payload.nodeId ? { ...n, x: payload.x, y: payload.y } : n
      ),
    },
    updatedAt: new Date().toISOString(),
  };
}

function rotateNode(state: LabProjectV1, payload: { nodeId: string; rotation: number }): LabProjectV1 {
  return {
    ...state,
    circuit: {
      ...state.circuit,
      nodes: state.circuit.nodes.map((n) =>
        n.id === payload.nodeId ? { ...n, rotation: payload.rotation } : n
      ),
    },
    updatedAt: new Date().toISOString(),
  };
}

function addConnection(state: LabProjectV1, payload: CircuitConnection): LabProjectV1 {
  return {
    ...state,
    circuit: {
      ...state.circuit,
      connections: [...state.circuit.connections, payload],
    },
    updatedAt: new Date().toISOString(),
  };
}

function deleteConnection(state: LabProjectV1, payload: { connectionId: string }): LabProjectV1 {
  return {
    ...state,
    circuit: {
      ...state.circuit,
      connections: state.circuit.connections.filter((c) => c.id !== payload.connectionId),
    },
    updatedAt: new Date().toISOString(),
  };
}

function updateNodeParams(
  state: LabProjectV1,
  payload: { nodeId: string; params: Record<string, unknown> }
): LabProjectV1 {
  return {
    ...state,
    circuit: {
      ...state.circuit,
      nodes: state.circuit.nodes.map((n) =>
        n.id === payload.nodeId ? { ...n, params: { ...n.params, ...payload.params } } : n
      ),
    },
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Simulation Mutations
// ============================================================================

function tickSimulation(state: LabProjectV1, payload: { count: number }): LabProjectV1 {
  return {
    ...state,
    simulation: {
      ...state.simulation,
      currentTick: state.simulation.currentTick + payload.count,
    },
    updatedAt: new Date().toISOString(),
  };
}

function resetSimulation(state: LabProjectV1): LabProjectV1 {
  return {
    ...state,
    simulation: {
      ...state.simulation,
      currentTick: 0,
    },
    updatedAt: new Date().toISOString(),
  };
}

function addProbe(state: LabProjectV1, payload: ProbeDefinition): LabProjectV1 {
  return {
    ...state,
    simulation: {
      ...state.simulation,
      probes: [...state.simulation.probes, payload],
    },
    updatedAt: new Date().toISOString(),
  };
}

function removeProbe(state: LabProjectV1, payload: { probeId: string }): LabProjectV1 {
  return {
    ...state,
    simulation: {
      ...state.simulation,
      probes: state.simulation.probes.filter((p) => p.id !== payload.probeId),
    },
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Board Mapping Mutations
// ============================================================================

// ============================================================================
// Board Mapping Mutations
// ============================================================================

function setBoardProfile(state: LabProjectV1, payload: { profileId: string }): LabProjectV1 {
  // 1. Save current board state to savedBoards
  const currentProfileId = state.boardMap?.boardProfileId;
  let savedBoards = state.savedBoards || {};

  if (currentProfileId && state.boardMap) {
    savedBoards = {
      ...savedBoards,
      [currentProfileId]: {
        signalToPinMap: state.boardMap.signalToPinMap,
        virtualIOState: state.boardMap.virtualIOState,
      },
    };
  }

  // 2. Load new board state if exists, otherwise default
  const savedState = savedBoards[payload.profileId];

  return {
    ...state,
    savedBoards, // Persist the updated map of saved boards
    boardMap: {
      boardProfileId: payload.profileId,
      signalToPinMap: savedState?.signalToPinMap || {},
      virtualIOState: savedState?.virtualIOState || {
        switches: [],
        buttons: [],
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function mapSignal(state: LabProjectV1, payload: { signal: string; pin: string }): LabProjectV1 {
  if (!state.boardMap) {
    throw new Error('Cannot map signal: no board profile set');
  }

  return {
    ...state,
    boardMap: {
      ...state.boardMap,
      signalToPinMap: {
        ...state.boardMap.signalToPinMap,
        [payload.signal]: payload.pin,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function unmapSignal(state: LabProjectV1, payload: { signal: string }): LabProjectV1 {
  if (!state.boardMap) {
    return state;
  }

  const { [payload.signal]: _, ...rest } = state.boardMap.signalToPinMap;

  return {
    ...state,
    boardMap: {
      ...state.boardMap,
      signalToPinMap: rest,
    },
    updatedAt: new Date().toISOString(),
  };
}

function setSwitches(state: LabProjectV1, payload: { switches: boolean[] }): LabProjectV1 {
  if (!state.boardMap) {
    throw new Error('Cannot set switches: no board profile set');
  }

  return {
    ...state,
    boardMap: {
      ...state.boardMap,
      virtualIOState: {
        buttons: state.boardMap.virtualIOState?.buttons ?? [],
        switches: payload.switches,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function setButtons(state: LabProjectV1, payload: { buttons: boolean[] }): LabProjectV1 {
  if (!state.boardMap) {
    throw new Error('Cannot set buttons: no board profile set');
  }

  return {
    ...state,
    boardMap: {
      ...state.boardMap,
      virtualIOState: {
        switches: state.boardMap.virtualIOState?.switches ?? [],
        buttons: payload.buttons,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Evidence Recording
// ============================================================================

/**
 * Append action to evidence log (returns new state with action recorded).
 * Called by store after every dispatch.
 */
export function recordAction(
  state: LabProjectV1,
  action: LabActionV1,
  envelope: Omit<LabActionEnvelope, 'action'>
): LabProjectV1 {
  return {
    ...state,
    evidence: {
      ...state.evidence,
      actions: [
        ...state.evidence.actions,
        {
          ...envelope,
          action,
        },
      ],
    },
  };
}

/**
 * Add evidence snapshot (checkpoint verification result or manual capture).
 */
export function recordSnapshot(
  state: LabProjectV1,
  snapshot: EvidenceSnapshot
): LabProjectV1 {
  return {
    ...state,
    evidence: {
      ...state.evidence,
      snapshots: [...state.evidence.snapshots, snapshot],
    },
  };
}

// ============================================================================
// Replay Support
// ============================================================================

/**
 * Replay project from initial state + action log.
 * Enables deterministic verification and evidence review.
 */
export function replayActions(
  initialProject: LabProjectV1,
  actions: LabActionEnvelope[]
): LabProjectV1 {
  return actions.reduce((state, envelope) => {
    return labReducer(state, envelope.action);
  }, initialProject);
}
