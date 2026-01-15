// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { NodeRegistry } from './NodeRegistry';
import {
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
import { registerCompositeNode } from './CompositeNode';
import {
  RSLatchDef,
  DFlipFlopDef,
  JKFlipFlopDef,
  FullAdderDef,
  Counter4BitDef,
} from './composite-defs';

/**
 * Register all built-in and composite node behaviors once per runtime.
 */
export const ensureBuiltinsRegistered = (): void => {
  if (NodeRegistry.has('PowerSource')) return;

  NodeRegistry.register('PowerSource', PowerSourceBehavior);
  NodeRegistry.register('Switch', SwitchBehavior);
  NodeRegistry.register('INPUT', INPUTBehavior);
  NodeRegistry.register('Lamp', LampBehavior);
  NodeRegistry.register('Wire', WireBehavior);
  NodeRegistry.register('AND', ANDBehavior);
  NodeRegistry.register('OR', ORBehavior);
  NodeRegistry.register('NOT', NOTBehavior);
  NodeRegistry.register('NAND', NANDBehavior);
  NodeRegistry.register('XOR', XORBehavior);
  NodeRegistry.register('Clock', ClockBehavior);
  NodeRegistry.register('Delay', DelayBehavior);
  NodeRegistry.register('OUTPUT', OUTPUTBehavior);

  registerCompositeNode(RSLatchDef);
  registerCompositeNode(DFlipFlopDef);
  registerCompositeNode(JKFlipFlopDef);
  registerCompositeNode(FullAdderDef);
  registerCompositeNode(Counter4BitDef);
};
