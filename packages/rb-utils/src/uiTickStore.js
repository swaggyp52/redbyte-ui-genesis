// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
let rafId = null;
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createUiTickStore() {
    return create((set, get) => ({
        uiTick: 0,
        running: false,
        start: () => {
            if (get().running || typeof window === 'undefined')
                return;
            set({ running: true });
            const targetDelta = 1000 / 30;
            let lastFrame = performance.now();
            const step = (now) => {
                if (!get().running)
                    return;
                if (now - lastFrame >= targetDelta) {
                    lastFrame = now;
                    set((state) => ({ uiTick: state.uiTick + 1 }));
                }
                rafId = window.requestAnimationFrame(step);
            };
            rafId = window.requestAnimationFrame(step);
        },
        stop: () => {
            set({ running: false });
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
                rafId = null;
            }
        },
    }));
}
export const useUiTickStore = ((...args) => {
    if (!_store)
        _store = createUiTickStore();
    return _store(...args);
});
useUiTickStore.getState = () => {
    if (!_store)
        _store = createUiTickStore();
    return _store.getState();
};
useUiTickStore.setState = (...a) => {
    if (!_store)
        _store = createUiTickStore();
    return _store.setState(...a);
};
useUiTickStore.subscribe = (...a) => {
    if (!_store)
        _store = createUiTickStore();
    return _store.subscribe(...a);
};
export const startUiTickSampler = () => {
    useUiTickStore.getState().start();
};
