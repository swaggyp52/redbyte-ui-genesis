// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Migration *plan* for the project-open UX.
 *
 * `decodeRBProject` upgrades an older document silently at its normalization
 * choke point. When a project is *opened by a user*, RedByte should not upgrade
 * behind their back — it should say "this project needs an update", show what
 * will change, and let them open an upgraded copy, export the original untouched,
 * or cancel. This module is the pure analysis layer that powers that dialog: it
 * inspects a parsed document, decides whether a migration is required, and — when
 * it is — computes the migrated document and a human list of changes, without
 * ever mutating the input or touching the on-disk original.
 */

import {
  CURRENT_PROJECT_FORMAT_VERSION,
  RB_PROJECT_FORMAT_MIGRATIONS,
  detectRBProjectFormatVersion,
  migrateRBProjectDocument,
} from './projectFormatMigrations';

export type FormatMigrationStatus = 'current' | 'needs-migration' | 'too-new' | 'invalid';

export interface FormatMigrationPlan {
  status: FormatMigrationStatus;
  /** Detected version of the input, or null when unrecognizable. */
  fromVersion: number | null;
  /** The version the document would be upgraded to (always the current version). */
  toVersion: number;
  /** Human-readable descriptions of each migration that would apply. */
  changes: string[];
  /** Stable migration ids that would apply, in order. */
  appliedIds: string[];
  /** The upgraded document, present only when `status === 'needs-migration'`. */
  migratedDocument?: Record<string, any>;
  /** Present for `too-new` / `invalid`. */
  error?: string;
}

/** A durable record that a migration happened, for the migration log. */
export interface FormatMigrationRecord {
  fromVersion: number;
  toVersion: number;
  appliedIds: string[];
  /** Optional source label (e.g. the file name). */
  source?: string;
  /** Caller-supplied timestamp label — this module never reads the wall clock. */
  atLabel: string;
}

/**
 * Analyze a parsed project document. Never throws — a malformed document is
 * reported as `invalid` with a message.
 */
export function analyzeProjectForMigration(input: unknown): FormatMigrationPlan {
  let fromVersion: number;
  try {
    fromVersion = detectRBProjectFormatVersion(input);
  } catch (error) {
    return {
      status: 'invalid',
      fromVersion: null,
      toVersion: CURRENT_PROJECT_FORMAT_VERSION,
      changes: [],
      appliedIds: [],
      error: error instanceof Error ? error.message : 'Unrecognized project document',
    };
  }

  if (fromVersion > CURRENT_PROJECT_FORMAT_VERSION) {
    return {
      status: 'too-new',
      fromVersion,
      toVersion: CURRENT_PROJECT_FORMAT_VERSION,
      changes: [],
      appliedIds: [],
      error: `This project was saved by a newer RedByte (format v${fromVersion} > v${CURRENT_PROJECT_FORMAT_VERSION}). Update RedByte to open it.`,
    };
  }

  if (fromVersion === CURRENT_PROJECT_FORMAT_VERSION) {
    return {
      status: 'current',
      fromVersion,
      toVersion: CURRENT_PROJECT_FORMAT_VERSION,
      changes: [],
      appliedIds: [],
    };
  }

  try {
    const result = migrateRBProjectDocument(input);
    const changes = result.applied.map(
      (id) => RB_PROJECT_FORMAT_MIGRATIONS.find((m) => m.id === id)?.describe ?? id,
    );
    return {
      status: 'needs-migration',
      fromVersion: result.fromVersion,
      toVersion: result.toVersion,
      changes,
      appliedIds: [...result.applied],
      migratedDocument: result.document,
    };
  } catch (error) {
    return {
      status: 'invalid',
      fromVersion,
      toVersion: CURRENT_PROJECT_FORMAT_VERSION,
      changes: [],
      appliedIds: [],
      error: error instanceof Error ? error.message : 'Migration failed',
    };
  }
}

/** Build a migration record from a plan (caller supplies the timestamp label). */
export function recordFromPlan(plan: FormatMigrationPlan, atLabel: string, source?: string): FormatMigrationRecord {
  return {
    fromVersion: plan.fromVersion ?? 0,
    toVersion: plan.toVersion,
    appliedIds: [...plan.appliedIds],
    source,
    atLabel,
  };
}
