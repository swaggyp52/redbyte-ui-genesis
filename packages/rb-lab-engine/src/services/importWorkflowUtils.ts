/**
 * Import Workflow Utilities
 *
 * Helpers for Shell.tsx to manage full project state restoration during import.
 * Ensures imported circuits load properly in:
 * - Logic Playground (circuit editing, undo/redo, selection)
 * - Virtual Lab (simulation, probes, breakpoints, 3D visualization)
 * - Cross-app synchronization via unifiedProjectStore
 */

import type { LabProjectV1, CircuitV1, Circuit } from '../schema/index.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ImportedProjectState {
  project: LabProjectV1;
  circuit: Circuit;
  metadata: ImportMetadata;
}

export interface ImportMetadata {
  source: 'user-file' | 'example' | 'recovery';
  timestamp: string;
  fileSize?: number;
}

// ============================================================================
// Circuit Conversion
// ============================================================================

/**
 * Convert CircuitV1 (schema format) to Circuit (runtime format) for Logic Playground.
 * This is the standard conversion used when importing or loading projects.
 *
 * The Circuit format is used internally by Logic Playground for editing,
 * while CircuitV1 is the persisted schema format.
 */
export function convertCircuitV1ToCircuit(circuitV1: CircuitV1): Circuit {
  return {
    nodes: circuitV1.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      x: node.x,
      y: node.y,
      rotation: node.rotation,
      config: node.params || {},
      label: node.label,
      state: node.state || {},
      inputs: {},
      outputs: {},
    })),
    connections: circuitV1.connections.map((conn) => ({
      id: conn.id,
      from: conn.fromNodeId,
      fromPin: conn.fromPin,
      to: conn.toNodeId,
      toPin: conn.toPin,
    })),
  };
}

/**
 * Convert Circuit (runtime format) back to CircuitV1 (schema format) for export.
 * This is the inverse of convertCircuitV1ToCircuit.
 */
export function convertCircuitToCircuitV1(circuit: Circuit, existing?: CircuitV1): CircuitV1 {
  return {
    schemaVersion: existing?.schemaVersion || '1.0',
    nodes: circuit.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      x: node.x,
      y: node.y,
      rotation: node.rotation,
      label: node.label,
      params: node.config || {},
      state: node.state || {},
    })),
    connections: circuit.connections.map((conn) => ({
      id: conn.id,
      fromNodeId: conn.from,
      fromPin: conn.fromPin,
      toNodeId: conn.to,
      toPin: conn.toPin,
    })),
    customChips: existing?.customChips || [],
  };
}

// ============================================================================
// Import State Preparation
// ============================================================================

/**
 * Prepare an imported project for UI loading.
 * Converts project data to formats expected by Logic Playground and Virtual Lab.
 *
 * @param project - The imported LabProjectV1 from importEvidenceCapsule
 * @param source - Where the project came from (user file, example, recovery)
 * @returns Prepared state with circuit converted to runtime format
 */
export function prepareImportedProjectState(
  project: LabProjectV1,
  source: 'user-file' | 'example' | 'recovery' = 'user-file'
): ImportedProjectState {
  const circuit = convertCircuitV1ToCircuit(project.circuit);

  return {
    project,
    circuit,
    metadata: {
      source,
      timestamp: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Virtual Lab State Restoration
// ============================================================================

/**
 * Get the simulation state suitable for Virtual Lab initialization.
 * Virtual Lab uses these fields directly from the project.
 */
export function getVirtualLabSimulationState(project: LabProjectV1) {
  return {
    tickRate: project.simulation?.tickRate ?? 20,
    currentTick: project.simulation?.currentTick ?? 0,
    isRunning: project.simulation?.isRunning ?? false,
    breakpoints: project.simulation?.breakpoints ?? [],
    probes: project.simulation?.probes ?? [],
  };
}

/**
 * Verify that imported project has all required Virtual Lab state fields.
 * Returns any missing fields that need defaults.
 */
export function validateVirtualLabState(project: LabProjectV1): Record<string, boolean> {
  return {
    hasTickRate: project.simulation?.tickRate !== undefined,
    hasCurrentTick: project.simulation?.currentTick !== undefined,
    hasBreakpoints: Array.isArray(project.simulation?.breakpoints),
    hasProbes: Array.isArray(project.simulation?.probes),
  };
}

// ============================================================================
// Evidence & Checkpoint Restoration
// ============================================================================

/**
 * Prepare evidence for display in grading/checkpoint UI.
 * Extracts checkpoint snapshots and action history.
 */
export function extractEvidenceData(project: LabProjectV1) {
  return {
    actions: project.evidence?.actions ?? [],
    snapshots: project.evidence?.snapshots ?? [],
    actionCount: project.evidence?.actions?.length ?? 0,
    snapshotCount: project.evidence?.snapshots?.length ?? 0,
  };
}

/**
 * Verify that imported project has valid evidence structure.
 * Ensures grading data is intact.
 */
export function validateEvidenceStructure(project: LabProjectV1): {
  valid: boolean;
  message: string;
} {
  if (!project.evidence) {
    return { valid: false, message: 'Missing evidence object' };
  }

  if (!Array.isArray(project.evidence.actions)) {
    return { valid: false, message: 'Invalid actions array' };
  }

  if (!Array.isArray(project.evidence.snapshots)) {
    return { valid: false, message: 'Invalid snapshots array' };
  }

  return { valid: true, message: 'Evidence structure valid' };
}

// ============================================================================
// Cross-App State Sync
// ============================================================================

/**
 * Extract only the fields needed by unifiedProjectStore.loadProject().
 * Ensures compatibility with the store interface.
 */
export function getUnifiedProjectStorePayload(project: LabProjectV1) {
  return {
    schemaVersion: project.schemaVersion,
    projectId: project.projectId,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    circuit: project.circuit,
    simulation: project.simulation,
    evidence: project.evidence,
  };
}

/**
 * Verify that imported project is compatible with unifiedProjectStore.
 * Checks for all required fields.
 */
export function validateUnifiedProjectStoreCompatibility(project: LabProjectV1): {
  compatible: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  if (!project.schemaVersion) missingFields.push('schemaVersion');
  if (!project.projectId) missingFields.push('projectId');
  if (!project.name) missingFields.push('name');
  if (!project.circuit) missingFields.push('circuit');
  if (!project.simulation) missingFields.push('simulation');
  if (!project.evidence) missingFields.push('evidence');
  if (!project.createdAt) missingFields.push('createdAt');
  if (!project.updatedAt) missingFields.push('updatedAt');

  return {
    compatible: missingFields.length === 0,
    missingFields,
  };
}

// ============================================================================
// File Persistence for Logic Playground
// ============================================================================

/**
 * Generate a safe filename for the imported project in file system.
 * Used by loadImportedProject when creating .rblogic file.
 */
export function generateImportedProjectFilename(project: LabProjectV1): string {
  const baseName = (project.name || 'imported-circuit').trim();
  const safeName = baseName
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return `${safeName || 'imported-circuit'}.rblogic`;
}

/**
 * Create a displayable name for the imported project.
 * Used in UI notifications and window titles.
 */
export function formatImportedProjectDisplayName(project: LabProjectV1): string {
  const maxLength = 50;
  const name = project.name || 'Imported Project';
  return name.length > maxLength ? `${name.substring(0, maxLength)}...` : name;
}

// ============================================================================
// Import Status Reporting
// ============================================================================

/**
 * Generate a human-readable import summary for toast notifications.
 * Reports what was loaded and any warnings.
 */
export function generateImportSummary(
  project: LabProjectV1,
  success: boolean,
  warnings: string[] = []
): string {
  if (!success) {
    return 'Import failed. Check console for details.';
  }

  const parts: string[] = [
    `✅ Imported: ${formatImportedProjectDisplayName(project)}`,
  ];

  if (project.circuit.nodes.length > 0) {
    parts.push(`(${project.circuit.nodes.length} components)`);
  }

  if (warnings.length > 0) {
    parts.push(`⚠️ ${warnings.length} warnings`);
  }

  return parts.join(' ');
}

/**
 * Collect any warnings or issues during import.
 * Helps diagnose import problems without blocking the operation.
 */
export function getImportWarnings(project: LabProjectV1): string[] {
  const warnings: string[] = [];

  if (!project.name) {
    warnings.push('Project has no name');
  }

  if (project.circuit.nodes.length === 0) {
    warnings.push('Circuit is empty (no components)');
  }

  if (project.circuit.nodes.length > 0 && project.circuit.connections.length === 0) {
    warnings.push('Components present but not connected');
  }

  if (!project.simulation?.tickRate) {
    warnings.push('Using default simulation tick rate (20ms)');
  }

  const evidenceValid = validateEvidenceStructure(project);
  if (!evidenceValid.valid) {
    warnings.push(`Evidence issue: ${evidenceValid.message}`);
  }

  return warnings;
}
