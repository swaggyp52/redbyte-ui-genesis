// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { CSSProperties } from 'react';
import type { ThemeVariant, WallpaperId } from '@redbyte/rb-utils';

export interface WallpaperDefinition {
  id: WallpaperId;
  name: string;
  style: (variant: ThemeVariant) => CSSProperties;
}

const resolveThemeVariant = (_variant: ThemeVariant): 'light' | 'dark' => {
  // Current themes are dark-toned; keep wallpaper styling consistent.
  return 'dark';
};

export const wallpapers: WallpaperDefinition[] = [
  {
    id: 'neon-circuit',
    name: 'Neon Circuit',
    style: (variant) => {
      const resolved = resolveThemeVariant(variant);
      return {
        background: resolved === 'light' ? '#d1dae3' : '#0a0e1a',
      };
    },
  },
  {
    id: 'frost-grid',
    name: 'Frost Grid',
    style: (variant) => {
      const resolved = resolveThemeVariant(variant);
      return {
        background: resolved === 'light'
          ? `
            linear-gradient(rgba(6, 182, 212, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.06) 1px, transparent 1px),
            #d4dce5
          `
          : `
            linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px),
            #0a0f1a
          `,
        backgroundSize: '60px 60px',
        backgroundPosition: '0 0',
      };
    },
  },
  {
    id: 'default',
    name: 'Gradient',
    style: (variant) => {
      const resolved = resolveThemeVariant(variant);
      return {
        background: resolved === 'light'
          ? 'linear-gradient(135deg, #5a67d8 0%, #6b46a1 100%)'
          : 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      };
    },
  },
  {
    id: 'redbyte-field',
    name: 'RedByte Field',
    style: (variant) => {
      const resolved = resolveThemeVariant(variant);
      return {
        background:
          resolved === 'light'
            ? 'linear-gradient(140deg, #0b0f18 0%, #101826 55%, #0a0f18 100%)'
            : 'linear-gradient(140deg, #060b14 0%, #0d1624 55%, #060b14 100%)',
      };
    },
  },
  {
    id: 'solid',
    name: 'Solid',
    style: (variant) => {
      const resolved = resolveThemeVariant(variant);
      return {
        background: resolved === 'light' ? '#cbd5e1' : '#0f172a',
      };
    },
  },
];

export function getWallpaperStyle(id: WallpaperId, variant: ThemeVariant): CSSProperties {
  const wallpaper = wallpapers.find((w) => w.id === id) ?? wallpapers[0];
  return wallpaper.style(variant);
}
