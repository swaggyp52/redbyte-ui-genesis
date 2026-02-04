// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Current schema version
 */
export const CURRENT_LAB_PROJECT_SCHEMA_VERSION = '1.0';
/**
 * Supported schema versions (in order)
 */
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0'];
/**
 * Registry of migration functions
 * Key: "from version" → Function that migrates to "to version"
 *
 * Example:
 *   '1.0': (project) => { return { ...project, newField: defaultValue } }
 *
 * Currently empty because 1.0 is initial version.
 * When 2.0 is introduced, add migration here.
 */
const migrations = {
// '1.0': (project) => {
//   // Migrate from 1.0 to 2.0
//   return {
//     ...project,
//     schemaVersion: '2.0',
//     newV2Field: defaultValue,
//   };
// },
};
/**
 * Validate that schemaVersion is a known version
 */
export function isSupportedVersion(version) {
    return SUPPORTED_SCHEMA_VERSIONS.includes(version);
}
/**
 * Migrate a project to the current schema version
 *
 * Returns:
 * - Success: { success: true, project: migratedProject }
 * - Current version: { success: true, project, alreadyCurrent: true }
 * - Future version: { success: false, error: 'Project is newer than this client' }
 * - Invalid version: { success: false, error: 'Unknown schema version' }
 */
export function migrateLabProject(project) {
    const version = project.schemaVersion;
    // Validate version is known
    if (!isSupportedVersion(version)) {
        return { success: false, error: `Unknown schema version: ${version}` };
    }
    // If already current, return as-is
    if (version === CURRENT_LAB_PROJECT_SCHEMA_VERSION) {
        return { success: true, project, alreadyCurrent: true };
    }
    // Find migration path
    let current = project;
    let currentVersion = version;
    // For future expansion: migrate through intermediate versions
    // while (currentVersion !== CURRENT_LAB_PROJECT_SCHEMA_VERSION) {
    //   const migrate = migrations[currentVersion];
    //   if (!migrate) {
    //     return { success: false, error: `No migration path from schema ${currentVersion}` };
    //   }
    //   current = migrate(current);
    //   currentVersion = current.schemaVersion;
    // }
    return { success: true, project: current };
}
/**
 * Validate a project can be loaded
 *
 * Strict validation: catches schema issues early
 */
export function validateLabProject(project) {
    if (!project || typeof project !== 'object') {
        return { valid: false, error: 'Project is not an object' };
    }
    const p = project;
    // Check schemaVersion exists
    if (!('schemaVersion' in p)) {
        return { valid: false, error: 'Missing schemaVersion field' };
    }
    const { schemaVersion } = p;
    if (typeof schemaVersion !== 'string') {
        return { valid: false, error: `schemaVersion must be a string, got ${typeof schemaVersion}` };
    }
    // Check version is supported
    if (!isSupportedVersion(schemaVersion)) {
        // Note: Future version is OK at this stage (user may upgrade)
        // Return warning in separate check function
        return { valid: false, error: `Unknown schema version: ${schemaVersion}` };
    }
    // Check required fields for LabProjectV1
    const requiredFields = ['projectId', 'name', 'createdAt', 'updatedAt', 'circuit', 'simulation', 'evidence'];
    for (const field of requiredFields) {
        if (!(field in p)) {
            return { valid: false, error: `Missing required field: ${field}` };
        }
    }
    return { valid: true };
}
/**
 * Check if project is from a future schema version
 *
 * Used to provide helpful message: "Please upgrade RedByte OS"
 */
export function isFutureVersion(version) {
    if (typeof version !== 'string') {
        return false;
    }
    // Simple version comparison: "2.0" > "1.0"
    const parts = version.split('.').map((v) => parseInt(v, 10));
    const currentParts = CURRENT_LAB_PROJECT_SCHEMA_VERSION.split('.').map((v) => parseInt(v, 10));
    for (let i = 0; i < Math.max(parts.length, currentParts.length); i++) {
        const part = parts[i] || 0;
        const currentPart = currentParts[i] || 0;
        if (part > currentPart) {
            return true;
        }
        if (part < currentPart) {
            return false;
        }
    }
    return false;
}
/**
 * Get all supported schema versions in human-readable format
 *
 * Usage: show in UI or debug output
 */
export function getSupportedVersionsInfo() {
    return `Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}. Current: ${CURRENT_LAB_PROJECT_SCHEMA_VERSION}`;
}
/**
 * Example migration documentation (for v1.0 → v2.0, when that happens)
 *
 * This would be added to docs/SCHEMA_CHANGELOG.md
 */
export const exampleMigrationDoc = {
    fromVersion: '1.0',
    toVersion: '2.0',
    description: 'Add support for nested subcircuits and circuit libraries',
    breakingChanges: [],
    migratedFields: ['circuit', 'simulation', 'evidence'],
    newRequiredFields: ['circuitLibraries'],
};
