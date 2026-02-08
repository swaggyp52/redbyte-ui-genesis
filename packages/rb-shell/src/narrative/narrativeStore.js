// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
const STORAGE_KEY = 'rb:narrative:v1';
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createNarrativeStore() {
    return create()(persist((set, get) => ({
        shownEvents: {},
        lastShownAt: null,
        dismissedCount: 0,
        markAsShown: (eventId) => {
            const now = new Date().toISOString();
            set((state) => ({
                shownEvents: {
                    ...state.shownEvents,
                    [eventId]: now,
                },
                lastShownAt: now,
            }));
        },
        hasBeenShown: (eventId) => {
            return eventId in get().shownEvents;
        },
        updateLastShown: () => {
            set({ lastShownAt: new Date().toISOString() });
        },
        incrementDismissed: () => {
            set((state) => ({ dismissedCount: state.dismissedCount + 1 }));
        },
        reset: () => {
            set({
                shownEvents: {},
                lastShownAt: null,
                dismissedCount: 0,
            });
        },
    }), {
        name: STORAGE_KEY,
    }));
}
export const useNarrativeStore = ((...args) => {
    if (!_store)
        _store = createNarrativeStore();
    return _store(...args);
});
useNarrativeStore.getState = () => {
    if (!_store)
        _store = createNarrativeStore();
    return _store.getState();
};
useNarrativeStore.setState = (...a) => {
    if (!_store)
        _store = createNarrativeStore();
    return _store.setState(...a);
};
useNarrativeStore.subscribe = (...a) => {
    if (!_store)
        _store = createNarrativeStore();
    return _store.subscribe(...a);
};
