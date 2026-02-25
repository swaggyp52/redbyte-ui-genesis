// Lab Spec validation
export { validateEvidenceAgainstLabSpec } from './validateEvidenceAgainstLabSpec';
// Core classes
export { NodeRegistry } from './NodeRegistry';
export { CircuitEngine } from './CircuitEngine';
export { TickEngine } from './TickEngine';
export { TraceRecorder } from './TraceRecorder';
export { ProbeRecorder } from './ProbeRecorder';
// Serialization
export { serialize, deserialize } from './serialization';
// Circuit format conversion
export { toCircuitV1, fromCircuitV1 } from './convertCircuitV1';
export { SCHEMA_VERSION, createDefaultMeta, createEmptyCircuit, createBlankProjectDoc, normalizeProjectDoc, serializeProjectDoc, deserializeProjectDoc, updateProjectDocTimestamp, } from './projectDoc';
// Built-in behaviors
export { PowerSourceBehavior, SwitchBehavior, LampBehavior, WireBehavior, ANDBehavior, ORBehavior, NOTBehavior, NANDBehavior, XORBehavior, ClockBehavior, DelayBehavior, TFlipFlopBehavior, JKFlipFlopBehavior, } from './builtins';
export { createCompositeNodeBehavior, registerCompositeNode } from './CompositeNode';
export { RSLatchDef, DFlipFlopDef, DLatchDef, JKFlipFlopDef, FullAdderDef, Counter4BitDef, } from './composite-defs';
// Auto-register built-in node types
import { NodeRegistry } from './NodeRegistry';
import { PowerSourceBehavior, SwitchBehavior, LampBehavior, WireBehavior, ANDBehavior, ORBehavior, NOTBehavior, NANDBehavior, XORBehavior, ClockBehavior, DelayBehavior, TFlipFlopBehavior, JKFlipFlopBehavior, INPUTBehavior, OUTPUTBehavior, } from './builtins';
import { registerCompositeNode } from './CompositeNode';
import { RSLatchDef, DFlipFlopDef, DLatchDef, JKFlipFlopDef, FullAdderDef, Counter4BitDef, } from './composite-defs';
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
