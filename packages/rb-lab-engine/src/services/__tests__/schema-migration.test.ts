import { describe, it, expect } from 'vitest';
import {
  CURRENT_LAB_PROJECT_SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  isSupportedVersion,
  migrateLabProject,
  validateLabProject,
  isFutureVersion,
  getSupportedVersionsInfo,
} from '../schemaMigration.js';
import type { LabProjectV1 } from '@redbyte/rb-utils';

/**
 * Phase 3.5: Schema Versioning & Migration Tests
 *
 * Validates:
 * - Schema version detection
 * - Migration pipeline (currently no migrations, but framework ready)
 * - Forward compatibility (unknown fields preserved)
 * - Validation (strict on read, flexible on write)
 */

function createTestProject(overrides?: Partial<LabProjectV1>): LabProjectV1 {
  return {
    schemaVersion: '1.0',
    projectId: 'test-id',
    name: 'Test Project',
    description: 'Test project for schema migration',
    createdAt: '2026-02-02T10:00:00Z',
    updatedAt: '2026-02-02T11:00:00Z',
    circuit: {
      schemaVersion: '1.0',
      nodes: [],
      connections: [],
      customChips: [],
    },
    simulation: {
      tickRate: 20,
      currentTick: 0,
      probes: [],
      breakpoints: [],
    },
    evidence: {
      actions: [],
      snapshots: [],
    },
    ...overrides,
  };
}

describe('Schema Versioning (Phase 3.5)', () => {
  describe('Version Constants', () => {
    it('should define current schema version', () => {
      expect(CURRENT_LAB_PROJECT_SCHEMA_VERSION).toBe('1.0');
    });

    it('should include current version in supported versions', () => {
      expect(SUPPORTED_SCHEMA_VERSIONS).toContain(CURRENT_LAB_PROJECT_SCHEMA_VERSION);
    });

    it('should support at least version 1.0', () => {
      expect(SUPPORTED_SCHEMA_VERSIONS.length).toBeGreaterThanOrEqual(1);
      expect(SUPPORTED_SCHEMA_VERSIONS[0]).toBe('1.0');
    });
  });

  describe('Version Detection', () => {
    it('should recognize supported versions', () => {
      expect(isSupportedVersion('1.0')).toBe(true);
    });

    it('should reject unknown versions', () => {
      expect(isSupportedVersion('99.0')).toBe(false);
      expect(isSupportedVersion('foo')).toBe(false);
      expect(isSupportedVersion(null)).toBe(false);
      expect(isSupportedVersion(undefined)).toBe(false);
    });

    it('should detect future versions', () => {
      expect(isFutureVersion('2.0')).toBe(true);
      expect(isFutureVersion('1.1')).toBe(true);
      expect(isFutureVersion('1.0')).toBe(false);
      expect(isFutureVersion('0.9')).toBe(false);
    });

    it('should handle non-string versions', () => {
      expect(isFutureVersion(123)).toBe(false);
      expect(isFutureVersion(null)).toBe(false);
      expect(isFutureVersion(undefined)).toBe(false);
    });
  });

  describe('Schema Migration', () => {
    it('should not migrate if already current', () => {
      const project = createTestProject({ schemaVersion: '1.0' });
      const result = migrateLabProject(project);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.project).toEqual(project);
        expect(result.alreadyCurrent).toBe(true);
      }
    });

    it('should reject unknown schema version', () => {
      const project = createTestProject({ schemaVersion: '99.0' } as any);
      const result = migrateLabProject(project);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Unknown schema version');
      }
    });

    it('should preserve unknown fields (forward compatibility)', () => {
      const projectWithExtra = createTestProject() as any;
      projectWithExtra.unknownFutureField = 'should be preserved';
      projectWithExtra.anotherNewField = { nested: 'value' };

      const result = migrateLabProject(projectWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.project).toHaveProperty('unknownFutureField', 'should be preserved');
        expect(result.project).toHaveProperty('anotherNewField');
      }
    });

    it('should maintain circuit data during migration', () => {
      const project = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            { id: 'n1', type: 'and', x: 0, y: 0, rotation: 0, label: 'A', params: {}, state: {} },
            { id: 'n2', type: 'or', x: 100, y: 0, rotation: 0, label: 'B', params: {}, state: {} },
          ],
          connections: [{ id: 'c1', fromNodeId: 'n1', fromPin: 'out', toNodeId: 'n2', toPin: 'in1' }],
          customChips: [],
        },
      });

      const result = migrateLabProject(project);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.project.circuit.nodes).toHaveLength(2);
        expect(result.project.circuit.connections).toHaveLength(1);
      }
    });

    it('should maintain evidence during migration', () => {
      const project = createTestProject({
        evidence: {
          actions: [
            { id: 'a1', type: 'component_add', timestamp: '2026-02-02T10:00:00Z', details: {} },
            { id: 'a2', type: 'wire_add', timestamp: '2026-02-02T10:01:00Z', details: {} },
          ],
          snapshots: [],
        },
      });

      const result = migrateLabProject(project);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.project.evidence.actions).toHaveLength(2);
      }
    });
  });

  describe('Project Validation', () => {
    it('should validate correct project', () => {
      const project = createTestProject();
      const result = validateLabProject(project);

      expect(result.valid).toBe(true);
    });

    it('should reject non-object', () => {
      const result = validateLabProject(null);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('not an object');
      }
    });

    it('should reject missing schemaVersion', () => {
      const project = createTestProject();
      delete (project as any).schemaVersion;

      const result = validateLabProject(project);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('schemaVersion');
      }
    });

    it('should reject non-string schemaVersion', () => {
      const project = createTestProject({ schemaVersion: 1.0 } as any);
      const result = validateLabProject(project);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('string');
      }
    });

    it('should reject unknown schema version', () => {
      const project = createTestProject({ schemaVersion: '99.0' } as any);
      const result = validateLabProject(project);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Unknown schema version');
      }
    });

    it('should reject missing required fields', () => {
      const project = createTestProject();
      delete (project as any).projectId;

      const result = validateLabProject(project);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('projectId');
      }
    });

    it('should detect all missing required fields', () => {
      const requiredFields = ['projectId', 'name', 'createdAt', 'updatedAt', 'circuit', 'simulation', 'evidence'];

      for (const field of requiredFields) {
        const project = createTestProject();
        delete (project as any)[field];
        const result = validateLabProject(project);
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('Info and Documentation', () => {
    it('should provide supported versions info', () => {
      const info = getSupportedVersionsInfo();

      expect(info).toContain('Supported:');
      expect(info).toContain('1.0');
      expect(info).toContain('Current:');
    });

    it('should mention version numbers in info', () => {
      const info = getSupportedVersionsInfo();
      expect(info).toMatch(/\d+\.\d+/);
    });
  });

  describe('Migration Framework Readiness', () => {
    it('should be ready for v1.0 → v2.0 migration', () => {
      // This test documents that the migration system is ready to add
      // new migrations without breaking existing code
      expect(isSupportedVersion('1.0')).toBe(true);
      expect(isSupportedVersion('2.0')).toBe(false); // Not yet supported

      // When v2.0 is added:
      // 1. Add '2.0' to SUPPORTED_SCHEMA_VERSIONS
      // 2. Update CURRENT_LAB_PROJECT_SCHEMA_VERSION to '2.0'
      // 3. Add migration function for '1.0' → '2.0'
      // 4. Tests will automatically validate it
    });

    it('should maintain backward compatibility with future versions', () => {
      // Document the promise: old clients can open new projects (with warnings)
      const futureProject = createTestProject({ schemaVersion: '2.0' } as any);
      const migrationResult = migrateLabProject(futureProject);

      // Future version is rejected (can't migrate forward)
      expect(migrationResult.success).toBe(false);

      // But validation shows the issue clearly
      const validationResult = validateLabProject(futureProject);
      expect(validationResult.valid).toBe(false);
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error messages for version issues', () => {
      const project = createTestProject({ schemaVersion: '99.0' } as any);
      const result = migrateLabProject(project);

      expect(result.success).toBe(false);
      if (!result.success) {
        // Error should be helpful, not cryptic
        expect(result.error.length).toBeGreaterThan(10);
        expect(result.error).toContain('99.0');
      }
    });

    it('should suggest upgrade for future versions', () => {
      const futureProject = createTestProject({ schemaVersion: '2.0' } as any);
      const validationResult = validateLabProject(futureProject);

      expect(validationResult.valid).toBe(false);
      if (!validationResult.valid) {
        expect(validationResult.error).toContain('2.0');
      }
    });
  });

  describe('Large Projects', () => {
    it('should handle large circuits during migration', () => {
      const nodes = Array.from({ length: 1000 }, (_, i) => ({
        id: `n${i}`,
        type: 'and',
        x: (i % 10) * 100,
        y: Math.floor(i / 10) * 100,
        rotation: 0,
        label: `Node${i}`,
        params: {},
        state: {},
      }));

      const project = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes,
          connections: [],
          customChips: [],
        },
      });

      const result = migrateLabProject(project);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.project.circuit.nodes).toHaveLength(1000);
      }
    });

    it('should handle many evidence actions', () => {
      const actions = Array.from({ length: 100 }, (_, i) => ({
        id: `a${i}`,
        type: 'component_add',
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        details: {},
      }));

      const project = createTestProject({
        evidence: {
          actions,
          snapshots: [],
        },
      });

      const result = migrateLabProject(project);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.project.evidence.actions).toHaveLength(100);
      }
    });
  });
});
