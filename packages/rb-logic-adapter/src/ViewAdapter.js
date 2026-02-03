// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { circuitTransform } from './transforms/circuit-transform';
import { schematicTransform } from './transforms/schematic-transform';
import { isometricTransform } from './transforms/iso-transform';
/**
 * ViewAdapter - transforms engine state into view-layer representation
 */
export class ViewAdapter {
    engine;
    viewMode;
    constructor(engine, initialMode = 'circuit') {
        this.engine = engine;
        this.viewMode = initialMode;
    }
    /**
     * Set the current view mode
     */
    setViewMode(mode) {
        this.viewMode = mode;
    }
    /**
     * Get the current view mode
     */
    getViewMode() {
        return this.viewMode;
    }
    /**
     * Compute view state from engine state
     * This is the main transform function
     */
    computeViewState() {
        const circuit = this.engine?.getCircuit?.();
        // Return empty state if no circuit
        if (!circuit) {
            return { nodes: [], wires: [] };
        }
        switch (this.viewMode) {
            case 'circuit':
                return circuitTransform(circuit);
            case 'schematic':
                return schematicTransform(circuit);
            case 'isometric':
                return isometricTransform(circuit);
            case '3d':
                // For 3D mode, use isometric data (3D renderer will handle actual 3D)
                return isometricTransform(circuit);
            default:
                return circuitTransform(circuit);
        }
    }
    /**
     * Get the underlying engine
     */
    getEngine() {
        return this.engine;
    }
}
