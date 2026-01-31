// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { WindowBounds } from '@redbyte/rb-windowing';

/** Height of the top bar in pixels. */
export const TOPBAR_HEIGHT = 32;

/** Width of the dock in pixels. */
export const DOCK_WIDTH = 52;

/** Height of the truth bar (0 when hidden). */
export const TRUTHBAR_HEIGHT = 0;

/** Safe margin to keep windows from butting right up against chrome. */
export const SAFE_MARGIN = 8;

/** Minimum visible title-bar pixels when dragged off-screen vertically. */
export const MIN_VISIBLE_TITLEBAR = 24;

/** Minimum visible pixels of window when dragged off-screen horizontally. */
export const MIN_VISIBLE_SIDE = 100;

/**
 * Returns the usable desktop area excluding shell chrome (TopBar, Dock, TruthBar).
 * Falls back to sensible defaults in SSR.
 */
export function getDesktopBounds(): WindowBounds {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;

  return {
    x: DOCK_WIDTH,
    y: TOPBAR_HEIGHT,
    width: vw - DOCK_WIDTH,
    height: vh - TOPBAR_HEIGHT - TRUTHBAR_HEIGHT,
  };
}

/**
 * Returns the bounds a maximized window should fill — the full desktop area.
 */
export function getMaximizedBounds(): WindowBounds {
  return getDesktopBounds();
}

/**
 * Clamps a window's bounds so it stays reachable within the desktop area.
 * - At least MIN_VISIBLE_TITLEBAR px of title bar visible vertically
 * - At least MIN_VISIBLE_SIDE px visible horizontally
 * - Never above the TopBar
 */
export function clampWindowBounds(bounds: WindowBounds): WindowBounds {
  const desktop = getDesktopBounds();

  let { x, y, width, height } = bounds;

  // Floor: never above the top bar
  if (y < TOPBAR_HEIGHT) {
    y = TOPBAR_HEIGHT;
  }

  // Floor: never behind the dock
  if (x < DOCK_WIDTH - width + MIN_VISIBLE_SIDE) {
    x = DOCK_WIDTH - width + MIN_VISIBLE_SIDE;
  }

  // Ceiling: keep title bar reachable at bottom
  const maxY = desktop.y + desktop.height - MIN_VISIBLE_TITLEBAR;
  if (y > maxY) {
    y = maxY;
  }

  // Right: keep some window visible
  const maxX = desktop.x + desktop.width - MIN_VISIBLE_SIDE;
  if (x > maxX) {
    x = maxX;
  }

  return { x, y, width, height };
}
