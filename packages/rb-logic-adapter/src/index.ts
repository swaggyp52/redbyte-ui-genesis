// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

// Main ViewAdapter
export { ViewAdapter } from './ViewAdapter';

// Types
export type { ViewMode, ViewState, ViewNode, ViewWire } from './types';

// Transform functions (for advanced usage)
export { circuitTransform } from './transforms/circuit-transform';
export { schematicTransform } from './transforms/schematic-transform';
export { isometricTransform } from './transforms/iso-transform';

// Helpers
export {
  calculatePortPosition,
  manhattanRoute,
  snapToGrid,
  getNodeDimensions,
} from './transforms/shared-helpers';
