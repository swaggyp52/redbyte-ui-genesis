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

export const wallpapers: WallpaperDefinition[] = [
  {
    id: 'default',
    name: 'Default',
    style: (variant) => ({
      background: variant === 'light'
        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        : 'linear-gradient(135deg, #1e3a8a 0%, #312e81 50%, #1e1b4b 100%)',
    }),
  },
  {
    id: 'neon-circuit',
    name: 'Neon Circuit',
    style: () => ({
      backgroundImage: 'url(/wallpapers/neon-circuit.svg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }),
  },
  {
    id: 'frost-grid',
    name: 'Frost Grid',
    style: () => ({
      backgroundImage: 'url(/wallpapers/frost-grid.svg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }),
  },
  {
    id: 'solid',
    name: 'Solid',
    style: (variant) => ({
      backgroundColor: variant === 'light' ? '#e5e7eb' : '#0f172a',
    }),
  },
];

export function getWallpaperStyle(id: WallpaperId, variant: ThemeVariant): CSSProperties {
  const wallpaper = wallpapers.find((w) => w.id === id) ?? wallpapers[0];
  return wallpaper.style(variant);
}
