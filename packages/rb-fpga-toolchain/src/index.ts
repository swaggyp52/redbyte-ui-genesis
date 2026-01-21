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

// Toolchain detection
export {
  detectToolchain,
  canSynthesize,
  canProgram,
  getPreferredSynthesisTool,
  getPreferredProgrammingTool,
} from './detection';

// Verilog primitives
export {
  VERILOG_PRIMITIVES,
  getPrimitive,
  getPrimitivesLibrary,
  getNodeTypeToModuleMap,
  hasPrimitive,
  getSupportedNodeTypes,
} from './primitives';

// Vivado synthesis and programming
export {
  generateVivadoTcl,
  parseTimingReport,
  parseUtilizationReport,
  runVivadoSynthesis,
  generateVivadoProgramTcl,
  programFpgaWithVivado,
} from './vivado';

// openFPGALoader programming
export {
  programFpgaWithOpenFPGALoader,
  detectBoardsWithOpenFPGALoader,
  writeFpgaFlashWithOpenFPGALoader,
} from './openfpgaloader';

// Wrapper generator
export { WRAPPER_VERSION, buildSampleTemplate, generateWrapperVerilog, hashText } from './wrapper.js';

// Interface checker
export { checkTopInterface, getRequiredInterface } from './interface-checker.js';
