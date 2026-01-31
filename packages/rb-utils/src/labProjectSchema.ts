// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Lab Project Schema V1 — Canonical source of truth for unified lab environment
 *
 * CRITICAL DESIGN DECISIONS:
 * 1. All checkpoints are declarative data (NO FUNCTIONS) for serializability
 * 2. Actions are versioned + namespaced: { v: 1; t: 'circuit/addNode'; p: {...} }
 * 3. Evidence = action log (append-only) + sparse snapshots (checkpoints only)
 * 4. Circuit schema versioned independently from LabProject schema
 * 5. Board profiles loaded from JSON, not hardcoded
 */

// ============================================================================
// Core Circuit Schema (Versioned Independently)
// ============================================================================

export interface CircuitV1 {
  schemaVersion: '1.0';
  nodes: CircuitNode[];
  connections: CircuitConnection[];
  customChips?: CustomChip[];
}

export interface CircuitNode {
  id: string;
  type: string; // ComponentType: 'AND', 'OR', 'NOT', 'SWITCH', 'LED', 'CUSTOM', etc.
  x: number;
  y: number;
  rotation?: number; // degrees (default 0)
  params?: Record<string, unknown>; // Component-specific config
  label?: string;
  state?: Record<string, unknown>; // Runtime state (for sequential components)
}

export interface CircuitConnection {
  id: string;
  fromNodeId: string;
  fromPin: string;
  toNodeId: string;
  toPin: string;
}

export interface CustomChip {
  id: string;
  name: string;
  inputPins: string[];
  outputPins: string[];
  internalCircuit: CircuitV1;
}

// ============================================================================
// Lab Project Schema (Canonical Source of Truth)
// ============================================================================

export interface LabProjectV1 {
  schemaVersion: '1.0';
  projectId: string;
  name: string;
  description?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601

  // Core circuit (versioned independently)
  circuit: CircuitV1;

  // Simulation state
  simulation: {
    tickRate: number; // Hz
    currentTick: number; // Integer only (deterministic)
    probes: ProbeDefinition[];
    breakpoints?: number[]; // Tick numbers
  };

  // Board mapping (for Deploy mode)
  boardMap?: {
    boardProfileId: string; // "basys3" | "nexys4" (loaded from JSON)
    signalToPinMap: Record<string, string>; // signal name → pin ID
    virtualIOState?: {
      switches: boolean[];
      buttons: boolean[];
    };
  };

  // Lab spec (if this is a structured lab)
  labSpec?: LabSpecV1;

  // Evidence (action log + sparse snapshots)
  evidence: {
    actions: LabActionEnvelope[]; // Append-only action log
    snapshots: EvidenceSnapshot[]; // Sparse snapshots (checkpoints only)
    manifest?: EvidenceManifest; // SHA256 integrity (on export)
  };
}

// ============================================================================
// Simulation Probes
// ============================================================================

export interface ProbeDefinition {
  id: string;
  signal: string; // Node output to probe (e.g., "node123.Q")
  label?: string;
  color?: string;
}

// ============================================================================
// Lab Spec Schema (Declarative, Serializable)
// ============================================================================

export interface LabSpecV1 {
  labId: string;
  title: string;
  description?: string;
  steps: LabStep[];
  checkpoints: Checkpoint[];
  constraints?: LabConstraints;
}

export interface LabStep {
  id: string;
  title: string;
  description: string;
  hints?: string[];
  requiredProbes?: string[];
  estimatedMinutes?: number;
}

export interface LabConstraints {
  maxComponents?: number;
  allowedComponentTypes?: string[];
  prohibitedComponentTypes?: string[];
  timeLimit?: number; // minutes
}

// ============================================================================
// Checkpoint Schema (Declarative — NO FUNCTIONS)
// ============================================================================

export type Checkpoint =
  | TruthTableCheckpoint
  | WaveformCheckpoint
  | TestVectorCheckpoint
  | BoardIOCheckpoint
  | CustomCheckpoint;

export interface TruthTableCheckpoint {
  id: string;
  stepId: string;
  type: 'truth-table';
  spec: {
    inputs: string[]; // Signal names
    outputs: string[];
    expectedTable: TruthTableRow[];
  };
}

export interface TruthTableRow {
  [signal: string]: number | boolean; // 0/1 or false/true
}

export interface WaveformCheckpoint {
  id: string;
  stepId: string;
  type: 'waveform';
  spec: {
    signals: string[];
    ticks: number;
    expectedWaveforms: Record<string, number[]>; // signal → values per tick
    tolerance?: { timingTicks?: number };
  };
}

export interface TestVectorCheckpoint {
  id: string;
  stepId: string;
  type: 'test-vector';
  spec: {
    vectors: TestVector[]; // Input patterns + expected outputs
  };
}

export interface TestVector {
  inputs: Record<string, number | boolean>;
  outputs: Record<string, number | boolean>;
  ticksToStabilize?: number;
}

export interface BoardIOCheckpoint {
  id: string;
  stepId: string;
  type: 'board-io';
  spec: {
    inputSwitches: boolean[]; // Virtual switch states to apply
    expectedLEDs: boolean[]; // Expected LED states after simulation
    ticksToStabilize?: number; // Allow N ticks for circuit to settle
  };
}

export interface CustomCheckpoint {
  id: string;
  stepId: string;
  type: 'custom';
  spec: {
    customSpecId: string; // "ece347.lab3.partB" (registered verifier)
    params?: Record<string, unknown>;
  };
}

// ============================================================================
// Action Log (Deterministic Replay) — Versioned + Namespaced
// ============================================================================

/**
 * All actions follow versioned namespaced format:
 * { v: 1; t: 'category/action'; p: {...} }
 *
 * This enables:
 * - Schema evolution without breaking replays
 * - Namespace isolation (circuit, sim, board, checkpoint)
 * - Future migration paths
 */
export type LabActionV1 =
  // Circuit mutations
  | { v: 1; t: 'circuit/addNode'; p: { nodeId: string; componentType: string; x: number; y: number; rotation?: number } }
  | { v: 1; t: 'circuit/deleteNode'; p: { nodeId: string } }
  | { v: 1; t: 'circuit/moveNode'; p: { nodeId: string; x: number; y: number } }
  | { v: 1; t: 'circuit/rotateNode'; p: { nodeId: string; rotation: number } }
  | { v: 1; t: 'circuit/addConnection'; p: CircuitConnection }
  | { v: 1; t: 'circuit/deleteConnection'; p: { connectionId: string } }
  | { v: 1; t: 'circuit/updateNodeParams'; p: { nodeId: string; params: Record<string, unknown> } }

  // Simulation control
  | { v: 1; t: 'sim/start'; p: { tickRate: number } }
  | { v: 1; t: 'sim/stop'; p: {} }
  | { v: 1; t: 'sim/tick'; p: { count: number } }
  | { v: 1; t: 'sim/reset'; p: {} }
  | { v: 1; t: 'sim/addProbe'; p: ProbeDefinition }
  | { v: 1; t: 'sim/removeProbe'; p: { probeId: string } }

  // Board mapping
  | { v: 1; t: 'board/setProfile'; p: { profileId: string } }
  | { v: 1; t: 'board/mapSignal'; p: { signal: string; pin: string } }
  | { v: 1; t: 'board/unmapSignal'; p: { signal: string } }
  | { v: 1; t: 'board/setSwitches'; p: { switches: boolean[] } }
  | { v: 1; t: 'board/setButtons'; p: { buttons: boolean[] } }

  // Checkpoint verification
  | { v: 1; t: 'checkpoint/verify'; p: { checkpointId: string; result: CheckpointResult } };

export interface LabActionEnvelope {
  timestamp: string; // ISO 8601
  sessionId: string;
  action: LabActionV1;
  appId?: string;
  windowId?: string;
}

// ============================================================================
// Evidence Snapshot (Sparse — only at checkpoints)
// ============================================================================

export interface EvidenceSnapshot {
  timestamp: string; // ISO 8601
  checkpointId?: string;
  tick: number; // Integer tick (deterministic)
  probeValues: Record<string, number>; // Probe signals → values
  circuitHash: string; // SHA256 of circuit (not full circuit)
  projectHash: string; // SHA256 of entire project state
  boardState?: {
    leds: boolean[];
    switches: boolean[];
    buttons?: boolean[];
  };
}

// ============================================================================
// Checkpoint Verification Result
// ============================================================================

export interface CheckpointResult {
  passed: boolean;
  headline: string; // "Truth table matches" | "3 mismatches found"
  failures: CheckpointFailure[]; // What failed + where
  evidence: {
    expected: unknown;
    actual: unknown;
    diff?: unknown;
  };
}

export interface CheckpointFailure {
  message: string; // "Row 3: expected Y=1, got Y=0"
  jumpTarget?: JumpTarget; // UI can offer "Jump to tick 12" or "Highlight row 3"
}

export type JumpTarget =
  | { type: 'probe'; signal: string }
  | { type: 'tick'; tick: number }
  | { type: 'pin'; pin: string }
  | { type: 'table-row'; row: number };

// ============================================================================
// Evidence Manifest (Export Integrity)
// ============================================================================

export interface EvidenceManifest {
  schemaVersion: '1.0';
  buildVersion?: string; // Git SHA
  buildDate?: string; // ISO 8601
  createdAt: string; // ISO 8601
  files: EvidenceFileEntry[];
  rootHash: string; // SHA256 of all file hashes combined
}

export interface EvidenceFileEntry {
  path: string; // "project.json", "actions.log.json", etc.
  hash: string; // SHA256
  size: number; // bytes
}

// ============================================================================
// Capsule Index (Top-level export metadata)
// ============================================================================

export interface CapsuleIndex {
  schemaVersion: '1.0';
  projectHash: string; // SHA256 of project.json
  actionLogHash: string; // SHA256 of actions.log.json
  manifestHash: string; // SHA256 of manifest.json
  buildSHA?: string; // Git commit SHA
  buildDate?: string; // ISO 8601
  createdAt: string; // ISO 8601
  files: {
    project: string; // "project.json"
    actions: string; // "actions.log.json"
    manifest: string; // "manifest.json"
  };
}

// ============================================================================
// Integrity Status
// ============================================================================

export type IntegrityStatus = 'verified' | 'modified' | 'unknown';

export interface IntegrityResult {
  status: IntegrityStatus;
  message: string;
  details?: {
    expectedHash?: string;
    actualHash?: string;
    modifiedFiles?: string[];
  };
}
