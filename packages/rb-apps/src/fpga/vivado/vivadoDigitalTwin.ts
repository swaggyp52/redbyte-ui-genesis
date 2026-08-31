// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Vivado digital-twin snapshot envelope.
 *
 * A deterministic, versioned record of a Vivado result that was produced
 * **entirely outside RedByte**. RedByte never runs Vivado, synthesis,
 * implementation, timing, or bitstream generation — it *imports* a snapshot as
 * evidence and presents it honestly. `generatedBy` is a constant `'external'`;
 * there is no code path that stamps this as in-browser work.
 *
 * Determinism: serialization sorts artifacts by path, omits absent fields, and
 * uses a stable key order — there is no wall-clock or random value. The external
 * generation time is a *data field* supplied by whoever produced the snapshot,
 * never stamped by RedByte.
 */

import { stableStringify } from '../../export/stableStringify';
import { compareCodepoint } from '../../export/codepointSort';

export const VIVADO_DIGITAL_TWIN_SCHEMA_VERSION = '1.0' as const;

export interface VivadoUtilization {
  lut?: number;
  ff?: number;
  bram?: number;
  dsp?: number;
  io?: number;
}

export interface VivadoTimingSummary {
  /** Worst negative slack (ns). Negative means a timing violation. */
  wns?: number;
  /** Total negative slack (ns). */
  tns?: number;
  /** Whether the external tool reported timing as met. */
  met: boolean;
}

export interface VivadoArtifactRef {
  path: string;
  sha256: string;
  bytes: number;
}

export interface VivadoDigitalTwinSnapshot {
  schemaVersion: typeof VIVADO_DIGITAL_TWIN_SCHEMA_VERSION;
  /** FPGA part, e.g. xc7a35tcpg236-1. */
  part: string;
  topModule: string;
  /** External tool version, e.g. "Vivado 2024.2". */
  toolVersion: string;
  /** Always 'external' — RedByte never generates this snapshot. */
  generatedBy: 'external';
  /** Generation time supplied by the external tool (not stamped by RedByte). */
  generatedAtIso?: string;
  utilization?: VivadoUtilization;
  timing?: VivadoTimingSummary;
  /** Referenced artifacts (reports, checkpoints, bitstream) with content hashes. */
  artifacts: VivadoArtifactRef[];
  notes?: string[];
}

export interface VivadoDigitalTwinInput {
  part: string;
  topModule: string;
  toolVersion: string;
  generatedAtIso?: string;
  utilization?: VivadoUtilization;
  timing?: VivadoTimingSummary;
  artifacts?: VivadoArtifactRef[];
  notes?: string[];
}

export interface VivadoDigitalTwinValidation {
  ok: boolean;
  errors: string[];
}

const HEX64 = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeUtilization(value: unknown): VivadoUtilization | undefined {
  if (!isRecord(value)) return undefined;
  const util: VivadoUtilization = {};
  for (const key of ['lut', 'ff', 'bram', 'dsp', 'io'] as const) {
    const n = readOptionalNumber(value[key]);
    if (n !== undefined) util[key] = n;
  }
  return Object.keys(util).length > 0 ? util : undefined;
}

function normalizeTiming(value: unknown): VivadoTimingSummary | undefined {
  if (!isRecord(value)) return undefined;
  const timing: VivadoTimingSummary = { met: value.met === true };
  const wns = readOptionalNumber(value.wns);
  const tns = readOptionalNumber(value.tns);
  if (wns !== undefined) timing.wns = wns;
  if (tns !== undefined) timing.tns = tns;
  return timing;
}

function normalizeArtifacts(value: unknown): VivadoArtifactRef[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const artifacts: VivadoArtifactRef[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const path = readString(entry.path);
    const sha256 = readString(entry.sha256).toLowerCase();
    const bytes = readOptionalNumber(entry.bytes) ?? 0;
    if (!path || seen.has(path)) continue;
    seen.add(path);
    artifacts.push({ path, sha256, bytes });
  }
  return artifacts.sort((a, b) => compareCodepoint(a.path, b.path));
}

/** Build a normalized, deterministic snapshot envelope from external inputs. */
export function buildVivadoDigitalTwin(input: VivadoDigitalTwinInput): VivadoDigitalTwinSnapshot {
  const snapshot: VivadoDigitalTwinSnapshot = {
    schemaVersion: VIVADO_DIGITAL_TWIN_SCHEMA_VERSION,
    part: readString(input.part),
    topModule: readString(input.topModule),
    toolVersion: readString(input.toolVersion),
    generatedBy: 'external',
    artifacts: normalizeArtifacts(input.artifacts),
  };
  const generatedAtIso = readString(input.generatedAtIso);
  if (generatedAtIso) snapshot.generatedAtIso = generatedAtIso;
  const utilization = normalizeUtilization(input.utilization);
  if (utilization) snapshot.utilization = utilization;
  const timing = normalizeTiming(input.timing);
  if (timing) snapshot.timing = timing;
  const notes = Array.isArray(input.notes) ? input.notes.map(readString).filter(Boolean) : [];
  if (notes.length > 0) snapshot.notes = notes;
  return snapshot;
}

/** Normalize an arbitrary parsed value into a snapshot (for decoding imports). */
export function normalizeVivadoDigitalTwin(value: unknown): VivadoDigitalTwinSnapshot {
  if (!isRecord(value)) {
    return buildVivadoDigitalTwin({ part: '', topModule: '', toolVersion: '' });
  }
  return buildVivadoDigitalTwin({
    part: readString(value.part),
    topModule: readString(value.topModule),
    toolVersion: readString(value.toolVersion),
    generatedAtIso: readString(value.generatedAtIso),
    utilization: value.utilization,
    timing: value.timing,
    artifacts: Array.isArray(value.artifacts) ? value.artifacts : [],
    notes: Array.isArray(value.notes) ? value.notes : [],
  });
}

/** Deterministic serialization — byte-stable for identical input. */
export function serializeVivadoDigitalTwin(snapshot: VivadoDigitalTwinSnapshot): string {
  return stableStringify(snapshot);
}

export function validateVivadoDigitalTwin(snapshot: VivadoDigitalTwinSnapshot): VivadoDigitalTwinValidation {
  const errors: string[] = [];
  if (!snapshot.part) errors.push('Snapshot is missing an FPGA part.');
  if (!snapshot.topModule) errors.push('Snapshot is missing a top module.');
  if (!snapshot.toolVersion) errors.push('Snapshot is missing a tool version.');
  if (snapshot.generatedBy !== 'external') errors.push('Snapshot generatedBy must be external.');
  for (const artifact of snapshot.artifacts) {
    if (artifact.sha256 && !HEX64.test(artifact.sha256)) {
      errors.push(`Artifact "${artifact.path}" has a malformed sha256.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * The honest evidence caption for a snapshot. Always states it was generated
 * outside RedByte and that RedByte performed no synthesis.
 */
export function vivadoSnapshotEvidenceLabel(snapshot: VivadoDigitalTwinSnapshot): string {
  return `Imported Vivado snapshot (${snapshot.toolVersion || 'unknown tool'}) — generated outside RedByte; no in-browser synthesis.`;
}
