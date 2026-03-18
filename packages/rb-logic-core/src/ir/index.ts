// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * RedByte Canonical IR v2
 *
 * Public API for the IR layer. Import from here, not from individual files.
 *
 * @example
 *   import { elaborateCircuit } from '@redbyte/rb-logic-core/ir';
 *   const { ir, diagnostics } = elaborateCircuit(circuit, { pins: ioMap });
 */

export type {
  // Core IR types
  CircuitIR,
  ElaborationResult,
  IRDiagnostic,
  IRFeatures,
  IRNet,
  IRNetEndpoint,
  IRPort,
  IRPortKind,
  IRPrimitive,
  IRPrimitiveType,
  IRSignalType,
} from './circuitIR';

export { elaborateCircuit } from './elaborator';
export type { PinMapping } from './elaborator';
export type {
  SimulationModel,
  SimulationModelOutputBinding,
  SimulationModelPortRef,
  SimulationModelTemporalBinding,
} from './simulationModel';
export { buildSimulationModel } from './simulationModel';
