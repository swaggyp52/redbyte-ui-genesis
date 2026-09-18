import type { Bootstrap, Change, Mutation, MutationResult } from '@daily-plate/contracts';
import { ApiClient, ApiError, OfflineError } from './api.js';
import { clearProjection, getMeta, setMeta, type DailyPlateDb, type OutboxItem } from './db.js';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'unauthenticated' | 'error';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  attention: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

type Listener = (status: SyncStatus) => void;

const BATCH_SIZE = 25;
const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * Sync engine: pushes the outbox in order, then pulls the change feed. The
 * phone never shows "saved" until a receipt has come back from the Pi.
 */
export class SyncEngine {
  private listeners = new Set<Listener>();
  private status: SyncStatus = { state: 'idle', pending: 0, attention: 0, lastSyncAt: null, lastError: null };
  private running: Promise<void> | null = null;
  private backoffMs = 2000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly db: DailyPlateDb,
    private readonly api: ApiClient,
    private readonly isOnline: () => boolean = () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  ) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  /** Stops retry timers; used on logout, account switch and in tests. */
  dispose(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.listeners.clear();
  }

  private async emit(patch: Partial<SyncStatus>): Promise<void> {
    let pending = this.status.pending;
    let attention = this.status.attention;
    try {
      pending = await this.db.outbox.where('status').anyOf('pending', 'inflight').count();
      attention = await this.db.outbox.where('status').equals('attention').count();
    } catch {
      // Database closed (logout / account switch); keep the last known counts.
    }
    this.status = { ...this.status, ...patch, pending, attention };
    for (const l of this.listeners) l(this.status);
  }

  /** Something changed locally: refresh counts and schedule a sync. */
  async notifyLocalChange(): Promise<void> {
    await this.emit({});
    void this.sync().catch(() => undefined);
  }

  /** Full bootstrap replaces the projection but never the outbox. */
  async bootstrap(): Promise<Bootstrap> {
    const boot = await this.api.bootstrap();
    const existingUser = await getMeta<{ id: string }>(this.db, 'user');
    if (existingUser && existingUser.id !== boot.user.id) {
      const pending = await this.db.outbox.count();
      if (pending > 0) throw new Error('This phone holds unsent entries for a different account. Resolve them before switching.');
    }
    await this.db.transaction('rw', [this.db.foods, this.db.foodVersions, this.db.entries, this.db.days, this.db.meals, this.db.recipes, this.db.recipeVersions, this.db.dismissals, this.db.meta, this.db.outbox], async () => {
      const pendingIds = new Set((await this.db.outbox.toArray()).map((o) => o.entityId));
      await clearProjection(this.db);
      await this.db.foods.bulkPut(boot.foods);
      await this.db.foodVersions.bulkPut(boot.foodVersions);
      await this.db.entries.bulkPut(boot.entries.filter((e) => !pendingIds.has(e.id)));
      await this.db.days.bulkPut(boot.days);
      await this.db.meals.bulkPut(boot.meals);
      await this.db.recipes.bulkPut(boot.recipes);
      await this.db.recipeVersions.bulkPut(boot.recipeVersions);
      await this.db.dismissals.bulkPut(boot.dismissals);
      await setMeta(this.db, 'user', boot.user);
      await setMeta(this.db, 'goals', boot.goals);
      await setMeta(this.db, 'cursor', boot.cursor);
      await setMeta(this.db, 'window', boot.window);
      await setMeta(this.db, 'serverVersion', boot.serverVersion);
      await setMeta(this.db, 'bootstrappedAt', new Date().toISOString());
    });
    await this.emit({ state: 'idle', lastSyncAt: new Date().toISOString(), lastError: null });
    return boot;
  }

  /** Push then pull; concurrent calls share one run. */
  sync(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<void> {
    if (!this.isOnline()) {
      // Count what is waiting and keep a bounded retry alive; the online event is not guaranteed on every platform.
      await this.emit({ state: 'offline' });
      if (this.status.pending > 0) this.scheduleRetry();
      return;
    }
    await this.emit({ state: 'syncing' });
    try {
      await this.push();
      await this.pull();
      this.backoffMs = 2000;
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }
      await this.emit({ state: 'idle', lastSyncAt: new Date().toISOString(), lastError: null });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await this.emit({ state: 'unauthenticated', lastError: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Sync failed.';
      await this.emit({ state: err instanceof OfflineError ? 'offline' : 'error', lastError: message });
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(MAX_BACKOFF_MS, this.backoffMs * 2);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.sync().catch(() => undefined);
    }, delay);
  }

  private async push(): Promise<void> {
    // Reset anything left inflight by a crash; the server dedupes by mutation id.
    await this.db.outbox.where('status').equals('inflight').modify({ status: 'pending' });
    for (;;) {
      const batch = (await this.db.outbox.where('status').equals('pending').sortBy('order')).slice(0, BATCH_SIZE);
      if (batch.length === 0) return;
      await this.db.outbox.bulkPut(batch.map((b) => ({ ...b, status: 'inflight' as const, attempts: b.attempts + 1 })));
      let response;
      try {
        response = await this.api.mutations(batch.map((b) => b.mutation));
      } catch (err) {
        await this.db.outbox.bulkPut(batch.map((b) => ({ ...b, status: 'pending' as const, attempts: b.attempts + 1 })));
        throw err;
      }
      await this.applyResults(batch, response.results);
    }
  }

  private async applyResults(batch: OutboxItem[], results: MutationResult[]): Promise<void> {
    const byId = new Map(results.map((r) => [r.mutationId, r]));
    await this.db.transaction('rw', [this.db.outbox, this.db.entries, this.db.foods, this.db.meals, this.db.recipes, this.db.days], async () => {
      for (const item of batch) {
        const result = byId.get(item.mutationId);
        if (!result) {
          await this.db.outbox.put({ ...item, status: 'pending' });
          continue;
        }
        switch (result.status) {
          case 'committed':
          case 'duplicate':
            await this.db.outbox.delete(item.mutationId);
            break;
          case 'conflict':
            await this.db.outbox.put({ ...item, status: 'attention', lastError: result.error.message, conflictCurrent: result.current });
            break;
          case 'rejected':
            await this.db.outbox.put({ ...item, status: 'attention', lastError: result.error.message });
            break;
        }
      }
    });
  }

  private async pull(): Promise<void> {
    let cursor = (await getMeta<number>(this.db, 'cursor')) ?? 0;
    for (;;) {
      const page = await this.api.changes(cursor);
      if (page.changes.length === 0) return;
      const pendingIds = new Set((await this.db.outbox.toArray()).map((o) => o.entityId));
      await this.db.transaction('rw', [this.db.foods, this.db.foodVersions, this.db.entries, this.db.days, this.db.meals, this.db.recipes, this.db.recipeVersions, this.db.dismissals, this.db.meta], async () => {
        for (const change of page.changes) await this.applyChange(change, pendingIds);
        await setMeta(this.db, 'cursor', page.cursor);
      });
      cursor = page.cursor;
      if (!page.more) return;
    }
  }

  private async applyChange(change: Change, pendingIds: Set<string>): Promise<void> {
    // An entity with a queued local mutation is left alone until that mutation resolves.
    if (pendingIds.has(change.entityId) && change.entityType !== 'goals' && change.entityType !== 'user') return;
    const data = change.data as never;
    switch (change.entityType) {
      case 'entry':
        await this.db.entries.put(data);
        break;
      case 'food':
        await this.db.foods.put(data);
        break;
      case 'foodVersion':
        await this.db.foodVersions.put(data);
        break;
      case 'meal':
        await this.db.meals.put(data);
        break;
      case 'recipe':
        await this.db.recipes.put(data);
        break;
      case 'recipeVersion':
        await this.db.recipeVersions.put(data);
        break;
      case 'day':
        await this.db.days.put(data);
        break;
      case 'goals':
        await setMeta(this.db, 'goals', data);
        break;
      case 'user':
        await setMeta(this.db, 'user', data);
        break;
      case 'dismissal':
        await this.db.dismissals.put(data);
        break;
    }
  }

  /** Drops a stuck local mutation (user chose to keep the Pi's version). */
  async discardAttention(mutationId: string): Promise<void> {
    const item = await this.db.outbox.get(mutationId);
    if (!item) return;
    await this.db.transaction('rw', [this.db.outbox, this.db.entries, this.db.foods, this.db.meals, this.db.days, this.db.recipes], async () => {
      await this.db.outbox.delete(mutationId);
      const current = item.conflictCurrent as { id?: string } | undefined;
      if (current && item.entityType === 'entry') await this.db.entries.put(current as never);
      else if (current && item.entityType === 'food') await this.db.foods.put(current as never);
      else if (current && item.entityType === 'meal') await this.db.meals.put(current as never);
      else if (item.mutation.payload.type === 'diary.add') await this.db.entries.delete(item.entityId);
    });
    await this.notifyLocalChange();
  }

  /** Re-queues a conflicted change on top of the Pi's current revision. */
  async retryAttentionOnCurrent(mutationId: string): Promise<void> {
    const item = await this.db.outbox.get(mutationId);
    if (!item) return;
    const current = item.conflictCurrent as { revision?: number } | undefined;
    const payload = item.mutation.payload as { baseRevision?: number };
    if (current?.revision !== undefined && payload.baseRevision !== undefined) {
      const next: Mutation = { ...item.mutation, mutationId: crypto.randomUUID(), payload: { ...item.mutation.payload, baseRevision: current.revision } as Mutation['payload'] };
      const { lastError: _l, conflictCurrent: _c, ...rest } = item;
      await this.db.transaction('rw', this.db.outbox, async () => {
        await this.db.outbox.delete(mutationId);
        await this.db.outbox.put({ ...rest, mutationId: next.mutationId, mutation: next, status: 'pending', attempts: 0 });
      });
    } else {
      const { lastError: _l, conflictCurrent: _c, ...rest } = item;
      await this.db.outbox.put({ ...rest, status: 'pending', attempts: 0 });
    }
    await this.notifyLocalChange();
  }
}

export function attachLifecycle(engine: SyncEngine): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onOnline = (): void => void engine.sync();
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') void engine.sync();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('focus', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(() => {
    if (engine.getStatus().pending > 0) void engine.sync();
  }, 30_000);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('focus', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
  };
}
