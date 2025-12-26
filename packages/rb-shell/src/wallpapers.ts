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
        : `
          radial-gradient(ellipse at 20% 30%, rgba(255, 0, 0, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, rgba(0, 135, 255, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(128, 0, 255, 0.1) 0%, transparent 50%),
          linear-gradient(135deg, #0a0d1a 0%, #0f1729 25%, #1a0f29 50%, #0f1729 75%, #0a0d1a 100%)
        `,
    }),
  },
  {
    id: 'neon-circuit',
    name: 'Neon Circuit',
    style: () => ({
      background: `
        radial-gradient(circle at 25% 25%, rgba(255, 0, 0, 0.2) 0%, transparent 25%),
        radial-gradient(circle at 75% 75%, rgba(0, 135, 255, 0.2) 0%, transparent 25%),
        radial-gradient(circle at 50% 50%, rgba(128, 0, 255, 0.15) 0%, transparent 30%),
        linear-gradient(0deg, transparent 49%, rgba(255, 0, 0, 0.05) 49%, rgba(255, 0, 0, 0.05) 51%, transparent 51%),
        linear-gradient(90deg, transparent 49%, rgba(0, 135, 255, 0.05) 49%, rgba(0, 135, 255, 0.05) 51%, transparent 51%),
        #050a15
      `,
      backgroundSize: '100% 100%, 100% 100%, 100% 100%, 50px 50px, 50px 50px, 100% 100%',
      backgroundPosition: 'center',
    }),
  },
  {
    id: 'frost-grid',
    name: 'Frost Grid',
    style: () => ({
      background: `
        linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px),
        linear-gradient(rgba(6, 182, 212, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(6, 182, 212, 0.02) 1px, #0a0f1a 1px)
      `,
      backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
      backgroundPosition: '-1px -1px, -1px -1px, -1px -1px, -1px -1px',
    }),
  },
  {
    id: 'solid',
    name: 'Solid',
    style: (variant) => ({
      background: variant === 'light'
        ? 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)'
        : 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
    }),
  },
];

export function getWallpaperStyle(id: WallpaperId, variant: ThemeVariant): CSSProperties {
  const wallpaper = wallpapers.find((w) => w.id === id) ?? wallpapers[0];
  return wallpaper.style(variant);
}
