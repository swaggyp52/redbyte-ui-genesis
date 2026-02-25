// Lab Spec validation
export { validateEvidenceAgainstLabSpec } from './validateEvidenceAgainstLabSpec';
export type { LabSpecV1 } from './labSpecSchema';

// Sequential logic analysis (for Verify pipeline)
export type { SequentialAnalysis } from './analysis/analyzeSequentialLogic';
export { analyzeSequentialLogic } from './analysis/analyzeSequentialLogic';
export type { NodeMeta } from './analysis/nodeMetaRegistry';
export { getNodeMeta, isSequentialNodeType, getClockPortName, getResetPortName } from './analysis/nodeMetaRegistry';
export { injectSimClock } from './analysis/injectSimClock';

// Determinism / Event logging (for replay, recording, verification)
export type { EventLogV1, SimulationEventV1 } from './determinism/eventLog';
export { encodeEventLog, decodeEventLog } from './determinism/eventLog';
export { runReplay, validateEventLog } from './determinism/replay';

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
export { ProbeRecorder } from './ProbeRecorder';
export type { ProbeSample } from './ProbeRecorder';

// Serialization
export { serialize, deserialize } from './serialization';

// Circuit format conversion
export { toCircuitV1, fromCircuitV1 } from './convertCircuitV1';

// Project document (canonical schema)
export type { RBProjectDoc, ProjectMeta, ViewState, AppStateMap } from './projectDoc';
export {
  SCHEMA_VERSION,
  createDefaultMeta,
  createEmptyCircuit,
  createBlankProjectDoc,
  normalizeProjectDoc,
  serializeProjectDoc,
  deserializeProjectDoc,
  updateProjectDocTimestamp,
} from './projectDoc';

// Built-in behaviors
export {
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
  TFlipFlopBehavior,
  JKFlipFlopBehavior,
} from './builtins';

// Composite nodes
export type { CompositeNodeDef } from './CompositeNode';
export { createCompositeNodeBehavior, registerCompositeNode } from './CompositeNode';
export {
  RSLatchDef,
  DFlipFlopDef,
  DLatchDef,
  JKFlipFlopDef,
  FullAdderDef,
  Counter4BitDef,
} from './composite-defs';

// Auto-register built-in node types
import { NodeRegistry } from './NodeRegistry';
import {
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
  TFlipFlopBehavior,
  JKFlipFlopBehavior,
  INPUTBehavior,
  OUTPUTBehavior,
} from './builtins';
import { registerCompositeNode } from './CompositeNode';
import {
  RSLatchDef,
  DFlipFlopDef,
  DLatchDef,
  JKFlipFlopDef,
  FullAdderDef,
  Counter4BitDef,
} from './composite-defs';
import { registerAnalogNodes } from './analog';

NodeRegistry.register('PowerSource', PowerSourceBehavior);
NodeRegistry.register('Switch', SwitchBehavior);
NodeRegistry.register('Lamp', LampBehavior);
NodeRegistry.register('Wire', WireBehavior);
NodeRegistry.register('AND', ANDBehavior);
NodeRegistry.register('OR', ORBehavior);
NodeRegistry.register('NOT', NOTBehavior);
NodeRegistry.register('NAND', NANDBehavior);
NodeRegistry.register('XOR', XORBehavior);
NodeRegistry.register('Clock', ClockBehavior);
NodeRegistry.register('Delay', DelayBehavior);
NodeRegistry.register('TFlipFlop', TFlipFlopBehavior);
NodeRegistry.register('JKFlipFlop', JKFlipFlopBehavior);
NodeRegistry.register('INPUT', INPUTBehavior);
NodeRegistry.register('OUTPUT', OUTPUTBehavior);

// Register composite nodes
registerCompositeNode(RSLatchDef);
registerCompositeNode(DFlipFlopDef);
registerCompositeNode(DLatchDef);
registerCompositeNode(FullAdderDef);
registerCompositeNode(Counter4BitDef);

// Register analog nodes
registerAnalogNodes();

// Share utilities
export * from './share/encoding';
