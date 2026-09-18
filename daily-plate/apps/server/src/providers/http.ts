/** Allowlisted outbound HTTP for food providers only. No general proxying. */

export const ALLOWED_HOSTS = new Set(['api.nal.usda.gov', 'world.openfoodfacts.org']);

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ProviderHttpOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  userAgent: string;
}

export type ProviderFetchResult =
  | { kind: 'ok'; status: number; body: unknown }
  | { kind: 'not-found' }
  | { kind: 'throttled'; retryAfterMs: number | undefined }
  | { kind: 'unavailable'; reason: string };

export async function providerFetch(url: string, options: ProviderHttpOptions): Promise<ProviderFetchResult> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return { kind: 'unavailable', reason: 'host not allowed' };
  }
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? 5000;
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': options.userAgent },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
    if (res.status === 404) return { kind: 'not-found' };
    if (res.status === 429 || res.status === 503) {
      const header = res.headers.get('retry-after');
      const seconds = header ? Number(header) : Number.NaN;
      return { kind: 'throttled', retryAfterMs: Number.isFinite(seconds) ? seconds * 1000 : undefined };
    }
    if (!res.ok) return { kind: 'unavailable', reason: `status ${res.status}` };
    const body: unknown = await res.json();
    return { kind: 'ok', status: res.status, body };
  } catch (err) {
    const name = err instanceof Error ? err.name : 'error';
    return { kind: 'unavailable', reason: name === 'TimeoutError' ? 'timeout' : name };
  }
}
