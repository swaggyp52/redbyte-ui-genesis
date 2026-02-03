// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
const ACCENT_COLORS = ['blue', 'purple', 'green', 'orange', 'pink'];
const STORAGE_KEY = 'rb.shell.settings';
const DEFAULT_SETTINGS = {
    themeVariant: 'dark',
    wallpaperId: 'default',
    accentColor: 'blue',
    tickRate: 20,
    reduceMotion: false,
    density: 'comfortable',
    snapAssist: 'manual',
};
/** Migrate legacy theme variant names */
function migrateThemeVariant(raw) {
    if (raw === 'dark' || raw === 'light' || raw === 'midnight' || raw === 'system')
        return raw;
    if (raw === 'redbyte-dark' || raw === 'redbyte')
        return 'dark';
    if (raw === 'instrument')
        return 'light';
    return DEFAULT_SETTINGS.themeVariant;
}
/** Migrate legacy accent color names */
function migrateAccentColor(raw) {
    if (typeof raw === 'string' && ACCENT_COLORS.includes(raw))
        return raw;
    if (raw === 'cyan')
        return 'blue';
    return DEFAULT_SETTINGS.accentColor;
}
function loadSettings() {
    if (typeof localStorage === 'undefined') {
        return DEFAULT_SETTINGS;
    }
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return DEFAULT_SETTINGS;
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) {
            console.warn('Invalid settings format in localStorage, using defaults');
            return DEFAULT_SETTINGS;
        }
        const VALID_WALLPAPERS = ['default', 'neon-circuit', 'frost-grid', 'solid', 'redbyte-field'];
        const themeVariant = migrateThemeVariant(parsed.themeVariant);
        const accentColor = migrateAccentColor(parsed.accentColor);
        const density = rawDensity(parsed.density);
        const snapAssist = rawSnapAssist(parsed.snapAssist);
        return {
            themeVariant,
            wallpaperId: VALID_WALLPAPERS.includes(parsed.wallpaperId)
                ? parsed.wallpaperId
                : DEFAULT_SETTINGS.wallpaperId,
            accentColor,
            tickRate: typeof parsed.tickRate === 'number' && parsed.tickRate > 0 && parsed.tickRate <= 60
                ? parsed.tickRate
                : DEFAULT_SETTINGS.tickRate,
            reduceMotion: typeof parsed.reduceMotion === 'boolean'
                ? parsed.reduceMotion
                : DEFAULT_SETTINGS.reduceMotion,
            density,
            snapAssist,
        };
    }
    catch (err) {
        console.warn('Failed to load settings from localStorage, using defaults', err);
        return DEFAULT_SETTINGS;
    }
}
function persistSettings(settings) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    catch (err) {
        console.warn('Failed to persist settings to localStorage', err);
    }
}
function rawDensity(value) {
    if (value === 'compact' || value === 'comfortable')
        return value;
    return DEFAULT_SETTINGS.density;
}
function rawSnapAssist(value) {
    if (value === 'off' || value === 'manual' || value === 'auto')
        return value;
    return DEFAULT_SETTINGS.snapAssist;
}
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createSettingsStore() {
    return create((set, get) => ({
        ...loadSettings(),
        setThemeVariant: (variant) => {
            set({ themeVariant: variant });
            persistSettings(get());
        },
        setWallpaperId: (id) => {
            set({ wallpaperId: id });
            persistSettings(get());
        },
        setAccentColor: (color) => {
            set({ accentColor: color });
            persistSettings(get());
        },
        setTickRate: (rate) => {
            if (!Number.isFinite(rate))
                return;
            // Clamp to valid range
            const clampedRate = Math.max(1, Math.min(60, rate));
            set({ tickRate: clampedRate });
            persistSettings(get());
        },
        setReduceMotion: (enabled) => {
            set({ reduceMotion: enabled });
            persistSettings(get());
        },
        setDensity: (mode) => {
            const next = rawDensity(mode);
            set({ density: next });
            persistSettings(get());
        },
        setSnapAssist: (mode) => {
            const next = rawSnapAssist(mode);
            set({ snapAssist: next });
            persistSettings(get());
        },
    }));
}
export const useSettingsStore = ((...args) => {
    if (!_store)
        _store = createSettingsStore();
    return _store(...args);
});
useSettingsStore.getState = () => {
    if (!_store)
        _store = createSettingsStore();
    return _store.getState();
};
useSettingsStore.setState = (...a) => {
    if (!_store)
        _store = createSettingsStore();
    return _store.setState(...a);
};
useSettingsStore.subscribe = (...a) => {
    if (!_store)
        _store = createSettingsStore();
    return _store.subscribe(...a);
};
