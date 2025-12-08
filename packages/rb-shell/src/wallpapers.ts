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
      backgroundColor: variant === 'light-frost' ? '#e5e7eb' : '#0f172a',
    }),
  },
];

export function getWallpaperStyle(id: WallpaperId, variant: ThemeVariant): CSSProperties {
  const wallpaper = wallpapers.find((w) => w.id === id) ?? wallpapers[0];
  return wallpaper.style(variant);
}
