// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Cloud sync adapter interface.
 *
 * Provides the seam for future cloud sync without requiring
 * app-level refactoring. Currently ships with LocalOnlyAdapter.
 *
 * To add a backend later: implement SyncAdapter and call setSyncAdapter().
 */

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'conflict' | 'error' | 'offline';

export interface SyncConflict<T = unknown> {
  local: T;
  remote: T;
  lastSyncedAt: string;
}

export interface SyncResult<T = unknown> {
  status: 'ok' | 'conflict' | 'error';
  data?: T;
  conflict?: SyncConflict<T>;
  errorMessage?: string;
}

export interface SyncAdapter {
  /** Pull the latest state for a resource. */
  pull<T>(resourceId: string): Promise<SyncResult<T>>;

  /** Push local state to the remote. */
  push<T>(resourceId: string, data: T): Promise<SyncResult<T>>;

  /** Get current sync status for a resource. */
  getStatus(resourceId: string): SyncStatus;

  /** Register a conflict resolution handler. */
  onConflict?<T>(handler: (conflict: SyncConflict<T>) => Promise<T>): void;
}

/**
 * Local-only adapter — all operations succeed immediately with no network.
 * This is the default until a cloud backend is integrated.
 */
class LocalOnlyAdapter implements SyncAdapter {
  async pull<T>(): Promise<SyncResult<T>> {
    return { status: 'ok' };
  }

  async push<T>(_resourceId: string, data: T): Promise<SyncResult<T>> {
    return { status: 'ok', data };
  }

  getStatus(): SyncStatus {
    return 'idle';
  }
}

let currentAdapter: SyncAdapter = new LocalOnlyAdapter();

/**
 * Set the active sync adapter. Call this when initializing cloud sync.
 */
export function setSyncAdapter(adapter: SyncAdapter): void {
  currentAdapter = adapter;
}

/**
 * Get the current sync adapter.
 */
export function getSyncAdapter(): SyncAdapter {
  return currentAdapter;
}
