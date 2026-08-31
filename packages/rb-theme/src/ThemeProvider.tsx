// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
} from 'react';
import { applyTheme, getActiveTheme, resolveThemeVariant } from './applyTheme';
import type { ResolvedThemeVariant, ThemeVariant } from './applyTheme';

interface ThemeContextValue {
  variant: ThemeVariant;
  resolvedVariant: ResolvedThemeVariant;
  setVariant: (variant: ThemeVariant) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [variant, setVariantState] = useState<ThemeVariant>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = getActiveTheme();
    return saved ?? 'light';
  });

  const resolvedVariant = resolveThemeVariant(variant);

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    applyTheme(document.documentElement, variant);

    if (variant !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const handleSystemThemeChange = () => applyTheme(document.documentElement, 'system');
    media.addEventListener?.('change', handleSystemThemeChange);
    return () => media.removeEventListener?.('change', handleSystemThemeChange);
  }, [variant]);

  const setVariant = (newVariant: ThemeVariant) => {
    setVariantState(newVariant);
  };

  return (
    <ThemeContext.Provider value={{ variant, resolvedVariant, setVariant }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
