// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo, useRef } from 'react';
import type { ThemeVariant, WallpaperId } from '@redbyte/rb-utils';
import { getWallpaperStyle } from './wallpapers';

interface DesktopProps {
  onOpenApp: (id: string, props?: any) => void;
  wallpaperId: WallpaperId;
  themeVariant: ThemeVariant;
}

export const Desktop: React.FC<DesktopProps> = React.memo(({ onOpenApp, wallpaperId, themeVariant }) => {
  const desktopRef = useRef<HTMLDivElement>(null);
  const wallpaperStyle = useMemo(() => getWallpaperStyle(wallpaperId, themeVariant), [wallpaperId, themeVariant]);

  const handleContextMenu = (e: React.MouseEvent) => {
    // Future: custom context menu with New File, Open Terminal, Appearance
    // For now, allow default browser context menu
  };

  const handleDoubleClick = () => {
    onOpenApp('logic-playground');
  };

  return (
    <div
      ref={desktopRef}
      id="rb-desktop-region"
      data-testid="shell-desktop"
      role="region"
      aria-label="Desktop"
      className="rb-desktop rb-noise absolute inset-0 overflow-hidden pointer-events-none"
      style={{ ...wallpaperStyle }}
    >
      {/* Subtle vignette for depth */}
      <div className="pointer-events-none absolute inset-0 rb-vignette" />

      {/* Centered watermark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="text-[120px] font-bold leading-none select-none"
          style={{
            color: 'var(--rb-text)',
            opacity: 0.02,
            fontFamily: 'var(--rb-font-sans)',
            letterSpacing: '-0.04em',
          }}
        >
          R
        </div>
      </div>

      {/* RedByte Field wallpaper effect — subtle grid drift */}
      {wallpaperId === 'redbyte-field' && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 rb-anim"
            style={{
              opacity: 0.3,
              backgroundImage:
                'linear-gradient(rgba(59, 130, 246, 0.04) 1px, transparent 1px), ' +
                'linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)',
              backgroundSize: '120px 120px',
              animation: 'rb-field-drift 60s linear infinite',
            }}
          />
        </div>
      )}

      {/* Interaction layer — sits behind windows (z-0), receives desktop events */}
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{ zIndex: 0 }}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      />

      {/* Copyright */}
      <div
        className="absolute bottom-3 right-4 z-10 text-right text-[10px] font-mono pointer-events-none"
        style={{ color: 'var(--rb-text-3)', opacity: 0.5 }}
      >
        <div>RedByte OS Genesis</div>
      </div>
    </div>
  );
});
Desktop.displayName = 'Desktop';
