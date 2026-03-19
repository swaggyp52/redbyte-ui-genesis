import type { TestVector } from '@redbyte/rb-utils';
import { digestValue } from '../../utils/digest';

export interface VerifyScenario {
  /** Stable identifier — survives renames and vector edits. */
  id: string;
  /** User-editable display name. */
  name: string;
  /** Ordered test vectors (tick + inputs + expected outputs). */
  vectors: TestVector[];
  /**
   * Monotonic version counter — incremented on every save.
   * Stored in run metadata so result-to-scenario drift is machine-checkable.
   */
  version: number;
  /** ISO timestamp — when this scenario was first created. */
  createdAt: string;
  /** ISO timestamp — when this scenario was last modified. */
  updatedAt: string;
}

export const DEFAULT_SCENARIO_ID = 'default';
export const DEFAULT_SCENARIO_NAME = 'Default';

/**
 * Create a new named scenario with a fresh UUID, optionally seeded from a vector set.
 * Use this for "New Scenario" and "Duplicate" actions — never reuse an existing ID.
 * The generated scenario carries no run provenance; it must be verified independently.
 */
export function createScenario(name: string, seedVectors: TestVector[] = []): VerifyScenario {
  const trimmedName = name.trim() || 'New Scenario';
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: trimmedName,
    vectors: seedVectors.map(cloneVector),
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/** Create a new scenario from a vector set (or empty if omitted). */
export function createDefaultScenario(vectors: TestVector[] = []): VerifyScenario {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_SCENARIO_ID,
    name: DEFAULT_SCENARIO_NAME,
    vectors: vectors.map(cloneVector),
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Return a new scenario with an incremented version and fresh updatedAt.
 * Always call before persisting a vector or name edit.
 */
export function stampScenario(scenario: VerifyScenario): VerifyScenario {
  return {
    ...scenario,
    vectors: scenario.vectors.map(cloneVector),
    version: scenario.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Deterministic content hash based on scenario id, version, and vectors.
 * Store this in run metadata to detect drift between a run result and the
 * current scenario content without relying on timestamps.
 */
export function computeScenarioContentHash(scenario: VerifyScenario): string {
  return `scn_${digestValue({
    id: scenario.id,
    version: scenario.version,
    vectors: scenario.vectors,
  }).slice(0, 12)}`;
}

/**
 * Runtime invariant: after initialization there must always be at least one
 * scenario and a valid activeScenarioId.
 *
 * Call this in mergePersistedRuntimeState and anywhere the scenario library
 * is loaded from untrusted storage. Self-heals by creating a default scenario
 * if the persisted data is absent or corrupt.
 */
export function repairScenarioLibrary(
  rawScenarios: unknown,
  rawActiveId: unknown,
  fallbackVectors: TestVector[] = []
): { scenarios: VerifyScenario[]; activeScenarioId: string } {
  const valid = Array.isArray(rawScenarios)
    ? rawScenarios.filter(isValidScenario)
    : [];

  if (valid.length === 0) {
    const defaultScenario = createDefaultScenario(fallbackVectors);
    return { scenarios: [defaultScenario], activeScenarioId: defaultScenario.id };
  }

  const activeId = typeof rawActiveId === 'string' ? rawActiveId : null;
  const hasActive = valid.some((s) => s.id === activeId);
  return {
    scenarios: valid,
    activeScenarioId: hasActive ? activeId! : valid[0].id,
  };
}

/**
 * One-time migration: wrap legacy projectVectors into the "Default" scenario.
 * Call from mergePersistedRuntimeState when scenarios field is absent in persisted data.
 */
export function migrateProjectVectorsToScenario(
  projectVectors: TestVector[]
): { scenarios: VerifyScenario[]; activeScenarioId: string } {
  const defaultScenario = createDefaultScenario(projectVectors);
  return { scenarios: [defaultScenario], activeScenarioId: defaultScenario.id };
}

/**
 * Resolve the currently active scenario.
 * Falls back to the first scenario if activeScenarioId is null or invalid.
 * Returns null only if the library is empty (should not happen after repairScenarioLibrary).
 */
export function getActiveScenario(
  scenarios: VerifyScenario[],
  activeScenarioId: string | null
): VerifyScenario | null {
  if (scenarios.length === 0) return null;
  if (!activeScenarioId) return scenarios[0];
  return scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0];
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function isValidScenario(value: unknown): value is VerifyScenario {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === 'string' && s.id.trim().length > 0 &&
    typeof s.name === 'string' &&
    Array.isArray(s.vectors) &&
    typeof s.version === 'number'
  );
}

function cloneVector(v: TestVector): TestVector {
  return {
    tick: v.tick,
    inputs: { ...v.inputs },
    expected: { ...(v.expected ?? {}) },
  };
}
