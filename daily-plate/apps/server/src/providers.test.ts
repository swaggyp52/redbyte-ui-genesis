import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaleNutrients, sumNutrients, type NutrientSet } from '@daily-plate/domain';
import type { BarcodeResponse, SearchResponse } from '@daily-plate/contracts';
import { normalizeUsdaSearch } from './providers/usda.js';
import { normalizeBarcode, normalizeOffProduct, paddedBarcode, type OffResponse } from './providers/off.js';
import { providerFetch } from './providers/http.js';
import { Throttle } from './providers/throttle.js';
import { rankLocalFoods } from './services/search.js';
import { cleanup, makeTestApp, SHAKE_FOOD, signUp, type Client, type TestApp } from './test-helpers.js';
import { resolveQuantity } from '@daily-plate/domain';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures');
const fixture = (rel: string): unknown => JSON.parse(fs.readFileSync(path.join(fixturesDir, rel), 'utf8'));

describe('P02 USDA normalization', () => {
  it('maps per-100 g nutrients and leaves missing ones unknown', () => {
    const [banana, powder] = normalizeUsdaSearch(fixture('usda/search-banana.json'));
    expect(banana).toMatchObject({ provider: 'usda', providerId: '1000001', name: 'Bananas, raw', preparation: 'raw', basis: { kind: 'per100g' } });
    expect(banana!.nutrients.protein).toEqual({ status: 'reported', amount: '1.09' });
    expect(banana!.nutrients.sugar).toEqual({ status: 'reported', amount: '12.23' });
    expect(banana!.nutrients.calories).toEqual({ status: 'reported', amount: '89' });
    expect(powder!.nutrients.fat).toEqual({ status: 'unknown' });
    expect(powder!.nutrients.fiber).toEqual({ status: 'unknown' });
    expect(powder!.needsLabelConfirmation).toBe(false);
  });

  it('treats a branded liquid stated in ml as per 100 ml with a serving portion and a warning', () => {
    const [shake] = normalizeUsdaSearch(fixture('usda/search-branded-liquid.json'));
    expect(shake).toMatchObject({ basis: { kind: 'per100ml' }, brand: 'Example', barcode: '0123456789012' });
    expect(shake!.portions).toEqual([{ id: 'serving', name: '1 bottle', ml: '325' }]);
    expect(shake!.nutrients.sugar).toEqual({ status: 'unknown' });
    expect(shake!.warnings[0]).toMatch(/per 100 ml/);
    const r = resolveQuantity({ basis: shake!.basis, portions: shake!.portions }, { amount: '1', unit: { kind: 'portion', portionId: 'serving' } });
    expect(r).toMatchObject({ ok: true, factor: '3.25' });
    if (r.ok) expect(scaleNutrients(shake!.nutrients as NutrientSet, r.factor).protein).toEqual({ status: 'reported', amount: '29.9975' });
  });

  it('ignores malformed hits', () => {
    expect(normalizeUsdaSearch({ foods: [{ description: 'no id' }, null, 5] })).toEqual([]);
    expect(normalizeUsdaSearch('garbage')).toEqual([]);
  });
});

describe('P02 Open Food Facts normalization', () => {
  it('keeps barcodes as strings with leading zeros and pads short codes on retry', () => {
    expect(normalizeBarcode(' 0012345678905 ')).toBe('0012345678905');
    expect(normalizeBarcode('12345')).toBeUndefined();
    expect(paddedBarcode('012345678905')).toBe('0012345678905');
    expect(paddedBarcode('0012345678905')).toBeUndefined();
  });

  it('flags bare carbohydrates for label confirmation and keeps a < bound', () => {
    const body = fixture('off/product-leading-zero.json') as OffResponse & { product: NonNullable<OffResponse['product']> };
    const c = normalizeOffProduct('0012345678905', body.product);
    expect(c).toMatchObject({ provider: 'off', barcode: '0012345678905', brand: 'Example Mills', basis: { kind: 'per100g' }, needsLabelConfirmation: true });
    expect(c.nutrients.carbs).toEqual({ status: 'estimated', amount: '68' });
    expect(c.nutrients.fiber).toEqual({ status: 'less-than', amount: '1' });
    expect(c.nutrients.sugar).toEqual({ status: 'unknown' });
    expect(c.portions).toEqual([
      { id: 'serving', name: '40 g (about 3/4 cup)', grams: '40' },
      { id: 'package', name: 'whole package (400 g)', grams: '400' },
    ]);
    expect(c.warnings[0]).toMatch(/include fiber/);
  });

  it('uses carbohydrates-total when present and per-serving data as a serving basis', () => {
    const body = fixture('off/product-per-serving.json') as OffResponse & { product: NonNullable<OffResponse['product']> };
    const c = normalizeOffProduct('4000000000012', body.product);
    expect(c.needsLabelConfirmation).toBe(false);
    expect(c.basis).toEqual({ kind: 'serving', servingText: '170 g', servingGrams: '170' });
    expect(c.nutrients.carbs).toEqual({ status: 'reported', amount: '6' });
    expect(c.nutrients.sugar).toEqual({ status: 'estimated', amount: '5' });
    expect(c.nutrients.fat).toEqual({ status: 'reported', amount: '0' });
    expect(c.portions[0]).toEqual({ id: 'serving', name: '170 g', servings: '1' });
    expect(c.portions[1]).toEqual({ id: 'package', name: 'whole package (500 g)', grams: '500' });
    const r = resolveQuantity({ basis: c.basis, portions: c.portions }, { amount: '85', unit: { kind: 'mass', unit: 'g' } });
    expect(r).toMatchObject({ ok: true, factor: '0.5' });
  });
});

describe('N03 two confirmed containers (synthetic beverage)', () => {
  it('multiplies known fields by container size and keeps sugar unknown', () => {
    const f = fixture('synthetic/octoberfest-synthetic.json') as { basis: { kind: 'per100ml' }; nutrients: NutrientSet; portions: { id: string; name: string; ml: string }[] };
    const bottle = resolveQuantity({ basis: f.basis, portions: f.portions }, { amount: '2', unit: { kind: 'portion', portionId: 'bottle12' } });
    expect(bottle.ok).toBe(true);
    if (!bottle.ok) return;
    const scaled = scaleNutrients(f.nutrients, bottle.factor);
    expect(scaled.carbs).toEqual({ status: 'reported', amount: '29.810088' });
    expect(scaled.sugar).toEqual({ status: 'unknown' });
    const totals = sumNutrients([scaled]);
    expect(totals.sugar.unknownCount).toBe(1);
    expect(totals.carbs.complete).toBe(true);
  });
});

describe('provider HTTP guardrails', () => {
  it('refuses hosts outside the allowlist without calling fetch', async () => {
    let called = 0;
    const r = await providerFetch('https://example.com/anything', { userAgent: 'test', fetchImpl: async () => { called += 1; return new Response('{}'); } });
    expect(r).toEqual({ kind: 'unavailable', reason: 'host not allowed' });
    expect(called).toBe(0);
    const http = await providerFetch('http://api.nal.usda.gov/x', { userAgent: 'test', fetchImpl: async () => new Response('{}') });
    expect(http.kind).toBe('unavailable');
  });

  it('maps 429 with Retry-After, 404, and timeouts to bounded outcomes', async () => {
    const throttled = await providerFetch('https://api.nal.usda.gov/x', { userAgent: 'test', fetchImpl: async () => new Response('', { status: 429, headers: { 'retry-after': '30' } }) });
    expect(throttled).toEqual({ kind: 'throttled', retryAfterMs: 30000 });
    const missing = await providerFetch('https://world.openfoodfacts.org/x', { userAgent: 'test', fetchImpl: async () => new Response('', { status: 404 }) });
    expect(missing).toEqual({ kind: 'not-found' });
    const slow = await providerFetch('https://api.nal.usda.gov/x', {
      userAgent: 'test',
      timeoutMs: 20,
      fetchImpl: (_u, init) => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('t'), { name: 'TimeoutError' })))),
    });
    expect(slow).toEqual({ kind: 'unavailable', reason: 'timeout' });
  });

  it('throttle refills over time and honors holds', () => {
    let now = 0;
    const th = new Throttle(2, 1 / 1000, () => now);
    expect(th.take()).toBe(true);
    expect(th.take()).toBe(true);
    expect(th.take()).toBe(false);
    now = 1000;
    expect(th.take()).toBe(true);
    th.hold(5000);
    now = 3000;
    expect(th.take()).toBe(false);
    now = 6001;
    expect(th.take()).toBe(true);
  });
});

describe('local retrieval order', () => {
  const food = (id: string, name: string, extra: Partial<Parameters<typeof rankLocalFoods>[0]['foods'][number]> = {}) => ({
    id,
    name,
    aliases: [],
    currentVersionId: `${id}-v1`,
    pin: null,
    suggestEligible: true,
    tags: [],
    hidden: false,
    revision: 1,
    updatedAt: '2026-09-18T00:00:00.000Z',
    ...extra,
  });
  it('puts pinned exact matches first, then aliases, then recent, then name matches', () => {
    const foods = [
      food('f-generic-shake', 'Protein shake, generic'),
      food('f-my-shake', 'My shake', { pin: { order: 0, quantity: { amount: '1', unit: { kind: 'serving' } } } }),
      food('f-alias', 'Vanilla whey bottle', { aliases: ['shake'] }),
      food('f-recent', 'Chocolate shake'),
      food('f-hidden', 'Old shake', { hidden: true }),
    ];
    const r = rankLocalFoods({ foods, query: 'shake', recentFoodIds: ['f-recent'] });
    expect(r.map((x) => (x.kind === 'local' ? x.foodId : ''))).toEqual(['f-alias', 'f-my-shake', 'f-recent', 'f-generic-shake']);
    expect(r[0]).toMatchObject({ matchedAlias: 'shake' });
    const exact = rankLocalFoods({ foods, query: 'my shake', recentFoodIds: [] });
    expect(exact[0]).toMatchObject({ foodId: 'f-my-shake' });
  });
});

describe('search and barcode routes with injected provider responses', () => {
  let t: TestApp;
  let me: Client;
  const calls: string[] = [];
  const fetchImpl = async (url: string): Promise<Response> => {
    calls.push(url);
    if (url.includes('api.nal.usda.gov')) return new Response(JSON.stringify(fixture('usda/search-banana.json')), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.includes('/product/0012345678905')) return new Response(JSON.stringify(fixture('off/product-leading-zero.json')), { status: 200 });
    if (url.includes('/product/')) return new Response(JSON.stringify({ status: 'failure', result: { id: 'product_not_found' } }), { status: 404 });
    return new Response('', { status: 500 });
  };
  beforeEach(async () => {
    calls.length = 0;
    t = await makeTestApp({ fetchImpl, usdaApiKey: 'test-key' });
    me = await signUp(t);
  });
  afterEach(async () => {
    await t.close();
    cleanup(t.dataDir);
  });

  it('local mode never calls a provider; online mode calls USDA once and caches', async () => {
    await me.mutate([{ type: 'food.upsert', ...SHAKE_FOOD }]);
    const local = (await me.get('/api/v1/foods/search?q=shake&mode=local')).json() as SearchResponse;
    expect(local.results.map((r) => r.kind)).toEqual(['local']);
    expect(local.providerStatus).toBe('skipped');
    expect(calls).toHaveLength(0);

    const online = (await me.get('/api/v1/foods/search?q=banana&mode=online')).json() as SearchResponse;
    expect(online.providerStatus).toBe('ok');
    expect(online.results.filter((r) => r.kind === 'candidate')).toHaveLength(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain('shake');
    await me.get('/api/v1/foods/search?q=banana&mode=online');
    expect(calls).toHaveLength(1);
  });

  it('barcode lookup pads a 12-digit UPC on a miss and reports the local match', async () => {
    const miss = (await me.get('/api/v1/foods/barcode/999999999999')).json() as BarcodeResponse;
    expect(miss.providerStatus).toBe('not-found');
    expect(calls.filter((c) => c.includes('/product/')).map((c) => c.split('/product/')[1]?.split('?')[0])).toEqual(['999999999999', '0999999999999']);
    const hit = (await me.get('/api/v1/foods/barcode/0012345678905')).json() as BarcodeResponse;
    expect(hit.providerStatus).toBe('ok');
    expect(hit.candidate?.name).toBe('Example Oat Crunch Cereal');
    expect(hit.candidate?.needsLabelConfirmation).toBe(true);
    expect((await me.get('/api/v1/foods/barcode/abc')).status).toBe(400);
  });

  it('reports not-configured without a USDA key and unavailable on provider failure, while local foods still work', async () => {
    await t.close();
    t = await makeTestApp({ fetchImpl: async () => { throw new Error('ECONNRESET'); } });
    me = await signUp(t);
    await me.mutate([{ type: 'food.upsert', ...SHAKE_FOOD }]);
    const r = (await me.get('/api/v1/foods/search?q=shake&mode=online')).json() as SearchResponse;
    expect(r.providerStatus).toBe('not-configured');
    expect(r.results[0]?.kind).toBe('local');
    await t.close();
    t = await makeTestApp({ fetchImpl: async () => { throw new Error('ECONNRESET'); }, usdaApiKey: 'k' });
    me = await signUp(t);
    const bad = (await me.get('/api/v1/foods/search?q=banana&mode=online')).json() as SearchResponse;
    expect(bad.providerStatus).toBe('unavailable');
    const code = (await me.get('/api/v1/foods/barcode/0012345678905')).json() as BarcodeResponse;
    expect(code.providerStatus).toBe('unavailable');
  });
});
