/**
 * Codepoint-based string comparison for deterministic ordering.
 *
 * Unlike localeCompare, this produces identical results regardless of
 * runtime locale, ICU version, or platform. Use in all determinism-critical
 * paths: zip packing, hashing, export ordering, manifest ordering,
 * bundle ordering, rbproj canonicalization, simulation evidence ordering.
 */
export function compareCodepoint(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Sort an array of strings by codepoint order (in-place).
 */
export function sortCodepoint(values: string[]): string[] {
  return values.sort(compareCodepoint);
}

/**
 * Sort an array of objects by a string key using codepoint order (in-place).
 */
export function sortByCodepoint<T>(items: T[], keyFn: (item: T) => string): T[] {
  return items.sort((a, b) => compareCodepoint(keyFn(a), keyFn(b)));
}
