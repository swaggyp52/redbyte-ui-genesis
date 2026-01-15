/**
 * Lab Session Types & Interfaces
 * Represents student lab work lifecycle: session, checkpoints, results, export evidence
 */

export type LabCheckpointStatus = 'not-attempted' | 'in-progress' | 'passed' | 'failed';

/** Result of a single checkpoint evaluation */
export interface CheckpointResult {
  checkpointId: string;
  status: LabCheckpointStatus;
  passedAt?: number; // timestamp when checkpoint was first passed
  attempts: number; // how many times was validation run?
  feedback: string; // structured feedback (e.g., "Need 2 ORs, got 1")
}

/** Circuit snapshot at a point in time (deterministic for grading) */
export interface CircuitSnapshot {
  // Serialized circuit structure (deterministic JSON)
  circuitJson: string; // JSON.stringify(circuit) deterministically
  snapshotAt: number; // timestamp
  circuitHash: string; // SHA256 or deterministic hash for verification
}

/** Lab session state (student's work on a single lab) */
export interface LabSessionState {
  sessionId: string; // unique session ID (lab + student + timestamp)
  labId: string; // which lab is this session for?
  studentName?: string; // for later export (nullable in autosave)
  
  // Session lifecycle
  createdAt: number;
  updatedAt: number;
  
  // Circuit work
  currentCircuit: string; // JSON.stringify(circuit) — in-progress work
  circuitSnapshots: CircuitSnapshot[]; // history of saves (optional, for resume)
  
  // Checkpoint tracking
  checkpointResults: Record<string, CheckpointResult>;
  
  // Session summary
  totalCheckpoints: number;
  passedCheckpoints: number;
}

/** Public lab session API for store consumers */
export interface ILabSession {
  // State
  readonly state: LabSessionState;
  
  // Lifecycle
  createSession(labId: string): void;
  loadSession(sessionId: string): boolean; // load from localStorage
  clearSession(): void;
  
  // Circuit updates
  setCircuit(circuit: string): void;
  getCircuit(): string;
  
  // Checkpoint results
  setCheckpointResult(checkpointId: string, result: CheckpointResult): void;
  getCheckpointResult(checkpointId: string): CheckpointResult | undefined;
  getAllCheckpointResults(): Record<string, CheckpointResult>;
  
  // Checkpoint summary
  updateCheckpointSummary(): void; // recalc passedCheckpoints
  isCheckpointPassed(checkpointId: string): boolean;
  
  // Persistence
  saveToLocalStorage(): void;
  loadFromLocalStorage(sessionId: string): boolean;
}

/** Export format: complete capsule with evidence */
export interface LabCapsule {
  format: 'rblab.json'; // version identifier
  sessionId: string;
  labId: string;
  studentName: string;
  exportedAt: number;
  
  // Evidence
  finalCircuit: string; // final circuit JSON
  checkpointResults: Record<string, CheckpointResult>;
  passedCheckpoints: number;
  totalCheckpoints: number;
  
  // Integrity
  appVersion: string;
  gitSha?: string; // injected at build time
  capsuleHash?: string; // hash for tampering detection
}

/** Helper: Generate a unique session ID */
export function generateSessionId(labId: string, timestamp: number = Date.now()): string {
  return `${labId}-${timestamp}-${Math.random().toString(36).substring(2, 9)}`;
}

/** Helper: Create empty session state */
export function createEmptySession(labId: string, sessionId?: string): LabSessionState {
  const now = Date.now();
  return {
    sessionId: sessionId || generateSessionId(labId, now),
    labId,
    studentName: undefined,
    createdAt: now,
    updatedAt: now,
    currentCircuit: JSON.stringify({ nodes: [], connections: [] }),
    circuitSnapshots: [],
    checkpointResults: {},
    totalCheckpoints: 0,
    passedCheckpoints: 0,
  };
}

/** Helper: Create empty checkpoint result */
export function createCheckpointResult(checkpointId: string): CheckpointResult {
  return {
    checkpointId,
    status: 'not-attempted',
    attempts: 0,
    feedback: '',
  };
}
