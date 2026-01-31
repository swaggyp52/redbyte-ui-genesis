// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Project format versioning and migration pipeline.
 *
 * State domains:
 * - OSState: windows, preferences (managed by rb-shell/rb-windowing)
 * - AppState: per-window temporary state (managed by app components)
 * - ProjectState: persisted artifacts (circuits, evidence, files)
 *
 * Rules:
 * - No app imports OS store directly (use shell APIs)
 * - Projects include schemaVersion for forward migration
 * - Migration pipeline: v1 → v2 → v3 with migrateProject()
 */

export const CURRENT_PROJECT_SCHEMA_VERSION = 2;

export interface ProjectMeta {
  projectSchemaVersion: number;
  name: string;
  createdAt: string;
  modifiedAt: string;
  appVersion: string;
}

export interface ProjectState {
  meta: ProjectMeta;
  /** Raw project data — shape depends on schema version */
  data: Record<string, unknown>;
}

type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

const migrations: Record<number, MigrationFn> = {
  // v1 → v2: Add default settings, normalize circuit format
  1: (data) => {
    return {
      ...data,
      settings: data.settings ?? {},
      _migratedFrom: 1,
    };
  },
};

/**
 * Migrate a project from its current schema version to the latest.
 * Returns null if migration is impossible.
 */
export function migrateProject(project: ProjectState): ProjectState | null {
  let { meta, data } = project;
  let version = meta.projectSchemaVersion;

  if (version > CURRENT_PROJECT_SCHEMA_VERSION) {
    // Future version — can't downgrade
    return null;
  }

  while (version < CURRENT_PROJECT_SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) {
      // No migration path from this version
      return null;
    }
    data = migrate(data);
    version++;
  }

  return {
    meta: {
      ...meta,
      projectSchemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      modifiedAt: new Date().toISOString(),
    },
    data,
  };
}

/**
 * Create a new empty project.
 */
export function createProject(name: string, appVersion: string): ProjectState {
  const now = new Date().toISOString();
  return {
    meta: {
      projectSchemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      name,
      createdAt: now,
      modifiedAt: now,
      appVersion,
    },
    data: {},
  };
}

/**
 * Validate that a project can be loaded.
 * Returns an error message or null if valid.
 */
export function validateProject(project: unknown): string | null {
  if (!project || typeof project !== 'object') {
    return 'Project is not an object';
  }
  const p = project as Record<string, unknown>;
  if (!p.meta || typeof p.meta !== 'object') {
    return 'Missing project metadata';
  }
  const meta = p.meta as Record<string, unknown>;
  if (typeof meta.projectSchemaVersion !== 'number') {
    return 'Missing projectSchemaVersion';
  }
  if (meta.projectSchemaVersion > CURRENT_PROJECT_SCHEMA_VERSION) {
    return `Project was created with a newer version (schema v${meta.projectSchemaVersion}). Please update RedByte OS.`;
  }
  return null;
}
