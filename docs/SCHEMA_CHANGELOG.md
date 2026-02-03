# Lab Project Schema Changelog

This document tracks all changes to the LabProject schema format, including migrations and breaking changes.

## Schema Version 1.0 (Current)

**Release Date**: Phase 3.5 (2026-02-03)

**Key Features**:
- Core circuit schema with nodes, connections, custom chips
- Simulation state: tick rate, current tick, probes, breakpoints
- Board mapping for hardware deployment
- I/O mapping for cross-app synchronization
- Lab specifications for structured labs
- Evidence tracking: action log + sparse snapshots
- Metadata: project ID, name, creation/update dates

**Required Fields**:
- `schemaVersion`: '1.0'
- `projectId`: Unique identifier
- `name`: Project name
- `createdAt`: ISO 8601 timestamp
- `updatedAt`: ISO 8601 timestamp
- `circuit`: CircuitV1 object
- `simulation`: Simulation configuration
- `evidence`: Action log and snapshots

**Optional Fields**:
- `description`: Project description
- `boardMap`: Board mapping configuration
- `ioMapping`: Cross-app I/O mapping
- `savedBoards`: Saved board configurations
- `labSpec`: Lab specifications

**Compatibility Notes**:
- Unknown fields are preserved (forward-compatible)
- Missing optional fields have sensible defaults
- No breaking changes (v1.0 is initial release)

---

## Schema Version 1.0 → 2.0 (Future)

When introducing schema v2.0, follow this procedure:

### 1. Update Constants

```typescript
export const CURRENT_LAB_PROJECT_SCHEMA_VERSION = '2.0' as const;
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0', '2.0'] as const;
```

### 2. Add Migration Function

```typescript
const migrations: Record<string, MigrationFn> = {
  '1.0': (project: LabProjectV1) => {
    return {
      ...project,
      schemaVersion: '2.0',
      // Add new required fields with defaults
      newField: defaultValue,
    };
  },
};
```

### 3. Document Breaking Changes

Example (hypothetical):

**Migration from 1.0 to 2.0**:
- **Breaking Change**: Removed `boardMap.virtualIOState` (moved to separate UI state)
- **Migration**: Copy `virtualIOState` to application state store on import
- **New Required Field**: `circuitLibraries` (array of library definitions)
- **Migration**: Populate with empty array `[]` for legacy projects
- **Preserved Fields**: All 1.0 fields preserved in new schema

### 4. Update Tests

- Add tests for new schema version detection
- Add migration tests (v1.0 → v2.0)
- Add validation tests for v2.0 structure
- Test backward compatibility (old clients can detect new version)

### 5. Document in CHANGELOG.md

Add entry like:

```markdown
## [2.0] - 2026-MM-DD

### Added
- Subcircuit/library support via `circuitLibraries` field
- Enhanced metadata tracking

### Changed
- Virtual IO state moved to separate application state
- Circuit schema now v2.0 with extended component properties

### Migration
- Automatic migration from 1.0 → 2.0 on import
- Legacy projects get empty library list
- UI state reconstruction from evidence log
```

---

## Migration Strategy

**Philosophy**: Preserve data, fail gracefully on version conflicts

### Import Workflow

1. **Load Project File**
   - Read `schemaVersion` from JSON

2. **Validate Version**
   - If unknown: Show error with version number
   - If future: Show "Please upgrade RedByte OS" message
   - If current: Proceed to migration

3. **Migrate if Needed**
   - Apply migration functions v1 → v2 → v3 (as needed)
   - Preserve unknown fields (forward-compatible)
   - Add defaults for missing fields

4. **Validate Migrated Project**
   - Check all required fields present
   - Verify data integrity
   - Show warnings for any issues

5. **Load into App**
   - Use migrated project state
   - Log migration details for debugging

### Error Messages

**Unknown Version**:
```
Unknown schema version: 3.0

Supported versions: 1.0, 2.0
Current version: 2.0

This project may have been created with a newer version of RedByte OS.
```

**Validation Failure**:
```
Cannot open project: Missing required field projectId

The file may be corrupted or from an incompatible version.
```

---

## Testing Migration Paths

### Current Phase 3.5 Tests

The `schema-migration.test.ts` test suite validates:

1. **Version Detection**
   - Supported versions recognized
   - Unknown versions rejected
   - Future versions detected

2. **Migration Safety**
   - Unknown fields preserved
   - Circuit data maintained
   - Evidence maintained

3. **Validation**
   - Required fields checked
   - Type validation
   - Error messages helpful

4. **Large Projects**
   - 1000+ node circuits migrate correctly
   - 100+ evidence actions preserved

5. **Forward Compatibility**
   - Old clients reject new versions gracefully
   - Error messages guide user to upgrade

---

## Implementation Checklist

When introducing new schema version:

- [ ] Add version to `SUPPORTED_SCHEMA_VERSIONS`
- [ ] Update `CURRENT_LAB_PROJECT_SCHEMA_VERSION`
- [ ] Implement migration function in `schemaMigration.ts`
- [ ] Add unit tests for migration path
- [ ] Test with large projects (1000+ nodes)
- [ ] Document breaking changes here
- [ ] Update CHANGELOG.md
- [ ] Update import workflow to use new migration
- [ ] Verify backward compatibility
- [ ] Update FPGA MVP spec with schema version

---

## References

- **Migration Code**: `packages/rb-lab-engine/src/services/schemaMigration.ts`
- **Tests**: `packages/rb-lab-engine/src/services/__tests__/schema-migration.test.ts`
- **Import Workflow**: `packages/rb-lab-engine/src/services/importWorkflowUtils.ts`
- **Schema Definition**: `packages/rb-utils/src/labProjectSchema.ts`

---

## Contact

Questions about schema versions? Consult Connor Angiel.
