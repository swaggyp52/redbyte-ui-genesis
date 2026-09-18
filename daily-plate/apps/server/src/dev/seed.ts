/**
 * Synthetic "lived-in" accounts for tests and screenshots. Never run against
 * production data: refused when NODE_ENV=production.
 *   node dist/dev/seed.js --profile week|months --dataDir <dir>   (prints an invite link)
 */
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { Store } from '../db/store.js';
import { Invites } from '../auth/sessions.js';
import { applyMutation } from '../services/mutations.js';
import type { MutationPayload, NewFoodVersion } from '@daily-plate/contracts';
import { shiftLocalDate } from '@daily-plate/domain';

if (process.env.NODE_ENV === 'production') throw new Error('seed is test-only');

const args = process.argv.slice(2);
const flag = (n: string): string | undefined => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const profile = flag('profile') ?? 'week';
const config = loadConfig({ ...(flag('dataDir') ? { dataDir: flag('dataDir')!, dbPath: `${flag('dataDir')!}/daily-plate.db` } : {}) });
const db = openDatabase(config.dbPath);
const store = new Store(db);
const user = store.createUser(flag('name') ?? 'Demo Mom', 'America/New_York');
store.saveUser({ ...user, setupConfirmedAt: new Date().toISOString(), trainingWeekdays: [1, 3, 5], revision: 2 });

const r = (n: number | string) => ({ status: 'reported' as const, amount: String(n) });
const U = { status: 'unknown' as const };
const version = (name: string, n: Partial<NewFoodVersion['nutrients']>, basis: NewFoodVersion['basis'], portions: NewFoodVersion['portions'], extra: Partial<NewFoodVersion> = {}): NewFoodVersion => ({
  id: randomUUID(),
  name,
  preparation: 'unspecified',
  basis,
  nutrients: { protein: U, carbs: U, fat: U, fiber: U, sugar: U, calories: U, ...n },
  portions,
  defaultQuantity: portions[0] ? { amount: '1', unit: { kind: 'portion', portionId: portions[0].id } } : { amount: '100', unit: { kind: 'mass', unit: 'g' } },
  provenance: { provider: 'user', fetchedAt: new Date().toISOString(), normalizationVersion: 'user-1' },
  ...extra,
});

const foods: Array<{ name: string; aliases?: string[]; pin?: number; tags?: Array<'alcohol' | 'drink'>; v: NewFoodVersion }> = [
  { name: 'My shake', aliases: ['shake'], pin: 0, tags: ['drink'], v: version('My shake', { protein: r(30), carbs: r(15), fiber: r(5) }, { kind: 'serving', servingText: '1 bottle', servingMl: '325' }, [{ id: 'bottle', name: 'bottle', servings: '1' }, { id: 'half', name: 'half bottle', servings: '0.5' }]) },
  { name: 'Egg, large', aliases: ['eggs'], pin: 1, v: version('Egg, large', { protein: r(6.3), carbs: r(0.4), fat: r(5), fiber: r(0), sugar: r(0.2), calories: r(72) }, { kind: 'per100g' }, [{ id: 'large', name: 'large', grams: '50' }], { preparation: 'cooked' }) },
  { name: 'Greek yogurt, plain, nonfat', v: version('Greek yogurt, plain, nonfat', { protein: r(10), carbs: r(3.6), fat: r(0.4), fiber: r(0), sugar: r(3.2), calories: r(59) }, { kind: 'per100g' }, [{ id: 'cup', name: 'cup', grams: '245' }, { id: 'tub', name: 'single tub (150 g)', grams: '150' }]) },
  { name: 'Whole wheat bread', aliases: ['toast'], v: version('Whole wheat bread', { protein: r(13), carbs: r(41), fat: r(3.5), fiber: r(6), sugar: r(5.5), calories: r(252) }, { kind: 'per100g' }, [{ id: 'slice', name: 'slice', grams: '43' }]) },
  { name: 'Peanut butter, creamy, no salt added, no sugar added, 100% peanuts', aliases: ['pb'], v: version('Peanut butter, creamy, no salt added, no sugar added, 100% peanuts', { protein: r(22), carbs: r(22), fat: r(51), fiber: r(5), sugar: r(10), calories: r(598) }, { kind: 'per100g' }, [{ id: 'tbsp', name: 'tablespoon', grams: '16' }]) },
  { name: 'Chicken breast, cooked', v: version('Chicken breast, cooked', { protein: r(31), carbs: r(0), fat: r(3.6), fiber: r(0), sugar: r(0), calories: r(165) }, { kind: 'per100g' }, [{ id: 'breast', name: 'breast (120 g)', grams: '120' }], { preparation: 'cooked' }) },
  { name: 'Chicken breast, raw', v: version('Chicken breast, raw', { protein: r(22.5), carbs: r(0), fat: r(2.6), fiber: r(0), sugar: r(0), calories: r(120) }, { kind: 'per100g' }, [], { preparation: 'raw' }) },
  { name: 'Rice, white, cooked', v: version('Rice, white, cooked', { protein: r(2.4), carbs: r(28.6), fat: r(0.2), fiber: r(0.4), sugar: r(0.05), calories: r(129) }, { kind: 'per100g' }, [{ id: 'cup', name: 'cup', grams: '158' }], { preparation: 'cooked' }) },
  { name: 'Banana, raw', v: version('Banana, raw', { protein: r(1.1), carbs: r(22.8), fat: r(0.3), fiber: r(2.6), sugar: r(12.2), calories: r(89) }, { kind: 'per100g' }, [{ id: 'medium', name: 'medium', grams: '118' }], { preparation: 'raw' }) },
  { name: 'Coffee with 2% milk', tags: ['drink'], v: version('Coffee with 2% milk', { protein: r(0.5), carbs: r(0.7), fat: r(0.3), calories: r(8) }, { kind: 'per100ml' }, [{ id: 'mug', name: 'mug (300 ml)', ml: '300' }]) },
  { name: 'Synthetic Märzen-style beer (TEST DATA)', tags: ['alcohol'], v: version('Synthetic Märzen-style beer (TEST DATA)', { protein: r(0.5), carbs: r(4.2), fat: r(0), fiber: r(0), calories: r(53) }, { kind: 'per100ml' }, [{ id: 'bottle12', name: '12 fl oz bottle', ml: '354.882' }, { id: 'can16', name: '16 fl oz can', ml: '473.176' }]) },
  { name: 'Restaurant salad, dressing unknown', v: version('Restaurant salad, dressing unknown', { protein: { status: 'estimated', amount: '12' }, carbs: { status: 'estimated', amount: '18' } }, { kind: 'serving', servingText: '1 bowl' }, [{ id: 'bowl', name: 'bowl', servings: '1' }]) },
  { name: 'Granola bar, chocolate chip', v: version('Granola bar, chocolate chip', { protein: r(2), carbs: r(17), fat: r(3.5), fiber: { status: 'less-than', amount: '1' }, sugar: r(7), calories: r(100) }, { kind: 'serving', servingText: '1 bar (24 g)', servingGrams: '24' }, [{ id: 'bar', name: 'bar', servings: '1' }], { barcode: '0012345678905', brand: 'Example Mills' }) },
];

const apply = (payload: MutationPayload): void => {
  const res = applyMutation(store, user.id, { schemaVersion: 1, mutationId: randomUUID(), clientTime: new Date().toISOString(), payload });
  if (res.status !== 'committed') throw new Error(`seed failed: ${JSON.stringify(res)}`);
};

const ids = new Map<string, { foodId: string; versionId: string }>();
for (const f of foods) {
  const foodId = randomUUID();
  apply({ type: 'food.upsert', food: { id: foodId, name: f.name, aliases: f.aliases ?? [], pin: f.pin !== undefined ? { order: f.pin, quantity: f.v.defaultQuantity! } : null, suggestEligible: !f.tags?.includes('alcohol'), tags: f.tags ?? [], hidden: false }, version: f.v });
  ids.set(f.name, { foodId, versionId: f.v.id });
}
const id = (name: string) => ids.get(name)!;
apply({ type: 'meal.upsert', meal: { id: randomUUID(), name: 'Usual breakfast', items: [{ ...id('Egg, large'), foodVersionId: id('Egg, large').versionId, quantity: { amount: '2', unit: { kind: 'portion', portionId: 'large' } } }, { ...id('Whole wheat bread'), foodVersionId: id('Whole wheat bread').versionId, quantity: { amount: '1', unit: { kind: 'portion', portionId: 'slice' } } }, { ...id('Coffee with 2% milk'), foodVersionId: id('Coffee with 2% milk').versionId, quantity: { amount: '1', unit: { kind: 'portion', portionId: 'mug' } } }], pin: { order: 2 }, suggestEligible: true } });
apply({ type: 'recipe.upsert', recipeId: randomUUID(), recipeVersionId: randomUUID(), foodId: randomUUID(), foodVersionId: randomUUID(), name: 'Chicken and rice bake', servingName: 'portion', yieldServings: '4', ingredients: [{ ...id('Chicken breast, raw'), foodVersionId: id('Chicken breast, raw').versionId, quantity: { amount: '600', unit: { kind: 'mass', unit: 'g' } } }, { ...id('Rice, white, cooked'), foodVersionId: id('Rice, white, cooked').versionId, quantity: { amount: '3', unit: { kind: 'portion', portionId: 'cup' } } }] });

const days = profile === 'months' ? 100 : profile === 'week' ? 7 : 1;
const today = new Date().toISOString().slice(0, 10);
const slots = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
for (let d = days - 1; d >= 0; d -= 1) {
  const localDate = shiftLocalDate(today, -d);
  const picks: Array<[string, string, string, (typeof slots)[number]]> = [
    ['My shake', '1', 'bottle', 'breakfast'],
    ['Egg, large', d % 3 === 0 ? '2' : '3', 'large', 'breakfast'],
    ['Chicken breast, cooked', '1', 'breast', 'lunch'],
    ['Rice, white, cooked', '1', 'cup', 'lunch'],
    ['Greek yogurt, plain, nonfat', '1', 'tub', 'snack'],
    ['Banana, raw', '1', 'medium', 'snack'],
  ];
  if (d % 2 === 0) picks.push(['Whole wheat bread', '2', 'slice', 'dinner'], ['Peanut butter, creamy, no salt added, no sugar added, 100% peanuts', '2', 'tbsp', 'dinner']);
  if (d % 5 === 0) picks.push(['Restaurant salad, dressing unknown', '1', 'bowl', 'dinner']);
  for (const [name, amount, portionId, slot] of picks) {
    if (d === 0 && slot !== 'breakfast') continue;
    apply({ type: 'diary.add', entry: { id: randomUUID(), localDate, timeZone: 'America/New_York', occurredAt: `${localDate}T${slot === 'breakfast' ? '12' : slot === 'lunch' ? '16' : slot === 'snack' ? '19' : '23'}:00:00.000Z`, mealSlot: slot, kind: 'food', foodVersionId: id(name).versionId, quantity: { amount, unit: { kind: 'portion', portionId } } } });
  }
  if (d % 7 === 3) apply({ type: 'diary.add', entry: { id: randomUUID(), localDate, timeZone: 'America/New_York', occurredAt: `${localDate}T22:00:00.000Z`, mealSlot: 'dinner', kind: 'draft', draft: { text: 'Neighbour’s lasagne, not sure of the portion' } } });
}
const invites = new Invites(db, config.inviteMinutes);
const { token } = invites.create({ userId: user.id });
console.log(JSON.stringify({ userId: user.id, invite: `${config.origins[0] ?? ''}/#invite=${token}`, foods: foods.length, days }));
db.close();
