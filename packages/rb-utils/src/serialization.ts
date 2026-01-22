/**
 * Safety helpers for Zustand persistence hydration.
 * Ensures that values coming from storage are always real Sets/Maps.
 */

export function asSet<T>(v: unknown): Set<T> {
    if (v instanceof Set) return v;
    if (Array.isArray(v)) return new Set(v as T[]);
    return new Set<T>();
}

export function asMap<K, V>(v: unknown): Map<K, V> {
    if (v instanceof Map) return v;
    if (Array.isArray(v)) return new Map(v as [K, V][]);
    return new Map<K, V>();
}
