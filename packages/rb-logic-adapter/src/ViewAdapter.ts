// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { CircuitEngine } from '@redbyte/rb-logic-core';
import type { ViewMode, ViewState } from './types';
import { circuitTransform } from './transforms/circuit-transform';
import { schematicTransform } from './transforms/schematic-transform';
import { isometricTransform } from './transforms/iso-transform';

/**
 * ViewAdapter - transforms engine state into view-layer representation
 */
export class ViewAdapter {
  private engine: CircuitEngine;
  private viewMode: ViewMode;

  constructor(engine: CircuitEngine, initialMode: ViewMode = 'circuit') {
    this.engine = engine;
    this.viewMode = initialMode;
  }

  /**
   * Set the current view mode
   */
  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  /**
   * Get the current view mode
   */
  getViewMode(): ViewMode {
    return this.viewMode;
  }

  /**
   * Compute view state from engine state
   * This is the main transform function
   */
  computeViewState(): ViewState {
    const circuit = this.engine.getCircuit();

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
  getEngine(): CircuitEngine {
    return this.engine;
  }
}
