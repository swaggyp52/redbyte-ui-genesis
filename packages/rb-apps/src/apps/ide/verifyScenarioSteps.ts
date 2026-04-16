import type { TestVector } from '@redbyte/rb-utils';

export type VerifyScenarioStepKind =
  | 'set_input'
  | 'set_bit'
  | 'set_slice'
  | 'set_bus'
  | 'apply_reset'
  | 'pulse_step'
  | 'observe'
  | 'assert_scalar'
  | 'assert_bus'
  | 'inspect_register'
  | 'inspect_state_bank';

export interface VerifyScenarioStep {
  id: string;
  order: number;
  kind: VerifyScenarioStepKind;
  targetRef?: string;
  value?: 0 | 1 | Record<string, 0 | 1>;
  expectedValue?: 0 | 1 | Record<string, 0 | 1>;
  durationTicks?: number;
  pulseBehavior?: 'rising' | 'falling' | 'high' | 'low';
  label?: string;
  notes?: string;
  origin?: 'explicit' | 'derived';
}

export interface ScenarioStepDraft {
  kind: VerifyScenarioStepKind;
  targetRef?: string;
  value?: 0 | 1 | Record<string, 0 | 1>;
  expectedValue?: 0 | 1 | Record<string, 0 | 1>;
  durationTicks?: number;
  pulseBehavior?: 'rising' | 'falling' | 'high' | 'low';
  label?: string;
  notes?: string;
  origin?: 'explicit' | 'derived';
}

export function createScenarioStep(
  draft: ScenarioStepDraft,
  order: number
): VerifyScenarioStep {
  return {
    id: crypto.randomUUID(),
    order,
    kind: draft.kind,
    targetRef: normalizeText(draft.targetRef),
    value: normalizeBitOrRecord(draft.value),
    expectedValue: normalizeBitOrRecord(draft.expectedValue),
    durationTicks: normalizeDuration(draft.durationTicks),
    pulseBehavior: draft.pulseBehavior,
    label: normalizeText(draft.label),
    notes: normalizeText(draft.notes),
    origin: draft.origin ?? 'explicit',
  };
}

export function normalizeScenarioSteps(
  raw: unknown
): VerifyScenarioStep[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const steps: VerifyScenarioStep[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const normalized = normalizeStep(raw[index], index);
    if (normalized) {
      steps.push(normalized);
    }
  }
  return steps.length > 0 ? steps : undefined;
}

export function deriveScenarioStepsFromVectors(vectors: TestVector[]): VerifyScenarioStep[] {
  const sorted = [...vectors].sort((left, right) => left.tick - right.tick);
  const steps: VerifyScenarioStep[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const vector = sorted[index];
    const previous = index > 0 ? sorted[index - 1] : null;
    const changedInputs = Object.keys(vector.inputs ?? {}).filter((key) => {
      const previousValue = previous?.inputs?.[key];
      return previousValue === undefined || Number(previousValue) !== Number(vector.inputs[key]);
    });

    for (const inputKey of changedInputs) {
      const value = normalizeBit(vector.inputs[inputKey]);
      const lower = inputKey.toLowerCase();
      const isResetLike = /reset|rst/.test(lower) && value === 1;
      const isStepLike = /(clk|clock|step)/.test(lower);
      steps.push({
        id: `derived:${vector.tick}:${inputKey}:${steps.length}`,
        order: steps.length,
        kind: isResetLike ? 'apply_reset' : isStepLike ? 'pulse_step' : 'set_input',
        targetRef: inputKey,
        value,
        durationTicks: 1,
        origin: 'derived',
      });
    }

    const expectedEntries = Object.entries(vector.expected ?? {});
    if (expectedEntries.length > 0) {
      for (const [signal, expectedValue] of expectedEntries) {
        steps.push({
          id: `derived:${vector.tick}:assert:${signal}:${steps.length}`,
          order: steps.length,
          kind: 'assert_scalar',
          targetRef: signal,
          expectedValue: normalizeBit(expectedValue),
          durationTicks: 1,
          origin: 'derived',
        });
      }
    } else {
      steps.push({
        id: `derived:${vector.tick}:observe:${steps.length}`,
        order: steps.length,
        kind: 'observe',
        durationTicks: 1,
        origin: 'derived',
      });
    }
  }

  return steps;
}

export function materializeVectorsFromScenarioSteps(
  steps: VerifyScenarioStep[] | undefined,
  fallbackVectors: TestVector[]
): TestVector[] {
  if (!steps || steps.length === 0) return cloneVectors(fallbackVectors);

  const sorted = [...steps].sort((left, right) => left.order - right.order);
  const vectors: TestVector[] = [];
  let tick = 0;
  let currentInputs: Record<string, 0 | 1> = {};
  let currentExpected: Record<string, 0 | 1> = {};

  const pushVector = (overrideExpected?: Record<string, 0 | 1>) => {
    vectors.push({
      tick,
      inputs: { ...currentInputs },
      expected: { ...(overrideExpected ?? currentExpected) },
    });
    tick += 1;
  };

  for (const step of sorted) {
    const duration = normalizeDuration(step.durationTicks);
    const target = normalizeText(step.targetRef);

    switch (step.kind) {
      case 'set_input':
      case 'set_bit': {
        if (target) currentInputs[target] = normalizeBit(step.value);
        for (let d = 0; d < duration; d += 1) pushVector();
        break;
      }
      case 'set_slice':
      case 'set_bus': {
        if (step.value && typeof step.value === 'object' && !Array.isArray(step.value)) {
          for (const [key, bit] of Object.entries(step.value)) {
            currentInputs[key] = normalizeBit(bit);
          }
        } else if (target) {
          currentInputs[target] = normalizeBit(step.value);
        }
        for (let d = 0; d < duration; d += 1) pushVector();
        break;
      }
      case 'apply_reset': {
        if (target) currentInputs[target] = normalizeBit(step.value ?? 1);
        for (let d = 0; d < duration; d += 1) pushVector();
        break;
      }
      case 'pulse_step': {
        if (target) {
          currentInputs[target] = 1;
          pushVector();
          currentInputs[target] = 0;
          for (let d = 0; d < duration; d += 1) pushVector();
        } else {
          pushVector();
        }
        break;
      }
      case 'assert_scalar': {
        if (target) {
          currentExpected[target] = normalizeBit(step.expectedValue ?? step.value);
        }
        for (let d = 0; d < duration; d += 1) pushVector();
        break;
      }
      case 'assert_bus': {
        if (step.expectedValue && typeof step.expectedValue === 'object' && !Array.isArray(step.expectedValue)) {
          for (const [key, bit] of Object.entries(step.expectedValue)) {
            currentExpected[key] = normalizeBit(bit);
          }
        } else if (target) {
          currentExpected[target] = normalizeBit(step.expectedValue ?? step.value);
        }
        for (let d = 0; d < duration; d += 1) pushVector();
        break;
      }
      case 'inspect_register':
      case 'inspect_state_bank':
      case 'observe':
      default: {
        for (let d = 0; d < duration; d += 1) pushVector();
        break;
      }
    }
  }

  return vectors.length > 0 ? vectors : cloneVectors(fallbackVectors);
}

function normalizeStep(raw: unknown, index: number): VerifyScenarioStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const kind = normalizeKind(source.kind);
  if (!kind) return null;

  return {
    id:
      typeof source.id === 'string' && source.id.trim().length > 0
        ? source.id.trim()
        : `step-${index + 1}`,
    order:
      typeof source.order === 'number' && Number.isFinite(source.order)
        ? Math.max(0, Math.floor(source.order))
        : index,
    kind,
    targetRef: normalizeText(source.targetRef),
    value: normalizeBitOrRecord(source.value),
    expectedValue: normalizeBitOrRecord(source.expectedValue),
    durationTicks: normalizeDuration(
      typeof source.durationTicks === 'number' ? source.durationTicks : undefined
    ),
    pulseBehavior:
      source.pulseBehavior === 'rising' ||
      source.pulseBehavior === 'falling' ||
      source.pulseBehavior === 'high' ||
      source.pulseBehavior === 'low'
        ? source.pulseBehavior
        : undefined,
    label: normalizeText(source.label),
    notes: normalizeText(source.notes),
    origin: source.origin === 'derived' ? 'derived' : 'explicit',
  };
}

function normalizeKind(value: unknown): VerifyScenarioStepKind | null {
  if (typeof value !== 'string') return null;
  switch (value) {
    case 'set_input':
    case 'set_bit':
    case 'set_slice':
    case 'set_bus':
    case 'apply_reset':
    case 'pulse_step':
    case 'observe':
    case 'assert_scalar':
    case 'assert_bus':
    case 'inspect_register':
    case 'inspect_state_bank':
      return value;
    default:
      return null;
  }
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeDuration(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(64, Math.floor(value)));
}

function normalizeBit(value: unknown): 0 | 1 {
  return value === true || Number(value) === 1 ? 1 : 0;
}

function normalizeBitOrRecord(
  value: unknown
): 0 | 1 | Record<string, 0 | 1> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const normalized: Record<string, 0 | 1> = {};
    for (const [key, rawBit] of Object.entries(value as Record<string, unknown>)) {
      const trimmed = key.trim();
      if (!trimmed) continue;
      normalized[trimmed] = normalizeBit(rawBit);
    }
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }
  return normalizeBit(value);
}

function cloneVectors(vectors: TestVector[]): TestVector[] {
  return vectors.map((vector) => ({
    ...vector,
    inputs: { ...(vector.inputs ?? {}) },
    expected: { ...(vector.expected ?? {}) },
  }));
}
