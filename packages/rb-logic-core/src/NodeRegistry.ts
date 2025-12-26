// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { NodeBehavior } from './types';

/**
 * Global registry of node behaviors
 */
export class NodeRegistry {
  private static behaviors = new Map<string, NodeBehavior>();

  /**
   * Register a node behavior
   */
  static register(type: string, behavior: NodeBehavior): void {
    this.behaviors.set(type, behavior);
  }

  /**
   * Get a registered node behavior
   */
  static get(type: string): NodeBehavior | undefined {
    return this.behaviors.get(type);
  }

  /**
   * Check if a node type is registered
   */
  static has(type: string): boolean {
    return this.behaviors.has(type);
  }

  /**
   * Unregister a node behavior
   */
  static unregister(type: string): boolean {
    return this.behaviors.delete(type);
  }

  /**
   * Clear all registered behaviors (for testing)
   */
  static clear(): void {
    this.behaviors.clear();
  }

  /**
   * Get all registered node types
   */
  static getTypes(): string[] {
    return Array.from(this.behaviors.keys());
  }
}
