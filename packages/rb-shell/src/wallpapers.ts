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
    name: 'Gradient',
    style: () => ({
      background: 'linear-gradient(145deg, #09090B 0%, #18181B 50%, #09090B 100%)',
    }),
  },
  {
    id: 'redbyte-field',
    name: 'RedByte Field',
    style: () => ({
      background: 'linear-gradient(140deg, #09090B 0%, #111318 55%, #09090B 100%)',
    }),
  },
  {
    id: 'neon-circuit',
    name: 'Deep',
    style: () => ({
      background: '#09090B',
    }),
  },
  {
    id: 'frost-grid',
    name: 'Grid',
    style: () => ({
      background: `
        linear-gradient(rgba(59, 130, 246, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(59, 130, 246, 0.02) 1px, transparent 1px),
        #09090B
      `,
      backgroundSize: '60px 60px',
      backgroundPosition: '0 0',
    }),
  },
  {
    id: 'solid',
    name: 'Solid',
    style: () => ({
      background: '#09090B',
    }),
  },
];

export function getWallpaperStyle(id: WallpaperId, variant: ThemeVariant): CSSProperties {
  const wallpaper = wallpapers.find((w) => w.id === id) ?? wallpapers[0];
  return wallpaper.style(variant);
}
