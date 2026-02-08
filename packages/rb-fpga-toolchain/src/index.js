// Copyright 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * @redbyte/rb-fpga-toolchain
 *
 * FPGA synthesis and programming toolchain orchestration for RedByte.
 * Supports Vivado (primary) and open-source tools (fallback).
 */
// Types
export * from './types';
// NOTE: Toolchain detection, Vivado, and openFPGALoader functions
// require Node.js and should only be imported server-side.
// They are NOT exported from the main index to keep the package browser-safe.
// Import them directly if needed in Node.js environments:
//   import { detectToolchain } from '@redbyte/rb-fpga-toolchain/detection';
//   import { runVivadoSynthesis } from '@redbyte/rb-fpga-toolchain/vivado';
// Verilog primitives (browser-safe)
export { VERILOG_PRIMITIVES, getPrimitive, getPrimitivesLibrary, getNodeTypeToModuleMap, hasPrimitive, getSupportedNodeTypes, } from './primitives';
// Circuit-to-Verilog generator (browser-safe)
export { circuitToVerilog, generateConstraints, generateBasys3Constraints, } from './verilog-generator';
// Bitstream provenance tracking (browser-safe)
export { generateBitstreamArtifacts, verifyBitstreamProvenance, } from './bitstream-provenance';
// Verilog and constraint validation (browser-safe)
export { validateVerilog, validateConstraints, calculateReadinessScore, } from './verilog-validator';
