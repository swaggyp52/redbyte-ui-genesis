import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../settingsStore';
const STORAGE_KEY = 'rb.shell.settings';
describe('Performance Mode gate', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    it('persists performanceMode to localStorage', () => {
        const settings = useSettingsStore.getState();
        settings.setPerformanceMode(true);
        expect(useSettingsStore.getState().performanceMode).toBe(true);
        const stored = localStorage.getItem(STORAGE_KEY);
        expect(stored).toBeTruthy();
        if (!stored)
            return;
        const parsed = JSON.parse(stored);
        expect(parsed.performanceMode).toBe(true);
        settings.setPerformanceMode(false);
        expect(useSettingsStore.getState().performanceMode).toBe(false);
        const stored2 = localStorage.getItem(STORAGE_KEY);
        expect(stored2).toBeTruthy();
        if (!stored2)
            return;
        const parsed2 = JSON.parse(stored2);
        expect(parsed2.performanceMode).toBe(false);
    });
});

