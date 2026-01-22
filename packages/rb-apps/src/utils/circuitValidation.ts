// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates that the provided data matches the minimal expected schema for a circuit.
 * This is a runtime guard to prevent loading malformed JSON that could crash the engine.
 */
export function validateCircuitData(data: any): ValidationResult {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Circuit data must be an object' };
    }

    // Check for SerializedCircuitV1 signature which typically has 'version', 'nodes' (or 'gates'), 'connections' (or 'wires')
    // We handle both V1 (nodes/connections) and legacy/compressed (gates/wires) just in case,
    // though typically we expect serialized structure here.

    if (!Array.isArray(data.nodes) && !Array.isArray(data.gates)) {
        return { valid: false, error: 'Missing "nodes" or "gates" array' };
    }

    if (!Array.isArray(data.connections) && !Array.isArray(data.wires)) {
        return { valid: false, error: 'Missing "connections" or "wires" array' };
    }

    return { valid: true };
}
