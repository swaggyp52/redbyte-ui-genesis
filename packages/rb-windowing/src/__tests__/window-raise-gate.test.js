// Copyright Â© 2025 Connor Angiel â€” RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect, beforeEach } from 'vitest';
import { useWindowStore } from '../store';
describe('os:window-raise-gate', () => {
    beforeEach(() => {
        useWindowStore.setState({ windows: [], nextZIndex: 1 });
    });
    it('raises and focuses a window on focusWindow()', () => {
        const { createWindow, focusWindow } = useWindowStore.getState();
        const w1 = createWindow({ title: 'A', contentId: 'app-a' });
        const w2 = createWindow({ title: 'B', contentId: 'app-b' });
        expect(useWindowStore.getState().getFocusedWindow()?.id).toBe(w2.id);
        focusWindow(w1.id);
        const state = useWindowStore.getState();
        const focused = state.getFocusedWindow();
        expect(focused?.id).toBe(w1.id);
        const zOrdered = state.getZOrderedWindows();
        expect(zOrdered[zOrdered.length - 1]?.id).toBe(w1.id);
    });
    it('restores a minimized window when focusing it', () => {
        const { createWindow, toggleMinimize, focusWindow } = useWindowStore.getState();
        const w1 = createWindow({ title: 'A', contentId: 'app-a' });
        createWindow({ title: 'B', contentId: 'app-b' });
        toggleMinimize(w1.id);
        expect(useWindowStore.getState().windows.find((w) => w.id === w1.id)?.mode).toBe('minimized');
        focusWindow(w1.id);
        const restored = useWindowStore.getState().windows.find((w) => w.id === w1.id);
        expect(restored?.mode).toBe('normal');
        expect(useWindowStore.getState().getFocusedWindow()?.id).toBe(w1.id);
    });
    it('minimize -> restore+focus brings window to front', () => {
        const { createWindow, toggleMinimize, restoreWindow, focusWindow } = useWindowStore.getState();
        const w1 = createWindow({ title: 'A', contentId: 'app-a' });
        const w2 = createWindow({ title: 'B', contentId: 'app-b' });
        focusWindow(w1.id);
        toggleMinimize(w1.id);
        expect(useWindowStore.getState().windows.find((w) => w.id === w1.id)?.mode).toBe('minimized');
        restoreWindow(w1.id);
        focusWindow(w1.id);
        const state = useWindowStore.getState();
        const focused = state.getFocusedWindow();
        expect(focused?.id).toBe(w1.id);
        const zOrdered = state.getZOrderedWindows();
        expect(zOrdered[zOrdered.length - 1]?.id).toBe(w1.id);
        // Other windows remain intact
        expect(state.windows.find((w) => w.id === w2.id)).toBeTruthy();
    });
});
