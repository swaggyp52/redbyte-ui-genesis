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
import { parseVhdl } from '../../../import/vhdlImport';
import { compareCodepoint } from '../../../export/codepointSort';
import {
  isBasys3InputCapablePin,
  isBasys3OutputCapablePin,
  listKnownBasys3AliasesForDirection,
  normalizeBasys3PinAlias,
  resolveBasys3PackagePin,
} from './basys3Pins';

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

type RequiredPortDirection = 'input' | 'output' | 'either';
type MappingDirection = 'input' | 'output';

interface RequiredPort {
  name: string;
  normalized: string;
  direction: RequiredPortDirection;
}

interface MappingRecord {
  direction: MappingDirection;
  nodeId: string;
  port: string;
  id: string;
  label?: string;
  pin?: string;
  normalizedPin?: string;
  resolvedPackagePin?: string;
  aliases: string[];
  key: string;
}

interface NormalizedConnection {
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
}

const BASYS3_INPUT_ALIAS_LIST = listKnownBasys3AliasesForDirection('input');
const BASYS3_OUTPUT_ALIAS_LIST = listKnownBasys3AliasesForDirection('output');

const SYNTH_SUPPORTED_NODE_TYPES = new Set([
  'INPUT',
  'Switch',
  'Clock',
  'OUTPUT',
  'Lamp',
  'Wire',
  'AND',
  'OR',
  'XOR',
  'NOT',
  'NAND',
  'NOR',
  'XNOR',
  'FullAdder',
  'MUX4',
  'DFlipFlop',
]);

const SEQUENTIAL_NODE_TYPES = new Set(['DFlipFlop']);

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

  const inputMappings = normalizeMappings(project, 'input');
  const outputMappings = normalizeMappings(project, 'output');
  const requiredPorts = deriveRequiredPorts(project);
  const matchedMappingKeys = new Set<string>();

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

  errors.push(...validateSynthSubset(project));
  errors.push(...validateTopPortWidths(project));

  for (const requiredPort of requiredPorts) {
    const mappedInput = findMappingRecord(inputMappings, requiredPort.normalized);
    const mappedOutput = findMappingRecord(outputMappings, requiredPort.normalized);

    if (requiredPort.direction === 'input') {
      if (!mappedInput) {
        errors.push({
          type: 'validation',
          severity: 'error',
          message: mappedOutput
            ? `Required input port "${requiredPort.name}" is mapped as an output. Fix: map "${requiredPort.name}" under Inputs and assign ${suggestBasys3Fix(requiredPort.name, 'input')}.`
            : `Unmapped required input port "${requiredPort.name}". Fix: map "${requiredPort.name}" to ${suggestBasys3Fix(requiredPort.name, 'input')}.`,
        });
        continue;
      }

      matchedMappingKeys.add(mappedInput.key);
      if (!mappedInput.pin) {
        errors.push({
          type: 'validation',
          severity: 'error',
          message: `Input port "${requiredPort.name}" is declared but has no Basys3 pin assignment. Fix: map "${requiredPort.name}" to ${suggestBasys3Fix(requiredPort.name, 'input')}.`,
        });
      }
      continue;
    }

    if (requiredPort.direction === 'output') {
      if (!mappedOutput) {
        errors.push({
          type: 'validation',
          severity: 'error',
          message: mappedInput
            ? `Required output port "${requiredPort.name}" is mapped as an input. Fix: map "${requiredPort.name}" under Outputs and assign ${suggestBasys3Fix(requiredPort.name, 'output')}.`
            : `Unmapped required output port "${requiredPort.name}". Fix: map "${requiredPort.name}" to ${suggestBasys3Fix(requiredPort.name, 'output')}.`,
        });
        continue;
      }

      matchedMappingKeys.add(mappedOutput.key);
      if (!mappedOutput.pin) {
        errors.push({
          type: 'validation',
          severity: 'error',
          message: `Output port "${requiredPort.name}" is declared but has no Basys3 pin assignment. Fix: map "${requiredPort.name}" to ${suggestBasys3Fix(requiredPort.name, 'output')}.`,
        });
      }
      continue;
    }

    const mappedEither = mappedInput ?? mappedOutput;
    if (!mappedEither) {
      errors.push({
        type: 'validation',
        severity: 'error',
        message: `Unmapped required bidirectional port "${requiredPort.name}". Fix: assign an explicit Basys3 pin mapping before export.`,
      });
      continue;
    }

    matchedMappingKeys.add(mappedEither.key);
    if (!mappedEither.pin) {
      errors.push({
        type: 'validation',
        severity: 'error',
        message: `Bidirectional port "${requiredPort.name}" is declared but has no Basys3 pin assignment.`,
      });
    }
  }

  for (const entry of inputMappings) {
    if (!entry.pin) continue;
    if (!entry.resolvedPackagePin) {
      errors.push({
        type: 'constraint',
        severity: 'error',
        message: `Unsupported input pin "${entry.pin}" for ${entry.nodeId}.${entry.port}. Valid aliases: ${BASYS3_INPUT_ALIAS_LIST}. Direct Basys3 package pins are also supported.`,
      });
      continue;
    }
    if (!isBasys3InputCapablePin(entry.pin) && isBasys3OutputCapablePin(entry.pin)) {
      errors.push({
        type: 'constraint',
        severity: 'warning',
        message: `Questionable input mapping "${displayMappingEntry(entry)}" -> ${entry.pin}: input is mapped to an LED alias.`,
      });
    }
  }

  for (const entry of outputMappings) {
    if (!entry.pin) continue;
    if (!entry.resolvedPackagePin) {
      errors.push({
        type: 'constraint',
        severity: 'error',
        message: `Unsupported output pin "${entry.pin}" for ${entry.nodeId}.${entry.port}. Valid aliases: ${BASYS3_OUTPUT_ALIAS_LIST}. Direct Basys3 package pins are also supported.`,
      });
      continue;
    }
    if (!isBasys3OutputCapablePin(entry.pin) && isBasys3InputCapablePin(entry.pin)) {
      errors.push({
        type: 'constraint',
        severity: 'warning',
        message: `Questionable output mapping "${displayMappingEntry(entry)}" -> ${entry.pin}: output is mapped to an input/clock alias.`,
      });
    }
  }

  const unusedMappings = [...inputMappings, ...outputMappings]
    .filter((entry) => !matchedMappingKeys.has(entry.key))
    .sort((left, right) => compareCodepoint(left.key, right.key));
  for (const unused of unusedMappings) {
    errors.push({
      type: 'validation',
      severity: 'warning',
      message: `Unused mapped ${unused.direction} "${displayMappingEntry(unused)}" will be ignored by top-entity export.`,
    });
  }

  errors.push(...collectIgnoredConstraintWarnings(project));

  return errors.sort((left, right) => compareCodepoint(left.message, right.message));
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

  const bundleResult = exportBasys3Bundle(project.circuit, project.ioMapping, {
    entityName: project.hdl?.top,
  });
  const hdlPortProjection = isTopLevelHdlPortProjection(project);
  const filteredBundleWarnings = hdlPortProjection
    ? bundleResult.warnings.filter((warning) => !isHdlProjectionScaffoldWarning(warning))
    : bundleResult.warnings;

  result.warnings.push(...filteredBundleWarnings);

  const allowProjectionWarnings =
    hdlPortProjection &&
    bundleResult.warnings.length > 0 &&
    bundleResult.warnings.every((warning) => isHdlProjectionScaffoldWarning(warning));
  if (!bundleResult.valid && !allowProjectionWarnings) {
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

  // Cross-artifact consistency guard: testbench component ports must agree with entity ports.
  if (result.bundle.testbench) {
    const inconsistencies = validateArtifactConsistency(result.bundle.topVhd, result.bundle.testbench);
    for (const msg of inconsistencies) {
      result.errors.push({ type: 'unknown', severity: 'error', message: msg });
    }
  }

  // Step 4: Compute determinism hash
  // Use the encoded project + bundle to detect any non-determinism
  const projectJson = JSON.stringify(project, Object.keys(project).sort());
  const bundleJson = JSON.stringify(result.bundle, Object.keys(result.bundle).sort());
  result.determinismHash = computeDeterminismHash(projectJson, bundleJson);

  result.success = result.errors.length === 0;

  return result;
}

/**
 * Cross-artifact consistency check: verifies that the generated testbench's
 * component declaration agrees with the top-level entity declaration in top.vhd.
 *
 * Returns error messages for any disagreement found; empty array = consistent.
 * Exported for direct unit testing.
 */
export function validateArtifactConsistency(topVhd: string, testbenchVhd: string): string[] {
  const inconsistencies: string[] = [];

  const entityNameMatch = topVhd.match(/\bentity\s+([A-Za-z_][A-Za-z0-9_]*)\s+is\b/i);
  const entityName = entityNameMatch?.[1]?.trim();
  if (!entityName) {
    inconsistencies.push('Artifact consistency: could not extract entity name from top.vhd.');
    return inconsistencies;
  }

  const entityPorts = extractVhdlEntityPortNames(topVhd);

  // Locate component block; if absent (empty testbench / no vectors) there is nothing to check.
  const componentMatch = testbenchVhd.match(
    /\bcomponent\s+([A-Za-z_][A-Za-z0-9_]*)\s+is[\s\S]*?port\s*\(([^]*?)\)\s*;\s*end\s+component/i
  );
  if (!componentMatch) return inconsistencies;

  const componentName = componentMatch[1].trim();
  if (componentName.toLowerCase() !== entityName.toLowerCase()) {
    inconsistencies.push(
      `Artifact consistency: testbench component "${componentName}" does not match top.vhd entity "${entityName}". Fix: regenerate both artifacts from the same project state.`
    );
  }

  const componentPorts = componentMatch[2]
    .split(';')
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
    .map((e) => e.split(':')[0]?.trim() ?? '')
    .filter((e) => e.length > 0);

  const entityPortSet = new Set(entityPorts.map((p) => p.toLowerCase()));
  const componentPortSet = new Set(componentPorts.map((p) => p.toLowerCase()));

  for (const port of componentPorts) {
    if (!entityPortSet.has(port.toLowerCase())) {
      inconsistencies.push(
        `Artifact consistency: testbench component port "${port}" not found in top.vhd entity ports [${entityPorts.join(', ')}].`
      );
    }
  }
  for (const port of entityPorts) {
    if (!componentPortSet.has(port.toLowerCase())) {
      inconsistencies.push(
        `Artifact consistency: top.vhd entity port "${port}" missing from testbench component declaration.`
      );
    }
  }

  return inconsistencies;
}

function extractVhdlEntityPortNames(vhdlText: string): string[] {
  const portBlock = vhdlText.match(/Port\s*\(([^]*?)\)\s*;\s*end\s+entity/i);
  if (!portBlock) return [];
  return portBlock[1]
    .split(';')
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
    .map((e) => e.split(':')[0]?.trim() ?? '')
    .filter((e) => e.length > 0);
}

function normalizeMappings(project: RBProject, direction: MappingDirection): MappingRecord[] {
  const entries = direction === 'input' ? project.ioMapping?.inputs ?? [] : project.ioMapping?.outputs ?? [];
  return entries
    .map((entry) => {
      const canonicalName =
        (entry.label ?? '').trim() ||
        (entry.id ?? '').trim() ||
        `${entry.nodeId}.${entry.port}`;
      const aliasCandidates = [
        canonicalName,
        entry.label ?? '',
        entry.id ?? '',
        entry.nodeId ?? '',
        entry.port ?? '',
        `${entry.nodeId}_${entry.port}`,
      ];
      const aliases = Array.from(
        new Set(
          aliasCandidates
            .map((value) => normalizeSignalName(value))
            .filter((value) => value.length > 0)
        )
      ).sort((left, right) => compareCodepoint(left, right));
      const pin = (entry.pin ?? '').trim();
      const normalizedPin = pin.length > 0 ? normalizeBasys3PinAlias(pin) : undefined;
      const resolvedPackagePin = pin.length > 0 ? resolveBasys3PackagePin(pin) ?? undefined : undefined;
      return {
        direction,
        nodeId: entry.nodeId,
        port: entry.port,
        id: entry.id,
        label: entry.label,
        pin: pin.length > 0 ? pin : undefined,
        normalizedPin,
        resolvedPackagePin,
        aliases,
        key: `${direction}:${entry.nodeId}.${entry.port}.${entry.id}`,
      };
    })
    .sort((left, right) => compareCodepoint(left.key, right.key));
}

function validateSynthSubset(project: RBProject): Basys3ExportError[] {
  const diagnostics: Basys3ExportError[] = [];
  const circuit = project.circuit;
  const normalizedConnections = normalizeCircuitConnections(circuit);
  const nodesById = new Map(circuit.nodes.map((node) => [node.id, node]));

  for (const node of circuit.nodes) {
    if (SYNTH_SUPPORTED_NODE_TYPES.has(node.type)) continue;
    diagnostics.push({
      type: 'logic',
      severity: 'error',
      message: `Unsupported synth subset node type "${node.type}" on node "${node.id}". Fix: replace it with supported v1 primitives (IO, combinational gates, DFlipFlop).`,
    });
  }

  const inboundByEndpoint = new Map<string, NormalizedConnection[]>();
  for (const connection of normalizedConnections) {
    const endpointKey = `${connection.toNodeId}.${connection.toPort}`;
    const existing = inboundByEndpoint.get(endpointKey);
    if (existing) {
      existing.push(connection);
    } else {
      inboundByEndpoint.set(endpointKey, [connection]);
    }
  }

  for (const [endpointKey, inbound] of inboundByEndpoint.entries()) {
    if (inbound.length < 2) continue;
    const [nodeId, portName] = endpointKey.split('.');
    const sourceList = inbound
      .map((entry) => `${entry.fromNodeId}.${entry.fromPort}`)
      .sort((left, right) => compareCodepoint(left, right))
      .join(', ');
    diagnostics.push({
      type: 'logic',
      severity: 'error',
      message: `Multiple drivers detected for "${nodeId}.${portName}" from: ${sourceList}. Fix: keep exactly one upstream source per input port.`,
    });
  }

  const hasTopLevelHdl = isTopLevelHdlPortProjection(project);
  if (!hasTopLevelHdl) {
    const outputNodes = circuit.nodes.filter((node) => node.type === 'OUTPUT' || node.type === 'Lamp');
    for (const outputNode of outputNodes) {
      const hasDriver = normalizedConnections.some((entry) => entry.toNodeId === outputNode.id);
      if (hasDriver) continue;
      diagnostics.push({
        type: 'logic',
        severity: 'error',
        message: `Floating output detected on node "${outputNode.id}" (${outputNode.label ?? outputNode.id}). Fix: connect a single upstream driver before export.`,
      });
    }
  }

  diagnostics.push(...validateClockResetContract(circuit, normalizedConnections, nodesById));
  diagnostics.push(...detectCombinationalLoopViolations(circuit, normalizedConnections, nodesById));

  return diagnostics;
}

function isTopLevelHdlPortProjection(project: RBProject): boolean {
  if (!project.hdl?.sources?.length) return false;
  if (!project.circuit?.nodes?.length) return false;
  return project.circuit.nodes.every(
    (node) => node.type === 'INPUT' || node.type === 'OUTPUT'
  );
}

export function isHdlProjectionScaffoldWarning(message: string): boolean {
  const trimmed = message.trim();
  return (
    /^Node .+ type "INPUT" not supported for synthesis$/i.test(trimmed) ||
    /^Node .+ type "OUTPUT" not supported for synthesis$/i.test(trimmed) ||
    /^Unsupported node: .+ \(INPUT\)$/i.test(trimmed) ||
    /^Unsupported node: .+ \(OUTPUT\)$/i.test(trimmed) ||
    /^Output ".+" \(id: .+\) has no driver .*$/i.test(trimmed) ||
    /^Top output port ".+" has no driver .*$/i.test(trimmed) ||
    /^Top output port ".+" has unresolved driver .+$/i.test(trimmed)
  );
}

function validateTopPortWidths(project: RBProject): Basys3ExportError[] {
  const diagnostics: Basys3ExportError[] = [];
  const sources = project.hdl?.sources ?? [];
  if (sources.length === 0) return diagnostics;

  const topModuleName = ((project.fpga?.top ?? project.hdl?.top ?? '').trim() || 'top').toLowerCase();

  for (const source of sources) {
    if (source.language !== 'vhdl') continue;
    const parsed = parseVhdl(source.text ?? '');
    if (parsed.entityName.toLowerCase() !== topModuleName) continue;
    for (const port of parsed.ports) {
      if (!/vector/i.test(port.typeName)) continue;
      diagnostics.push({
        type: 'validation',
        severity: 'error',
        message: `Unsupported bus port "${port.name}" (${port.typeName}) in top entity "${parsed.entityName}". Fix: synth subset v1 supports single-bit std_logic ports only.`,
      });
    }
  }

  return diagnostics;
}

function validateClockResetContract(
  circuit: RBProject['circuit'],
  normalizedConnections: NormalizedConnection[],
  nodesById: Map<string, RBProject['circuit']['nodes'][number]>
): Basys3ExportError[] {
  const diagnostics: Basys3ExportError[] = [];
  const sequentialNodes = circuit.nodes.filter((node) => SEQUENTIAL_NODE_TYPES.has(node.type));
  if (sequentialNodes.length === 0) return diagnostics;

  const clockDrivers = new Set<string>();
  const resetDrivers = new Set<string>();
  const enableDrivers = new Set<string>();

  for (const node of sequentialNodes) {
    const inbound = normalizedConnections.filter((entry) => entry.toNodeId === node.id);
    const clockInputs = inbound.filter((entry) => /^(clk|clock|c|ck)$/i.test(entry.toPort));
    if (clockInputs.length === 0) {
      diagnostics.push({
        type: 'logic',
        severity: 'error',
        message: `Sequential node "${node.id}" is missing a clock input. Fix: connect "${node.id}.clk" to a mapped clock source (for example clk -> CLK100MHZ / W5).`,
      });
      continue;
    }
    if (clockInputs.length > 1) {
      diagnostics.push({
        type: 'logic',
        severity: 'error',
        message: `Sequential node "${node.id}" has multiple clock drivers. Fix: keep one deterministic clock source for "${node.id}.clk".`,
      });
    }
    for (const entry of clockInputs) {
      clockDrivers.add(`${entry.fromNodeId}.${entry.fromPort}`);
    }

    const resetInputs = inbound.filter((entry) => /^(rst|reset|clr|clear)$/i.test(entry.toPort));
    if (resetInputs.length > 1) {
      diagnostics.push({
        type: 'logic',
        severity: 'error',
        message: `Sequential node "${node.id}" has multiple reset drivers. Fix: keep one active-high reset source for "${node.id}.rst".`,
      });
    }
    for (const entry of resetInputs) {
      resetDrivers.add(`${entry.fromNodeId}.${entry.fromPort}`);
      const driverNode = nodesById.get(entry.fromNodeId);
      if (driverNode?.type === 'NOT') {
        diagnostics.push({
          type: 'logic',
          severity: 'error',
          message: `Unsupported reset polarity on "${node.id}.rst": source "${entry.fromNodeId}" inverts reset. Fix: synth subset v1 requires direct active-high reset wiring.`,
        });
      }
    }

    const enableInputs = inbound.filter((entry) => /^(en|enable)$/i.test(entry.toPort));
    for (const entry of enableInputs) {
      enableDrivers.add(`${entry.fromNodeId}.${entry.fromPort}`);
    }
  }

  if (clockDrivers.size > 1) {
    const sortedDrivers = Array.from(clockDrivers).sort((left, right) => compareCodepoint(left, right));
    diagnostics.push({
      type: 'logic',
      severity: 'error',
      message: `Multiple clock domains detected (${sortedDrivers.join(', ')}). Fix: synth subset v1 supports exactly one clock domain.`,
    });
  }

  if (resetDrivers.size > 1) {
    const sortedResets = Array.from(resetDrivers).sort((left, right) => compareCodepoint(left, right));
    diagnostics.push({
      type: 'logic',
      severity: 'warning',
      message: `Multiple reset sources detected (${sortedResets.join(', ')}). Verify all sequential nodes use one consistent reset source.`,
    });
  }

  if (enableDrivers.size > 1) {
    const sortedEnable = Array.from(enableDrivers).sort((left, right) => compareCodepoint(left, right));
    diagnostics.push({
      type: 'logic',
      severity: 'warning',
      message: `Multiple enable sources detected (${sortedEnable.join(', ')}). Verify deterministic enable semantics before export.`,
    });
  }

  return diagnostics;
}

function detectCombinationalLoopViolations(
  circuit: RBProject['circuit'],
  normalizedConnections: NormalizedConnection[],
  nodesById: Map<string, RBProject['circuit']['nodes'][number]>
): Basys3ExportError[] {
  const diagnostics: Basys3ExportError[] = [];
  const adjacency = new Map<string, Set<string>>();
  const nonSequentialNodes = new Set(
    circuit.nodes
      .filter((node) => !SEQUENTIAL_NODE_TYPES.has(node.type))
      .map((node) => node.id)
  );

  for (const nodeId of nonSequentialNodes) {
    adjacency.set(nodeId, new Set());
  }

  for (const connection of normalizedConnections) {
    if (!nonSequentialNodes.has(connection.fromNodeId)) continue;
    if (!nonSequentialNodes.has(connection.toNodeId)) continue;
    adjacency.get(connection.fromNodeId)?.add(connection.toNodeId);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const parent = new Map<string, string>();
  let cycle: string[] | null = null;

  const buildCycle = (fromId: string, toId: string): string[] => {
    const nodes = [toId];
    let cursor = fromId;
    while (cursor !== toId && parent.has(cursor)) {
      nodes.push(cursor);
      cursor = parent.get(cursor) ?? toId;
    }
    nodes.push(toId);
    return nodes.reverse();
  };

  const dfs = (nodeId: string): boolean => {
    visited.add(nodeId);
    inStack.add(nodeId);

    for (const next of adjacency.get(nodeId) ?? []) {
      if (!visited.has(next)) {
        parent.set(next, nodeId);
        if (dfs(next)) return true;
        continue;
      }
      if (!inStack.has(next)) continue;
      cycle = buildCycle(nodeId, next);
      return true;
    }

    inStack.delete(nodeId);
    return false;
  };

  for (const nodeId of nonSequentialNodes) {
    if (visited.has(nodeId)) continue;
    if (dfs(nodeId)) break;
  }

  if (cycle && cycle.length > 0) {
    const cycleLabel = cycle
      .map((nodeId) => {
        const node = nodesById.get(nodeId);
        return node ? `${node.id}(${node.type})` : nodeId;
      })
      .join(' -> ');
    diagnostics.push({
      type: 'logic',
      severity: 'error',
      message: `Combinational loop detected: ${cycleLabel}. Fix: break the loop with a sequential element (DFlipFlop) or remove feedback.`,
    });
  }

  return diagnostics;
}

function normalizeCircuitConnections(circuit: RBProject['circuit']): NormalizedConnection[] {
  return circuit.connections
    .map((connection) => ({
      fromNodeId:
        typeof connection.from === 'string' ? connection.from : connection.from.nodeId,
      fromPort:
        typeof connection.from === 'string'
          ? connection.fromPin ?? connection.fromPort ?? 'out'
          : connection.from.portName ?? connection.from.port ?? 'out',
      toNodeId:
        typeof connection.to === 'string' ? connection.to : connection.to.nodeId,
      toPort:
        typeof connection.to === 'string'
          ? connection.toPin ?? connection.toPort ?? 'in'
          : connection.to.portName ?? connection.to.port ?? 'in',
    }))
    .sort((left, right) => {
      const leftKey = `${left.fromNodeId}.${left.fromPort}->${left.toNodeId}.${left.toPort}`;
      const rightKey = `${right.fromNodeId}.${right.fromPort}->${right.toNodeId}.${right.toPort}`;
      return compareCodepoint(leftKey, rightKey);
    });
}

function findMappingRecord(entries: MappingRecord[], normalizedPortName: string): MappingRecord | undefined {
  return entries.find((entry) => entry.aliases.includes(normalizedPortName));
}

function deriveRequiredPorts(project: RBProject): RequiredPort[] {
  const required = new Map<string, RequiredPort>();

  const register = (name: string, direction: RequiredPortDirection) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const normalized = normalizeSignalName(trimmed);
    if (!normalized) return;
    const existing = required.get(normalized);
    if (!existing) {
      required.set(normalized, { name: trimmed, normalized, direction });
      return;
    }
    existing.direction = mergeRequiredDirection(existing.direction, direction);
  };

  for (const topPort of extractTopEntityPorts(project)) {
    register(topPort.name, topPort.direction);
  }

  for (const node of project.circuit.nodes) {
    const declared = (node.label ?? '').trim() || node.id;
    if (!declared) continue;
    if (node.type === 'Switch' || node.type === 'InputPin' || node.type === 'INPUT' || node.type === 'Clock') {
      register(declared, 'input');
      continue;
    }
    if (node.type === 'Lamp' || node.type === 'OUTPUT') {
      register(declared, 'output');
    }
  }

  return Array.from(required.values()).sort((left, right) => compareCodepoint(left.name, right.name));
}

function mergeRequiredDirection(
  left: RequiredPortDirection,
  right: RequiredPortDirection
): RequiredPortDirection {
  if (left === right) return left;
  return 'either';
}

function extractTopEntityPorts(project: RBProject): Array<{ name: string; direction: RequiredPortDirection }> {
  const sources = project.hdl?.sources ?? [];
  if (sources.length === 0) return [];

  const topModuleName = ((project.fpga?.top ?? project.hdl?.top ?? '').trim() || 'top').toLowerCase();
  const portMap = new Map<string, RequiredPortDirection>();

  const addPort = (name: string, direction: RequiredPortDirection) => {
    const normalized = normalizeSignalName(name);
    if (!normalized) return;
    const existing = portMap.get(normalized);
    if (!existing) {
      portMap.set(normalized, direction);
      return;
    }
    portMap.set(normalized, mergeRequiredDirection(existing, direction));
  };

  for (const source of sources) {
    if (source.language === 'vhdl') {
      const parsed = parseVhdl(source.text ?? '');
      if (parsed.entityName.toLowerCase() !== topModuleName) continue;
      for (const port of parsed.ports) {
        addPort(port.name, port.direction === 'out' ? 'output' : 'input');
      }
      continue;
    }

    if (source.language === 'verilog') {
      const verilogPorts = parseVerilogTopPorts(source.text ?? '', topModuleName);
      for (const port of verilogPorts) {
        addPort(port.name, port.direction);
      }
    }
  }

  return Array.from(portMap.entries())
    .map(([normalized, direction]) => ({ name: normalized, direction }))
    .sort((left, right) => compareCodepoint(left.name, right.name));
}

function parseVerilogTopPorts(
  sourceText: string,
  topModuleName: string
): Array<{ name: string; direction: RequiredPortDirection }> {
  const moduleRegex = /module\s+([A-Za-z_]\w*)\s*\(([\s\S]*?)\)\s*;/gi;
  const result: Array<{ name: string; direction: RequiredPortDirection }> = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = moduleRegex.exec(sourceText)) !== null) {
    if (match[1].toLowerCase() !== topModuleName) continue;
    const rawPortBlock = match[2];
    const tokens = rawPortBlock
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);
    for (const token of tokens) {
      const inline = token.match(/\b(input|output|inout)\b(?:\s+(?:wire|reg|logic))?\s+([A-Za-z_]\w*)/i);
      if (inline) {
        const name = inline[2];
        const normalized = normalizeSignalName(name);
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        result.push({
          name,
          direction: inline[1].toLowerCase() === 'output'
            ? 'output'
            : inline[1].toLowerCase() === 'inout'
              ? 'either'
              : 'input',
        });
        continue;
      }
      const bareName = token.replace(/\[[^\]]+\]/g, '').trim();
      if (!/^[A-Za-z_]\w*$/.test(bareName)) continue;
      const normalized = normalizeSignalName(bareName);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push({ name: bareName, direction: 'either' });
    }
  }
  return result;
}

function normalizeSignalName(name: string): string {
  return name.trim().toLowerCase();
}

function displayMappingEntry(entry: MappingRecord): string {
  return (entry.label ?? '').trim() || entry.id || `${entry.nodeId}.${entry.port}`;
}

function suggestBasys3Fix(portName: string, direction: MappingDirection): string {
  const normalized = normalizeSignalName(portName);
  if (normalized === 'clk' || normalized === 'clock' || normalized === 'clk100mhz') {
    return '"CLK100MHZ / W5"';
  }
  if (direction === 'input') {
    return '"SW0 / V17"';
  }
  return '"LD0 / U16"';
}

function collectIgnoredConstraintWarnings(project: RBProject): Basys3ExportError[] {
  const constraintText = project.fpga?.constraints?.text;
  if (!constraintText || constraintText.trim().length === 0) {
    return [];
  }

  const ignoredDirectives = new Set<string>();
  const lines = constraintText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const directiveMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (!directiveMatch) continue;
    const directive = directiveMatch[1].toLowerCase();
    if (directive === 'set_property' && /\bpackage_pin\b/i.test(trimmed)) {
      ignoredDirectives.add('set_property(PACKAGE_PIN)');
      continue;
    }
    ignoredDirectives.add(directive);
  }

  return Array.from(ignoredDirectives)
    .sort((left, right) => compareCodepoint(left, right))
    .map((directive) => ({
      type: 'constraint' as const,
      severity: 'warning' as const,
      message: `Ignoring source XDC directive "${directive}" during deterministic Basys3 export; constraints are regenerated from IO mapping.`,
    }));
}
