import { describe, expect, it } from 'vitest';
import { dedupeById, rankCandidates, rankLocalFoods, tokenize } from './ranking.js';

describe('rankLocalFoods', () => {
  const f = (id: string, name: string, extra: Partial<{ aliases: string[]; pinned: boolean; hidden: boolean }> = {}) => ({ id, name, aliases: [], pinned: false, hidden: false, ...extra });
  it('orders pinned exact, alias, recent, then name matches; hides hidden', () => {
    const foods = [f('generic', 'Protein shake, generic'), f('mine', 'My shake', { pinned: true }), f('alias', 'Vanilla whey bottle', { aliases: ['shake'] }), f('recent', 'Chocolate shake'), f('hidden', 'Old shake', { hidden: true })];
    expect(rankLocalFoods(foods, 'shake', ['recent']).map((r) => r.foodId)).toEqual(['alias', 'mine', 'recent', 'generic']);
    expect(rankLocalFoods(foods, 'my shake', [])[0]?.foodId).toBe('mine');
  });
  it('tolerates one typo in longer words but not short ones', () => {
    const foods = [f('b', 'Banana, raw'), f('c', 'Bran flakes')];
    expect(rankLocalFoods(foods, 'bananna', []).map((r) => r.foodId)).toEqual(['b']);
    expect(rankLocalFoods(foods, 'brn', []).map((r) => r.foodId)).toEqual([]);
  });
});

describe('rankCandidates', () => {
  const c = (id: string, name: string, kind: 'generic' | 'branded', providerRank: number, brand?: string) => ({ id, name, kind, providerRank, ...(brand ? { brand } : {}) });
  it('keeps a generic banana above banana-flavoured snacks', () => {
    const ranked = rankCandidates('banana', [c('snack', 'Banana Chips Sweetened', 'branded', 0, 'Snackco'), c('pudding', 'Banana Cream Pudding', 'branded', 1, 'Dessertco'), c('raw', 'Bananas, raw', 'generic', 2), c('powder', 'Bananas, dehydrated, or banana powder', 'generic', 3)]);
    expect(ranked.slice(0, 2).map((r) => r.id)).toEqual(['raw', 'powder']);
    expect(ranked.slice(2).map((r) => r.id).sort()).toEqual(['pudding', 'snack']);
  });
  it('does not resolve vanilla to chocolate', () => {
    const ranked = rankCandidates('vanilla protein shake', [c('choc', 'Chocolate Protein Shake', 'branded', 0, 'Brand'), c('van', 'Vanilla Protein Shake', 'branded', 1, 'Brand')]);
    expect(ranked[0]?.id).toBe('van');
  });
  it('preserves raw vs cooked and zero-sugar distinctions in order, never merging them', () => {
    const ranked = rankCandidates('chicken breast cooked', [c('raw', 'Chicken, breast, raw', 'generic', 0), c('cooked', 'Chicken, breast, cooked, roasted', 'generic', 1)]);
    expect(ranked[0]?.id).toBe('cooked');
    const zero = rankCandidates('cola zero', [c('reg', 'Cola', 'branded', 0, 'Fizz'), c('zero', 'Cola Zero Sugar', 'branded', 1, 'Fizz')]);
    expect(zero[0]?.id).toBe('zero');
    expect(dedupeById([c('a', 'Cola', 'branded', 0), c('a', 'Cola', 'branded', 1), c('b', 'Cola', 'branded', 2)])).toHaveLength(2);
  });
  it('a brand word in the query lifts that brand', () => {
    const ranked = rankCandidates('fizz cola', [c('other', 'Cola', 'branded', 0, 'Otherco'), c('fizz', 'Cola', 'branded', 1, 'Fizz')]);
    expect(ranked[0]?.id).toBe('fizz');
    expect(tokenize("Ben's 2% milk")).toEqual(['bens', '2%', 'milk']);
  });
});
