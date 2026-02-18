/**
 * IdeContext — Shared context provider for all IDE modes.
 *
 * This is the single source of truth across Project / Design / Verify / Export / Import modes.
 * Each mode reads from this context rather than prop-drilling through LogicPlaygroundApp.
 *
 * Zustand stores (circuitStore, probeStore, layoutStore, etc.) remain global singletons;
 * this context holds the IDE-level state that doesn't belong in any single store.
 */

import React, { createContext, useContext } from 'react';
import type { CircuitEngine, TickEngine, Circuit, Node, Connection } from '@redbyte/rb-logic-core';
import type { ToastKind } from '@redbyte/rb-primitives';
import type { RBProject, RBFpgaConfig } from '../../export/projectFormat';
import type { ToolchainProjectInput } from '../../fpga/toolchainBackend';

// ── IDE Mode ──────────────────────────────────────────────────────────────────
export type IDEMode = 'project' | 'design' | 'verify' | 'export' | 'import';

// ── Context value ─────────────────────────────────────────────────────────────
export interface IdeContextValue {
  // ── Mode ──
  ideMode: IDEMode;
  setIdeMode: (mode: IDEMode) => void;

  // ── Engines ──
  engine: CircuitEngine | undefined;
  tickEngine: TickEngine | undefined;

  // ── Circuit ──
  circuit: Circuit;
  handleCircuitChange: (circuit: Circuit) => void;

  // ── Project metadata ──
  projectName: string;
  setProjectName: (name: string) => void;
  projectId: string;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;

  // ── Simulation ──
  isRunning: boolean;
  tickCount: number;
  currentHz: number;
  handleRun: () => void;
  handlePause: () => void;
  handleStep: () => void;
  handleHzChange: (hz: number) => void;
  handleResetTickCount: () => void;

  // ── HDL / FPGA ──
  hdlProject: ToolchainProjectInput | undefined;
  setHdlProject: (p: ToolchainProjectInput) => void;
  fpgaProject: RBFpgaConfig | undefined;
  setFpgaProject: (p: RBFpgaConfig) => void;
  enableHdlTab: boolean;

  // ── Project build / apply ──
  buildProject: () => RBProject;
  applyProject: (project: RBProject) => void;

  // ── Toast (UI feedback) ──
  addToast: (message: string, kind: ToastKind, durationMs?: number) => void;
}

// ── React context ─────────────────────────────────────────────────────────────
const IdeContext = createContext<IdeContextValue | null>(null);

/**
 * Hook to consume the IDE context. Throws if used outside IdeProvider.
 */
export function useIde(): IdeContextValue {
  const ctx = useContext(IdeContext);
  if (!ctx) {
    throw new Error('useIde() must be called inside <IdeProvider>');
  }
  return ctx;
}

export const IdeProvider = IdeContext.Provider;
export { IdeContext };
