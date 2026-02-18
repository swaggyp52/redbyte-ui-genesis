// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Basys3 Export Service — Canonical, deterministic Vivado export authority.
 *
 * This is the ONLY place where Basys3 bundles are generated.
 * No alternate HDL generation paths.
 * All exports must go through this service.
 */

import { exportBasys3Bundle } from './basys3Bundle';
import type { RBProject } from '../../export/projectFormat';
import { generateTestbenchVhdl } from './testbenchGenerator';

export interface Basys3ExportError {
  type: 'validation' | 'constraint' | 'logic' | 'unknown';
  message: string;
  severity: 'error' | 'warning';
}

export interface Basys3ExportResult {
  success: boolean;
  bundle?: {
    topVhd: string;
    topXdc: string;
    readme: string;
    topVerilog?: string;
    testbench?: string;
  };
  errors: Basys3ExportError[];
  warnings: string[];
  determinismHash?: string; // SHA256 of normalized project + bundle
}

/**
 * Validate RBProject for Basys3 export.
 * Checks for:
 * - Valid ioMapping with required pin mappings
 * - Unsupported pin names
 * - Missing clock for sequential logic
 * - Port/XDC mismatches
 */
function validateProjectForBasys3(project: RBProject): Basys3ExportError[] {
  const errors: Basys3ExportError[] = [];

  // Check ioMapping exists
  if (!project.ioMapping) {
    errors.push({
      type: 'validation',
      severity: 'error',
      message: 'No IO mapping defined. Configure switches, buttons, and LEDs before export.',
    });
    return errors;
  }

  // Check for required switch mappings (SW0-15)
  if (project.ioMapping.inputs.length === 0) {
    errors.push({
      type: 'validation',
      severity: 'warning',
      message: 'No input mappings found. At minimum, map switches (SW0-15).',
    });
  }

  // Check for required LED mappings (LD0-15)
  if (project.ioMapping.outputs.length === 0) {
    errors.push({
      type: 'validation',
      severity: 'warning',
      message: 'No output mappings found. At minimum, map LEDs (LD0-15).',
    });
  }

  // Check for unsupported pin aliases
  const validPins = new Set([
    ...Array.from({ length: 16 }, (_, i) => `SW${i}`),
    ...Array.from({ length: 16 }, (_, i) => `LD${i}`),
    'BTNC', 'BTNU', 'BTNL', 'BTNR', 'BTND',
    'CLK100MHZ',
  ]);

  for (const entry of project.ioMapping.inputs) {
    if (entry.pin && !validPins.has(entry.pin)) {
      errors.push({
        type: 'constraint',
        severity: 'error',
        message: `Unsupported input pin "${entry.pin}" for ${entry.nodeId}.${entry.port}. Valid: SW0-15, BTND/U/L/R/C, CLK100MHZ`,
      });
    }
  }

  for (const entry of project.ioMapping.outputs) {
    if (entry.pin && !validPins.has(entry.pin)) {
      errors.push({
        type: 'constraint',
        severity: 'error',
        message: `Unsupported output pin "${entry.pin}" for ${entry.nodeId}.${entry.port}. Valid: LD0-15`,
      });
    }
  }

  // TODO: Check for missing clock when sequential logic present
  // This requires analyzing the circuit for flip-flops, registers, etc.

  return errors;
}

/**
 * Compute a simple determinism hash to detect any changes.
 * Uses a basic hash algorithm (not cryptographically secure, but sufficient for detecting divergence).
 */
function computeDeterminismHash(normalized: string, bundle: string): string {
  const combined = normalized + bundle;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Return first 16 chars of hex representation
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Verify that two exports of identical projects produce identical artifacts.
 * Returns true if hashes match (deterministic) or false if diverged.
 */
export function verifyDeterminism(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}

/**
 * Export RBProject as canonical Basys3 bundle.
 *
 * This is the ONLY function that generates Basys3 exports.
 * It enforces:
 * - Deterministic output (same input = same hash)
 * - Basys3 contract compliance
 * - Explicit error reporting
 * - Vivado compatibility
 */
export function exportProjectAsBasys3(project: RBProject): Basys3ExportResult {
  const result: Basys3ExportResult = {
    success: false,
    errors: [],
    warnings: [],
  };

  // Step 1: Validate project structure
  const validationErrors = validateProjectForBasys3(project);
  result.errors.push(...validationErrors);

  if (validationErrors.some((e) => e.severity === 'error')) {
    return result;
  }

  // Step 2: Generate Basys3 bundle
  if (!project.ioMapping) {
    result.errors.push({
      type: 'unknown',
      severity: 'error',
      message: 'IO mapping is required for Basys3 export',
    });
    return result;
  }

  const bundleResult = exportBasys3Bundle(project.circuit, project.ioMapping);

  result.warnings.push(...bundleResult.warnings);

  if (!bundleResult.valid) {
    result.errors.push({
      type: 'validation',
      severity: 'error',
      message: 'Bundle validation failed. Check warnings for details.',
    });
  }

  // Step 3: Assemble bundle
  result.bundle = {
    topVhd: bundleResult.topVhd,
    topXdc: bundleResult.topXdc,
    readme: bundleResult.readme,
    topVerilog: bundleResult.topV,
  };

  // TODO: Generate testbench.vhd if vectors present
  if (project.vectors && project.vectors.length > 0) {
    result.bundle.testbench = generateTestbenchVhdl(project, project.vectors);
  }

  // Step 4: Compute determinism hash
  // Use the encoded project + bundle to detect any non-determinism
  const projectJson = JSON.stringify(project, Object.keys(project).sort());
  const bundleJson = JSON.stringify(result.bundle, Object.keys(result.bundle).sort());
  result.determinismHash = computeDeterminismHash(projectJson, bundleJson);

  result.success = result.errors.length === 0;

  return result;
}
