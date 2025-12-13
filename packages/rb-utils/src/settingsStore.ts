// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeVariant = 'dark-neon' | 'light-frost';
export type WallpaperId = 'neon-circuit' | 'frost-grid' | 'solid';

interface SettingsState {
  themeVariant: ThemeVariant;
  wallpaperId: WallpaperId;
  tickRate: number;
  
  setThemeVariant: (variant: ThemeVariant) => void;
  setWallpaperId: (id: WallpaperId) => void;
  setTickRate: (rate: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeVariant: 'dark-neon',
      wallpaperId: 'neon-circuit',
      tickRate: 20,
      
      setThemeVariant: (variant) => set({ themeVariant: variant }),
      setWallpaperId: (id) => set({ wallpaperId: id }),
      setTickRate: (rate) => set({ tickRate: Math.max(1, Math.min(60, rate)) }),
    }),
    {
      name: 'rb:settings:v1',
    }
  )
);
