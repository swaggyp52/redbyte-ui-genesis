import { jsx as _jsx } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { createContext, useContext, useEffect, useState, } from 'react';
import { applyTheme, getActiveTheme } from './applyTheme';
const ThemeContext = createContext(undefined);
export const ThemeProvider = ({ children, }) => {
    const [variant, setVariantState] = useState(() => {
        if (typeof window === 'undefined')
            return 'dark';
        const saved = getActiveTheme();
        return saved ?? 'dark';
    });
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
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return ctx;
}
