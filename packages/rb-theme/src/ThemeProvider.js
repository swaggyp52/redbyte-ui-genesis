import { jsx as _jsx } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { createContext, useContext, useLayoutEffect, useState, } from 'react';
import { applyTheme, getActiveTheme, resolveThemeVariant } from './applyTheme';
const ThemeContext = createContext(undefined);
export const ThemeProvider = ({ children, }) => {
    const [variant, setVariantState] = useState(() => {
        if (typeof window === 'undefined')
            return 'light';
        const saved = getActiveTheme();
        return saved ?? 'light';
    });
    const resolvedVariant = resolveThemeVariant(variant);
    useLayoutEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined')
            return;
        applyTheme(document.documentElement, variant);
        if (variant !== 'system')
            return;
        const media = window.matchMedia('(prefers-color-scheme: light)');
        const handleSystemThemeChange = () => applyTheme(document.documentElement, 'system');
        media.addEventListener?.('change', handleSystemThemeChange);
        return () => media.removeEventListener?.('change', handleSystemThemeChange);
    }, [variant]);
    const setVariant = (newVariant) => {
        setVariantState(newVariant);
    };
    return (_jsx(ThemeContext.Provider, { value: { variant, resolvedVariant, setVariant }, children: children }));
};
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return ctx;
}
