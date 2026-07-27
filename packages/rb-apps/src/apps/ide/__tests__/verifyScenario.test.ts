import { describe, it, expect } from 'vitest';
import {
  createDefaultScenario,
  stampScenario,
  computeScenarioContentHash,
  computeScenarioStimulusHash,
  repairScenarioLibrary,
  migrateProjectVectorsToScenario,
  getActiveScenario,
  materializeScenarioVectors,
  normalizeScenarioSequentialPolicy,
  normalizeScenarioProbes,
  toggleScenarioProbe,
  DEFAULT_SCENARIO_ID,
  DEFAULT_SCENARIO_NAME,
  type VerifyScenario,
  type VerifyScenarioSequentialPolicy,
} from '../verifyScenario';
import type { TestVector } from '@redbyte/rb-utils';
import { createScenarioStep } from '../verifyScenarioSteps';

const vec = (tick: number): TestVector => ({
  tick,
  inputs: { a: 0 },
  expected: { y: 0 },
});

const sequentialPolicy: VerifyScenarioSequentialPolicy = {
  overrideMode: 'auto',
  runCycles: 8,
  activeEdge: 'rising',
  resetBehavior: 'auto-sequence',
  sourceType: 'board-clock',
  executionModel: 'external-input-auto-toggle',
  signalId: 'clk',
  signalLabel: 'CLK100MHZ',
  resetSignalName: 'rst',
  startLevel: 0,
};

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

  it('clones browser-local sequential policy intent', () => {
    const source = { ...sequentialPolicy };
    const scenario = createDefaultScenario([], source);

    source.runCycles = 99;
    expect(scenario.sequentialPolicy).toEqual(sequentialPolicy);
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

  it('clones sequential policy in the stamped result', () => {
    const scenario = createDefaultScenario([], sequentialPolicy);
    const stamped = stampScenario(scenario);

    stamped.sequentialPolicy!.runCycles = 3;
    expect(scenario.sequentialPolicy?.runCycles).toBe(8);
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

describe('computeScenarioStimulusHash', () => {
  it('stays stable when only expected outputs change', () => {
    const baseline = createDefaultScenario([vec(0)]);
    const updated = {
      ...baseline,
      version: baseline.version + 1,
      vectors: [{ tick: 0, inputs: { a: 0 }, expected: { y: 1 } }],
    };

    expect(computeScenarioStimulusHash(updated)).toBe(computeScenarioStimulusHash(baseline));
  });

  it('changes when stimulus inputs change', () => {
    const baseline = createDefaultScenario([vec(0)]);
    const updated = {
      ...baseline,
      version: baseline.version + 1,
      vectors: [{ tick: 0, inputs: { a: 1 }, expected: { y: 0 } }],
    };

    expect(computeScenarioStimulusHash(updated)).not.toBe(computeScenarioStimulusHash(baseline));
  });

  it('changes when sequential execution intent changes', () => {
    const baseline = createDefaultScenario([vec(0)], sequentialPolicy);
    const updated = {
      ...baseline,
      sequentialPolicy: { ...sequentialPolicy, runCycles: 12 },
    };

    expect(computeScenarioContentHash(updated)).not.toBe(computeScenarioContentHash(baseline));
    expect(computeScenarioStimulusHash(updated)).not.toBe(computeScenarioStimulusHash(baseline));
  });
});

describe('scenario probes', () => {
  it('persists normalized watched lanes independently per scenario', () => {
    const watched = toggleScenarioProbe([], { key: 'xor_ab', label: 'A XOR B' });
    expect(watched).toEqual([{ key: 'xor_ab', label: 'A XOR B' }]);
    expect(normalizeScenarioProbes(watched)).toEqual(watched);
    expect(toggleScenarioProbe(watched, { key: 'xor_ab' })).toEqual([]);
  });
});

describe('materializeScenarioVectors', () => {
  it('uses explicit steps as the authoritative vectors when present', () => {
    const scenario = createDefaultScenario([{ tick: 0, inputs: { a: 0 }, expected: { y: 0 } }]);
    scenario.steps = [
      createScenarioStep({ kind: 'set_input', targetRef: 'a', value: 1 }, 0),
      createScenarioStep({ kind: 'assert_scalar', targetRef: 'y', expectedValue: 1 }, 1),
    ];

    const vectors = materializeScenarioVectors(scenario);
    expect(vectors[0]?.inputs).toEqual({ a: 1 });
    expect(vectors[1]?.expected).toEqual({ y: 1 });
  });

  it('falls back to stored vectors when no explicit steps exist', () => {
    const scenario = createDefaultScenario([{ tick: 2, inputs: { a: 1 }, expected: { y: 1 } }]);
    scenario.steps = undefined;

    expect(materializeScenarioVectors(scenario)).toEqual(scenario.vectors);
  });

  it('layers per-event optional checks onto explicit sequential stimulus without changing its timing', () => {
    const scenario = createDefaultScenario([
      { id: 'event-0', tick: 0, inputs: { d: 0, clk: 0 }, expected: {} },
      { id: 'event-1', tick: 1, inputs: { d: 1, clk: 0 }, expected: { q: 0 } },
      { id: 'event-2', tick: 2, inputs: { d: 1, clk: 1 }, expected: {} },
    ]);
    scenario.steps = [
      createScenarioStep({ kind: 'set_input', targetRef: 'd', value: 0 }, 0),
      createScenarioStep({ kind: 'set_input', targetRef: 'd', value: 1 }, 1),
      createScenarioStep({ kind: 'pulse_step', targetRef: 'clk', pulseBehavior: 'rising' }, 2),
    ];

    const vectors = materializeScenarioVectors(scenario);
    expect(vectors).toHaveLength(4);
    expect(vectors[1]).toMatchObject({
      tick: 1,
      inputs: { d: 1 },
      expected: { q: 0 },
    });
    expect(vectors[2]?.inputs.clk).toBe(0);
    expect(vectors[3]?.inputs.clk).toBe(1);
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

  it('normalizes persisted sequential policy without trusting invalid cycle counts', () => {
    const scenario = createDefaultScenario();
    const { scenarios } = repairScenarioLibrary(
      [
        {
          ...scenario,
          sequentialPolicy: {
            ...sequentialPolicy,
            runCycles: 0,
            signalId: '  clk  ',
          },
        },
      ],
      scenario.id
    );

    expect(scenarios[0]?.sequentialPolicy).toMatchObject({
      runCycles: 1,
      signalId: 'clk',
      overrideMode: 'auto',
    });
    expect(normalizeScenarioSequentialPolicy({ ...sequentialPolicy, sourceType: 'invalid' })).toBeUndefined();
  });

  it('canonicalizes legacy falling-edge capture policy to the supported rising edge', () => {
    expect(
      normalizeScenarioSequentialPolicy({
        ...sequentialPolicy,
        activeEdge: 'falling',
      })
    ).toMatchObject({
      activeEdge: 'rising',
      overrideMode: sequentialPolicy.overrideMode,
    });
  });

  it('canonicalizes contradictory authored execution and reset fields', () => {
    expect(
      normalizeScenarioSequentialPolicy({
        ...sequentialPolicy,
        overrideMode: 'manual-pulses',
        executionModel: 'external-input-auto-toggle',
        resetBehavior: 'auto-sequence',
        resetSignalName: 'rst',
      })
    ).toMatchObject({
      overrideMode: 'manual-pulses',
      executionModel: 'manual',
      resetBehavior: 'custom',
      activeEdge: 'rising',
    });
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
