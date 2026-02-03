// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Global registry of node behaviors
 */
export class NodeRegistry {
    static behaviors = new Map();
    /**
     * Register a node behavior
     */
    static register(type, behavior) {
        this.behaviors.set(type, behavior);
    }
    /**
     * Get a registered node behavior
     */
    static get(type) {
        return this.behaviors.get(type);
    }
    /**
     * Check if a node type is registered
     */
    static has(type) {
        return this.behaviors.has(type);
    }
    /**
     * Unregister a node behavior
     */
    static unregister(type) {
        return this.behaviors.delete(type);
    }
    /**
     * Clear all registered behaviors (for testing)
     */
    static clear() {
        this.behaviors.clear();
    }
    /**
     * Get all registered node types
     */
    static getTypes() {
        return Array.from(this.behaviors.keys());
    }
}
