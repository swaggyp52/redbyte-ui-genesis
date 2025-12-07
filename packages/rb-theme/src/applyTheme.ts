import { tokensDarkNeon, tokensLightFrost, tokensToCSSVariables } from '@redbyte/rb-tokens';
import type { RBTokens } from '@redbyte/rb-tokens';

/**
 * Theme variant identifiers
 */
export type ThemeVariant = 'dark-neon' | 'light-frost';

/**
 * Storage key for persisting active theme
 */
const THEME_STORAGE_KEY = 'rb-theme-variant';

/**
 * Get theme tokens for a given variant
 */
function getThemeTokens(variant: ThemeVariant): RBTokens {
  return variant === 'dark-neon' ? tokensDarkNeon : tokensLightFrost;
}

/**
 * Apply theme to a root element by setting CSS custom properties
 *
 * @param root - HTMLElement to apply theme to (usually document.documentElement)
 * @param variant - Theme variant to apply ('dark-neon' | 'light-frost')
 * @param options - Optional configuration
 * @param options.persist - Whether to persist theme choice to localStorage (default: true)
 *
 * @example
 * ```ts
 * // Apply dark-neon theme to document root
 * applyTheme(document.documentElement, 'dark-neon');
 *
 * // Apply light-frost theme without persisting
 * applyTheme(document.documentElement, 'light-frost', { persist: false });
 * ```
 */
export function applyTheme(
  root: HTMLElement,
  variant: ThemeVariant,
  options?: { persist?: boolean }
): void {
  // SSR guard - ensure we're in browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const tokens = getThemeTokens(variant);
  const cssVars = tokensToCSSVariables(tokens);

  // Apply CSS variables to root element
  Object.entries(cssVars).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  // Set data attribute for theme variant (useful for debugging and testing)
  root.setAttribute('data-rb-theme', variant);

  // Persist to localStorage if requested (default: true)
  const shouldPersist = options?.persist !== false;
  if (shouldPersist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, variant);
    } catch {
      // Ignore localStorage errors (private browsing, quota exceeded, etc.)
    }
  }
}

/**
 * Get the currently active theme variant
 *
 * Checks in order:
 * 1. data-rb-theme attribute on document.documentElement
 * 2. Persisted value in localStorage
 * 3. Returns null if no theme is active
 *
 * @returns The active theme variant or null
 *
 * @example
 * ```ts
 * const activeTheme = getActiveTheme();
 * if (activeTheme === 'dark-neon') {
 *   console.log('Dark theme is active');
 * }
 * ```
 */
export function getActiveTheme(): ThemeVariant | null {
  // SSR guard - ensure we're in browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  // Check data attribute first (source of truth for currently applied theme)
  const dataAttr = document.documentElement.getAttribute('data-rb-theme');
  if (dataAttr === 'dark-neon' || dataAttr === 'light-frost') {
    return dataAttr;
  }

  // Fall back to localStorage
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark-neon' || stored === 'light-frost') {
      return stored;
    }
  } catch {
    // Ignore localStorage errors
  }

  return null;
}
