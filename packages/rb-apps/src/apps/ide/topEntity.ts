/**
 * Active top-entity name derivation — the single source of truth shared by the
 * project runtime store (which OWNS the active top) and the Ide shell (which
 * projects it). Keeping the derivation here means the store and the UI can
 * never disagree on how a project name becomes a top entity or how a
 * user-typed top is normalized.
 */

import { VHDL_RESERVED_WORDS } from './vhdlNames';

/**
 * Why a name cannot be the top entity, or null when it can: it must analyse as a VHDL
 * identifier (letter first; letters, digits and single underscores; no trailing underscore)
 * and must not be a reserved word (a project named "Register" made a top that never analysed).
 */
export function topEntityNameProblem(name: string): string | null {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name)) {
    return 'Top entity must start with a letter and use only letters, digits, or underscores (max 64 characters).';
  }
  if (/__|_$/.test(name)) return 'Top entity cannot contain two underscores in a row or end with an underscore.';
  if (VHDL_RESERVED_WORDS.has(name.toLowerCase())) return `"${name}" is a VHDL reserved word; choose another top entity name.`;
  return null;
}

/** A normalized identifier that analyses: single underscores, never a reserved word. */
function analysableIdentifier(value: string): string {
  const collapsed = value.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return VHDL_RESERVED_WORDS.has(collapsed.toLowerCase()) ? `${collapsed}_top` : collapsed;
}

/** Derive the default HDL top-entity name from a project name. */
export function buildTopEntityName(projectName: string): string {
  const normalized = analysableIdentifier(projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_'));
  const base = normalized.length > 0 ? normalized : 'redbyte_top';
  return /^[a-z]/.test(base) ? base : `rb_${base}`;
}

/**
 * Normalize a candidate top-entity name to a valid HDL identifier, falling
 * back to `fallbackTopEntity` (typically {@link buildTopEntityName}) when the
 * candidate is empty or reduces to nothing.
 */
export function normalizeTopEntityName(
  value: string | undefined,
  fallbackTopEntity: string
): string {
  const fallback = fallbackTopEntity.trim().length > 0 ? fallbackTopEntity : 'redbyte_top';
  const normalized = analysableIdentifier((value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_'));
  if (normalized.length === 0) return fallback;
  return /^[A-Za-z]/.test(normalized) ? normalized : `rb_${normalized}`;
}

/**
 * Resolve the active top for a project from its saved top (hdl/fpga) and name,
 * mirroring what the Ide shell historically derived on load. The saved top
 * wins when present; otherwise the name-derived default is used.
 */
export function resolveActiveTopEntity(
  savedTop: string | undefined,
  projectName: string
): string {
  return normalizeTopEntityName(savedTop, buildTopEntityName(projectName));
}
