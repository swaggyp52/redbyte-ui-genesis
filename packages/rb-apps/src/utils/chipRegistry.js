// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { NodeRegistry } from '@redbyte/rb-logic-core';
import { registerCompositeNode } from '@redbyte/rb-logic-core';
/**
 * Converts a ChipDefinition into a CompositeNodeDef that can be registered
 * with the NodeRegistry.
 */
export function chipDefToCompositeNodeDef(chip) {
    // Build input mapping: external port name -> internal node.port
    const inputMapping = {};
    chip.inputs.forEach((input) => {
        inputMapping[input.name] = input.nodeRef;
    });
    // Build output mapping: external port name -> internal node.port
    const outputMapping = {};
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
export function registerChip(chip) {
    const compositeNodeDef = chipDefToCompositeNodeDef(chip);
    registerCompositeNode(compositeNodeDef);
}
/**
 * Registers all chips from the chip store.
 * Call this on app initialization to make all saved chips available.
 */
export function registerAllChips(chips) {
    chips.forEach((chip) => {
        try {
            registerChip(chip);
        }
        catch (error) {
            console.error(`Failed to register chip "${chip.name}":`, error);
        }
    });
}
/**
 * Unregisters a chip from the NodeRegistry.
 * This removes the chip's behavior so it can no longer be used in circuits.
 */
export function unregisterChip(chipName) {
    return NodeRegistry.unregister(chipName);
}
/**
 * Gets the node type name for a chip.
 * This is the name used to reference the chip when creating nodes.
 */
export function getChipNodeType(chip) {
    return chip.name;
}
/**
 * Checks if a chip is registered as a node type.
 */
export function isChipRegistered(chip) {
    return NodeRegistry.has(chip.name);
}
