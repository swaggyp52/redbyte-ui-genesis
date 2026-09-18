import { describe, expect, it } from 'vitest';
import { DiaryEntrySchema, MutationSchema, NutrientSetSchema, PortionSchema, QuantitySchema } from './index.js';

describe('contracts', () => {
  it('rejects bare numbers and zero defaults for nutrients', () => {
    expect(NutrientSetSchema.safeParse({ protein: 30 }).success).toBe(false);
    expect(NutrientSetSchema.safeParse({ protein: { status: 'reported', amount: '30' } }).success).toBe(false);
    const ok = NutrientSetSchema.safeParse({
      protein: { status: 'reported', amount: '30' },
      carbs: { status: 'reported', amount: '15' },
      fat: { status: 'unknown' },
      fiber: { status: 'reported', amount: '5' },
      sugar: { status: 'unknown' },
      calories: { status: 'less-than', amount: '5' },
    });
    expect(ok.success).toBe(true);
    expect(NutrientSetSchema.safeParse({ ...(ok.data as object), fat: { status: 'less-than', amount: '0' } }).success).toBe(false);
  });

  it('requires exactly one portion relationship', () => {
    expect(PortionSchema.safeParse({ id: 'bottle-01', name: 'bottle', servings: '1' }).success).toBe(true);
    expect(PortionSchema.safeParse({ id: 'bottle-01', name: 'bottle', servings: '1', grams: '300' }).success).toBe(false);
    expect(PortionSchema.safeParse({ id: 'bottle-01', name: 'bottle' }).success).toBe(false);
  });

  it('requires positive quantities', () => {
    expect(QuantitySchema.safeParse({ amount: '0', unit: { kind: 'serving' } }).success).toBe(false);
    expect(QuantitySchema.safeParse({ amount: '1.5', unit: { kind: 'serving' } }).success).toBe(true);
  });

  it('validates a mutation envelope', () => {
    const m = MutationSchema.safeParse({
      schemaVersion: 1,
      mutationId: '4c1d9c2e-2b6b-4f2b-9e3f-1c9f5f3a0a11',
      clientTime: '2026-09-18T12:00:00.000Z',
      payload: { type: 'day.setType', localDate: '2026-09-18', dayType: 'training' },
    });
    expect(m.success).toBe(true);
    expect(MutationSchema.safeParse({ schemaVersion: 2 }).success).toBe(false);
  });

  it('rejects an entry with a flat client user id or missing timezone', () => {
    expect(DiaryEntrySchema.safeParse({ id: 'entry-0001', localDate: '2026-09-18' }).success).toBe(false);
  });
});
