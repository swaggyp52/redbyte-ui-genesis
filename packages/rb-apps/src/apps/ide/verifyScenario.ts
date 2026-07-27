import type { TestVector } from '@redbyte/rb-utils';
import { digestValue } from '../../utils/digest';
import {
  materializeVectorsFromScenarioSteps,
  normalizeScenarioSteps,
  type VerifyScenarioStep,
} from './verifyScenarioSteps';
import type {
  VerifyClockExecutionModel,
  VerifyClockOverrideMode,
  VerifyClockPolicy,
  VerifyClockSourceType,
} from './verifyClockPolicy';

/**
 * Browser-local sequential execution choices owned by one Verify scenario.
 *
 * This deliberately excludes board frequency/pin presentation metadata. Those
 * values are detected from the current design on every run, while these fields
 * capture only the student's durable execution intent.
 */
export interface VerifyScenarioSequentialPolicy {
  overrideMode: VerifyClockOverrideMode;
  runCycles: number;
  activeEdge: VerifyClockPolicy['activeEdge'];
  resetBehavior: VerifyClockPolicy['resetBehavior'];
  sourceType: VerifyClockSourceType;
  executionModel: VerifyClockExecutionModel;
  signalId?: string;
  signalLabel?: string;
  resetSignalName?: string;
  startLevel?: 0 | 1;
}

export interface VerifyScenarioProbe {
  key: string;
  label?: string;
}

export interface VerifyScenario {
  /** Stable identifier — survives renames and vector edits. */
  id: string;
  /** User-editable display name. */
  name: string;
  /** Ordered test vectors (tick + inputs + expected outputs). */
  vectors: TestVector[];
  /** Explicit sequencer contract. When present, this is verify-authority. */
  steps?: VerifyScenarioStep[];
  /** Per-scenario sequential execution intent. Browser-local; never part of RBProject. */
  sequentialPolicy?: VerifyScenarioSequentialPolicy;
  /** Signal lanes watched in this scenario. Browser-local and independent of run freshness. */
  probes?: VerifyScenarioProbe[];
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

export type { VerifyScenarioStep } from './verifyScenarioSteps';

/**
 * Create a new named scenario with a fresh UUID, optionally seeded from a vector set.
 * Use this for "New Scenario" and "Duplicate" actions — never reuse an existing ID.
 * The generated scenario carries no run provenance; it must be verified independently.
 */
export function createScenario(
  name: string,
  seedVectors: TestVector[] = [],
  sequentialPolicy?: VerifyScenarioSequentialPolicy
): VerifyScenario {
  const trimmedName = name.trim() || 'New Scenario';
  const normalizedVectors = seedVectors.map(cloneVector);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: trimmedName,
    vectors: normalizedVectors,
    sequentialPolicy: cloneScenarioSequentialPolicy(sequentialPolicy),
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/** Create a new scenario from a vector set (or empty if omitted). */
export function createDefaultScenario(
  vectors: TestVector[] = [],
  sequentialPolicy?: VerifyScenarioSequentialPolicy
): VerifyScenario {
  const normalizedVectors = vectors.map(cloneVector);
  const now = new Date().toISOString();
  return {
    id: DEFAULT_SCENARIO_ID,
    name: DEFAULT_SCENARIO_NAME,
    vectors: normalizedVectors,
    sequentialPolicy: cloneScenarioSequentialPolicy(sequentialPolicy),
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
    vectors: materializeScenarioVectors(scenario),
    steps: scenario.steps?.map(cloneStep),
    sequentialPolicy: cloneScenarioSequentialPolicy(scenario.sequentialPolicy),
    probes: normalizeScenarioProbes(scenario.probes),
    version: scenario.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeScenarioProbes(
  probes: ReadonlyArray<VerifyScenarioProbe> | null | undefined
): VerifyScenarioProbe[] {
  const normalized = new Map<string, VerifyScenarioProbe>();
  for (const probe of probes ?? []) {
    const key = typeof probe?.key === 'string' ? probe.key.trim() : '';
    if (!key) continue;
    const label = typeof probe.label === 'string' ? probe.label.trim() : '';
    normalized.set(key, label && label !== key ? { key, label } : { key });
  }
  return [...normalized.values()].sort((left, right) => left.key.localeCompare(right.key));
}

export function toggleScenarioProbe(
  probes: ReadonlyArray<VerifyScenarioProbe> | null | undefined,
  probe: VerifyScenarioProbe
): VerifyScenarioProbe[] {
  const normalized = normalizeScenarioProbes(probes);
  const key = probe.key.trim();
  if (!key) return normalized;
  if (normalized.some((entry) => entry.key === key)) {
    return normalized.filter((entry) => entry.key !== key);
  }
  return normalizeScenarioProbes([...normalized, probe]);
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
    vectors: materializeScenarioVectors(scenario),
    steps: scenario.steps ?? [],
    ...(scenario.sequentialPolicy ? { sequentialPolicy: scenario.sequentialPolicy } : {}),
  }).slice(0, 12)}`;
}

/**
 * Stimulus-only hash for run freshness checks.
 * Expected outputs are intentionally excluded so saving checks does not
 * invalidate the waveform that produced them.
 */
export function computeVectorStimulusHash(
  vectors: ReadonlyArray<Pick<TestVector, 'tick' | 'inputs'>>
): string {
  return `stv_${digestValue(
    vectors.map((vector, index) => ({
      tick:
        Number.isFinite(Number(vector.tick))
          ? Math.max(0, Math.floor(Number(vector.tick)))
          : index,
      inputs: normalizeStimulusRecord(vector.inputs ?? {}),
    }))
  ).slice(0, 12)}`;
}

export function computeExecutionStimulusHash(
  vectors: ReadonlyArray<Pick<TestVector, 'tick' | 'inputs'>>,
  policy?: VerifyScenarioSequentialPolicy | VerifyClockPolicy | null
): string {
  const vectorStimulusHash = computeVectorStimulusHash(vectors);
  const sequentialPolicy = normalizeScenarioSequentialPolicy(policy);
  if (!sequentialPolicy) return vectorStimulusHash;
  return `stv_${digestValue({
    vectorStimulusHash,
    sequentialPolicy,
  }).slice(0, 12)}`;
}

export function computeScenarioStimulusHash(scenario: VerifyScenario): string {
  return computeExecutionStimulusHash(
    materializeScenarioVectors(scenario),
    scenario.sequentialPolicy
  );
}

/**
 * Returns vectors from explicit steps when present; falls back to stored vectors.
 */
export function materializeScenarioVectors(scenario: VerifyScenario): TestVector[] {
  return materializeVectorsFromScenarioSteps(scenario.steps, scenario.vectors);
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
    ? rawScenarios.filter(isValidScenario).map((scenario) => ({
        ...scenario,
        vectors: scenario.vectors.map(cloneVector),
        steps: normalizeScenarioSteps(scenario.steps),
        sequentialPolicy: normalizeScenarioSequentialPolicy(scenario.sequentialPolicy),
      }))
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
  const steps = normalizeScenarioSteps(s.steps);
  return (
    typeof s.id === 'string' && s.id.trim().length > 0 &&
    typeof s.name === 'string' &&
    Array.isArray(s.vectors) &&
    typeof s.version === 'number' &&
    (s.steps === undefined || Array.isArray(steps))
  );
}

export function normalizeScenarioSequentialPolicy(
  value: unknown
): VerifyScenarioSequentialPolicy | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const overrideMode = normalizeOverrideMode(source.overrideMode);
  const sourceType = normalizeSourceType(source.sourceType);
  const executionModel = normalizeExecutionModel(source.executionModel);
  if (!overrideMode || !sourceType || !executionModel) return undefined;

  // RedByte v1 primitives and generated HDL are rising-edge only. Preserve
  // authored falling *transitions* in scenario steps/vectors, but never persist
  // an unsupported falling-edge capture policy from legacy or imported state.
  const activeEdge = 'rising' as const;
  const resetBehavior =
    source.resetBehavior === 'auto-sequence' || source.resetBehavior === 'custom'
      ? source.resetBehavior
      : 'none';
  const runCycles = normalizeRunCycles(source.runCycles);
  const resetSignalName = normalizeOptionalText(source.resetSignalName);
  const authoredClock = overrideMode !== 'auto';

  return {
    overrideMode,
    runCycles,
    activeEdge,
    resetBehavior: authoredClock ? (resetSignalName ? 'custom' : 'none') : resetBehavior,
    sourceType,
    executionModel: authoredClock ? 'manual' : executionModel,
    signalId: normalizeOptionalText(source.signalId),
    signalLabel: normalizeOptionalText(source.signalLabel),
    resetSignalName,
    startLevel: source.startLevel === 1 ? 1 : source.startLevel === 0 ? 0 : undefined,
  };
}

export function cloneScenarioSequentialPolicy(
  value: VerifyScenarioSequentialPolicy | undefined
): VerifyScenarioSequentialPolicy | undefined {
  return value ? { ...value } : undefined;
}

function normalizeOverrideMode(value: unknown): VerifyClockOverrideMode | undefined {
  return value === 'auto' || value === 'manual-pulses' || value === 'custom-pattern'
    ? value
    : undefined;
}

function normalizeSourceType(value: unknown): VerifyClockSourceType | undefined {
  return value === 'board-clock' ||
    value === 'explicit-clock-component' ||
    value === 'manual' ||
    value === 'inferred'
    ? value
    : undefined;
}

function normalizeExecutionModel(value: unknown): VerifyClockExecutionModel | undefined {
  return value === 'external-input-auto-toggle' ||
    value === 'component-oscillator' ||
    value === 'manual'
    ? value
    : undefined;
}

function normalizeRunCycles(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(4096, Math.floor(parsed)));
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function cloneVector(v: TestVector): TestVector {
  return {
    tick: v.tick,
    inputs: { ...v.inputs },
    expected: { ...(v.expected ?? {}) },
  };
}

function cloneStep(step: VerifyScenarioStep): VerifyScenarioStep {
  return {
    ...step,
    value: cloneStepBitOrRecord(step.value),
    expectedValue: cloneStepBitOrRecord(step.expectedValue),
  };
}

function cloneStepBitOrRecord(
  value: VerifyScenarioStep['value']
): VerifyScenarioStep['value'] {
  if (value && typeof value === 'object') {
    return { ...value };
  }
  return value;
}

function normalizeStimulusRecord(
  record: Record<string, boolean | number>
): Record<string, 0 | 1> {
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, normalizeStimulusBit(value)])
  );
}

function normalizeStimulusBit(value: boolean | number): 0 | 1 {
  return value === true || Number(value) === 1 ? 1 : 0;
}
