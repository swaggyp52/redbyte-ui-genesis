// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';

export type ThemeVariant = 'light' | 'dark' | 'system';

const ACCENT_COLORS = ['cyan', 'purple', 'green', 'orange', 'pink'] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

interface SettingsState {
  themeVariant: ThemeVariant;
  wallpaperId: string;
  accentColor: AccentColor;
}

interface SettingsActions {
  setThemeVariant: (variant: ThemeVariant) => void;
  setWallpaperId: (id: string) => void;
  setAccentColor: (color: AccentColor) => void;
}

type SettingsStore = SettingsState & SettingsActions;

const STORAGE_KEY = 'rb.shell.settings';

const DEFAULT_SETTINGS: SettingsState = {
  themeVariant: 'dark',
  wallpaperId: 'default',
  accentColor: 'cyan',
};

function loadSettings(): SettingsState {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) {
      console.warn('Invalid settings format in localStorage, using defaults');
      return DEFAULT_SETTINGS;
    }

    return {
      themeVariant: ['light', 'dark', 'system'].includes(parsed.themeVariant)
        ? parsed.themeVariant
        : DEFAULT_SETTINGS.themeVariant,
      wallpaperId: typeof parsed.wallpaperId === 'string'
        ? parsed.wallpaperId
        : DEFAULT_SETTINGS.wallpaperId,
      accentColor: ACCENT_COLORS.includes(parsed.accentColor)
        ? parsed.accentColor
        : DEFAULT_SETTINGS.accentColor,
    };
  } catch (err) {
    console.warn('Failed to load settings from localStorage, using defaults', err);
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(settings: SettingsState): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to persist settings to localStorage', err);
  }
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
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
}));
