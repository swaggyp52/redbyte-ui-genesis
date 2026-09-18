/**
 * Retrieval and relevance rules shared by the phone and the Pi so the two
 * never drift. Personal foods: pinned exact, aliases, recent exact, then name
 * matches. Provider candidates: exact/whole-name and generic-data-type
 * preference for short generic queries, variant words preserved.
 */

export interface RankableFood {
  id: string;
  name: string;
  aliases: string[];
  pinned: boolean;
  hidden: boolean;
}

export interface LocalRankResult {
  foodId: string;
  score: number;
  matchedAlias?: string;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9%]+/)
    .filter((t) => t.length > 0);
}

/** Small, conservative typo tolerance: one edit for words of 5+ letters. */
function closeEnough(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function tokenMatches(queryToken: string, haystack: string[]): boolean {
  return haystack.some((h) => h === queryToken || h.startsWith(queryToken) || closeEnough(queryToken, h));
}

export function rankLocalFoods(foods: RankableFood[], query: string, recentFoodIds: string[]): LocalRankResult[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const qTokens = tokenize(q);
  const recentRank = new Map(recentFoodIds.map((id, i) => [id, i]));
  const out: LocalRankResult[] = [];
  for (const food of foods) {
    if (food.hidden) continue;
    const name = food.name.toLowerCase();
    const nameTokens = tokenize(name);
    let score = 0;
    let alias: string | undefined;
    if (name === q) score = 100;
    else {
      const exactAlias = food.aliases.find((a) => a.toLowerCase() === q);
      if (exactAlias) {
        score = 95;
        alias = exactAlias;
      } else if (name.startsWith(q)) score = 80;
      else if (qTokens.every((t) => tokenMatches(t, nameTokens))) score = 60;
      else {
        const a = food.aliases.find((x) => qTokens.every((t) => tokenMatches(t, tokenize(x))));
        if (a) {
          score = 55;
          alias = a;
        } else if (qTokens.some((t) => t.length >= 3 && nameTokens.some((n) => n.startsWith(t)))) score = 30;
      }
    }
    if (score === 0) continue;
    if (food.pinned) score += 20;
    const r = recentRank.get(food.id);
    if (r !== undefined) score += Math.max(0, 15 - r);
    out.push(alias ? { foodId: food.id, score, matchedAlias: alias } : { foodId: food.id, score });
  }
  return out.sort((a, b) => b.score - a.score || a.foodId.localeCompare(b.foodId));
}

/** Words that change what a food is; two records differing in one of these are different foods. */
export const VARIANT_WORDS = new Set([
  'raw',
  'cooked',
  'dry',
  'dried',
  'prepared',
  'sweetened',
  'unsweetened',
  'zero',
  'diet',
  'light',
  'lite',
  'sugar-free',
  'sugarfree',
  'vanilla',
  'chocolate',
  'strawberry',
  'original',
  'plain',
  'whole',
  'skim',
  'nonfat',
  'lowfat',
  'reduced',
  'decaf',
  'instant',
  'frozen',
  'canned',
  'fresh',
  'boiled',
  'fried',
  'baked',
  'grilled',
  'roasted',
  'smoked',
  'salted',
  'unsalted',
]);

export interface RankableCandidate {
  id: string;
  name: string;
  brand?: string | undefined;
  /** 'generic' for reference/survey foods, 'branded' for manufacturer records. */
  kind: 'generic' | 'branded';
  /** Position returned by the provider (0-based); used as a tiebreak. */
  providerRank: number;
}

/**
 * Re-orders one page of provider candidates for a query. Whole-name matches
 * first; a short generic query prefers generic records over branded ones whose
 * names merely contain the word (banana vs banana-flavoured snack); a query
 * that names a variant (vanilla, zero, raw) must be matched by that variant.
 */
export function rankCandidates<T extends RankableCandidate>(query: string, candidates: T[]): T[] {
  const qTokens = tokenize(query);
  const qVariants = qTokens.filter((t) => VARIANT_WORDS.has(t));
  const generic = qTokens.length <= 2 && qVariants.length === 0 && !candidates.some((c) => c.brand && tokenize(c.brand).some((b) => qTokens.includes(b)));
  const scored = candidates.map((c) => {
    const nameTokens = tokenize(c.name);
    const brandTokens = c.brand ? tokenize(c.brand) : [];
    const all = [...nameTokens, ...brandTokens];
    let score = 0;
    const covered = qTokens.filter((t) => tokenMatches(t, all)).length;
    score += (covered / Math.max(1, qTokens.length)) * 50;
    if (nameTokens.join(' ') === qTokens.join(' ')) score += 40;
    else if (qTokens.length > 0 && nameTokens.slice(0, qTokens.length).join(' ') === qTokens.join(' ')) score += 10;
    // Variant words in the query must appear; variant words in the record that the query did not ask for cost a little.
    for (const v of qVariants) if (!nameTokens.includes(v)) score -= 30;
    const extraVariants = nameTokens.filter((t) => VARIANT_WORDS.has(t) && !qTokens.includes(t)).length;
    score -= Math.min(15, extraVariants * 5);
    if (generic) score += c.kind === 'generic' ? 20 : -15;
    score -= Math.min(10, Math.max(0, nameTokens.length - qTokens.length) * 1.5);
    score -= c.providerRank * 0.5;
    return { c, score };
  });
  return scored.sort((a, b) => b.score - a.score || a.c.providerRank - b.c.providerRank).map((s) => s.c);
}

/** Conservative dedupe: same provider id only. Names are never enough. */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
