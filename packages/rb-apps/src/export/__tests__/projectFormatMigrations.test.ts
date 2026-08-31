import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CURRENT_PROJECT_FORMAT_VERSION,
  detectRBProjectFormatVersion,
  migrateRBProjectDocument,
  RB_PROJECT_FORMAT_MIGRATIONS,
} from '../projectFormatMigrations';
import { decodeRBProject, encodeRBProject, normalizeRBProject } from '../projectFormat';

const FIXTURE_DIR = resolve(
  process.cwd(),
  'packages/rb-apps/src/export/__tests__/fixtures/project-format'
);

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), 'utf8'));

const CORPUS = ['v0-legacy-no-version.json', 'v1-canonical.json'] as const;

describe('project-format version detection', () => {
  it('reads an explicit integer version', () => {
    expect(detectRBProjectFormatVersion({ version: 1, circuit: {} })).toBe(1);
  });

  it('treats a version-less project-shaped document as legacy v0', () => {
    expect(detectRBProjectFormatVersion({ circuit: { nodes: [], connections: [] } })).toBe(0);
  });

  it('rejects a non-object', () => {
    expect(() => detectRBProjectFormatVersion(null)).toThrow('not an object');
    expect(() => detectRBProjectFormatVersion(42)).toThrow('not an object');
  });

  it('rejects a version-less document that is not project-shaped', () => {
    expect(() => detectRBProjectFormatVersion({ foo: 'bar' })).toThrow('unrecognized document');
  });

  it('rejects a non-integer, negative, or non-numeric version', () => {
    expect(() => detectRBProjectFormatVersion({ version: 1.5, circuit: {} })).toThrow(
      'non-negative integer'
    );
    expect(() => detectRBProjectFormatVersion({ version: -1, circuit: {} })).toThrow(
      'non-negative integer'
    );
    expect(() => detectRBProjectFormatVersion({ version: 'x', circuit: {} })).toThrow(
      'must be a number'
    );
  });
});

describe('migrateRBProjectDocument', () => {
  it('is a no-op for a document already at the current version', () => {
    const doc = { kind: 'rb-project', version: CURRENT_PROJECT_FORMAT_VERSION, circuit: {} };
    const result = migrateRBProjectDocument(doc);
    expect(result.fromVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION);
    expect(result.toVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION);
    expect(result.applied).toEqual([]);
    expect(result.document).toEqual(doc);
  });

  it('upgrades a legacy v0 document to the current version', () => {
    const result = migrateRBProjectDocument({ circuit: { nodes: [], connections: [] }, name: 'x' });
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION);
    expect(result.applied).toEqual(['v0-to-v1-stamp-envelope']);
    expect(result.document.kind).toBe('rb-project');
    expect(result.document.version).toBe(CURRENT_PROJECT_FORMAT_VERSION);
  });

  it('never mutates the input document', () => {
    const input = { circuit: { nodes: [], connections: [] }, name: 'x' };
    const snapshot = JSON.parse(JSON.stringify(input));
    migrateRBProjectDocument(input);
    expect(input).toEqual(snapshot);
    expect(input).not.toHaveProperty('kind');
  });

  it('rejects a document newer than the current supported version', () => {
    expect(() =>
      migrateRBProjectDocument({
        kind: 'rb-project',
        version: CURRENT_PROJECT_FORMAT_VERSION + 1,
        circuit: {},
      })
    ).toThrow(/newer than supported/);
  });

  it('is idempotent: migrating an already-migrated document changes nothing', () => {
    const once = migrateRBProjectDocument(fixture('v0-legacy-no-version.json')).document;
    const twice = migrateRBProjectDocument(once).document;
    expect(twice).toEqual(once);
  });

  it('has a well-formed, single-step, contiguous, uniquely-identified ladder', () => {
    RB_PROJECT_FORMAT_MIGRATIONS.forEach((migration) => {
      expect(migration.to).toBe(migration.from + 1);
      expect(typeof migration.id).toBe('string');
      expect(migration.id.length).toBeGreaterThan(0);
    });
    const froms = RB_PROJECT_FORMAT_MIGRATIONS.map((migration) => migration.from);
    expect(froms).toEqual([...froms].sort((a, b) => a - b));
    const ids = RB_PROJECT_FORMAT_MIGRATIONS.map((migration) => migration.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The ladder terminates at exactly the current version.
    const top = RB_PROJECT_FORMAT_MIGRATIONS[RB_PROJECT_FORMAT_MIGRATIONS.length - 1];
    expect(top?.to ?? CURRENT_PROJECT_FORMAT_VERSION).toBe(CURRENT_PROJECT_FORMAT_VERSION);
  });
});

describe('migration corpus — lossless upgrade + round-trip', () => {
  it('a legacy v0 document upgrades to the same normalized project as its v1 canonical form', () => {
    const upgraded = normalizeRBProject(fixture('v0-legacy-no-version.json'));
    const canonical = normalizeRBProject(fixture('v1-canonical.json'));
    expect(upgraded).toEqual(canonical);
  });

  it('the legacy v0 document loads (previously a version-less doc would have thrown)', () => {
    const decoded = normalizeRBProject(fixture('v0-legacy-no-version.json'));
    expect(decoded.kind).toBe('rb-project');
    expect(decoded.version).toBe(CURRENT_PROJECT_FORMAT_VERSION);
    expect(decoded.circuit.connections[0]).toEqual({
      from: { nodeId: 'in_a', portName: 'out' },
      to: { nodeId: 'out_y', portName: 'in' },
    });
  });

  it('round-trips every corpus fixture and encodes deterministically', () => {
    for (const name of CORPUS) {
      const first = normalizeRBProject(fixture(name));
      const encoded = encodeRBProject(first);
      const second = decodeRBProject(encoded);
      // Structural round-trip: decode(encode(x)) preserves the project.
      expect(second).toEqual(first);
      // Determinism: re-encoding the round-tripped project is byte-identical.
      expect(encodeRBProject(second)).toBe(encoded);
    }
  });
});
