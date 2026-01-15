// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

// Types
export type * from './types';

// Core classes
export { NodeRegistry } from './NodeRegistry';
export { CircuitEngine } from './CircuitEngine';
export { TickEngine } from './TickEngine';
export { TraceRecorder } from './TraceRecorder';
export type { TraceEntry, TraceSnapshot } from './TraceRecorder';
export { ensureBuiltinsRegistered } from './registerBuiltins';

// Serialization
export { serialize, deserialize } from './serialization';

// Built-in behaviors
export {
  INPUTBehavior,
  OUTPUTBehavior,
  PowerSourceBehavior,
  SwitchBehavior,
  LampBehavior,
  WireBehavior,
  ANDBehavior,
  ORBehavior,
  NOTBehavior,
  NANDBehavior,
  XORBehavior,
  ClockBehavior,
  DelayBehavior,
} from './builtins';

// Composite nodes
export type { CompositeNodeDef } from './CompositeNode';
export { createCompositeNodeBehavior, registerCompositeNode } from './CompositeNode';
export {
  RSLatchDef,
  DFlipFlopDef,
  JKFlipFlopDef,
  FullAdderDef,
  Counter4BitDef,
} from './composite-defs';

// Auto-register built-in node types
import { ensureBuiltinsRegistered } from './registerBuiltins';

ensureBuiltinsRegistered();

// Share utilities
export * from './share/encoding';

// Lab module (ECE Lab MVP)
export { createLabSessionStore, getGlobalLabSessionStore, resetGlobalLabSessionStore } from './lab/sessionStore';
export { evaluateCheckpoint } from './lab/evaluator';
export type { CapsuleV1, CheckpointResult } from './lab/CapsuleV1';
export { validateCapsule, parseCapsuleJSON, parseCapsuleFile } from './lab/CapsuleV1';
export { createTestVector, createCheckpoint, createLabDef } from './lab/LabDefinition';
export type { TestVector, CheckpointDef, LabDef, LabLibrary } from './lab/LabDefinition';
export { getDefaultLab, getDefaultLabs, defaultLabLibrary } from './lab/exampleLabs';

// FPGA Bridge (H2)
export { BridgeClient, getBridgeClient, resetBridgeClient } from './bridge/BridgeClient';
export type { BridgeConfig, EvaluateCheckpointRequest, EvaluateCheckpointResponse, ErrorResponse, BridgeMessage } from './bridge/BridgeClient';
