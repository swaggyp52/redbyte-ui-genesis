// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Versioned project-format contract for the portable `.rbproj` codec.
 *
 * This module is the single source of truth for the RedByte project *format
 * version* and the ordered migration ladder that upgrades an older serialized
 * document to the current version. It is deliberately decode-side only and
 * shape-agnostic: it operates on plain records and never touches the canonical
 * encode output, so making the format migration-safe does not perturb the
 * byte-identical golden export gates.
 *
 * Invariants:
 * - `detectRBProjectFormatVersion` maps a document to an integer version.
 *   A version-less but project-shaped document (has a `circuit`) is legacy `v0`.
 * - `migrateRBProjectDocument` upgrades v(from) -> current by applying each
 *   registered migration in order. It is a no-op for a document already at the
 *   current version, so current-version documents round-trip unchanged.
 * - A document whose version is newer than the current supported version is
 *   rejected with an honest "newer than supported" error rather than silently
 *   mangled.
 * - Migrations are append-only and never renumbered once shipped.
 */

export const CURRENT_PROJECT_FORMAT_VERSION = 1 as const;

export interface RBProjectFormatMigration {
  /** The document version this migration upgrades *from*. */
  readonly from: number;
  /** The document version this migration produces. Must be `from + 1`. */
  readonly to: number;
  /** Stable identifier, recorded in migration results. Never renamed once shipped. */
  readonly id: string;
  /** Human-readable summary of what the migration changes. */
  readonly describe: string;
  /** Pure upgrade: returns a new document at version `to`; never mutates input. */
  migrate(doc: Record<string, any>): Record<string, any>;
}

export interface RBProjectMigrationResult {
  /** The document upgraded to `toVersion` (`CURRENT_PROJECT_FORMAT_VERSION`). */
  readonly document: Record<string, any>;
  /** The detected version of the input document. */
  readonly fromVersion: number;
  /** The version after migration (always the current version on success). */
  readonly toVersion: number;
  /** The ids of the migrations applied, in order (empty when already current). */
  readonly applied: readonly string[];
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * v0 -> v1: stamp the explicit versioned envelope onto a pre-versioned document.
 *
 * A "v0" document is one that predates the explicit `formatVersion`/`version`
 * field: it looks like a project (carries a `circuit`) but has no numeric
 * version. Everything else about the shape (legacy coordinate `x/y`, string or
 * aliased connection refs, `Base[N]` bus label groups) is already tolerated and
 * normalized by `normalizeRBProject`, so the only structural change this
 * migration must make is to declare the envelope.
 */
const MIGRATION_V0_TO_V1: RBProjectFormatMigration = {
  from: 0,
  to: 1,
  id: 'v0-to-v1-stamp-envelope',
  describe: 'Stamp the explicit rb-project / version:1 envelope onto a pre-versioned document.',
  migrate: (doc) => ({
    ...doc,
    kind: 'rb-project',
    version: 1,
  }),
};

/**
 * Ordered, append-only migration ladder. Each entry upgrades exactly one
 * version step. Later slices add `v1 -> v2` (source/fileset model), etc.
 */
export const RB_PROJECT_FORMAT_MIGRATIONS: readonly RBProjectFormatMigration[] = [
  MIGRATION_V0_TO_V1,
];

/**
 * Determine the format version of a parsed project document.
 * Throws for documents that are not recognizable as RedByte projects at all.
 */
export function detectRBProjectFormatVersion(input: unknown): number {
  if (!isRecord(input)) {
    throw new Error('Invalid project: not an object');
  }
  const version = input.version;
  if (typeof version === 'number') {
    if (!Number.isInteger(version) || version < 0) {
      throw new Error(
        `Invalid project: format version must be a non-negative integer (got ${String(version)})`
      );
    }
    return version;
  }
  if (version !== undefined && version !== null) {
    throw new Error('Invalid project: format version must be a number');
  }
  // No explicit version. Accept only if the document is project-shaped.
  if (isRecord(input.circuit)) {
    return 0;
  }
  throw new Error('Invalid project: unrecognized document (missing version and circuit)');
}

/**
 * Upgrade a parsed project document to {@link CURRENT_PROJECT_FORMAT_VERSION}.
 *
 * The returned {@link RBProjectMigrationResult.document} is at the current
 * version and ready for {@link normalizeRBProject}. This never validates the
 * document's *content* beyond version handling — that remains the normalizer's
 * job — so callers must still normalize the result.
 */
export function migrateRBProjectDocument(input: unknown): RBProjectMigrationResult {
  const fromVersion = detectRBProjectFormatVersion(input);
  if (fromVersion > CURRENT_PROJECT_FORMAT_VERSION) {
    throw new Error(
      `Invalid project: format version ${fromVersion} is newer than supported ` +
        `(${CURRENT_PROJECT_FORMAT_VERSION}); update RedByte to open it`
    );
  }

  let document = input as Record<string, any>;
  let version = fromVersion;
  const applied: string[] = [];

  while (version < CURRENT_PROJECT_FORMAT_VERSION) {
    const step = RB_PROJECT_FORMAT_MIGRATIONS.find((migration) => migration.from === version);
    if (!step) {
      throw new Error(`Invalid project: no migration path from format version ${version}`);
    }
    document = step.migrate(document);
    version = step.to;
    applied.push(step.id);
    // Convergence guard: the ladder is finite; never loop more than its length.
    if (applied.length > RB_PROJECT_FORMAT_MIGRATIONS.length) {
      throw new Error('Invalid project: migration ladder did not converge');
    }
  }

  return { document, fromVersion, toVersion: version, applied };
}
