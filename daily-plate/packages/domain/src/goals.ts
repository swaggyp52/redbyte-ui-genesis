import { abs, gt, sub, type Decimal } from './decimal.js';
import type { MacroKey, NutrientTotal } from './nutrients.js';

export type DayType = 'rest' | 'training';

export const DAY_TYPE_LABELS: Record<DayType, string> = { rest: 'Rest day', training: 'Training day' };

export type MacroTargets = Record<MacroKey, Decimal>;

/**
 * Optional secondary targets the user may enter themselves. The app never
 * invents fiber, sugar or calorie targets; these stay undefined until the
 * user explicitly sets them.
 */
export interface SecondaryTargets {
  fiber?: Decimal;
  sugar?: Decimal;
}

export interface GoalTemplate {
  rest: MacroTargets;
  training: MacroTargets;
  secondary: SecondaryTargets;
}

/** The user's stated presets from the original message. 165 g interpreted as carbohydrates; confirmed once at setup. */
export const DEFAULT_GOAL_TEMPLATE: GoalTemplate = {
  rest: { protein: '140', carbs: '130', fat: '45' },
  training: { protein: '145', carbs: '165', fat: '40' },
  secondary: {},
};

export interface DayGoalSnapshot {
  localDate: string;
  dayType: DayType;
  targets: MacroTargets;
  secondary: SecondaryTargets;
  /** Identifies which template version the snapshot was taken from. */
  templateRevision: number;
}

export function snapshotForDay(template: GoalTemplate, localDate: string, dayType: DayType, templateRevision: number): DayGoalSnapshot {
  return {
    localDate,
    dayType,
    targets: { ...template[dayType] },
    secondary: { ...template.secondary },
    templateRevision,
  };
}

export interface MacroProgress {
  target: Decimal;
  /** Known consumed amount (reported + estimated). */
  consumed: Decimal;
  /** Target minus consumed; negative when over. */
  remaining: Decimal;
  over: boolean;
  /** Absolute amount over target, when over. */
  overBy: Decimal;
  /** True when an item is missing this nutrient or contributes only a bound. */
  provisional: boolean;
  approximate: boolean;
  /** Fraction of target consumed, clamped 0..1, for a simple track. */
  fraction: number;
}

export function macroProgress(total: NutrientTotal, target: Decimal): MacroProgress {
  const remaining = sub(target, total.known);
  const over = gt(total.known, target);
  const fraction = Number(target) > 0 ? Math.min(1, Math.max(0, Number(total.known) / Number(target))) : 0;
  return {
    target,
    consumed: total.known,
    remaining,
    over,
    overBy: over ? abs(remaining) : '0',
    provisional: !total.complete,
    approximate: total.hasEstimate,
    fraction,
  };
}
