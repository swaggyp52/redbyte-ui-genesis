import { jsx as _jsx } from "react/jsx-runtime";
import React, { createContext, useContext, useEffect, useState, } from 'react';
import { applyTheme, getActiveTheme } from './applyTheme';
const ThemeContext = createContext(undefined);
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
export const ThemeProvider = ({ children, }) => {
    const [variant, setVariantState] = useState(() => {
        // SSR guard - return default theme during SSR
        if (typeof window === 'undefined')
            return 'dark-neon';
        // Try to get saved theme
        const saved = getActiveTheme();
        return saved ?? 'dark-neon';
    });
    // Apply theme on mount and when variant changes
    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined')
            return;
        applyTheme(document.documentElement, variant);
    }, [variant]);
    const setVariant = (newVariant) => {
        setVariantState(newVariant);
    };
    return (_jsx(ThemeContext.Provider, { value: { variant, setVariant }, children: children }));
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
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return ctx;
}
