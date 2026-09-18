import type { BarcodeResponse, Food, FoodCandidate, FoodDetailResponse, SearchResponse, SearchResult } from '@daily-plate/contracts';
import { rankCandidates, rankLocalFoods as rankLocal, dedupeById } from '@daily-plate/domain';
import type { Store } from '../db/store.js';
import { providerFetch, type FetchLike } from '../providers/http.js';
import { normalizeBarcode, normalizeOffProduct, offProductFound, offProductUrl, paddedBarcode } from '../providers/off.js';
import { Throttle, offThrottle, usdaThrottle } from '../providers/throttle.js';
import { normalizeUsdaDetail, normalizeUsdaSearch, sameGtin, usdaDetailUrl, usdaGtinSearchUrl, usdaSearchUrl, USDA_DATA_TYPES, USDA_NORMALIZATION_VERSION, USDA_PAGE_SIZE } from '../providers/usda.js';

export interface SearchServiceOptions {
  usdaApiKey: string | undefined;
  userAgent: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

const SEARCH_TTL_MS = 7 * 86_400_000;
const DETAIL_TTL_MS = 30 * 86_400_000;
const PRODUCT_TTL_MS = 30 * 86_400_000;
const NOT_FOUND_TTL_MS = 86_400_000;
const MAX_PAGE = 20;

export interface LocalRankInput {
  foods: Food[];
  query: string;
  recentFoodIds: string[];
}

/** Server-side wrapper over the shared domain ranking so phone and Pi agree. */
export function rankLocalFoods({ foods, query, recentFoodIds }: LocalRankInput): SearchResult[] {
  const ranked = rankLocal(
    foods.map((f) => ({ id: f.id, name: f.name, aliases: f.aliases, pinned: Boolean(f.pin), hidden: f.hidden })),
    query,
    recentFoodIds,
  );
  return ranked.map((r) => (r.matchedAlias ? { kind: 'local', foodId: r.foodId, matchedAlias: r.matchedAlias } : { kind: 'local', foodId: r.foodId }));
}

type ProviderStatus = SearchResponse['providerStatus'];

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

  async search(userId: string, query: string, mode: 'local' | 'online', page = 1): Promise<SearchResponse> {
    const foods = this.store.listFoods(userId, false);
    const local = page === 1 ? rankLocalFoods({ foods, query, recentFoodIds: this.recentFoodIds(userId) }) : [];
    if (mode === 'local') return { query, mode, results: local, providerStatus: 'skipped', page: 1, hasMore: false };
    const online = await this.usdaSearch(query, Math.min(MAX_PAGE, Math.max(1, page)));
    const ranked = rankCandidates(
      query,
      dedupeById(online.candidates.map((c, i) => ({ id: c.providerId, name: c.name, brand: c.brand, kind: c.kind, providerRank: i, candidate: c }))),
    ).map((r) => r.candidate);
    const response: SearchResponse = {
      query,
      mode,
      results: [...local, ...ranked.map((c): SearchResult => ({ kind: 'candidate', candidate: c }))],
      providerStatus: online.status,
      page,
      hasMore: online.hasMore,
    };
    if (online.totalHits !== undefined) response.totalHits = online.totalHits;
    return response;
  }

  private cacheKey(query: string, page: number): string {
    return `search:${USDA_NORMALIZATION_VERSION}:${USDA_DATA_TYPES.join('|')}:${USDA_PAGE_SIZE}:p${page}:${query}`;
  }

  private async usdaSearch(query: string, page: number): Promise<{ candidates: FoodCandidate[]; status: ProviderStatus; hasMore: boolean; totalHits?: number }> {
    const key = query.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100);
    if (key.length < 2) return { candidates: [], status: 'skipped', hasMore: false };
    const cached = this.store.getCache('usda', this.cacheKey(key, page));
    if (cached && cached.status === 'ok') {
      const n = normalizeUsdaSearch(cached.payload);
      return { candidates: n.candidates, status: 'ok', hasMore: page < n.totalPages, totalHits: n.totalHits };
    }
    if (!this.options.usdaApiKey) return { candidates: [], status: 'not-configured', hasMore: false };
    if (!this.usda.take()) return { candidates: [], status: 'throttled', hasMore: false };
    const result = await providerFetch(usdaSearchUrl(key, this.options.usdaApiKey, page), this.httpOptions());
    if (result.kind === 'ok') {
      const n = normalizeUsdaSearch(result.body);
      this.store.putCache('usda', this.cacheKey(key, page), 'ok', result.body, SEARCH_TTL_MS);
      return { candidates: n.candidates, status: 'ok', hasMore: page < n.totalPages, totalHits: n.totalHits };
    }
    if (result.kind === 'throttled') {
      this.usda.hold(result.retryAfterMs ?? 60_000);
      return { candidates: [], status: 'throttled', hasMore: false };
    }
    return { candidates: [], status: 'unavailable', hasMore: false };
  }

  /** Full USDA record: household portions and detail nutrients for a search hit. */
  async details(provider: 'usda', providerId: string): Promise<FoodDetailResponse> {
    const id = providerId.replace(/\D/g, '').slice(0, 12);
    if (id.length === 0) return { provider, providerId, candidate: null, providerStatus: 'not-found' };
    const cacheKey = `detail:${USDA_NORMALIZATION_VERSION}:${id}`;
    const cached = this.store.getCache('usda', cacheKey);
    if (cached) {
      if (cached.status === 'ok') return { provider, providerId: id, candidate: normalizeUsdaDetail(cached.payload) ?? null, providerStatus: 'ok' };
      if (cached.status === 'not-found') return { provider, providerId: id, candidate: null, providerStatus: 'not-found' };
    }
    if (!this.options.usdaApiKey) return { provider, providerId: id, candidate: null, providerStatus: 'not-configured' };
    if (!this.usda.take()) return { provider, providerId: id, candidate: null, providerStatus: 'throttled' };
    const result = await providerFetch(usdaDetailUrl(id, this.options.usdaApiKey), this.httpOptions());
    if (result.kind === 'ok') {
      const candidate = normalizeUsdaDetail(result.body);
      if (!candidate) return { provider, providerId: id, candidate: null, providerStatus: 'unavailable' };
      this.store.putCache('usda', cacheKey, 'ok', result.body, DETAIL_TTL_MS);
      return { provider, providerId: id, candidate, providerStatus: 'ok' };
    }
    if (result.kind === 'not-found') {
      this.store.putCache('usda', cacheKey, 'not-found', null, NOT_FOUND_TTL_MS);
      return { provider, providerId: id, candidate: null, providerStatus: 'not-found' };
    }
    if (result.kind === 'throttled') {
      this.usda.hold(result.retryAfterMs ?? 60_000);
      return { provider, providerId: id, candidate: null, providerStatus: 'throttled' };
    }
    return { provider, providerId: id, candidate: null, providerStatus: 'unavailable' };
  }

  /**
   * Barcode: the Pi's own saved foods first. A provider is contacted only
   * when nothing local matches (or the phone explicitly asks for a remote look).
   */
  async barcode(userId: string, raw: string, remote = false): Promise<BarcodeResponse | { error: 'invalid-barcode' }> {
    const barcode = normalizeBarcode(raw);
    if (!barcode) return { error: 'invalid-barcode' };
    const localVersions = this.store.listFoodVersionsByBarcode(userId, barcode);
    const local = [...new Set(localVersions.map((v) => v.foodId))].filter((id) => !this.store.getFood(userId, id)?.hidden);
    if (local.length > 0 && !remote) return { barcode, local, candidate: null, providerStatus: 'skipped' };
    const off = await this.offLookup(barcode);
    if (off.candidate) return { barcode, local, candidate: off.candidate, providerStatus: 'ok', source: 'off' };
    if (off.status === 'not-found') {
      const usda = await this.usdaGtinLookup(barcode);
      if (usda.candidate) return { barcode, local, candidate: usda.candidate, providerStatus: 'ok', source: 'usda' };
      return { barcode, local, candidate: null, providerStatus: usda.status === 'not-found' ? 'not-found' : usda.status };
    }
    return { barcode, local, candidate: null, providerStatus: off.status };
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
    }
    this.store.putCache('off', `product:${barcode}`, 'not-found', null, NOT_FOUND_TTL_MS);
    return { candidate: null, status: 'not-found' };
  }

  /** Documented fallback: branded search by GTIN, accepted only when the returned gtinUpc is the same code. */
  private async usdaGtinLookup(barcode: string): Promise<{ candidate: FoodCandidate | null; status: BarcodeResponse['providerStatus'] }> {
    const cacheKey = `gtin:${USDA_NORMALIZATION_VERSION}:${barcode}`;
    const cached = this.store.getCache('usda', cacheKey);
    if (cached) {
      if (cached.status === 'ok') {
        const match = normalizeUsdaSearch(cached.payload).candidates.find((c) => c.barcode && sameGtin(c.barcode, barcode));
        return match ? { candidate: match, status: 'ok' } : { candidate: null, status: 'not-found' };
      }
      if (cached.status === 'not-found') return { candidate: null, status: 'not-found' };
    }
    if (!this.options.usdaApiKey) return { candidate: null, status: 'not-configured' };
    if (!this.usda.take()) return { candidate: null, status: 'throttled' };
    const result = await providerFetch(usdaGtinSearchUrl(barcode, this.options.usdaApiKey), this.httpOptions());
    if (result.kind === 'ok') {
      const match = normalizeUsdaSearch(result.body).candidates.find((c) => c.barcode && sameGtin(c.barcode, barcode));
      this.store.putCache('usda', cacheKey, match ? 'ok' : 'not-found', match ? result.body : null, match ? PRODUCT_TTL_MS : NOT_FOUND_TTL_MS);
      return match ? { candidate: match, status: 'ok' } : { candidate: null, status: 'not-found' };
    }
    if (result.kind === 'throttled') {
      this.usda.hold(result.retryAfterMs ?? 60_000);
      return { candidate: null, status: 'throttled' };
    }
    return { candidate: null, status: result.kind === 'not-found' ? 'not-found' : 'unavailable' };
  }

  private httpOptions() {
    const opts: { userAgent: string; fetchImpl?: FetchLike; timeoutMs?: number } = { userAgent: this.options.userAgent };
    if (this.options.fetchImpl) opts.fetchImpl = this.options.fetchImpl;
    if (this.options.timeoutMs !== undefined) opts.timeoutMs = this.options.timeoutMs;
    return opts;
  }
}
