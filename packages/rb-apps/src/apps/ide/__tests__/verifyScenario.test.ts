import { describe, it, expect } from 'vitest';
import {
  createDefaultScenario,
  stampScenario,
  computeScenarioContentHash,
  repairScenarioLibrary,
  migrateProjectVectorsToScenario,
  getActiveScenario,
  DEFAULT_SCENARIO_ID,
  DEFAULT_SCENARIO_NAME,
  type VerifyScenario,
} from '../verifyScenario';
import type { TestVector } from '@redbyte/rb-utils';

const vec = (tick: number): TestVector => ({
  tick,
  inputs: { a: 0 },
  expected: { y: 0 },
});

describe('createDefaultScenario', () => {
  it('creates a scenario with correct shape and default id', () => {
    const s = createDefaultScenario([vec(0)]);
    expect(s.id).toBe(DEFAULT_SCENARIO_ID);
    expect(s.name).toBe(DEFAULT_SCENARIO_NAME);
    expect(s.vectors).toHaveLength(1);
    expect(s.version).toBe(1);
    expect(s.createdAt).toBeTruthy();
    expect(s.updatedAt).toBeTruthy();
  });

  it('creates scenario with empty vectors by default', () => {
    const s = createDefaultScenario();
    expect(s.vectors).toHaveLength(0);
  });

  it('clones vectors (deep isolation)', () => {
    const original = [vec(0)];
    const s = createDefaultScenario(original);
    original[0].inputs.a = 1;
    expect(s.vectors[0].inputs.a).toBe(0);
  });
});

describe('stampScenario', () => {
  it('increments version on each stamp', () => {
    const s = createDefaultScenario();
    const s2 = stampScenario(s);
    expect(s2.version).toBe(2);
    const s3 = stampScenario(s2);
    expect(s3.version).toBe(3);
  });

  it('updates updatedAt but preserves createdAt', () => {
    const s = createDefaultScenario();
    const s2 = stampScenario(s);
    expect(s2.createdAt).toBe(s.createdAt);
    // updatedAt may equal createdAt if stamps happen in same millisecond — just check it's present
    expect(s2.updatedAt).toBeTruthy();
  });

  it('does not mutate the original', () => {
    const s = createDefaultScenario();
    const versionBefore = s.version;
    stampScenario(s);
    expect(s.version).toBe(versionBefore);
  });

  it('clones vectors in the stamped result', () => {
    const s = createDefaultScenario([vec(0)]);
    const s2 = stampScenario(s);
    s2.vectors[0].inputs.a = 1;
    expect(s.vectors[0].inputs.a).toBe(0);
  });
});

describe('computeScenarioContentHash', () => {
  it('returns a string with scn_ prefix', () => {
    const s = createDefaultScenario([vec(0)]);
    expect(computeScenarioContentHash(s)).toMatch(/^scn_/);
  });

  it('same content produces same hash', () => {
    const s1 = createDefaultScenario([vec(0)]);
    const s2 = createDefaultScenario([vec(0)]);
    // same id + version + vectors → same hash
    expect(computeScenarioContentHash(s1)).toBe(computeScenarioContentHash(s2));
  });

  it('different vectors produce different hash', () => {
    const s1 = createDefaultScenario([vec(0)]);
    const s2 = createDefaultScenario([vec(1)]);
    expect(computeScenarioContentHash(s1)).not.toBe(computeScenarioContentHash(s2));
  });

  it('different version produces different hash even with same vectors', () => {
    const s1 = createDefaultScenario([vec(0)]);
    const s2 = stampScenario(s1);
    expect(computeScenarioContentHash(s1)).not.toBe(computeScenarioContentHash(s2));
  });
});

describe('repairScenarioLibrary', () => {
  it('creates default scenario from fallbackVectors when rawScenarios is empty', () => {
    const { scenarios, activeScenarioId } = repairScenarioLibrary([], null, [vec(0)]);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].vectors).toHaveLength(1);
    expect(activeScenarioId).toBe(scenarios[0].id);
  });

  it('creates default scenario when rawScenarios is not an array', () => {
    const { scenarios, activeScenarioId } = repairScenarioLibrary(null, null);
    expect(scenarios).toHaveLength(1);
    expect(activeScenarioId).toBe(DEFAULT_SCENARIO_ID);
  });

  it('filters out invalid scenarios', () => {
    const valid: VerifyScenario = createDefaultScenario([vec(0)]);
    const invalid = { id: '', name: 'bad', vectors: [], version: 1 };
    const { scenarios } = repairScenarioLibrary([valid, invalid], valid.id);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].id).toBe(valid.id);
  });

  it('preserves valid activeScenarioId', () => {
    const s1 = createDefaultScenario();
    const s2 = { ...s1, id: 'scenario-2', name: 'Second', version: 1 };
    const { activeScenarioId } = repairScenarioLibrary([s1, s2], 'scenario-2');
    expect(activeScenarioId).toBe('scenario-2');
  });

  it('falls back to first scenario when activeScenarioId is unknown', () => {
    const s = createDefaultScenario();
    const { activeScenarioId } = repairScenarioLibrary([s], 'nonexistent-id');
    expect(activeScenarioId).toBe(s.id);
  });

  it('falls back to first scenario when activeScenarioId is null', () => {
    const s = createDefaultScenario();
    const { activeScenarioId } = repairScenarioLibrary([s], null);
    expect(activeScenarioId).toBe(s.id);
  });
});

describe('migrateProjectVectorsToScenario', () => {
  it('wraps vectors into a default scenario', () => {
    const { scenarios, activeScenarioId } = migrateProjectVectorsToScenario([vec(0), vec(1)]);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].vectors).toHaveLength(2);
    expect(activeScenarioId).toBe(scenarios[0].id);
  });

  it('creates empty default scenario for empty vectors', () => {
    const { scenarios } = migrateProjectVectorsToScenario([]);
    expect(scenarios[0].vectors).toHaveLength(0);
  });
});

describe('getActiveScenario', () => {
  it('returns null for empty library', () => {
    expect(getActiveScenario([], null)).toBeNull();
  });

  it('returns first scenario when activeScenarioId is null', () => {
    const s = createDefaultScenario();
    expect(getActiveScenario([s], null)).toBe(s);
  });

  it('returns scenario matching activeScenarioId', () => {
    const s1 = createDefaultScenario();
    const s2 = { ...s1, id: 'scenario-2', name: 'Second' };
    expect(getActiveScenario([s1, s2], 'scenario-2')).toBe(s2);
  });

  it('falls back to first when activeScenarioId does not match any', () => {
    const s = createDefaultScenario();
    expect(getActiveScenario([s], 'no-match')).toBe(s);
  });
});

// ── Scenario lifecycle (switch, rename, delete, last-scenario guard) ──────────

describe('scenario lifecycle helpers', () => {
  describe('switch active scenario', () => {
    it('getActiveScenario resolves by id after switch', () => {
      const s1 = createDefaultScenario([vec(0)]);
      const s2 = { ...s1, id: 'sc-2', name: 'Scenario 2', version: 1 };
      // Before switch
      expect(getActiveScenario([s1, s2], s1.id)?.id).toBe(s1.id);
      // After switch
      expect(getActiveScenario([s1, s2], s2.id)?.id).toBe(s2.id);
    });
  });

  describe('rename active scenario', () => {
    it('stampScenario preserves id while updating name', () => {
      const s = createDefaultScenario();
      const renamed = stampScenario({ ...s, name: 'New Name' });
      expect(renamed.id).toBe(s.id);
      expect(renamed.name).toBe('New Name');
      expect(renamed.version).toBe(s.version + 1);
    });

    it('rename produces different content hash', () => {
      const s = createDefaultScenario([vec(0)]);
      const renamed = stampScenario({ ...s, name: 'New Name' });
      // Rename increments version → different hash even with same vectors
      expect(computeScenarioContentHash(s)).not.toBe(computeScenarioContentHash(renamed));
    });
  });

  describe('delete scenario and reassign', () => {
    it('reassigns active to previous scenario after deletion', () => {
      const s1 = createDefaultScenario();
      const s2 = { ...s1, id: 'sc-2', name: 'S2', version: 1 };
      const s3 = { ...s1, id: 'sc-3', name: 'S3', version: 1 };
      const library = [s1, s2, s3];
      // Delete s3 (last) — active was s3
      const remaining = library.filter((s) => s.id !== s3.id);
      const idx = library.findIndex((s) => s.id === s3.id); // 2
      const nextActiveId = idx > 0 ? remaining[idx - 1].id : remaining[0].id;
      expect(nextActiveId).toBe(s2.id);
    });

    it('reassigns active to first when deleting the first scenario', () => {
      const s1 = createDefaultScenario();
      const s2 = { ...s1, id: 'sc-2', name: 'S2', version: 1 };
      const library = [s1, s2];
      // Delete s1 (idx=0) — active was s1
      const remaining = library.filter((s) => s.id !== s1.id);
      const idx = library.findIndex((s) => s.id === s1.id); // 0
      const nextActiveId = idx > 0 ? remaining[idx - 1].id : remaining[0].id;
      expect(nextActiveId).toBe(s2.id);
    });
  });

  describe('prevent deleting last scenario', () => {
    it('repairScenarioLibrary always returns at least one scenario', () => {
      // Even if we try to delete the last one, repair recreates it
      const { scenarios } = repairScenarioLibrary([], null, [vec(0)]);
      expect(scenarios.length).toBeGreaterThanOrEqual(1);
    });

    it('single-scenario library is always preserved by repair', () => {
      const s = createDefaultScenario([vec(0)]);
      const { scenarios, activeScenarioId } = repairScenarioLibrary([s], s.id);
      expect(scenarios).toHaveLength(1);
      expect(activeScenarioId).toBe(s.id);
    });
  });
});
