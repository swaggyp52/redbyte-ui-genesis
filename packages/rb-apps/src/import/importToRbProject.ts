// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// Import Bridge — converts ParsedHDL + optional XDC to RBProject.
//
// Scope (v1): ParsedHDL + XdcParseResult → RBProject with auto-layout + IO mapping.
// Canonical mapping is **hardwareMappingV2**; structured **ioMapping** is kept for compatibility.

import type { RBProject } from '@redbyte/rb-circuit';
import type { ParsedHDL } from './hdlToCircuit.js';
import type { XdcParseResult } from './xdcImport.js';
import { buildImportedProjectCompilerResult } from './importCompiler.js';

/**
 * Convert ParsedHDL (+ optional XDC output) to RBProject.
 *
 * Delegates to {@link buildImportedProjectCompilerResult} so the project includes
 * **hardwareMappingV2** (primary) and **ioMapping** (materialization-compatible legacy shape).
 */
export function importToRbProject(parsedHdl: ParsedHDL, xdcResult?: XdcParseResult): RBProject {
  return buildImportedProjectCompilerResult({
    sourceName: `${parsedHdl.entityName || 'imported-design'}.${parsedHdl.lang === 'verilog' ? 'v' : 'vhd'}`,
    topPath: `top.${parsedHdl.lang === 'verilog' ? 'v' : 'vhd'}`,
    topText: '',
    parsedHdl,
    xdcResult,
  }).project;
}
