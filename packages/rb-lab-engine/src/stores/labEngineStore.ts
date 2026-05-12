// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Lab Engine Store — Zustand Orchestration Layer
 *
 * CRITICAL DESIGN:
 * - Thin layer over pure reducer + services
 * - Handles side effects (I/O, async operations)
 * - Maintains session-level state (project, isSimulating)
 * - Auto-records all actions to evidence log
 * - Provides high-level operations for UI (verifyCheckpoint, exportCapsule)
 *
 * The store delegates business logic to:
 * - labReducer (pure state mutations)
 * - services (verification, export, simulation)
 */

import { create } from 'zustand';
import type {
  LabProjectV1,
  LabActionV1,
  CheckpointResult,
  IntegrityResult,
  EvidenceSnapshot,
  CircuitV1,
  Checkpoint,
} from '@redbyte/rb-utils';
import { labReducer, recordAction, recordSnapshot } from '../reducer/labReducer';

// ============================================================================
// Store State
// ============================================================================

interface LabEngineState {
  project: LabProjectV1 | null;
  isSimulating: boolean;
  sessionId: string;

  // Core actions
  loadProject: (project: LabProjectV1) => void;
  dispatch: (action: LabActionV1) => void;

  // High-level operations (async)
  verifyCheckpoint: (checkpointId: string) => Promise<CheckpointResult>;
  exportCapsule: () => Promise<Blob>;
  importCapsule: (file: File) => Promise<{
    project: LabProjectV1;
    integrity: IntegrityResult;
  }>;
}

// ============================================================================
// Store Implementation
// ============================================================================

const SESSION_ID = crypto.randomUUID?.() ?? `s-${Date.now()}`;

export const useLabEngineStore = create<LabEngineState>((set, get) => ({
  project: null,
  isSimulating: false,
  sessionId: SESSION_ID,

  // -------------------------------------------------------------------------
  // Load Project
  // -------------------------------------------------------------------------

  loadProject: (project) => {
    set({ project });
  },

  // -------------------------------------------------------------------------
  // Dispatch Action (Core)
  // -------------------------------------------------------------------------

  dispatch: (action) => {
    const { project, sessionId } = get();
    if (!project) {
      console.warn('[LabEngineStore] Cannot dispatch action: no project loaded', action);
      return;
    }

    // Apply reducer
    let nextState = labReducer(project, action);

    // Record action to evidence
    nextState = recordAction(nextState, action, {
      timestamp: new Date().toISOString(),
      sessionId,
    });

    set({ project: nextState });
  },

  // -------------------------------------------------------------------------
  // Verify Checkpoint (Async)
  // -------------------------------------------------------------------------

  verifyCheckpoint: async (checkpointId) => {
    const { project, dispatch } = get();
    if (!project) throw new Error('No project loaded');

    const checkpoint = project.labSpec?.checkpoints.find((c) => c.id === checkpointId);
    if (!checkpoint) throw new Error(`Checkpoint ${checkpointId} not found`);
    if (!isConcreteCheckpoint(checkpoint)) {
      throw new Error(`Checkpoint ${checkpointId} is missing verifier configuration`);
    }

    // Import verification service dynamically (to avoid circular deps)
    const { verifyCheckpoint: verifyFn } = await import('../verification/verifyCheckpoint');

    // Run verification (service operates on (project, checkpoint spec))
    const result = await verifyFn(project, checkpoint);

    // Record verification attempt
    dispatch({
      v: 1,
      t: 'checkpoint/verify',
      p: { checkpointId, result },
    });

    // Record evidence snapshot if verification completed
    const snapshot: EvidenceSnapshot = {
      timestamp: new Date().toISOString(),
      checkpointId,
      tick: project.simulation.currentTick,
      probeValues: {}, // TODO: extract from simulation
      circuitHash: await hashCircuit(project.circuit),
      projectHash: await hashProject(project),
      boardState: project.boardMap?.virtualIOState
        ? {
            leds: [], // TODO: compute from circuit outputs
            switches: project.boardMap.virtualIOState.switches,
            buttons: project.boardMap.virtualIOState.buttons ?? [],
          }
        : undefined,
    };

    set(state => ({
      project: state.project ? recordSnapshot(state.project, snapshot) : state.project
    }));

    return result;
  },

  // -------------------------------------------------------------------------
  // Export Capsule (Async)
  // -------------------------------------------------------------------------

  exportCapsule: async () => {
    const { project } = get();
    if (!project) throw new Error('No project loaded');

    // Import export service dynamically
    const { exportEvidenceCapsule } = await import('../services/exportService');

    return exportEvidenceCapsule(project);
  },

  // -------------------------------------------------------------------------
  // Import Capsule (Async)
  // -------------------------------------------------------------------------

  importCapsule: async (file) => {
    // Import import service dynamically
    const { importEvidenceCapsule } = await import('../services/exportService');

    // Read file as blob
    const blob = new Blob([file], { type: file.type });

    // Import and verify
    const result = await importEvidenceCapsule(blob);

    // Load the imported project
    set({ project: result.project });

    return {
      project: result.project,
      integrity: result.integrity,
    };
  },
}));

// ============================================================================
// Helper Functions (Simple hashing to avoid circular dependency)
// ============================================================================

async function hashCircuit(circuit: CircuitV1): Promise<string> {
  const json = JSON.stringify(circuit, Object.keys(circuit).sort());
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return `sha256:${hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

async function hashProject(project: LabProjectV1): Promise<string> {
  const json = JSON.stringify(project, Object.keys(project).sort());
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return `sha256:${hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function isConcreteCheckpoint(checkpoint: NonNullable<LabProjectV1['labSpec']>['checkpoints'][number]): checkpoint is Checkpoint {
  return checkpoint.config !== undefined;
}
