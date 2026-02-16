/**
 * Deterministic string comparison using Unicode codepoint order.
 * Unlike localeCompare, this produces identical results regardless of
 * host locale, ICU version, or environment defaults.
 */
export function compareCodepoint(a, b) {
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
/** Sort an array of strings in deterministic codepoint order (in place). */
export function sortCodepoint(values) {
    return values.sort(compareCodepoint);
}
/** Sort an array of items by key selector using deterministic codepoint order (in place). */
export function sortByCodepoint(items, keyFn) {
    return items.sort((a, b) => compareCodepoint(keyFn(a), keyFn(b)));
}
