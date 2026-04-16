// Copyright (c) 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, CompositeNodeDef } from '@redbyte/rb-logic-core';
import type { MacroDefinition } from './macros/MacroLibrary';
import type { ProjectIoRow } from './projectRuntime';

/**
 * Student-facing structural summary of a RedByte project.
 *
 * Derived purely from runtime state. Used by the Project Overview panel on
 * ProjectSurface to give students a glance at the size/shape of their design
 * and the reusable modules they've defined — the "big project" answer to
 * "what am I looking at?".
 */
export interface ProjectOutlineSummary {
  /** Total nodes on the design canvas. */
  nodeCount: number;
  /** Total connections on the design canvas. */
  connectionCount: number;
  /** Count of top-level boundary INPUT nodes (design inputs). */
  boundaryInputCount: number;
  /** Count of top-level boundary OUTPUT nodes (design outputs). */
  boundaryOutputCount: number;
  /** Distinct node types present on the canvas (e.g. AND, OR, DFF, composite names). */
  nodeTypeBreakdown: Array<{ type: string; count: number }>;
  /** Reusable macros saved by the student. */
  macros: Array<{ id: string; name: string; description: string; ioSummary: string }>;
  /** Custom composite components registered into the project. */
  customComponents: Array<{ name: string; description: string; ioSummary: string }>;
  /** Input IO rows (board-facing or virtual), with mapping status. */
  inputIoRows: Array<{ id: string; label: string; pin: string | null; required: boolean }>;
  /** Output IO rows (board-facing or virtual), with mapping status. */
  outputIoRows: Array<{ id: string; label: string; pin: string | null; required: boolean }>;
}

const BOUNDARY_INPUT_TYPES = new Set(['INPUT', 'input', 'Input']);
const BOUNDARY_OUTPUT_TYPES = new Set(['OUTPUT', 'output', 'Output']);

export function deriveProjectOutlineSummary(input: {
  circuit: Circuit;
  macros: MacroDefinition[];
  customComponents: CompositeNodeDef[];
  ioRows: ProjectIoRow[];
}): ProjectOutlineSummary {
  const { circuit, macros, customComponents, ioRows } = input;

  let boundaryInputCount = 0;
  let boundaryOutputCount = 0;
  const typeCounts = new Map<string, number>();
  for (const node of circuit.nodes) {
    const type = node.type ?? 'unknown';
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    if (BOUNDARY_INPUT_TYPES.has(type)) boundaryInputCount += 1;
    else if (BOUNDARY_OUTPUT_TYPES.has(type)) boundaryOutputCount += 1;
  }

  const nodeTypeBreakdown = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const mapMacros = macros.map((macro) => ({
    id: macro.id,
    name: macro.name,
    description: macro.description?.trim() ?? '',
    ioSummary: `${macro.inputs.length} in · ${macro.outputs.length} out`,
  }));

  const mapComponents = customComponents.map((def) => ({
    name: def.name,
    description: def.description?.trim() ?? '',
    ioSummary: `${Object.keys(def.inputMapping ?? {}).length} in · ${Object.keys(def.outputMapping ?? {}).length} out`,
  }));

  const inputIoRows = ioRows
    .filter((row) => row.direction === 'in')
    .map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      pin: row.pin && row.pin.trim().length > 0 ? row.pin : null,
      required: Boolean(row.required),
    }));

  const outputIoRows = ioRows
    .filter((row) => row.direction === 'out')
    .map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      pin: row.pin && row.pin.trim().length > 0 ? row.pin : null,
      required: Boolean(row.required),
    }));

  return {
    nodeCount: circuit.nodes.length,
    connectionCount: circuit.connections.length,
    boundaryInputCount,
    boundaryOutputCount,
    nodeTypeBreakdown,
    macros: mapMacros,
    customComponents: mapComponents,
    inputIoRows,
    outputIoRows,
  };
}
