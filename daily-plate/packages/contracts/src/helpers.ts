import {
  DEFAULT_GOAL_TEMPLATE,
  resolveQuantity,
  scaleNutrients,
  weekdayOf,
  type DayType,
  type ResolveError,
} from '@daily-plate/domain';
import type { DaySnapshot, DiarySnapshot, FoodVersion, GoalTemplateDto, Quantity, User } from './index.js';
import { SOURCE_BADGE_BY_PROVIDER } from './index.js';

export type SnapshotResult = { ok: true; factor: string; snapshot: DiarySnapshot } | { ok: false; error: ResolveError };

/**
 * Builds the immutable diary snapshot for a food version at a quantity. Used by
 * the server (authoritative) and by the phone (preview before add).
 */
export function buildDiarySnapshot(version: FoodVersion, quantity: Quantity): SnapshotResult {
  const resolved = resolveQuantity({ basis: version.basis, portions: version.portions }, quantity);
  if (!resolved.ok) return resolved;
  const snapshot: DiarySnapshot = {
    name: version.name,
    sourceBadge: SOURCE_BADGE_BY_PROVIDER[version.provenance.provider],
    preparation: version.preparation,
    nutrients: scaleNutrients(version.nutrients, resolved.factor),
    quantityLabel: resolved.label,
  };
  if (version.brand) snapshot.brand = version.brand;
  return { ok: true, factor: resolved.factor, snapshot };
}

export function defaultDayType(user: Pick<User, 'trainingWeekdays'>, localDate: string): DayType {
  return user.trainingWeekdays.includes(weekdayOf(localDate)) ? 'training' : 'rest';
}

/** A day that has no persisted snapshot yet is shown from the current template and schedule. */
export function virtualDaySnapshot(goals: GoalTemplateDto, user: Pick<User, 'trainingWeekdays'>, localDate: string, dayType?: DayType): DaySnapshot {
  const type = dayType ?? defaultDayType(user, localDate);
  return {
    localDate,
    dayType: type,
    targets: { ...goals[type] },
    secondary: { ...goals.secondary },
    templateRevision: goals.revision,
    revision: 0,
    updatedAt: goals.updatedAt,
  };
}

export const DEFAULT_GOALS = DEFAULT_GOAL_TEMPLATE;
