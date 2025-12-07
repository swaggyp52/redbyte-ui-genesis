import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { applyTheme, getActiveTheme } from './applyTheme';
import type { ThemeVariant } from './applyTheme';

interface ThemeContextValue {
  variant: ThemeVariant;
  setVariant: (variant: ThemeVariant) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * ThemeProvider - Manages theme state and applies CSS variables
 *
 * Automatically applies the theme to document.documentElement on mount and theme changes.
 * Persists theme choice to localStorage.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ThemeProvider>
 *       <YourApp />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [variant, setVariantState] = useState<ThemeVariant>(() => {
    // SSR guard - return default theme during SSR
    if (typeof window === 'undefined') return 'dark-neon';

    // Try to get saved theme
    const saved = getActiveTheme();
    return saved ?? 'dark-neon';
  });

  // Apply theme on mount and when variant changes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    applyTheme(document.documentElement, variant);
  }, [variant]);

  const setVariant = (newVariant: ThemeVariant) => {
    setVariantState(newVariant);
  };

  return (
    <ThemeContext.Provider value={{ variant, setVariant }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * useTheme hook - Access current theme variant and setter
 *
 * @throws Error if used outside ThemeProvider
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { variant, setVariant } = useTheme();
 *
 *   const toggleTheme = () => {
 *     setVariant(variant === 'dark-neon' ? 'light-frost' : 'dark-neon');
 *   };
 *
 *   return <button onClick={toggleTheme}>Toggle Theme</button>;
 * }
 * ```
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
