/**
 * Active top-entity name derivation — the single source of truth shared by the
 * project runtime store (which OWNS the active top) and the Ide shell (which
 * projects it). Keeping the derivation here means the store and the UI can
 * never disagree on how a project name becomes a top entity or how a
 * user-typed top is normalized.
 */

/** Derive the default HDL top-entity name from a project name. */
export function buildTopEntityName(projectName: string): string {
  const normalized = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
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
  const normalized = (value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized.length === 0) return fallback;
  return /^[A-Za-z_]/.test(normalized) ? normalized : `rb_${normalized}`;
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
