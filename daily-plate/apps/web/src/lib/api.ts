import type { BarcodeResponse, Bootstrap, ChangesResponse, FoodDetailResponse, MutationBatchResponse, SearchResponse, SessionInfo } from '@daily-plate/contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class OfflineError extends Error {
  constructor() {
    super('You are offline.');
  }
}

export type FetchLike = typeof fetch;

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  onUnauthenticated?: () => void;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly onUnauthenticated: (() => void) | undefined;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '';
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.onUnauthenticated = options.onUnauthenticated;
  }

  async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown, timeoutMs = 15_000): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        credentials: 'same-origin',
        headers: { 'x-daily-plate': '1', ...(body !== undefined ? { 'content-type': 'application/json' } : {}), accept: 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : null,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new OfflineError();
    }
    if (res.status === 401) {
      this.onUnauthenticated?.();
      throw new ApiError(401, 'unauthenticated', 'Please unlock Daily Plate.');
    }
    const text = await res.text();
    let json: unknown = undefined;
    try {
      json = text.length > 0 ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    if (!res.ok) {
      const j = (json ?? {}) as { error?: string; message?: string };
      throw new ApiError(res.status, j.error ?? 'request-error', j.message ?? `Request failed (${res.status}).`);
    }
    return json as T;
  }

  session = (): Promise<SessionInfo> => this.request('GET', '/api/v1/auth/session');
  redeemInvite = (token: string, displayName: string | undefined, timeZone: string): Promise<SessionInfo & { recovery: boolean }> =>
    this.request('POST', '/api/v1/auth/invite/redeem', { token, ...(displayName ? { displayName } : {}), timeZone });
  peekInvite = (token: string): Promise<{ valid: boolean; recovery: boolean; displayName: string | null }> => this.request('POST', '/api/v1/auth/invite/peek', { token });
  logout = (): Promise<{ ok: true }> => this.request('POST', '/api/v1/auth/logout');
  bootstrap = (): Promise<Bootstrap> => this.request('GET', '/api/v1/bootstrap', undefined, 30_000);
  changes = (cursor: number): Promise<ChangesResponse> => this.request('GET', `/api/v1/changes?cursor=${cursor}&limit=300`);
  mutations = (mutations: unknown[]): Promise<MutationBatchResponse> => this.request('POST', '/api/v1/mutations', { mutations }, 20_000);
  search = (q: string, mode: 'local' | 'online', page = 1): Promise<SearchResponse> => this.request('GET', `/api/v1/foods/search?q=${encodeURIComponent(q)}&mode=${mode}&page=${page}`, undefined, 8_000);
  details = (provider: 'usda', id: string): Promise<FoodDetailResponse> => this.request('GET', `/api/v1/foods/details/${provider}/${encodeURIComponent(id)}`, undefined, 8_000);
  barcode = (code: string, remote = false): Promise<BarcodeResponse> => this.request('GET', `/api/v1/foods/barcode/${encodeURIComponent(code)}${remote ? '?remote=1' : ''}`, undefined, 8_000);
  registerOptions = (): Promise<{ challengeId: string; options: unknown }> => this.request('POST', '/api/v1/auth/passkey/register/options');
  registerVerify = (challengeId: string, response: unknown, label?: string): Promise<{ ok: true; passkeyCount: number }> =>
    this.request('POST', '/api/v1/auth/passkey/register/verify', { challengeId, response, ...(label ? { label } : {}) });
  loginOptions = (): Promise<{ challengeId: string; options: unknown }> => this.request('POST', '/api/v1/auth/passkey/login/options');
  loginVerify = (challengeId: string, response: unknown): Promise<SessionInfo> => this.request('POST', '/api/v1/auth/passkey/login/verify', { challengeId, response });
  revokeOthers = (): Promise<{ revoked: number }> => this.request('POST', '/api/v1/auth/sessions/revoke-others');
  exportAll = (): Promise<unknown> => this.request('POST', '/api/v1/export', {}, 60_000);
}
