import type { CSSProperties } from 'react';
import type { ThemeVariant, WallpaperId } from '@rb/rb-utils';

export interface WallpaperDefinition {
  id: WallpaperId;
  name: string;
  style: (variant: ThemeVariant) => CSSProperties;
}

export const wallpapers: WallpaperDefinition[] = [
  {
    id: 'neon-circuit',
    name: 'Neon Circuit',
    style: () => ({
      backgroundImage: 'linear-gradient(135deg, #4c1d95, #0f172a 60%, #0ea5e9)',
      backgroundSize: '200% 200%',
      animation: 'rb-neon-shift 12s ease infinite',
    }),
  },
  {
    id: 'frost-grid',
    name: 'Frost Grid',
    style: () => ({
      backgroundColor: '#e2e8f0',
      backgroundImage:
        'linear-gradient(rgba(148, 163, 184, 0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.35) 1px, transparent 1px)',
      backgroundSize: '80px 80px',
    }),
  },
  {
    id: 'solid',
    name: 'Solid',
    style: (variant) => ({
      backgroundColor: variant === 'light-frost' ? '#e5e7eb' : '#0f172a',
    }),
  },
];

export function getWallpaperStyle(id: WallpaperId, variant: ThemeVariant): CSSProperties {
  const wallpaper = wallpapers.find((w) => w.id === id) ?? wallpapers[0];
  return wallpaper.style(variant);
}
