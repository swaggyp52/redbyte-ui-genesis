import type { HardwareMappingRow } from '../HardwareSurface';
import type {
  Basys3BoardProfile,
  Basys3BoardResource,
} from '../../../../fpga/boards/basys3/basys3Pins';
import type { Basys3SemanticMappingProjection } from '../../../../fpga/boards/basys3/basys3ExportContract';
import { deriveMappingCompleteness } from '../../hardwareMappingBridge';

/**
 * Pin planner projection — a PURE read-model over the canonical mapping
 * authorities. It never mutates, never invents board metadata, and renders
 * `null` for any fact the board profile / export contract does not provide.
 *
 * Authorities consumed (never duplicated):
 * - `HardwareMappingRow[]` — the flattened per-signal mapping rows that
 *   HardwareSurface already receives (`projectIoRows` in projectRuntime).
 * - `Basys3BoardProfile` — versioned official-source board facts
 *   (resources, package pins, IOSTANDARD, clock capability).
 * - Optional `Basys3SemanticMappingProjection[]` — the export contract's
 *   semantic-to-artifact projection; when present it wins for artifact port
 *   names and conflict states, exactly as in HardwareSurface's table.
 */

export type PinPlannerStatus =
  | 'conflict'
  | 'needs-review'
  | 'unassigned'
  | 'assigned'
  | 'optional';

export interface PinPlannerRow {
  /** Stable mapping-row id — the handle every mutation callback expects. */
  rowId: string;
  /** Student-facing logical signal name. */
  logical: string;
  direction: 'in' | 'out';
  required: boolean;
  /**
   * Exact generated artifact (HDL/XDC) port name from the export contract.
   * Null when no contract projection covers this row — the planner has no
   * authority to derive artifact port names itself.
   */
  port: string | null;
  /** Board resource alias (e.g. SW0); null when the saved pin token resolves to no known board resource. */
  resource: string | null;
  /** Official board resource label; null when unavailable. */
  resourceLabel: string | null;
  /** Resolved package pin (e.g. V17); null when unassigned or unresolvable. */
  packagePin: string | null;
  /** IOSTANDARD from board metadata; null when no resource metadata exists. */
  ioStandard: string | null;
  /**
   * True/false only when board metadata proves it; null when the row has no
   * resolved board resource (capability unknown, never fabricated).
   */
  clockCapable: boolean | null;
  status: PinPlannerStatus;
}

export interface PinPlannerProjectionOptions {
  /** Export-contract mapping projection, keyed by logicalSignalId === rowId. */
  mappingProjection?: readonly Basys3SemanticMappingProjection[];
  /**
   * Canonical alias→package-pin resolver (pass `resolveBasys3PackagePin` at
   * the integration site so alternate aliases like `CLK`/`LED3` resolve).
   * Defaults to a resolver derived from the supplied board profile only.
   */
  resolvePackagePin?: (pinToken: string) => string | null;
}

interface ResourceLookup {
  byAlias: Map<string, Basys3BoardResource>;
  byPackagePin: Map<string, Basys3BoardResource>;
}

function buildResourceLookup(profile: Basys3BoardProfile): ResourceLookup {
  const byAlias = new Map<string, Basys3BoardResource>();
  const byPackagePin = new Map<string, Basys3BoardResource>();
  for (const entry of profile.resources) {
    byAlias.set(entry.alias.toUpperCase(), entry);
    if (!byPackagePin.has(entry.packagePin.toUpperCase())) {
      byPackagePin.set(entry.packagePin.toUpperCase(), entry);
    }
  }
  return { byAlias, byPackagePin };
}

/**
 * Mirrors HardwareSurface's `splitMappingSignalLabel` presentation rule:
 * a trailing parenthetical is the logical meaning, the prefix is the
 * physical hint (e.g. "LD0 (SUM0)" -> logical SUM0).
 */
function extractLogicalFromLabel(label: string): string {
  const normalized = label.replace(/\s+/g, ' ').trim().toUpperCase();
  const parenthetical = normalized.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (!parenthetical) return normalized;
  return parenthetical[2]?.trim() || normalized;
}

const PROJECTION_HARD_CONFLICT_STATES = new Set([
  'direction-mismatch',
  'duplicate-package-pin',
  'artifact-port-collision',
]);

/**
 * Build planner rows from the canonical mapping rows + board profile.
 * Pure and deterministic: same inputs, same output, input order preserved.
 */
export function buildPinPlannerRows(
  mappingRows: readonly HardwareMappingRow[],
  boardProfile: Basys3BoardProfile,
  options: PinPlannerProjectionOptions = {}
): PinPlannerRow[] {
  const lookup = buildResourceLookup(boardProfile);
  const resolvePin =
    options.resolvePackagePin ??
    ((pinToken: string): string | null => {
      const normalized = pinToken.trim().toUpperCase();
      if (!normalized) return null;
      const byAlias = lookup.byAlias.get(normalized);
      if (byAlias) return byAlias.packagePin;
      if (lookup.byPackagePin.has(normalized)) return normalized;
      return null;
    });

  const projectionById = new Map<string, Basys3SemanticMappingProjection>();
  for (const entry of options.mappingProjection ?? []) {
    projectionById.set(entry.logicalSignalId, entry);
  }

  // Duplicate-pin detection mirrors HardwareSurface's mappingPinConflictKey:
  // key by resolved package pin when possible, else the raw upper-cased token.
  const pinUsageCounts = new Map<string, number>();
  const conflictKeyByRowId = new Map<string, string>();
  for (const row of mappingRows) {
    const token = row.pin.trim();
    if (!token) continue;
    const key = resolvePin(token) ?? token.toUpperCase();
    conflictKeyByRowId.set(row.id, key);
    pinUsageCounts.set(key, (pinUsageCounts.get(key) ?? 0) + 1);
  }

  return mappingRows.map((row) => {
    const projection = projectionById.get(row.id);
    const token = row.pin.trim();
    const resolvedPin = token ? resolvePin(token) : null;
    const resource = token
      ? lookup.byAlias.get(token.toUpperCase()) ??
        (resolvedPin ? lookup.byPackagePin.get(resolvedPin.toUpperCase()) : undefined) ??
        undefined
      : undefined;

    const conflictKey = conflictKeyByRowId.get(row.id);
    const duplicatePin = Boolean(
      conflictKey && (pinUsageCounts.get(conflictKey) ?? 0) > 1
    );
    const projectionHardConflict = Boolean(
      projection && PROJECTION_HARD_CONFLICT_STATES.has(projection.conflictState)
    );
    const completeness = deriveMappingCompleteness(row);
    const unresolvableToken = token.length > 0 && !resolvedPin && !resource;
    const isMissing = projection
      ? projection.required && projection.conflictState === 'missing-pin'
      : row.required && token.length === 0;

    const status: PinPlannerStatus =
      projectionHardConflict || duplicatePin
        ? 'conflict'
        : projection?.conflictState === 'invalid-resource' ||
            completeness === 'partial' ||
            unresolvableToken
          ? 'needs-review'
          : isMissing
            ? 'unassigned'
            : row.required
              ? 'assigned'
              : 'optional';

    return {
      rowId: row.id,
      logical: projection?.logicalLabel
        ? extractLogicalFromLabel(projection.logicalLabel)
        : extractLogicalFromLabel(row.label || row.id),
      direction: row.direction,
      required: row.required,
      port: projection?.artifactPortName?.trim() || null,
      resource: resource?.alias ?? null,
      resourceLabel: projection?.boardResourceLabel ?? resource?.label ?? null,
      packagePin: projection?.packagePin ?? resolvedPin ?? null,
      // IOSTANDARD only when a real resource or contract-resolved pin backs it.
      ioStandard:
        resource?.ioStandard ?? (projection?.packagePin ? projection.ioStandard : null),
      clockCapable: resource
        ? resource.compatibleSignalCategories.includes('clock')
        : null,
      status,
    };
  });
}
