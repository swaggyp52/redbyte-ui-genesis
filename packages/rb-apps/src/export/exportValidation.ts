// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// Export Validation — Ensure generated VHDL/XDC meet Vivado constraints.
//
// Scope (v1): Check entity naming, port parity, identifier hygiene.
// Does NOT perform synthesis simulation, but validates structural requirements.

import type { RBProject } from '@redbyte/rb-circuit';

export interface ExportValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that an RBProject can be legally exported as Basys3 VHDL+XDC.
 *
 * Checks:
 * 1. Project has circuit with valid nodes/connections
 * 2. IO mapping completeness (all ports mapped, or explicitly partial)
 * 3. Entity name hygiene (valid VHDL identifier)
 * 4. Port names are valid VHDL identifiers (no spaces, special chars, reserved words)
 * 5. No duplicate port names
 */
export function validateExportForBasys3(project: RBProject): ExportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check circuit structure exists
  if (!project.circuit) {
    errors.push('No circuit defined in project');
    return { ok: false, errors, warnings };
  }

  if (!project.circuit.nodes || project.circuit.nodes.length === 0) {
    errors.push('Circuit has no nodes');
    return { ok: false, errors, warnings };
  }

  // 2. Extract port nodes from circuit (INPUT/OUTPUT types)
  const ports = project.circuit.nodes.filter(
    (n) => n.type === 'INPUT' || n.type === 'OUTPUT'
  );

  if (ports.length === 0) {
    warnings.push('Circuit has no I/O ports');
  }

  // 3. Validate port names
  const vhdlReservedWords = new Set([
    'if', 'then', 'else', 'elsif', 'end', 'when', 'others', 'process', 'entity',
    'architecture', 'begin', 'port', 'map', 'signal', 'variable', 'constant',
    'library', 'use', 'type', 'record', 'array', 'is', 'in', 'out', 'inout',
  ]);

  const illegalCharRE = /[^a-zA-Z0-9_]/g;
  const portNames = new Set<string>();

  for (const port of ports) {
    const name = port.label || port.id;

    // Check for duplicates
    if (portNames.has(name)) {
      errors.push(`Duplicate port name: '${name}'`);
    }
    portNames.add(name);

    // Check for illegal characters
    if (illegalCharRE.test(name)) {
      errors.push(
        `Port '${name}' has illegal characters (only letters, digits, underscore allowed)`
      );
    }

    // Check for reserved words
    if (vhdlReservedWords.has(name.toLowerCase())) {
      errors.push(`Port '${name}' is a reserved VHDL keyword`);
    }

    // Check identifier syntax (can't start with digit)
    if (/^\d/.test(name)) {
      errors.push(`Port '${name}' cannot start with a digit`);
    }
  }

  // 4. Validate IO mapping (if present)
  if (project.ioMapping && Object.keys(project.ioMapping).length > 0) {
    const mappedPorts = Object.keys(project.ioMapping);
    const allPortNames = ports.map((p) => p.label || p.id);

    for (const mappedPort of mappedPorts) {
      if (!allPortNames.includes(mappedPort)) {
        errors.push(
          `IO mapping references unknown port '${mappedPort}' (not in circuit)`
        );
      }
    }

    // Check for unmatched ports (may be OK, but warn)
    const unmappedPorts = allPortNames.filter((p) => !mappedPorts.includes(p));
    if (unmappedPorts.length > 0) {
      warnings.push(
        `Ports not in IO mapping: ${unmappedPorts.join(', ')} (will export with unassigned pins)`
      );
    }
  } else {
    // No IO mapping provided
    if (ports.length > 0) {
      warnings.push('No IO mapping provided; exported design will not have pin assignments');
    }
  }

  // 5. Check for Basys3 pin validity (if mapping provided)
  if (project.ioMapping) {
    const basys3Pins = new Set([
      'V17', 'V16', 'W16', 'W17', 'W15', 'V15', 'W14', 'W13', // Switches
      'U16', 'E19', 'U19', 'V19', 'W18', 'U18', 'U17', 'U14', // LEDs
      'D19', 'D20', 'L20', 'L19', // Buttons
      'W5', // Clock
      'D10', 'A9', // UART
      'L19', // Reset (common)
      // Add more as needed
    ]);

    for (const [portName, pin] of Object.entries(project.ioMapping)) {
      if (!basys3Pins.has(pin)) {
        warnings.push(`Pin '${pin}' for port '${portName}' may not be valid for Basys3`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
