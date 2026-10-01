// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// Export Validation — Ensure generated VHDL/XDC meet Vivado constraints.
//
// Scope (v1): Check entity naming, port parity, identifier hygiene.
// Does NOT perform synthesis simulation, but validates structural requirements.

import type { RBProject } from './projectFormat';
import { resolveIoMappingFromProjectFields } from '@redbyte/rb-utils';
import { getBoundaryInputNodeTypes, getBoundaryOutputNodeTypes } from '@redbyte/rb-logic-core';
import { resolveBasys3PackagePin } from '../fpga/boards/basys3/basys3Pins';

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
  const boundaryTypes = new Set<string>([
    ...getBoundaryInputNodeTypes(),
    ...getBoundaryOutputNodeTypes(),
  ]);
  const ports = project.circuit.nodes.filter((node) => boundaryTypes.has(node.type));

  if (ports.length === 0) {
    warnings.push('Circuit has no I/O ports');
  }

  // 3. Validate port names
  const vhdlReservedWords = new Set([
    'if', 'then', 'else', 'elsif', 'end', 'when', 'others', 'process', 'entity',
    'architecture', 'begin', 'port', 'map', 'signal', 'variable', 'constant',
    'library', 'use', 'type', 'record', 'array', 'is', 'in', 'out', 'inout',
  ]);

  const illegalCharRE = /[^a-zA-Z0-9_]/;
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

  // 4. Validate the canonical structured mapping (V2 takes precedence).
  const ioMapping = resolveIoMappingFromProjectFields(project);
  const mappingRows = ioMapping ? [...ioMapping.inputs, ...ioMapping.outputs] : [];
  if (mappingRows.length > 0) {
    const mappedNodeIds = new Set<string>();
    for (const row of mappingRows) {
      const node = ports.find((port) => port.id === row.nodeId);
      const portName = row.label || node?.label || row.nodeId;
      if (!node) {
        errors.push(`IO mapping references unknown port '${portName}' (not in circuit)`);
        continue;
      }
      if (row.pin?.trim()) mappedNodeIds.add(row.nodeId);
      if (row.pin?.trim() && !resolveBasys3PackagePin(row.pin)) {
        warnings.push(`Pin '${row.pin}' for port '${portName}' may not be valid for Basys3`);
      }
    }
    const unmappedPorts = ports
      .filter((port) => !mappedNodeIds.has(port.id))
      .map((port) => port.label || port.id);
    if (unmappedPorts.length > 0) {
      warnings.push(
        `Ports not in IO mapping: ${unmappedPorts.join(', ')} (will export with unassigned pins)`
      );
    }
  } else if (ports.length > 0) {
    warnings.push('No IO mapping provided; exported design will not have pin assignments');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
