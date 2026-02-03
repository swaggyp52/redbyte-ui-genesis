// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createOscilloscopeStore() {
    return create((set) => ({
        pauseScroll: false,
        showTimeCursor: true,
        timeWindowSec: 10,
        showTickGuides: true,
        clearRequestId: 0,
        setPauseScroll: (enabled) => set({ pauseScroll: enabled }),
        togglePauseScroll: () => set((state) => ({ pauseScroll: !state.pauseScroll })),
        setShowTimeCursor: (enabled) => set({ showTimeCursor: enabled }),
        toggleTimeCursor: () => set((state) => ({ showTimeCursor: !state.showTimeCursor })),
        setTimeWindowSec: (seconds) => set({ timeWindowSec: Math.max(1, Math.min(10, Math.round(seconds))) }),
        setShowTickGuides: (enabled) => set({ showTickGuides: enabled }),
        requestClear: () => set((state) => ({ clearRequestId: state.clearRequestId + 1 })),
    }));
}
export const useOscilloscopeStore = ((...args) => {
    if (!_store)
        _store = createOscilloscopeStore();
    return _store(...args);
});
useOscilloscopeStore.getState = () => {
    if (!_store)
        _store = createOscilloscopeStore();
    return _store.getState();
};
useOscilloscopeStore.setState = (...a) => {
    if (!_store)
        _store = createOscilloscopeStore();
    return _store.setState(...a);
};
useOscilloscopeStore.subscribe = (...a) => {
    if (!_store)
        _store = createOscilloscopeStore();
    return _store.subscribe(...a);
};
