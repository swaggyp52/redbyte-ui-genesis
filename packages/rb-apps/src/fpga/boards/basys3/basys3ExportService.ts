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
  aliases: string[];
  key: string;
}

const BASYS3_INPUT_ALIASES = new Set([
  ...Array.from({ length: 16 }, (_, i) => `SW${i}`),
  'BTNC',
  'BTNU',
  'BTNL',
  'BTNR',
  'BTND',
  'CLK100MHZ',
]);

const BASYS3_OUTPUT_ALIASES = new Set(Array.from({ length: 16 }, (_, i) => `LD${i}`));

const BASYS3_ALIAS_TO_PACKAGE_PIN: Record<string, string> = {
  CLK100MHZ: 'W5',
  SW0: 'V17',
  LD0: 'U16',
};

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
    if (!BASYS3_INPUT_ALIASES.has(entry.pin) && !BASYS3_OUTPUT_ALIASES.has(entry.pin)) {
      errors.push({
        type: 'constraint',
        severity: 'error',
        message: `Unsupported input pin "${entry.pin}" for ${entry.nodeId}.${entry.port}. Valid: SW0-15, BTND/U/L/R/C, CLK100MHZ`,
      });
      continue;
    }
    if (BASYS3_OUTPUT_ALIASES.has(entry.pin)) {
      errors.push({
        type: 'constraint',
        severity: 'warning',
        message: `Questionable input mapping "${displayMappingEntry(entry)}" -> ${entry.pin}: input is mapped to an LED alias.`,
      });
    }
  }

  for (const entry of outputMappings) {
    if (!entry.pin) continue;
    if (!BASYS3_OUTPUT_ALIASES.has(entry.pin) && !BASYS3_INPUT_ALIASES.has(entry.pin)) {
      errors.push({
        type: 'constraint',
        severity: 'error',
        message: `Unsupported output pin "${entry.pin}" for ${entry.nodeId}.${entry.port}. Valid: LD0-15`,
      });
      continue;
    }
    if (!BASYS3_OUTPUT_ALIASES.has(entry.pin)) {
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
      return {
        direction,
        nodeId: entry.nodeId,
        port: entry.port,
        id: entry.id,
        label: entry.label,
        pin: pin.length > 0 ? pin : undefined,
        aliases,
        key: `${direction}:${entry.nodeId}.${entry.port}.${entry.id}`,
      };
    })
    .sort((left, right) => compareCodepoint(left.key, right.key));
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
