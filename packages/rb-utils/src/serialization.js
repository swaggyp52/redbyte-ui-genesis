/**
 * Safety helpers for Zustand persistence hydration.
 * Ensures that values coming from storage are always real Sets/Maps.
 */
export function asSet(v) {
    if (v instanceof Set)
        return v;
    if (Array.isArray(v))
        return new Set(v);
    return new Set();
}
export function asMap(v) {
    if (v instanceof Map)
        return v;
    if (Array.isArray(v))
        return new Map(v);
    return new Map();
}
