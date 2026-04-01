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

import type { CircuitIR, SimulationModel } from '@redbyte/rb-logic-core';
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
import { buildBasys3ExportModel } from './basys3ExportModel';

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

const BASYS3_INPUT_ALIAS_LIST = listKnownBasys3AliasesForDirection('input');
const BASYS3_OUTPUT_ALIAS_LIST = listKnownBasys3AliasesForDirection('output');

interface ExportAuthorityContext {
  ir: CircuitIR;
  simModel: SimulationModel;
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

  const authority: ExportAuthorityContext = buildBasys3ExportModel(project.circuit, project.ioMapping);
  const inputMappings = normalizeMappings(project, 'input');
  const outputMappings = normalizeMappings(project, 'output');
  const requiredPorts = deriveRequiredPorts(project, authority.ir);
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

  errors.push(...validateSynthSubset(project, authority.ir, authority.simModel));
  errors.push(...validateTopPortWidths(project));
  errors.push(...validateMultipleDrivers(project));

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

  // Duplicate physical pin detection — two ports sharing the same Basys3 package pin causes
  // Vivado DRC failure at implementation time. Surface this as a hard error before export.
  const pinToMappings = new Map<string, MappingRecord[]>();
  for (const entry of [...inputMappings, ...outputMappings]) {
    if (!entry.resolvedPackagePin) continue;
    const existing = pinToMappings.get(entry.resolvedPackagePin) ?? [];
    existing.push(entry);
    pinToMappings.set(entry.resolvedPackagePin, existing);
  }
  for (const [packagePin, dupeEntries] of pinToMappings) {
    if (dupeEntries.length < 2) continue;
    const conflictList = dupeEntries
      .map((e) => `"${displayMappingEntry(e)}" (${e.direction})`)
      .sort((left, right) => compareCodepoint(left, right))
      .join(', ');
    errors.push({
      type: 'constraint',
      severity: 'error',
      message: `Duplicate pin assignment: Basys3 package pin ${packagePin} is used by ${conflictList}. Each physical pin can only be assigned to one port.`,
    });
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

  // ── Testbench compatibility fallback ─────────────────────────────────────────
  // This is the ONLY alternate testbench generation path.
  //
  // Authority hierarchy for testbench.vhd:
  //   1. buildRuntimeBackedTestbench (in buildExportViewModel) — PRIMARY path.
  //      Uses activeScenario.vectors + VerifyScheduleContract from the last Verify run.
  //      This path respects the assertionMask and carries full provenance.
  //
  //   2. This path (basys3ExportService) — COMPAT FALLBACK only.
  //      Used when buildExportViewModel has no activeScenario and no runtimeVerifyRun.
  //      Reads project.vectors directly; no assertionMask; schedule derived from circuit.
  //      This path exists to ensure bundle.testbench is populated for legacy callers that
  //      do not pass an activeScenario (e.g. raw export API calls, unit tests without run).
  //
  // Export is never blocked by Verify state — testbench is generated regardless of whether
  // the last Verify run passed, failed, is stale, or has not run at all.
  //
  // DO NOT add a third testbench generation path. All future paths must go through
  // buildRuntimeBackedTestbench or this documented compat fallback.
  if (project.vectors && project.vectors.length > 0) {
    // Pass the entity VHDL so that component/signal declarations mirror the entity exactly.
    result.bundle.testbench = generateTestbenchVhdl(project, project.vectors, {
      entityVhd: result.bundle.topVhd,
    });
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

  const entityPorts = extractVhdlEntityPortInfos(topVhd);
  const entityPortNames = entityPorts.map((port) => port.name);

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

  const componentPorts = extractDeclaredPortNames(componentMatch[2]);

  const entityPortSet = new Set(entityPortNames.map((p) => p.toLowerCase()));
  const componentPortSet = new Set(componentPorts.map((p) => p.toLowerCase()));

  for (const port of componentPorts) {
    if (!entityPortSet.has(port.toLowerCase())) {
      inconsistencies.push(
        `Artifact consistency: testbench component port "${port}" not found in top.vhd entity ports [${entityPortNames.join(', ')}].`
      );
    }
  }
  for (const port of entityPortNames) {
    if (!componentPortSet.has(port.toLowerCase())) {
      inconsistencies.push(
        `Artifact consistency: top.vhd entity port "${port}" missing from testbench component declaration.`
      );
    }
  }

  inconsistencies.push(
    ...validateTestbenchSignalTargets(testbenchVhd, entityPorts),
  );

  return inconsistencies;
}

function extractVhdlEntityPortNames(vhdlText: string): string[] {
  return extractVhdlEntityPortInfos(vhdlText).map((port) => port.name);
}

interface VhdlPortInfo {
  name: string;
  direction: 'in' | 'out' | 'inout';
  isVector: boolean;
  vectorWidth?: number;
}

interface VhdlSignalInfo {
  name: string;
  isVector: boolean;
  vectorWidth?: number;
}

function extractVhdlEntityPortInfos(vhdlText: string): VhdlPortInfo[] {
  const portBlock = vhdlText.match(/Port\s*\(([^]*?)\)\s*;\s*end\s+entity/i);
  if (!portBlock) return [];
  return parseVhdlPortInfos(portBlock[1]);
}

function extractDeclaredPortNames(portBlock: string): string[] {
  return parseVhdlPortInfos(portBlock).map((port) => port.name);
}

function parseVhdlPortInfos(portBlock: string): VhdlPortInfo[] {
  const ports: VhdlPortInfo[] = [];

  for (const entry of portBlock.split(';').map((value) => value.trim()).filter((value) => value.length > 0)) {
    const colonIndex = entry.indexOf(':');
    if (colonIndex < 0) continue;

    const names = entry
      .slice(0, colonIndex)
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const remainder = entry.slice(colonIndex + 1).trim();
    const directionMatch = remainder.match(/^(in|out|inout)\s+(.+)$/i);
    if (!directionMatch) continue;

    const direction = directionMatch[1].toLowerCase() as VhdlPortInfo['direction'];
    const typeDecl = directionMatch[2].trim().toLowerCase();
    const isVector = typeDecl.includes('vector');
    const widthMatch = typeDecl.match(/\((\d+)\s+downto\s+0\)/);
    const vectorWidth = widthMatch ? Number.parseInt(widthMatch[1], 10) + 1 : undefined;

    for (const name of names) {
      ports.push({
        name,
        direction,
        isVector,
        vectorWidth,
      });
    }
  }

  return ports;
}

function extractTestbenchSignalInfos(testbenchVhd: string): Map<string, VhdlSignalInfo> {
  const signals = new Map<string, VhdlSignalInfo>();

  for (const match of testbenchVhd.matchAll(/\bsignal\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^;]+);/gi)) {
    const name = match[1]?.trim();
    const typeDecl = match[2]?.trim().toLowerCase() ?? '';
    if (!name) continue;

    const isVector = typeDecl.includes('vector');
    const widthMatch = typeDecl.match(/\((\d+)\s+downto\s+0\)/);
    const vectorWidth = widthMatch ? Number.parseInt(widthMatch[1], 10) + 1 : undefined;
    signals.set(name.toLowerCase(), { name, isVector, vectorWidth });
  }

  return signals;
}

function extractSignalRef(rawRef: string): { base: string; index?: number } | null {
  const trimmed = rawRef.trim();
  const indexedMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\((\d+)\)$/);
  if (indexedMatch) {
    return {
      base: indexedMatch[1],
      index: Number.parseInt(indexedMatch[2], 10),
    };
  }

  const bareMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!bareMatch) return null;
  return { base: bareMatch[1] };
}

function validateTestbenchSignalTargets(
  testbenchVhd: string,
  entityPorts: VhdlPortInfo[],
): string[] {
  const issues: string[] = [];
  const signals = extractTestbenchSignalInfos(testbenchVhd);
  const entityPortsByName = new Map(entityPorts.map((port) => [port.name.toLowerCase(), port] as const));

  const validateTarget = (kind: 'stimulus' | 'assertion', rawRef: string) => {
    const ref = extractSignalRef(rawRef);
    if (!ref) return;

    const signal = signals.get(ref.base.toLowerCase());
    if (!signal) {
      issues.push(
        `Artifact consistency: testbench ${kind} target "${rawRef}" is not declared in testbench signal declarations.`
      );
      return;
    }

    if (typeof ref.index === 'number') {
      if (!signal.isVector) {
        issues.push(
          `Artifact consistency: testbench ${kind} target "${rawRef}" indexes scalar signal "${signal.name}".`
        );
        return;
      }
      if (typeof signal.vectorWidth === 'number' && ref.index >= signal.vectorWidth) {
        issues.push(
          `Artifact consistency: testbench ${kind} target "${rawRef}" is out of range for signal "${signal.name}".`
        );
        return;
      }
    }

    const port = entityPortsByName.get(ref.base.toLowerCase());
    if (!port) return;

    if (kind === 'stimulus' && port.direction === 'out') {
      issues.push(
        `Artifact consistency: testbench stimulus target "${rawRef}" references output port "${port.name}".`
      );
    }
    if (kind === 'assertion' && port.direction === 'in') {
      issues.push(
        `Artifact consistency: testbench assertion target "${rawRef}" references input port "${port.name}".`
      );
    }
  };

  for (const match of testbenchVhd.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*(?:\(\d+\))?)\s*<=/gm)) {
    validateTarget('stimulus', match[1]);
  }

  for (const match of testbenchVhd.matchAll(/^\s*assert\s+([A-Za-z_][A-Za-z0-9_]*(?:\(\d+\))?)\s*=/gm)) {
    validateTarget('assertion', match[1]);
  }

  return issues;
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

/**
 * Multiple-driver detection for export constraint validation.
 *
 * Two connections to the same destination port produce an invalid net that would
 * cause Vivado to fail during elaboration (cannot resolve multi-driven signal).
 * The design canvas already catches this at the UI level via designIssues.ts, but
 * export validation must also check it independently so the error surfaces with a
 * clear Vivado-facing message even if the canvas guard was bypassed (e.g. programmatic
 * project loading or HDL import paths).
 */
function validateMultipleDrivers(project: RBProject): Basys3ExportError[] {
  const diagnostics: Basys3ExportError[] = [];
  const driverCount = new Map<string, number>();

  for (const conn of project.circuit?.connections ?? []) {
    const key = `${conn.to?.nodeId ?? (conn as Record<string, unknown>).toNodeId}.${conn.to?.portName ?? (conn as Record<string, unknown>).toPort}`;
    driverCount.set(key, (driverCount.get(key) ?? 0) + 1);
  }

  const multiDriven = Array.from(driverCount.entries())
    .filter(([, count]) => count > 1)
    .sort(([a], [b]) => compareCodepoint(a, b));

  for (const [portKey, count] of multiDriven) {
    diagnostics.push({
      type: 'logic',
      severity: 'error',
      message: `Multiple drivers (${count}) on port "${portKey}". Fix: only one connection may drive each input port. Vivado will reject multi-driven signals during elaboration.`,
    });
  }

  return diagnostics;
}

function validateSynthSubset(
  project: RBProject,
  ir: CircuitIR,
  simModel: SimulationModel,
): Basys3ExportError[] {
  const diagnostics: Basys3ExportError[] = [];
  const seenMessages = new Set<string>();
  const hasTopLevelHdl = isTopLevelHdlPortProjection(project);

  const pushDiagnostic = (diagnostic: Basys3ExportError): void => {
    if (seenMessages.has(diagnostic.message)) return;
    seenMessages.add(diagnostic.message);
    diagnostics.push(diagnostic);
  };

  for (const diagnostic of ir.diagnostics) {
    if (hasTopLevelHdl && diagnostic.code === 'IR003') continue;
    if (
      (diagnostic.code === 'IR004' || diagnostic.code === 'IR005') &&
      isSatisfiedByDirectInputMapping(project, diagnostic.nodeId, diagnostic.port)
    ) {
      continue;
    }
    pushDiagnostic({
      type: 'logic',
      severity: diagnostic.severity === 'info' ? 'warning' : diagnostic.severity,
      message: diagnostic.message,
    });
  }

  if (ir.features.hasCombinationalLoop) {
    pushDiagnostic({
      type: 'logic',
      severity: 'error',
      message:
        'Combinational loop detected. Fix: use a supported sequential primitive (DLatch/DFlipFlop/RSLatch), the exact 4-NAND D-latch topology, or remove unsupported feedback.',
    });
  }

  for (const diagnostic of validateClockResetContract(ir, simModel)) {
    pushDiagnostic(diagnostic);
  }

  // Sequential boundary enforcement: block export on unsupported temporal patterns.
  // These mirror the temporal issue checks in verifySchedule.ts so that Export and Verify
  // agree on what is supported. Verify blocks via hasUnsupportedTemporal; Export blocks here.
  if (project.hdl?.sources) {
    for (const source of project.hdl.sources) {
      if (/falling_edge\s*\(/i.test(source.text ?? '')) {
        pushDiagnostic({
          type: 'logic',
          severity: 'error',
          message:
            'Unsupported temporal construct: falling_edge(). RedByte v1 only supports rising-edge-triggered sequential logic.',
        });
        break;
      }
    }
  }

  const activeLowResetPattern = /^(reset_n|rst_n|nreset|nrst)$/i;
  for (const binding of simModel.resetBindings) {
    const signalName = binding.canonicalName ?? binding.netName ?? '';
    if (activeLowResetPattern.test(signalName)) {
      pushDiagnostic({
        type: 'logic',
        severity: 'error',
        message: `Unsupported reset convention: "${signalName}" suggests active-low reset. RedByte v1 only supports active-high reset signals.`,
      });
      break;
    }
  }

  return diagnostics.sort((left, right) => compareCodepoint(left.message, right.message));
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
    /^Top output port ".+" has unresolved driver .+$/i.test(trimmed) ||
    /^HDL ports missing in XDC: .+$/i.test(trimmed) ||
    /^XDC ports missing in HDL: .+$/i.test(trimmed)
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
  ir: CircuitIR,
  simModel: SimulationModel,
): Basys3ExportError[] {
  const diagnostics: Basys3ExportError[] = [];
  const statefulPrimitives = ir.primitives.filter((primitive) =>
    ['DFlipFlop', 'DLatch', 'TFlipFlop', 'JKFlipFlop'].includes(primitive.type)
  );
  if (statefulPrimitives.length === 0) return diagnostics;

  const primitiveById = new Map(ir.primitives.map((primitive) => [primitive.id, primitive]));
  const netsByName = new Map(ir.nets.map((net) => [net.name, net]));
  const clockDrivers = new Set(
    simModel.clockBindings
      .map((binding) => binding.canonicalName ?? binding.netName ?? binding.primitiveId)
      .filter((binding): binding is string => typeof binding === 'string' && binding.length > 0),
  );
  const resetDrivers = new Set(
    simModel.resetBindings
      .map((binding) => binding.canonicalName ?? binding.netName ?? binding.primitiveId)
      .filter((binding): binding is string => typeof binding === 'string' && binding.length > 0),
  );

  // Sequential circuit with no clock at all — this will produce a Vivado DRC error
  // and an untestable testbench. Surface as a hard error before export.
  // Constraint check: clock is a REQUIRED pin when any stateful primitive exists.
  if (clockDrivers.size === 0) {
    diagnostics.push({
      type: 'constraint',
      severity: 'error',
      message: `Sequential circuit (${statefulPrimitives.length} stateful element${statefulPrimitives.length > 1 ? 's' : ''}) has no clock signal bound. Fix: add a Clock node to the circuit and map it to Basys3 pin CLK (W5) in IO mapping.`,
    });
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

  for (const primitive of statefulPrimitives) {
    if (!primitive.resetBinding) continue;
    const resetNet = netsByName.get(primitive.resetBinding);
    if (!resetNet || resetNet.drivers.length !== 1) continue;
    const resetDriverPrimitive = primitiveById.get(resetNet.drivers[0]?.nodeId ?? '');
    if (resetDriverPrimitive?.type !== 'NOT') continue;
    diagnostics.push({
      type: 'logic',
      severity: 'error',
      message: `Unsupported reset polarity on "${primitive.id}.rst": source "${resetDriverPrimitive.id}" inverts reset. Fix: synth subset v1 requires direct active-high reset wiring.`,
    });
  }

  return diagnostics;
}

function findMappingRecord(entries: MappingRecord[], normalizedPortName: string): MappingRecord | undefined {
  return entries.find((entry) => entry.aliases.includes(normalizedPortName));
}

function deriveRequiredPorts(project: RBProject, ir: CircuitIR): RequiredPort[] {
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

  for (const port of ir.ports) {
    const direction = port.kind === 'output' ? 'output' : 'input';
    register(port.name, direction);
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

const PORT_ALIAS_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ['a', 'in1'],
  ['b', 'in2'],
  ['c', 'in3'],
  ['clk', 'clock', 'ck'],
  ['rst', 'reset', 'clr', 'clear'],
  ['en', 'enable'],
  ['q_inv', 'qbar', 'q_not'],
];

function portAliases(name: string): string[] {
  const normalized = normalizeSignalName(name);
  for (const group of PORT_ALIAS_GROUPS) {
    if (group.includes(normalized)) return [...group];
  }
  return [normalized];
}

function portsEquivalent(left: string, right: string): boolean {
  const leftAliases = new Set(portAliases(left));
  return portAliases(right).some((alias) => leftAliases.has(alias));
}

function isSatisfiedByDirectInputMapping(
  project: RBProject,
  nodeId: string | undefined,
  port: string | undefined,
): boolean {
  if (!project.ioMapping || !nodeId || !port) return false;
  return project.ioMapping.inputs.some(
    (entry) => entry.nodeId === nodeId && portsEquivalent(entry.port, port),
  );
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
