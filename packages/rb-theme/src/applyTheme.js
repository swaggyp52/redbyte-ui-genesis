// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
export function resolveThemeVariant(variant) {
    if (variant === 'system') {
        if (typeof window === 'undefined')
            return 'light';
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return variant;
}
/**
 * Apply a theme by setting `data-theme` on the root element.
 * All visual tokens are defined in os-tokens.css using `[data-theme]` selectors.
 * No more imperative CSS variable setting — the stylesheet handles everything.
 */
export function applyTheme(root, variant) {
    if (typeof window === 'undefined' || typeof document === 'undefined')
        return;
    const resolved = resolveThemeVariant(variant);
    root.setAttribute('data-theme', resolved);
    // Keep the selected value separate from the resolved palette. This lets the
    // workbench say "System" while CSS still receives a concrete light/dark value.
    root.setAttribute('data-rb-theme', resolved);
    root.setAttribute('data-rb-theme-setting', variant);
    root.style.colorScheme = resolved === 'light' ? 'light' : 'dark';
    try {
        localStorage.setItem('rb-theme-variant', variant);
    }
    catch { }
}
export function getActiveTheme() {
    if (typeof window === 'undefined' || typeof document === 'undefined')
        return null;
    try {
        const stored = localStorage.getItem('rb-theme-variant');
        if (stored === 'dark' || stored === 'light' || stored === 'midnight' || stored === 'system') {
            return stored;
        }
        // Migrate legacy values
        if (stored === 'redbyte-dark')
            return 'dark';
        if (stored === 'instrument')
            return 'light';
    }
    catch { }
    return null;
}
