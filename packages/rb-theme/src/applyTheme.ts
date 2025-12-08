import { tokensDarkNeon, tokensLightFrost, tokensToCSSVariables } from "@rb/rb-tokens";

const THEME_STORAGE_KEY = "rb-theme-variant";

export type ThemeVariant = "dark" | "light";

function getThemeTokens(variant: ThemeVariant) {
  return variant === "light" ? tokensLightFrost : tokensDarkNeon;
}

export function applyTheme(variant: ThemeVariant) {
  if (typeof document === "undefined") return;

  const tokens = getThemeTokens(variant);
  const cssVars = tokensToCSSVariables(tokens as Record<string, string>);

  const root = document.documentElement;
  for (const [name, value] of Object.entries(cssVars)) {
    root.style.setProperty(name, value);
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, variant);
  } catch {
    // ignore storage errors
  }
}

export function loadInitialTheme(): ThemeVariant {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  return "dark";
}
