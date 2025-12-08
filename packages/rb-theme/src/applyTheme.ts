import { tokensDarkNeon, tokensLightFrost, tokensToCSSVariables } from '@rb/rb-tokens';

export type ThemeVariant = 'dark-neon' | 'light-frost';

export function applyTheme(root: HTMLElement, variant: ThemeVariant): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
  const tokens = variant === 'dark-neon' ? tokensDarkNeon : tokensLightFrost;
  const cssVars = tokensToCSSVariables(tokens);
  
  Object.entries(cssVars).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
  
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
