import React from 'react';

export interface DesktopProps {
  wallpaper?: 'neon-circuit' | 'frost-grid' | string;
  children: React.ReactNode;
}

/**
 * Desktop - Main desktop container with wallpaper support
 *
 * Provides the base container for the windowing system with
 * customizable wallpapers and effects.
 */
export const Desktop: React.FC<DesktopProps> = ({ wallpaper = 'neon-circuit', children }) => {
  const wallpaperStyles = {
    'neon-circuit': 'bg-gradient-to-br from-[var(--rb-color-neutral-900)] via-[var(--rb-color-accent-900)] to-[var(--rb-color-neutral-900)]',
    'frost-grid': 'bg-gradient-to-br from-[var(--rb-color-neutral-100)] via-[var(--rb-color-accent-100)] to-[var(--rb-color-neutral-200)]',
  };

  const wallpaperClass = wallpaperStyles[wallpaper as keyof typeof wallpaperStyles] || wallpaperStyles['neon-circuit'];

  return (
    <div
      className={`relative w-full h-screen overflow-hidden ${wallpaperClass}`}
      data-testid="desktop"
    >
      {children}
    </div>
  );
};
