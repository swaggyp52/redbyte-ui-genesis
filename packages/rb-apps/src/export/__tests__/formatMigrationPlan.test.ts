import { describe, expect, it } from 'vitest';
import { analyzeProjectForMigration, recordFromPlan } from '../formatMigrationPlan';
import { CURRENT_PROJECT_FORMAT_VERSION } from '../projectFormatMigrations';

const v0 = { name: 'Legacy', circuit: { nodes: [], connections: [] } }; // no version → v0
const v1 = { kind: 'rb-project', version: 1, name: 'Current', circuit: { nodes: [], connections: [] } };

describe('analyzeProjectForMigration', () => {
  it('flags a pre-versioned (v0) document as needing migration and computes the upgrade', () => {
    const plan = analyzeProjectForMigration(v0);
    expect(plan.status).toBe('needs-migration');
    expect(plan.fromVersion).toBe(0);
    expect(plan.toVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION);
    expect(plan.changes.length).toBeGreaterThan(0);
    expect(plan.migratedDocument?.version).toBe(1);
    expect(plan.migratedDocument?.kind).toBe('rb-project');
    // The original is never mutated.
    expect((v0 as Record<string, unknown>).version).toBeUndefined();
  });

  it('reports a current-version document as current (no dialog)', () => {
    const plan = analyzeProjectForMigration(v1);
    expect(plan.status).toBe('current');
    expect(plan.changes).toEqual([]);
    expect(plan.migratedDocument).toBeUndefined();
  });

  it('rejects a newer-than-supported document honestly', () => {
    const plan = analyzeProjectForMigration({ kind: 'rb-project', version: 99, circuit: { nodes: [], connections: [] } });
    expect(plan.status).toBe('too-new');
    expect(plan.error).toContain('newer RedByte');
  });

  it('reports an unrecognizable document as invalid without throwing', () => {
    expect(analyzeProjectForMigration({ foo: 'bar' }).status).toBe('invalid');
    expect(analyzeProjectForMigration(null).status).toBe('invalid');
  });

  it('builds a migration record from a plan with a caller-supplied label', () => {
    const plan = analyzeProjectForMigration(v0);
    const record = recordFromPlan(plan, 'Opened 2026-08-31', 'legacy.rbproj');
    expect(record).toEqual({
      fromVersion: 0,
      toVersion: CURRENT_PROJECT_FORMAT_VERSION,
      appliedIds: plan.appliedIds,
      source: 'legacy.rbproj',
      atLabel: 'Opened 2026-08-31',
    });
  });
});
