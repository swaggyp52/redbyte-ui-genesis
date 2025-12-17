// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { tokensDarkNeon, tokensLightFrost, tokensToCSSVariables } from '@redbyte/rb-tokens';

export type ThemeVariant = 'light' | 'dark' | 'system';

function resolveThemeVariant(variant: ThemeVariant): 'dark' | 'light' {
  if (variant === 'system') {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return variant;
}

export function applyTheme(root: HTMLElement, variant: ThemeVariant): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const resolved = resolveThemeVariant(variant);
  const tokens = resolved === 'dark' ? tokensDarkNeon : tokensLightFrost;
  const cssVars = tokensToCSSVariables(tokens);

  Object.entries(cssVars).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  // Visual utility variables
  root.style.setProperty(
    '--rb-effect-glow',
    resolved === 'dark' ? '0 0 24px rgba(34,211,238,0.45)' : '0 0 18px rgba(59,130,246,0.35)'
  );
  root.style.setProperty(
    '--rb-effect-glass',
    resolved === 'dark' ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.6)'
  );
  root.style.setProperty('--rb-theme-foreground', resolved === 'dark' ? '#e2e8f0' : '#0f172a');
  root.style.setProperty('--rb-theme-background', resolved === 'dark' ? '#0b1224' : '#f8fafc');

  root.setAttribute('data-rb-theme', resolved);

  try {
    localStorage.setItem('rb-theme-variant', variant);
  } catch {}
}

export function getActiveTheme(): ThemeVariant | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  try {
    const stored = localStorage.getItem('rb-theme-variant');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {}

  return null;
}
