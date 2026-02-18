// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// Import Bridge — converts ParsedHDL + optional XDC to RBProject.
//
// Scope (v1): ParsedHDL + XdcParseResult → RBProject with auto-layout + IO mapping.

import type { RBProject } from '@redbyte/rb-circuit';
import type { ParsedHDL } from './hdlToCircuit.js';
import type { XdcParseResult } from './xdcImport.js';
import { parsedHdlToCircuit } from './hdlToCircuit.js';

/**
 * Convert ParsedHDL (+ optional XDC output) to RBProject.
 *
 * Process:
 *   1. Convert ParsedHDL → Circuit (auto-layout)
 *   2. If XDC provided: build ioMapping { circuitPortName → physicalPin }
 *   3. Return RBProject with circuit + ioMapping
 */
export function importToRbProject(
  parsedHdl: ParsedHDL,
  xdcResult?: XdcParseResult,
): RBProject {
  // Step 1: Convert HDL to Circuit (auto-layout included)
  const importResult = parsedHdlToCircuit(parsedHdl);
  const circuit = importResult.circuit;

  // Step 2: Build IO mapping from XDC (if provided)
  const ioMapping: Record<string, string> = {};
  if (xdcResult) {
    // Map circuit port names to physical pins from XDC
    // XDC pinMap has port names as seen in the file; match to circuit.ports
    for (const port of circuit.ports || []) {
      const pinFromXdc = xdcResult.pinMap[port.name];
      if (pinFromXdc) {
        ioMapping[port.name] = pinFromXdc;
      }
    }
  }

  // Step 3: Return RBProject
  return {
    circuit,
    ioMapping: Object.keys(ioMapping).length > 0 ? ioMapping : undefined,
  };
}
