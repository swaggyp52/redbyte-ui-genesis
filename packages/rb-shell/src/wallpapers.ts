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
    id: 'neon-circuit',
    name: 'Neon Circuit',
    style: (variant) => ({
      background: variant === 'light'
        ? '#d1dae3'
        : variant === 'midnight'
          ? '#000814'
          : '#0a0e1a',
    }),
  },
  {
    id: 'frost-grid',
    name: 'Frost Grid',
    style: (variant) => ({
      background: variant === 'light'
        ? `
          linear-gradient(rgba(6, 182, 212, 0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(6, 182, 212, 0.06) 1px, transparent 1px),
          #d4dce5
        `
        : variant === 'midnight'
          ? `
            linear-gradient(rgba(99, 102, 241, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 102, 241, 0.04) 1px, transparent 1px),
            #0a0118
          `
          : `
            linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px),
            #0a0f1a
          `,
      backgroundSize: '60px 60px',
      backgroundPosition: '0 0',
    }),
  },
  {
    id: 'default',
    name: 'Gradient',
    style: (variant) => ({
      background: variant === 'light'
        ? 'linear-gradient(135deg, #5a67d8 0%, #6b46a1 100%)'
        : variant === 'midnight'
          ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)'
          : 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    }),
  },
  {
    id: 'solid',
    name: 'Solid',
    style: (variant) => ({
      background: variant === 'light'
        ? '#cbd5e1'
        : variant === 'midnight'
          ? '#0a0118'
          : '#0f172a',
    }),
  },
];

export function getWallpaperStyle(id: WallpaperId, variant: ThemeVariant): CSSProperties {
  const wallpaper = wallpapers.find((w) => w.id === id) ?? wallpapers[0];
  return wallpaper.style(variant);
}
