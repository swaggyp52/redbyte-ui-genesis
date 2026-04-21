// Lab Spec validation
export { validateEvidenceAgainstLabSpec } from './validateEvidenceAgainstLabSpec';
export type { LabSpecV1 } from './labSpecSchema';

// Sequential logic analysis (for Verify pipeline)
export type { SequentialAnalysis } from './analysis/analyzeSequentialLogic';
export { analyzeSequentialLogic } from './analysis/analyzeSequentialLogic';
export type { NodeMeta } from './analysis/nodeMetaRegistry';
export { getNodeMeta, isSequentialNodeType, getClockPortName, getResetPortName } from './analysis/nodeMetaRegistry';
export { injectSimClock } from './analysis/injectSimClock';
export * from './ir';

// Determinism / Event logging (for replay, recording, verification)
export type { EventLogV1, SimulationEventV1 } from './determinism/eventLog';
export { encodeEventLog, decodeEventLog } from './determinism/eventLog';
export { runReplay, validateEventLog } from './determinism/replay';

// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

// Signal path analysis
export { getFaninCone } from './pathTrace';

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
  GroundBehavior,
  SwitchBehavior,
  LampBehavior,
  WireBehavior,
  ANDBehavior,
  ORBehavior,
  NOTBehavior,
  NANDBehavior,
  XORBehavior,
  AND3Behavior,
  OR3Behavior,
  NAND3Behavior,
  NOR3Behavior,
  XOR3Behavior,
  ClockBehavior,
  DelayBehavior,
  DFlipFlopBehavior,
  Register1Behavior,
  RegisterBusBehavior,
  StateBankBehavior,
  TFlipFlopBehavior,
  JKFlipFlopBehavior,
  LM358Behavior,
  LDRBehavior,
  FixedResistorBehavior,
  VoltageSourceBehavior,
  VoltageDividerBehavior,
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
  GroundBehavior,
  SwitchBehavior,
  LampBehavior,
  WireBehavior,
  ANDBehavior,
  ORBehavior,
  NOTBehavior,
  NANDBehavior,
  XORBehavior,
  AND3Behavior,
  OR3Behavior,
  NAND3Behavior,
  NOR3Behavior,
  XOR3Behavior,
  ClockBehavior,
  DelayBehavior,
  DFlipFlopBehavior,
  Register1Behavior,
  RegisterBusBehavior,
  StateBankBehavior,
  TFlipFlopBehavior,
  JKFlipFlopBehavior,
  INPUTBehavior,
  OUTPUTBehavior,
  LM358Behavior,
  LDRBehavior,
  FixedResistorBehavior,
  VoltageSourceBehavior,
  VoltageDividerBehavior,
} from './builtins';
import { registerCompositeNode } from './CompositeNode';
import {
  RSLatchDef,
  DLatchDef,
  FullAdderDef,
  Counter4BitDef,
} from './composite-defs';
NodeRegistry.register('PowerSource', PowerSourceBehavior);
NodeRegistry.register('Ground', GroundBehavior);
NodeRegistry.register('Switch', SwitchBehavior);
NodeRegistry.register('Lamp', LampBehavior);
NodeRegistry.register('Wire', WireBehavior);
NodeRegistry.register('AND', ANDBehavior);
NodeRegistry.register('OR', ORBehavior);
NodeRegistry.register('NOT', NOTBehavior);
NodeRegistry.register('NAND', NANDBehavior);
NodeRegistry.register('XOR', XORBehavior);
NodeRegistry.register('AND3', AND3Behavior);
NodeRegistry.register('OR3', OR3Behavior);
NodeRegistry.register('NAND3', NAND3Behavior);
NodeRegistry.register('NOR3', NOR3Behavior);
NodeRegistry.register('XOR3', XOR3Behavior);
NodeRegistry.register('Clock', ClockBehavior);
NodeRegistry.register('Delay', DelayBehavior);
NodeRegistry.register('DFlipFlop', DFlipFlopBehavior);
NodeRegistry.register('Register1', Register1Behavior);
NodeRegistry.register('RegisterBus', RegisterBusBehavior);
NodeRegistry.register('StateBank', StateBankBehavior);
NodeRegistry.register('TFlipFlop', TFlipFlopBehavior);
NodeRegistry.register('JKFlipFlop', JKFlipFlopBehavior);
NodeRegistry.register('INPUT', INPUTBehavior);
NodeRegistry.register('OUTPUT', OUTPUTBehavior);

// Analog node behaviors
NodeRegistry.register('LM358', LM358Behavior);
NodeRegistry.register('LDR', LDRBehavior);
NodeRegistry.register('FixedResistor', FixedResistorBehavior);
NodeRegistry.register('VoltageSource', VoltageSourceBehavior);
NodeRegistry.register('VoltageDivider', VoltageDividerBehavior);

// Register composite nodes
registerCompositeNode(RSLatchDef);
registerCompositeNode(DLatchDef);
registerCompositeNode(FullAdderDef);
registerCompositeNode(Counter4BitDef);

// Share utilities
export * from './share/encoding';
