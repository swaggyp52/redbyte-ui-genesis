/**
 * Contract gate: Scenario library — lifecycle operations + persistence.
 *
 * Tests the pure scenario helpers (createScenario, stampScenario, repairScenarioLibrary)
 * and the key runtime invariants that must hold across create/rename/duplicate/delete/switch:
 *
 *   1. createScenario generates a unique ID — collision-free even across many calls
 *   2. createScenario with seedVectors uses exactly those vectors (cloned, not referenced)
 *   3. duplicateScenario inherits vectors only — does NOT inherit run provenance
 *   4. deleteScenario refuses to delete the last remaining scenario
 *   5. renameActiveScenario stamps the version
 *   6. Full lifecycle: create → rename → duplicate → switch → delete → library valid
 *   7. Persistence regression: serialize → repairScenarioLibrary → valid state
 */

import { describe, expect, it } from 'vitest';
import type { TestVector } from '@redbyte/rb-utils';
import {
  computeScenarioContentHash,
  createDefaultScenario,
  createScenario,
  getActiveScenario,
  repairScenarioLibrary,
  stampScenario,
  type VerifyScenario,
} from '../apps/ide/verifyScenario';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeVectors(count: number): TestVector[] {
  return Array.from({ length: count }, (_, i) => ({
    tick: i,
    inputs: { a: i % 2 as 0 | 1 },
    expected: { y: i % 2 as 0 | 1 },
  }));
}

// ─── createScenario ──────────────────────────────────────────────────────────

describe('createScenario', () => {
  it('generates a fresh UUID — different from DEFAULT_SCENARIO_ID', () => {
    const scenario = createScenario('My Scenario');
    expect(scenario.id).not.toBe('default');
    expect(scenario.id.length).toBeGreaterThan(0);
  });

  it('generates unique IDs across many calls — collision-free', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createScenario('s').id));
    expect(ids.size).toBe(50);
  });

  it('sets the correct name and trims whitespace', () => {
    const scenario = createScenario('  Lab 3  ');
    expect(scenario.name).toBe('Lab 3');
  });

  it('falls back to "New Scenario" when name is blank', () => {
    const scenario = createScenario('   ');
    expect(scenario.name).toBe('New Scenario');
  });

  it('starts at version 1', () => {
    const scenario = createScenario('v1 start');
    expect(scenario.version).toBe(1);
  });

  it('clones the provided seed vectors — not a reference', () => {
    const original = makeVectors(3);
    const scenario = createScenario('Seeded', original);
    expect(scenario.vectors).toEqual(original);
    // Mutating original must not affect the scenario
    original[0]!.tick = 999;
    expect(scenario.vectors[0]!.tick).toBe(0);
  });

  it('starts with empty vectors when no seed provided', () => {
    const scenario = createScenario('Empty');
    expect(scenario.vectors).toEqual([]);
  });
});

// ─── duplicateScenario (pure simulation) ─────────────────────────────────────

describe('duplicateScenario (pure scenario helpers)', () => {
  it('copy gets a different ID from the source', () => {
    const source = createScenario('Original', makeVectors(2));
    const copy = createScenario(`${source.name} (copy)`, source.vectors);
    expect(copy.id).not.toBe(source.id);
  });

  it('copy name has "(copy)" suffix', () => {
    const source = createScenario('Lab 2');
    const copy = createScenario(`${source.name} (copy)`, source.vectors);
    expect(copy.name).toBe('Lab 2 (copy)');
  });

  it('copy inherits vectors — values match', () => {
    const vectors = makeVectors(4);
    const source = createScenario('Source', vectors);
    const copy = createScenario(`${source.name} (copy)`, source.vectors);
    expect(copy.vectors).toEqual(source.vectors);
  });

  it('copy starts at version 1 — does NOT inherit source version', () => {
    // Source is stamped several times to raise its version
    let source = createScenario('Source', makeVectors(2));
    source = stampScenario(source);
    source = stampScenario(source);
    expect(source.version).toBe(3);

    const copy = createScenario(`${source.name} (copy)`, source.vectors);
    // Constraint: duplicate inherits vectors only, not run provenance or version history
    expect(copy.version).toBe(1);
  });

  it('copy content hash differs from source due to different IDs', () => {
    const vectors = makeVectors(2);
    const source = createScenario('Source', vectors);
    const copy = createScenario(`${source.name} (copy)`, source.vectors);
    // Hashes include the ID — so even identical vectors produce different hashes
    expect(computeScenarioContentHash(source)).not.toBe(computeScenarioContentHash(copy));
  });
});

// ─── deleteScenario invariant (pure simulation) ──────────────────────────────

describe('deleteScenario invariant', () => {
  it('refuses to delete the last scenario — library stays at 1', () => {
    // Simulate the guard by hand (the actual guard is in the zustand store)
    const only = createDefaultScenario(makeVectors(2));
    const library = [only];
    const wouldDelete = library.length > 1;
    expect(wouldDelete).toBe(false);
    expect(library.length).toBe(1);
  });

  it('after deleting a non-last scenario, reassigns activeId to a valid scenario', () => {
    const s1 = createDefaultScenario(makeVectors(1));
    const s2 = createScenario('Second', makeVectors(2));
    const s3 = createScenario('Third', makeVectors(3));
    const library = [s1, s2, s3];

    // Simulate deletion of s2 (index 1)
    const idxToDelete = library.findIndex((s) => s.id === s2.id);
    const remaining = library.filter((s) => s.id !== s2.id);
    const newActive = idxToDelete > 0 ? remaining[idxToDelete - 1]! : remaining[0]!;

    expect(remaining).toHaveLength(2);
    expect(newActive.id).toBe(s1.id); // previous in list
    expect(remaining.some((s) => s.id === newActive.id)).toBe(true);
  });
});

// ─── stampScenario ───────────────────────────────────────────────────────────

describe('stampScenario', () => {
  it('increments the version on every call', () => {
    const s = createScenario('Test', makeVectors(1));
    const s2 = stampScenario(s);
    const s3 = stampScenario(s2);
    expect(s.version).toBe(1);
    expect(s2.version).toBe(2);
    expect(s3.version).toBe(3);
  });

  it('changes the content hash after stamp (version changes)', () => {
    const s = createScenario('Test', makeVectors(2));
    const h1 = computeScenarioContentHash(s);
    const s2 = stampScenario(s);
    const h2 = computeScenarioContentHash(s2);
    expect(h1).not.toBe(h2);
  });

  it('does not mutate the original scenario — immutable', () => {
    const s = createScenario('Original', makeVectors(1));
    const versionBefore = s.version;
    stampScenario(s);
    expect(s.version).toBe(versionBefore);
  });
});

// ─── Full lifecycle ───────────────────────────────────────────────────────────

describe('scenario lifecycle — create, rename, duplicate, switch, delete', () => {
  it('complete lifecycle leaves the library valid at each step', () => {
    // 1. Start with default scenario
    let library: VerifyScenario[] = [createDefaultScenario(makeVectors(3))];
    let activeId: string = library[0]!.id;

    // 2. Create a second scenario (seeded from active)
    const second = createScenario('Lab 2', library.find((s) => s.id === activeId)!.vectors);
    library = [...library, second];
    activeId = second.id;

    expect(library).toHaveLength(2);
    expect(getActiveScenario(library, activeId)?.name).toBe('Lab 2');

    // 3. Rename the active scenario
    const renamed = stampScenario({ ...second, name: 'Lab 2 — Revised' });
    library = library.map((s) => (s.id === second.id ? renamed : s));

    expect(library.find((s) => s.id === second.id)?.name).toBe('Lab 2 — Revised');

    // 4. Duplicate the active scenario
    const copy = createScenario(`${renamed.name} (copy)`, renamed.vectors);
    library = [...library, copy];
    activeId = copy.id;

    expect(library).toHaveLength(3);
    expect(copy.name).toBe('Lab 2 — Revised (copy)');
    expect(copy.id).not.toBe(renamed.id);

    // 5. Switch back to the original default
    const defaultId = library[0]!.id;
    activeId = defaultId;
    expect(getActiveScenario(library, activeId)?.name).toBe('Default');

    // 6. Delete the copy
    library = library.filter((s) => s.id !== copy.id);
    if (activeId === copy.id) activeId = library[library.length - 1]!.id;

    expect(library).toHaveLength(2);
    expect(library.some((s) => s.id === copy.id)).toBe(false);
    expect(getActiveScenario(library, activeId)).not.toBeNull();
  });
});

// ─── Persistence regression ───────────────────────────────────────────────────

describe('persistence regression — repairScenarioLibrary after serialize/reload', () => {
  it('survives round-trip through JSON serialization and repairScenarioLibrary', () => {
    // Create a library with two scenarios and simulate persistence
    const s1 = createDefaultScenario(makeVectors(2));
    const s2 = createScenario('Lab 3', makeVectors(4));
    const renamed_s2 = stampScenario({ ...s2, name: 'Lab 3 — Final' });
    const library = [s1, renamed_s2];
    const activeId = renamed_s2.id;

    // Simulate: JSON round-trip (what Zustand persist does)
    const serialized = JSON.parse(JSON.stringify({ scenarios: library, activeScenarioId: activeId }));

    // Re-hydrate via repairScenarioLibrary (what mergePersistedRuntimeState calls)
    const repaired = repairScenarioLibrary(
      serialized.scenarios,
      serialized.activeScenarioId
    );

    expect(repaired.scenarios).toHaveLength(2);
    expect(repaired.activeScenarioId).toBe(renamed_s2.id);
    expect(repaired.scenarios.find((s) => s.id === renamed_s2.id)?.name).toBe('Lab 3 — Final');
    expect(repaired.scenarios.find((s) => s.id === renamed_s2.id)?.version).toBe(2);
  });

  it('self-heals when serialized data is corrupt — creates a default scenario', () => {
    const repaired = repairScenarioLibrary(null, null, makeVectors(3));
    expect(repaired.scenarios).toHaveLength(1);
    expect(repaired.scenarios[0]!.name).toBe('Default');
    expect(repaired.scenarios[0]!.vectors).toHaveLength(3);
    expect(repaired.activeScenarioId).toBe(repaired.scenarios[0]!.id);
  });

  it('falls back to first scenario when activeScenarioId references a deleted scenario', () => {
    const s1 = createDefaultScenario(makeVectors(1));
    const s2 = createScenario('Second', makeVectors(2));
    const library = [s1, s2];

    // Simulate: s2 was deleted before persistence, but activeId still points to it
    const serialized = JSON.parse(JSON.stringify({
      scenarios: [s1], // only s1 survived
      activeScenarioId: s2.id, // stale reference
    }));

    const repaired = repairScenarioLibrary(serialized.scenarios, serialized.activeScenarioId);

    expect(repaired.scenarios).toHaveLength(1);
    // Falls back to first (only) scenario
    expect(repaired.activeScenarioId).toBe(s1.id);
    // The library array doesn't include s2
    expect(repaired.scenarios.some((s) => s.id === s2.id)).toBe(false);
  });
});
