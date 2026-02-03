/**
 * Classroom Edition (CE) Mode Configuration
 *
 * Provides runtime flag to enable teaching-optimized defaults:
 * - autosave + restore enabled
 * - safe tick rate cap
 * - build view as default
 * - examples gallery visible
 * - export/submit bundle visible
 * - reset button visible
 * - help overlay accessible
 *
 * Activate via:
 * - ?ce=1 (query parameter)
 * - VITE_CLASSROOM=true (environment variable)
 */
const DEFAULT_CE_CONFIG = {
    enabled: false,
    autosaveEnabled: true,
    tickRateCapped: true,
    defaultPerspective: 'build',
    examplesVisible: true,
    exportVisible: true,
    resetVisible: true,
    helpOverlayAccessible: true,
    autosaveIntervalMs: 3000,
};
/**
 * Detect CE mode from query params or environment
 */
export const detectCEMode = () => {
    if (typeof window === 'undefined')
        return false;
    // Check query param
    const params = new URLSearchParams(window.location.search);
    if (params.get('ce') === '1')
        return true;
    // Check Vite env var (injected at build time)
    if (import.meta.env.VITE_CLASSROOM === 'true')
        return true;
    return false;
};
/**
 * Get full CE configuration
 */
export const getCEConfig = () => {
    const enabled = detectCEMode();
    if (!enabled) {
        return { ...DEFAULT_CE_CONFIG, enabled: false };
    }
    return { ...DEFAULT_CE_CONFIG, enabled: true };
};
/**
 * Storage key for CE runtime state
 */
export const CE_STORAGE_KEY = 'rb:classroom:v1';
/**
 * Save CE state to localStorage
 */
export const saveCEState = (state) => {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.setItem(CE_STORAGE_KEY, JSON.stringify(state));
    }
    catch { }
};
/**
 * Load CE state from localStorage
 */
export const loadCEState = () => {
    if (typeof localStorage === 'undefined')
        return {};
    try {
        const stored = localStorage.getItem(CE_STORAGE_KEY);
        if (stored)
            return JSON.parse(stored);
    }
    catch { }
    return {};
};
/**
 * Clear all CE state (used by reset button)
 */
export const clearCEState = () => {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.removeItem(CE_STORAGE_KEY);
    }
    catch { }
};
