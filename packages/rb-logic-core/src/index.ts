// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

// Types
export type * from './types';

// Core classes
export { NodeRegistry } from './NodeRegistry';
export { CircuitEngine } from './CircuitEngine';
export { TickEngine } from './TickEngine';

// Serialization
export { serialize, deserialize } from './serialization';

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
} from './builtins';
import { registerCompositeNode } from './CompositeNode';
import {
  RSLatchDef,
  DFlipFlopDef,
  JKFlipFlopDef,
  FullAdderDef,
  Counter4BitDef,
} from './composite-defs';

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

// Register composite nodes
registerCompositeNode(RSLatchDef);
registerCompositeNode(DFlipFlopDef);
registerCompositeNode(JKFlipFlopDef);
registerCompositeNode(FullAdderDef);
registerCompositeNode(Counter4BitDef);

// Share utilities
export * from './share/encoding';
