// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Mock for @redbyte/rb-utils that avoids Zustand store initialization issues in tests

import { vi } from 'vitest';

// Mock settings state - stable reference
const mockSettingsState = {
  themeVariant: 'redbyte-dark' as const,
  wallpaperId: 'neon-circuit' as const,
  accentColor: 'cyan' as const,
  tickRate: 20,
  reduceMotion: false,
  density: 'comfortable' as const,
  snapAssist: 'manual' as const,
  setThemeVariant: vi.fn(),
  setWallpaperId: vi.fn(),
  setAccentColor: vi.fn(),
  setTickRate: vi.fn(),
  setReduceMotion: vi.fn(),
  setDensity: vi.fn(),
  setSnapAssist: vi.fn(),
};

// Mock UI tick state - stable reference
const mockUiTickState = {
  uiTick: 0,
  running: false,
  start: vi.fn(),
  stop: vi.fn(),
};

// Create Zustand-compatible mock stores
export const useSettingsStore = Object.assign(
  (selector?: (state: typeof mockSettingsState) => unknown) =>
    selector ? selector(mockSettingsState) : mockSettingsState,
  {
    getState: () => mockSettingsState,
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  }
);

export const useUiTickStore = Object.assign(
  (selector?: (state: typeof mockUiTickState) => unknown) =>
    selector ? selector(mockUiTickState) : mockUiTickState,
  {
    getState: () => mockUiTickState,
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  }
);

// Mock perf functions
export const mark = vi.fn();
export const measure = vi.fn();
export const logPerfSummary = vi.fn();
export const startPerfSummaryLogger = vi.fn();
export const stopPerfSummaryLogger = vi.fn();
export const trackRender = vi.fn();
export const getRenderCounts = vi.fn(() => ({}));
export const isPerfDebugEnabled = vi.fn(() => false);
export const startUiTickSampler = vi.fn();
