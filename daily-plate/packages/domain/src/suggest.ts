import { abs, add, div, gt, mul, sub, type Decimal } from './decimal.js';
import type { MacroTargets } from './goals.js';
import { MACRO_KEYS, type MacroKey, type NutrientSet } from './nutrients.js';
import type { MealSlot } from './meals.js';

/** ---------- Context suggestions ("Often used around now") ---------- */

export interface UsageRecord {
  foodId: string;
  /** ISO instant of the log. */
  occurredAt: string;
  mealSlot: MealSlot;
}

export interface ContextSuggestion {
  foodId: string;
  score: number;
  uses: number;
}

export interface ContextOptions {
  now: Date;
  mealSlot: MealSlot;
  excludeFoodIds?: Iterable<string>;
  limit?: number;
}

/**
 * Small bounded score from recency, repeat use and meal context. It ranks;
 * it says nothing about nutritional quality.
 */
export function contextSuggestions(history: UsageRecord[], options: ContextOptions): ContextSuggestion[] {
  const excluded = new Set(options.excludeFoodIds ?? []);
  const limit = options.limit ?? 3;
  const nowMs = options.now.getTime();
  const scores = new Map<string, { score: number; uses: number }>();
  for (const record of history) {
    if (excluded.has(record.foodId)) continue;
    const ageDays = Math.max(0, (nowMs - Date.parse(record.occurredAt)) / 86_400_000);
    const recency = Math.exp(-ageDays / 14);
    const context = record.mealSlot === options.mealSlot ? 1 : 0.35;
    const entry = scores.get(record.foodId) ?? { score: 0, uses: 0 };
    entry.score += recency * context;
    entry.uses += 1;
    scores.set(record.foodId, entry);
  }
  return [...scores.entries()]
    .map(([foodId, { score, uses }]) => ({ foodId, score: Number((score + Math.log1p(uses) * 0.25).toFixed(4)), uses }))
    .sort((a, b) => b.score - a.score || a.foodId.localeCompare(b.foodId))
    .slice(0, limit);
}

/** ---------- Macro-fit ideas ("Ideas from my foods") ---------- */

export interface IdeaCandidate {
  id: string;
  name: string;
  /** Nutrients for one unit of this candidate (one serving or one saved meal). */
  nutrients: NutrientSet;
  /** Serving multiples the user allows for suggestions. */
  multiples?: Decimal[];
}

export interface Idea {
  candidateId: string;
  name: string;
  multiple: Decimal;
  adds: Record<MacroKey, Decimal>;
  /** Remaining after this idea; negative means over. */
  remainingAfter: Record<MacroKey, Decimal>;
  score: number;
}

export interface IdeaInput {
  remaining: Record<MacroKey, Decimal>;
  targets: MacroTargets;
  candidates: IdeaCandidate[];
  limit?: number;
}

export const DEFAULT_MULTIPLES: Decimal[] = ['0.5', '1', '1.5'];

function scoreIdea(remaining: Record<MacroKey, Decimal>, targets: MacroTargets, adds: Record<MacroKey, Decimal>): number {
  let score = 0;
  for (const key of MACRO_KEYS) {
    const target = Number(targets[key]) || 1;
    const residual = sub(remaining[key], adds[key]);
    const normalized = Number(abs(residual)) / target;
    const overshoot = gt(adds[key], remaining[key]) ? Number(abs(residual)) / target : 0;
    score += normalized + overshoot; // conservative: equal weights, overshoot counted twice
  }
  return Number(score.toFixed(6));
}

/**
 * Transparent arithmetic: for each allowed candidate and multiple, compute what
 * it would add and how far from the remaining targets the day would be.
 * Candidates missing any macro are rejected outright.
 */
export function macroFitIdeas(input: IdeaInput): Idea[] {
  const ideas: Idea[] = [];
  for (const candidate of input.candidates) {
    const known = MACRO_KEYS.every((k) => candidate.nutrients[k].status === 'reported' || candidate.nutrients[k].status === 'estimated');
    if (!known) continue;
    let best: Idea | undefined;
    for (const multiple of candidate.multiples ?? DEFAULT_MULTIPLES) {
      const adds = {} as Record<MacroKey, Decimal>;
      const remainingAfter = {} as Record<MacroKey, Decimal>;
      for (const key of MACRO_KEYS) {
        const v = candidate.nutrients[key];
        const amount = v.status === 'unknown' ? '0' : v.amount;
        adds[key] = mul(amount, multiple);
        remainingAfter[key] = sub(input.remaining[key], adds[key]);
      }
      const score = scoreIdea(input.remaining, input.targets, adds);
      if (!best || score < best.score) best = { candidateId: candidate.id, name: candidate.name, multiple, adds, remainingAfter, score };
    }
    if (best) ideas.push(best);
  }
  return ideas.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).slice(0, input.limit ?? 3);
}

/** Baseline score of doing nothing, for callers who want to show "no idea improves the day". */
export function baselineScore(remaining: Record<MacroKey, Decimal>, targets: MacroTargets): number {
  return scoreIdea(remaining, targets, { protein: '0', carbs: '0', fat: '0' });
}

/** Utility: how much of a target a value is, as a decimal fraction string. */
export function fractionOf(value: Decimal, target: Decimal): Decimal {
  return Number(target) === 0 ? '0' : div(value, target, 4);
}

export { add };
