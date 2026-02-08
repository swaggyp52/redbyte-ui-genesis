// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Local-only adapter — all operations succeed immediately with no network.
 * This is the default until a cloud backend is integrated.
 */
class LocalOnlyAdapter {
    async pull() {
        return { status: 'ok' };
    }
    async push(_resourceId, data) {
        return { status: 'ok', data };
    }
    getStatus() {
        return 'idle';
    }
}
let currentAdapter = new LocalOnlyAdapter();
/**
 * Set the active sync adapter. Call this when initializing cloud sync.
 */
export function setSyncAdapter(adapter) {
    currentAdapter = adapter;
}
/**
 * Get the current sync adapter.
 */
export function getSyncAdapter() {
    return currentAdapter;
}
