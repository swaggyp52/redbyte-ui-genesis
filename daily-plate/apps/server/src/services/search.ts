import type { BarcodeResponse, Food, FoodCandidate, SearchResponse, SearchResult } from '@daily-plate/contracts';
import type { Store } from '../db/store.js';
import { providerFetch, type FetchLike } from '../providers/http.js';
import { normalizeBarcode, normalizeOffProduct, offProductFound, offProductUrl, paddedBarcode } from '../providers/off.js';
import { Throttle, offThrottle, usdaThrottle } from '../providers/throttle.js';
import { normalizeUsdaSearch, usdaSearchUrl } from '../providers/usda.js';

export interface SearchServiceOptions {
  usdaApiKey: string | undefined;
  userAgent: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  now?: () => number;
}

const SEARCH_TTL_MS = 7 * 86_400_000;
const PRODUCT_TTL_MS = 30 * 86_400_000;
const NOT_FOUND_TTL_MS = 86_400_000;

export interface LocalRankInput {
  foods: Food[];
  query: string;
  /** Food ids used recently, most recent first. */
  recentFoodIds: string[];
}

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 0);
}

/**
 * Retrieval order: pinned exact matches, then aliases, then recently used
 * exact matches, then other local foods by name match.
 */
export function rankLocalFoods({ foods, query, recentFoodIds }: LocalRankInput): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const qTokens = tokens(q);
  const recentRank = new Map(recentFoodIds.map((id, i) => [id, i]));
  const scored: Array<{ food: Food; score: number; alias?: string }> = [];
  for (const food of foods) {
    if (food.hidden) continue;
    const name = food.name.toLowerCase();
    let score = 0;
    let alias: string | undefined;
    if (name === q) score = 100;
    else {
      const matchedAlias = food.aliases.find((a) => a.toLowerCase() === q);
      if (matchedAlias) {
        score = 95;
        alias = matchedAlias;
      } else if (name.startsWith(q)) score = 80;
      else if (qTokens.every((t) => name.includes(t))) score = 60;
      else if (food.aliases.some((a) => qTokens.every((t) => a.toLowerCase().includes(t)))) {
        score = 55;
        alias = food.aliases.find((a) => qTokens.every((t) => a.toLowerCase().includes(t)));
      } else if (qTokens.some((t) => t.length >= 3 && name.includes(t))) score = 30;
    }
    if (score === 0) continue;
    if (food.pin) score += 20;
    const r = recentRank.get(food.id);
    if (r !== undefined) score += Math.max(0, 15 - r);
    scored.push(alias ? { food, score, alias } : { food, score });
  }
  scored.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name));
  return scored.map((s) => (s.alias ? { kind: 'local', foodId: s.food.id, matchedAlias: s.alias } : { kind: 'local', foodId: s.food.id }));
}

export class SearchService {
  private readonly usda: Throttle;
  private readonly off: Throttle;

  constructor(
    private readonly store: Store,
    private readonly options: SearchServiceOptions,
  ) {
    this.usda = usdaThrottle();
    this.off = offThrottle();
  }

  recentFoodIds(userId: string, limit = 30): string[] {
    const rows = this.store.db
      .prepare("select json_extract(data, '$.foodId') as food_id, max(updated_at) as last from diary_entries where user_id = ? and deleted = 0 and json_extract(data, '$.kind') = 'food' group by food_id order by last desc limit ?")
      .all(userId, limit) as { food_id: string | null }[];
    return rows.map((r) => r.food_id).filter((id): id is string => Boolean(id));
  }

  async search(userId: string, query: string, mode: 'local' | 'online'): Promise<SearchResponse> {
    const foods = this.store.listFoods(userId, false);
    const local = rankLocalFoods({ foods, query, recentFoodIds: this.recentFoodIds(userId) });
    if (mode === 'local') return { query, mode, results: local, providerStatus: 'skipped' };
    const online = await this.usdaSearch(query);
    return { query, mode, results: [...local, ...online.candidates.map((c): SearchResult => ({ kind: 'candidate', candidate: c }))], providerStatus: online.status };
  }

  private async usdaSearch(query: string): Promise<{ candidates: FoodCandidate[]; status: SearchResponse['providerStatus'] }> {
    const key = query.trim().toLowerCase().slice(0, 100);
    if (key.length < 2) return { candidates: [], status: 'skipped' };
    const cached = this.store.getCache('usda', `search:${key}`);
    if (cached && cached.status === 'ok') return { candidates: normalizeUsdaSearch(cached.payload), status: 'ok' };
    if (!this.options.usdaApiKey) return { candidates: [], status: 'not-configured' };
    if (!this.usda.take()) return { candidates: [], status: 'throttled' };
    const result = await providerFetch(usdaSearchUrl(key, this.options.usdaApiKey), this.httpOptions());
    if (result.kind === 'ok') {
      const candidates = normalizeUsdaSearch(result.body);
      this.store.putCache('usda', `search:${key}`, 'ok', result.body, SEARCH_TTL_MS);
      return { candidates, status: 'ok' };
    }
    if (result.kind === 'throttled') {
      this.usda.hold(result.retryAfterMs ?? 60_000);
      return { candidates: [], status: 'throttled' };
    }
    return { candidates: [], status: 'unavailable' };
  }

  async barcode(userId: string, raw: string): Promise<BarcodeResponse | { error: 'invalid-barcode' }> {
    const barcode = normalizeBarcode(raw);
    if (!barcode) return { error: 'invalid-barcode' };
    const local = this.store.listFoodVersionsByBarcode(userId, barcode).map((v) => v.foodId);
    const localUnique = [...new Set(local)].filter((id) => !this.store.getFood(userId, id)?.hidden);
    const lookup = await this.offLookup(barcode);
    return { barcode, local: localUnique, candidate: lookup.candidate, providerStatus: lookup.status };
  }

  private async offLookup(barcode: string): Promise<{ candidate: FoodCandidate | null; status: BarcodeResponse['providerStatus'] }> {
    const cached = this.store.getCache('off', `product:${barcode}`);
    if (cached) {
      if (cached.status === 'ok' && offProductFound(cached.payload)) return { candidate: normalizeOffProduct(barcode, cached.payload.product), status: 'ok' };
      if (cached.status === 'not-found') return { candidate: null, status: 'not-found' };
    }
    const attempts = [barcode];
    const padded = paddedBarcode(barcode);
    if (padded) attempts.push(padded);
    for (const code of attempts) {
      if (!this.off.take()) return { candidate: null, status: 'throttled' };
      const result = await providerFetch(offProductUrl(code), this.httpOptions());
      if (result.kind === 'ok' && offProductFound(result.body)) {
        this.store.putCache('off', `product:${barcode}`, 'ok', result.body, PRODUCT_TTL_MS);
        return { candidate: normalizeOffProduct(barcode, result.body.product), status: 'ok' };
      }
      if (result.kind === 'throttled') {
        this.off.hold(result.retryAfterMs ?? 60_000);
        return { candidate: null, status: 'throttled' };
      }
      if (result.kind === 'unavailable') return { candidate: null, status: 'unavailable' };
      // not-found (or found=false): try the padded form next
    }
    this.store.putCache('off', `product:${barcode}`, 'not-found', null, NOT_FOUND_TTL_MS);
    return { candidate: null, status: 'not-found' };
  }

  private httpOptions() {
    const opts: { userAgent: string; fetchImpl?: FetchLike; timeoutMs?: number } = { userAgent: this.options.userAgent };
    if (this.options.fetchImpl) opts.fetchImpl = this.options.fetchImpl;
    if (this.options.timeoutMs !== undefined) opts.timeoutMs = this.options.timeoutMs;
    return opts;
  }
}
