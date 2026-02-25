import React from 'react';

/**
 * Dev/test only — renders nothing in production.
 * When window.__RB_THROW_SURFACE__ matches `surface`, throws once to trigger
 * the nearest ErrorBoundary. Used by Playwright to verify boundary recovery.
 */
export const ThrowOnce: React.FC<{ surface: string }> = ({ surface }) => {
  if (import.meta.env.DEV && (window as any).__RB_THROW_SURFACE__ === surface) {
    delete (window as any).__RB_THROW_SURFACE__;
    throw new Error(`RB_TEST_THROW:${surface}`);
  }
  return null;
};
