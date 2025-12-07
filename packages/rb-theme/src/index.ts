import { Tokens, TokenVariant, getTokensForVariant, tokensToCssVariables } from '@rb/rb-tokens';

export interface ApplyThemeOptions {
  storageKey?: string | null;
}

const DEFAULT_STORAGE_KEY = 'rb:theme';
let activeTheme: TokenVariant | null = null;

const hasDOM = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

const persistTheme = (variant: TokenVariant, storageKey: string | null | undefined): void => {
  if (!storageKey || !hasDOM()) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, variant);
  } catch (error) {
    console.warn('rb-theme: unable to persist theme', error);
  }
};

const applyCssVariables = (root: HTMLElement, tokens: Tokens): void => {
  const vars = tokensToCssVariables(tokens);
  Object.entries(vars).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
};

export const applyTheme = (
  root: HTMLElement | null | undefined,
  variant: TokenVariant,
  options: ApplyThemeOptions = {},
): void => {
  activeTheme = variant;

  if (!hasDOM()) {
    return;
  }

  const target = root ?? document.documentElement;
  const tokens = getTokensForVariant(variant);

  applyCssVariables(target, tokens);
  target.setAttribute('data-rb-theme', variant);

  persistTheme(variant, options.storageKey ?? DEFAULT_STORAGE_KEY);
};

export const getActiveTheme = (): TokenVariant | null => {
  if (activeTheme) {
    return activeTheme;
  }

  if (!hasDOM()) {
    return null;
  }

  const stored = window.localStorage.getItem(DEFAULT_STORAGE_KEY);
  if (stored === 'dark-neon' || stored === 'light-frost') {
    activeTheme = stored;
    return stored;
  }

  const attributeTheme = document.documentElement.getAttribute('data-rb-theme');
  if (attributeTheme === 'dark-neon' || attributeTheme === 'light-frost') {
    activeTheme = attributeTheme;
    return attributeTheme;
  }

  return null;
};
