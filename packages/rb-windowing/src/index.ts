/**
 * @redbyte/rb-windowing — OS windowing system stub.
 *
 * This package was part of the OS-era shell and was not ported to the IDE Lab Shell.
 * It is retained as a minimal stub so that:
 *  1. The vitest.config.ts alias (`@redbyte/rb-windowing` → this file) resolves without error.
 *  2. Tests that use this module can apply vi.mock('@redbyte/rb-windowing', ...) correctly.
 *
 * Active IDE code does not import this package at runtime (useWindowActivity is dead code).
 * If any file transitively imports this stub at runtime, that import chain is dead code.
 */

export function useWindowStore<T>(
  selector: (state: { windows: { id: string; focused: boolean; mode: string }[] }) => T,
  _equality?: (a: T, b: T) => boolean,
): T {
  return selector({ windows: [] });
}
