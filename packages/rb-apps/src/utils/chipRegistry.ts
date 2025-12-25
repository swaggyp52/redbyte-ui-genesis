// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { NodeRegistry, type CompositeNodeDef } from '@redbyte/rb-logic-core';
import { registerCompositeNode } from '@redbyte/rb-logic-core';
import type { ChipDefinition } from '../stores/chipStore';

/**
 * Converts a ChipDefinition into a CompositeNodeDef that can be registered
 * with the NodeRegistry.
 */
export function chipDefToCompositeNodeDef(chip: ChipDefinition): CompositeNodeDef {
  // Build input mapping: external port name -> internal node.port
  const inputMapping: Record<string, string> = {};
  chip.inputs.forEach((input) => {
    inputMapping[input.name] = input.nodeRef;
  });

  // Build output mapping: external port name -> internal node.port
  const outputMapping: Record<string, string> = {};
  chip.outputs.forEach((output) => {
    outputMapping[output.name] = output.nodeRef;
  });

  return {
    name: chip.name,
    description: chip.description,
    subcircuit: chip.subcircuit,
    inputMapping,
    outputMapping,
  };
}

/**
 * Registers a chip as a usable node type in the NodeRegistry.
 * This allows the chip to be placed and used in circuits.
 */
export function registerChip(chip: ChipDefinition): void {
  const compositeNodeDef = chipDefToCompositeNodeDef(chip);
  registerCompositeNode(compositeNodeDef);
}

/**
 * Registers all chips from the chip store.
 * Call this on app initialization to make all saved chips available.
 */
export function registerAllChips(chips: ChipDefinition[]): void {
  chips.forEach((chip) => {
    try {
      registerChip(chip);
    } catch (error) {
      console.error(`Failed to register chip "${chip.name}":`, error);
    }
  });
}

/**
 * Unregisters a chip from the NodeRegistry.
 * Note: NodeRegistry doesn't have an unregister method, so this is a placeholder.
 */
export function unregisterChip(chipName: string): void {
  // TODO: Implement if NodeRegistry adds an unregister method
  console.warn(`Unregistering chips is not yet supported. Chip "${chipName}" will remain registered.`);
}

/**
 * Gets the node type name for a chip.
 * This is the name used to reference the chip when creating nodes.
 */
export function getChipNodeType(chip: ChipDefinition): string {
  return chip.name;
}

/**
 * Checks if a chip is registered as a node type.
 */
export function isChipRegistered(chip: ChipDefinition): boolean {
  return NodeRegistry.has(chip.name);
}
