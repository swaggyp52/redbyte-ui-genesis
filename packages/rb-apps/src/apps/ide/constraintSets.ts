// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Multiple constraint sets.
 *
 * A project may carry more than one XDC constraint set (e.g. a Basys3 set and a
 * variant), with exactly one active at a time — mirroring Vivado's constrs_1 /
 * constrs_2 fileset model. This is the pure document + operations layer; parsing
 * an active set reuses the existing bounded XDC reader.
 *
 * Deterministic: ids are derived from names (no random component), sets are kept
 * in a stable order, and normalization guarantees exactly one active set when
 * any exist.
 */

import { parseXdcPins, type XdcParseResult } from '../../import/xdcImport';

export const CONSTRAINT_SETS_SCHEMA_VERSION = '1.0' as const;

export interface ConstraintSet {
  id: string;
  name: string;
  xdcText: string;
}

export interface ConstraintSetsDocument {
  schemaVersion: typeof CONSTRAINT_SETS_SCHEMA_VERSION;
  sets: ConstraintSet[];
  /** Id of the active set, or null when there are no sets. */
  activeId: string | null;
}

function slugId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug ? `xdc-${slug}` : 'xdc';
}

export function createEmptyConstraintSets(): ConstraintSetsDocument {
  return { schemaVersion: CONSTRAINT_SETS_SCHEMA_VERSION, sets: [], activeId: null };
}

/** Add a constraint set; the first set added becomes active. Throws on a duplicate name. */
export function addConstraintSet(doc: ConstraintSetsDocument, name: string, xdcText: string): ConstraintSetsDocument {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Constraint set name is required');
  let id = slugId(trimmed);
  if (doc.sets.some((s) => s.name === trimmed)) throw new Error(`Duplicate constraint set "${trimmed}"`);
  // Ensure id uniqueness even when names slug to the same id.
  if (doc.sets.some((s) => s.id === id)) id = `${id}-${doc.sets.length}`;
  const sets = [...doc.sets, { id, name: trimmed, xdcText }];
  return normalizeConstraintSets({ ...doc, sets, activeId: doc.activeId ?? id });
}

/** Remove a set; if it was active, activation falls to the first remaining set. */
export function removeConstraintSet(doc: ConstraintSetsDocument, id: string): ConstraintSetsDocument {
  const sets = doc.sets.filter((s) => s.id !== id);
  const activeId = doc.activeId === id ? (sets[0]?.id ?? null) : doc.activeId;
  return normalizeConstraintSets({ ...doc, sets, activeId });
}

/** Set the active constraint set. A no-op if the id is not present. */
export function setActiveConstraintSet(doc: ConstraintSetsDocument, id: string): ConstraintSetsDocument {
  if (!doc.sets.some((s) => s.id === id)) return doc;
  return { ...doc, activeId: id };
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
 * Normalize a document: drop invalid entries, dedup ids, and guarantee exactly
 * one active set when any exist (falling back to the first). Tolerant of
 * malformed input for decoding.
 */
export function normalizeConstraintSets(value: unknown): ConstraintSetsDocument {
  if (!isRecord(value) || !Array.isArray(value.sets)) return createEmptyConstraintSets();
  const seenIds = new Set<string>();
  const sets: ConstraintSet[] = [];
  for (const entry of value.sets) {
    if (!isRecord(entry)) continue;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!name) continue;
    let id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : slugId(name);
    if (seenIds.has(id)) id = `${id}-${sets.length}`;
    seenIds.add(id);
    const xdcText = typeof entry.xdcText === 'string' ? entry.xdcText : '';
    sets.push({ id, name, xdcText });
  }
  let activeId: string | null = null;
  if (sets.length > 0) {
    const requested = typeof value.activeId === 'string' ? value.activeId : null;
    activeId = requested && sets.some((s) => s.id === requested) ? requested : sets[0]!.id;
  }
  return { schemaVersion: CONSTRAINT_SETS_SCHEMA_VERSION, sets, activeId };
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
