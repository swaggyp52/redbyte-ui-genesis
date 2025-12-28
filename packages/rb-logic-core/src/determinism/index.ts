// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Determinism module for RedByte Logic Core
 *
 * Provides state hashing, event logging, replay, and recording functionality
 * to enable deterministic simulation and research-grade reproducibility.
 *
 * Milestone A: Core Determinism Proof (Complete)
 * - State normalization and hashing
 * - Event log schema
 * - Replay runner
 * - E2E determinism tests
 *
 * Milestone B: Record/Replay Harness (Complete)
 * - PR5: Record Harness (recorder.ts)
 * - PR6: Replay Verification Command (verifyReplay.ts)
 * - PR7: Minimal UI Harness
 *
 * Milestone C: Inspectable Time Travel (Complete)
 * - PR8: State Query Primitive (inspector.ts)
 * - PR9: Step Navigation & Diffing (navigation.ts, diff.ts)
 * - PR10: Integration Test & Optional Dev UI (timetravel.integration.test.ts + dev panel)
 */

export {
  normalizeCircuitState,
  serializeNormalizedState,
  hashCircuitState,
  normalizeRuntimeState,
  hashRuntimeState,
  type NormalizedCircuitState,
  type CircuitRuntimeState,
  type NormalizedRuntimeState,
} from './stateHash';

export {
  encodeEventLog,
  decodeEventLog,
  createEventLog,
  appendEvent,
  createCircuitLoadedEvent,
  createInputToggledEvent,
  createSimulationTickEvent,
  createNodeStateModifiedEvent,
  type EventLogV1,
  type SimulationEventV1,
  type CircuitLoadedEvent,
  type InputToggledEvent,
  type SimulationTickEvent,
  type NodeStateModifiedEvent,
} from './eventLog';

export {
  runReplay,
  validateEventLog,
  type ReplayResult,
  type ReplayEngine,
  type EngineFactory,
} from './replay';

export {
  createRecorder,
  Recorder,
  type Clock,
  type RecorderOptions,
} from './recorder';

export {
  verifyReplay,
  type VerifyReplayResult,
  type VerifyReplayOptions,
} from './verifyReplay';

export {
  getStateAtIndex,
  type CircuitStateSnapshot,
  type GetStateAtIndexOptions,
} from './inspector';

export {
  stepForward,
  stepBackward,
  jumpToIndex,
  canStepForward,
  canStepBackward,
} from './navigation';

export {
  diffState,
  type StateDiff,
  type NodeStateChange,
  type SignalChange,
  type NodeAdded,
  type NodeRemoved,
  type ConnectionChange,
} from './diff';
