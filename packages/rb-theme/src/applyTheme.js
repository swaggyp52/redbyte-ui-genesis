// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
function resolveThemeVariant(variant) {
    if (variant === 'system') {
        if (typeof window === 'undefined')
            return 'dark';
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
    // The CSS in os-tokens.css uses [data-theme="light"] and [data-theme="midnight"].
    // Default (:root) is dark, so we remove the attribute for dark theme.
    if (resolved === 'dark') {
        root.removeAttribute('data-theme');
    }
    else {
        root.setAttribute('data-theme', resolved);
    }
    // Legacy attribute for components that check this
    root.setAttribute('data-rb-theme', resolved);
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
