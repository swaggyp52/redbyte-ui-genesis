import { tokensDarkNeon, tokensLightFrost, tokensToCssVars } from "@redbyte/rb-tokens";

export type ThemeVariant = "dark-neon" | "light-frost";

const THEME_KEY = "rb-os:v1:theme";
const variantMap: Record<ThemeVariant, ReturnType<typeof tokensToCssVars>> = {
  "dark-neon": tokensToCssVars(tokensDarkNeon),
  "light-frost": tokensToCssVars(tokensLightFrost),
};

function persistTheme(variant: ThemeVariant): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(THEME_KEY, variant);
}

function readPersistedTheme(): ThemeVariant | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const value = window.localStorage.getItem(THEME_KEY);
  return (value === "dark-neon" || value === "light-frost") ? value : null;
}

export function applyTheme(
  root: HTMLElement,
  variant: ThemeVariant,
  options?: { persist?: boolean },
): void {
  if (!root) return;
  const vars = variantMap[variant];
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  if (options?.persist !== false) {
    persistTheme(variant);
  }
}

export function getActiveTheme(): ThemeVariant | null {
  return readPersistedTheme();
}
