// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Multiple constraint sets.
 *
 * A project may carry more than one XDC constraint set (e.g. a Basys3 set and a
 * variant). A captured set holds structured mapping data; activating it restores
 * that data into the runtime's canonical hardware mapping. Raw XDC remains a
 * reference and is never interpreted as mapping authority.
 *
 * Deterministic: ids are derived from names (no random component), sets are kept
 * in a stable order. A null active id explicitly means live mapping, including
 * when captured sets exist.
 */

import { parseXdcPins, type XdcParseResult } from '../../import/xdcImport';
import { cloneHardwareMappingDocumentV2, materializeIoMappingFromHardwareMappingV2, type HardwareMappingDocumentV2 } from '@redbyte/rb-utils';

export const CONSTRAINT_SETS_SCHEMA_VERSION = '1.0' as const;

export interface ConstraintSet {
  id: string;
  name: string;
  xdcText: string;
  /** Captured structured assignments. Absent for raw/legacy reference text. */
  mappingSnapshot?: HardwareMappingDocumentV2;
}

export interface ConstraintSetsDocument {
  schemaVersion: typeof CONSTRAINT_SETS_SCHEMA_VERSION;
  sets: ConstraintSet[];
  /** Id of the active captured set, or null for the current live mapping. */
  activeId: string | null;
}

function slugId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug ? `xdc-${slug}` : 'xdc';
}

export function createEmptyConstraintSets(): ConstraintSetsDocument {
  return { schemaVersion: CONSTRAINT_SETS_SCHEMA_VERSION, sets: [], activeId: null };
}

/** Capture structured assignments or retain reference text. The first capture becomes active. */
export function addConstraintSet(doc: ConstraintSetsDocument, name: string, xdcText: string, mappingSnapshot?: HardwareMappingDocumentV2): ConstraintSetsDocument {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Constraint set name is required');
  let id = slugId(trimmed);
  if (doc.sets.some((s) => s.name === trimmed)) throw new Error(`Duplicate constraint set "${trimmed}"`);
  // Ensure id uniqueness even when names slug to the same id.
  const baseId = id;
  let suffix = doc.sets.length;
  while (doc.sets.some((s) => s.id === id)) id = `${baseId}-${suffix++}`;
  const snapshot = normalizeMappingSnapshot(mappingSnapshot);
  if (mappingSnapshot && !snapshot) throw new Error('Constraint set has an invalid captured mapping');
  const sets = [...doc.sets, { id, name: trimmed, xdcText, ...(snapshot ? { mappingSnapshot: snapshot } : {}) }];
  return normalizeConstraintSets({ ...doc, sets, activeId: doc.sets.length === 0 && snapshot ? id : doc.activeId });
}

/** Removing an active set preserves current assignments and explicitly returns to live mapping. */
export function removeConstraintSet(doc: ConstraintSetsDocument, id: string): ConstraintSetsDocument {
  const sets = doc.sets.filter((s) => s.id !== id);
  const activeId = doc.activeId === id ? null : doc.activeId;
  return normalizeConstraintSets({ ...doc, sets, activeId });
}

/** Set the active constraint set. A no-op if the id is not present. */
export function setActiveConstraintSet(doc: ConstraintSetsDocument, id: string | null): ConstraintSetsDocument {
  if (id === null) return { ...doc, activeId: null };
  if (!doc.sets.some((s) => s.id === id)) return doc;
  getConstraintSetMapping(doc, id);
  return { ...doc, activeId: id };
}

/** Return an isolated captured mapping; never reconstruct assignments from Tcl. */
export function getConstraintSetMapping(doc: ConstraintSetsDocument, id: string): HardwareMappingDocumentV2 {
  const matches = doc.sets.filter((set) => set.id === id);
  if (matches.length !== 1) throw new Error('Constraint set selection is missing or ambiguous. Select a unique captured set.');
  const snapshot = normalizeMappingSnapshot(matches[0].mappingSnapshot);
  if (!snapshot) throw new Error('This reference has no captured mapping. Capture current pins to create an activatable set.');
  return snapshot;
}

/** Rename a set (id stays stable). Throws on a duplicate name. */
export function renameConstraintSet(doc: ConstraintSetsDocument, id: string, name: string): ConstraintSetsDocument {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Constraint set name is required');
  if (doc.sets.some((s) => s.id !== id && s.name === trimmed)) throw new Error(`Duplicate constraint set "${trimmed}"`);
  const sets = doc.sets.map((s) => (s.id === id ? { ...s, name: trimmed } : s));
  return { ...doc, sets };
}

/** The active constraint set, or undefined when there are none. */
export function activeConstraintSet(doc: ConstraintSetsDocument): ConstraintSet | undefined {
  return doc.sets.find((s) => s.id === doc.activeId);
}

/** Parse the active set's XDC with the bounded reader. Undefined when there is none. */
export function parseActiveConstraintSet(doc: ConstraintSetsDocument): XdcParseResult | undefined {
  const active = activeConstraintSet(doc);
  return active ? parseXdcPins(active.xdcText) : undefined;
}

/**
 * Normalize a document without promoting reference Tcl or malformed snapshots
 * to active authority. Explicit live selection survives persistence.
 */
export function normalizeConstraintSets(value: unknown): ConstraintSetsDocument {
  if (!isRecord(value) || !Array.isArray(value.sets)) return createEmptyConstraintSets();
  const seenIds = new Set<string>();
  const requestedIds = new Set<string>();
  const resolvedIds = new Map<string, string>();
  const ambiguousIds = new Set<string>();
  const sets: ConstraintSet[] = [];
  for (const entry of value.sets) {
    if (!isRecord(entry)) continue;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!name) continue;
    let id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : slugId(name);
    if (requestedIds.has(id)) ambiguousIds.add(id);
    requestedIds.add(id);
    const originalId = id;
    const baseId = id;
    let suffix = sets.length;
    while (seenIds.has(id)) id = `${baseId}-${suffix++}`;
    seenIds.add(id);
    resolvedIds.set(originalId, id);
    const xdcText = typeof entry.xdcText === 'string' ? entry.xdcText : '';
    const mappingSnapshot = normalizeMappingSnapshot(entry.mappingSnapshot);
    sets.push({ id, name, xdcText, ...(mappingSnapshot ? { mappingSnapshot } : {}) });
  }
  let activeId: string | null = null;
  if (sets.length > 0) {
    const requested = typeof value.activeId === 'string' ? value.activeId : null;
    const resolved = requested ? resolvedIds.get(requested) : undefined;
    activeId = requested && !ambiguousIds.has(requested) && resolved && sets.some((s) => s.id === resolved && s.mappingSnapshot) ? resolved : null;
  }
  return { schemaVersion: CONSTRAINT_SETS_SCHEMA_VERSION, sets, activeId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeMappingSnapshot(value: unknown): HardwareMappingDocumentV2 | undefined {
  if (!isMappingSnapshot(value)) return undefined;
  try {
    const snapshot = cloneHardwareMappingDocumentV2(value);
    materializeIoMappingFromHardwareMappingV2(snapshot);
    return snapshot;
  } catch { return undefined; }
}

/** Fail closed for persisted snapshots; all supported mapping forms retain their structure. */
function isMappingSnapshot(value: unknown): value is HardwareMappingDocumentV2 {
  if (!isRecord(value) || value.schemaVersion !== '2.0' || value.boardId !== 'basys3' || !Array.isArray(value.entries)) return false;
  const text = (field: unknown): field is string => typeof field === 'string' && field.trim().length > 0;
  const optionalText = (field: unknown) => field === undefined || typeof field === 'string';
  const index = (field: unknown): field is number => Number.isSafeInteger(field) && Number(field) >= 0;
  const ids = new Set<string>();
  for (const entry of value.entries) {
    if (!isRecord(entry) || !text(entry.id) || ids.has(entry.id) || !text(entry.portName) || !oneOf(entry.direction, ['in', 'out'])) return false;
    ids.add(entry.id);
    if (![entry.label, entry.alias].every(optionalText)) return false;
    if (entry.timingRole !== undefined && !oneOf(entry.timingRole, ['generic', 'clock', 'reset', 'manual_step', 'enable'])) return false;
    if (entry.boardResourceType !== undefined && !oneOf(entry.boardResourceType, ['generic', 'switch', 'button', 'led', 'clock_pin', 'seven_seg'])) return false;
    switch (entry.kind) {
      case 'scalar':
        if (entry.width !== 1 || !text(entry.nodeId) || !text(entry.port) || !optionalText(entry.pin)) return false;
        break;
      case 'bit':
        if (!text(entry.nodeId) || !text(entry.port) || !index(entry.bitIndex) || !optionalText(entry.pin) || !optionalText(entry.parentId)) return false;
        break;
      case 'slice':
        if (!text(entry.nodeId) || !text(entry.port) || !index(entry.msb) || !index(entry.lsb) || entry.msb < entry.lsb || !Array.isArray(entry.pins) || entry.pins.length !== entry.msb - entry.lsb + 1 || !entry.pins.every((pin: unknown) => typeof pin === 'string')) return false;
        break;
      case 'bus': {
        if (!index(entry.width) || entry.width === 0 || !Array.isArray(entry.bits) || entry.bits.length > entry.width) return false;
        const bitIndices = new Set<number>();
        for (const bit of entry.bits) {
          if (!isRecord(bit) || !text(bit.id) || ids.has(bit.id) || !index(bit.bitIndex) || bit.bitIndex >= entry.width || bitIndices.has(bit.bitIndex) || !text(bit.nodeId) || !text(bit.port) || !optionalText(bit.pin) || !optionalText(bit.label)) return false;
          ids.add(bit.id);
          bitIndices.add(bit.bitIndex);
        }
        break;
      }
      case 'group':
        if (!Array.isArray(entry.memberIds) || !entry.memberIds.every(text)) return false;
        break;
      default: return false;
    }
  }
  const entryIds = new Set(value.entries.map(entry => entry.id));
  for (const entry of value.entries) {
    if (entry.kind === 'group' && entry.memberIds.some((id: string) => !entryIds.has(id))) return false;
  }
  return true;
}

function oneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === 'string' && choices.some(choice => choice === value);
}
