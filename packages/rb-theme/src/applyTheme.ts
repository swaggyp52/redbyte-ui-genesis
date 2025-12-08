// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { tokensDarkNeon, tokensLightFrost, tokensToCSSVariables } from '@redbyte/rb-tokens';

export type ThemeVariant = 'dark-neon' | 'light-frost';

export function applyTheme(root: HTMLElement, variant: ThemeVariant): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
  const tokens = variant === 'dark-neon' ? tokensDarkNeon : tokensLightFrost;
  const cssVars = tokensToCSSVariables(tokens);

  Object.entries(cssVars).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  // Visual utility variables
  root.style.setProperty(
    '--rb-effect-glow',
    variant === 'dark-neon' ? '0 0 24px rgba(34,211,238,0.45)' : '0 0 18px rgba(59,130,246,0.35)'
  );
  root.style.setProperty(
    '--rb-effect-glass',
    variant === 'dark-neon' ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.6)'
  );
  root.style.setProperty('--rb-theme-foreground', variant === 'dark-neon' ? '#e2e8f0' : '#0f172a');
  root.style.setProperty('--rb-theme-background', variant === 'dark-neon' ? '#0b1224' : '#f8fafc');

  root.setAttribute('data-rb-theme', variant);
  
  try {
    localStorage.setItem('rb-theme-variant', variant);
  } catch {}
}

export function getActiveTheme(): ThemeVariant | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  
  const dataAttr = document.documentElement.getAttribute('data-rb-theme');
  if (dataAttr === 'dark-neon' || dataAttr === 'light-frost') return dataAttr;
  
  try {
    const stored = localStorage.getItem('rb-theme-variant');
    if (stored === 'dark-neon' || stored === 'light-frost') return stored;
  } catch {}
  
  return null;
}
