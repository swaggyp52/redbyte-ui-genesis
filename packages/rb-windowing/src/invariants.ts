// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { WindowState } from './types';

/**
 * Asserts that window state invariants hold.
 * Only runs in development mode (process.env.NODE_ENV !== 'production').
 * Throws descriptive errors if invariants are violated.
 */
export function assertWindowInvariants(windows: WindowState[]): void {
  // Skip in production for performance
  if (process.env.NODE_ENV === 'production') return;

  // Invariant 1: At most one focused window
  const focusedWindows = windows.filter((w) => w.focused && w.mode !== 'minimized');
  if (focusedWindows.length > 1) {
    throw new Error(
      `Invariant violation: Multiple focused windows detected.\n` +
      `Expected: At most 1 focused non-minimized window\n` +
      `Actual: ${focusedWindows.length} focused windows\n` +
      `IDs: ${focusedWindows.map((w) => w.id).join(', ')}`
    );
  }

  // Invariant 2: Unique z-index values
  const zIndexes = windows.map((w) => w.zIndex);
  const uniqueZIndexes = new Set(zIndexes);
  if (zIndexes.length !== uniqueZIndexes.size) {
    const duplicates = zIndexes.filter((z, i) => zIndexes.indexOf(z) !== i);
    throw new Error(
      `Invariant violation: Duplicate z-index values detected.\n` +
      `Expected: All z-index values unique\n` +
      `Actual: Duplicates found: ${[...new Set(duplicates)].join(', ')}`
    );
  }

  // Invariant 3: Focus validity (focused windows must not be minimized)
  const invalidFocused = windows.filter((w) => w.focused && w.mode === 'minimized');
  if (invalidFocused.length > 0) {
    throw new Error(
      `Invariant violation: Minimized window is focused.\n` +
      `Expected: Focused windows must not be minimized\n` +
      `Actual: ${invalidFocused.length} minimized focused window(s)\n` +
      `IDs: ${invalidFocused.map((w) => w.id).join(', ')}`
    );
  }

  // Invariant 4: Z-index values are positive integers
  const invalidZIndexes = windows.filter((w) => w.zIndex < 1 || !Number.isInteger(w.zIndex));
  if (invalidZIndexes.length > 0) {
    throw new Error(
      `Invariant violation: Invalid z-index values detected.\n` +
      `Expected: All z-index values are positive integers (>= 1)\n` +
      `Actual: ${invalidZIndexes.length} window(s) with invalid z-index\n` +
      `Details: ${invalidZIndexes.map((w) => `${w.id}:${w.zIndex}`).join(', ')}`
    );
  }
}

/**
 * Helper to get the focused window from a window list.
 * Used for testing and validation.
 */
export function getFocusedWindow(windows: WindowState[]): WindowState | null {
  const focused = windows.find((w) => w.focused && w.mode !== 'minimized');
  return focused || null;
}

/**
 * Helper to check if invariants hold without throwing.
 * Useful for testing.
 */
export function checkWindowInvariants(windows: WindowState[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const focusedWindows = windows.filter((w) => w.focused && w.mode !== 'minimized');
  if (focusedWindows.length > 1) {
    errors.push(`Multiple focused windows: ${focusedWindows.length}`);
  }

  const zIndexes = windows.map((w) => w.zIndex);
  const uniqueZIndexes = new Set(zIndexes);
  if (zIndexes.length !== uniqueZIndexes.size) {
    errors.push('Duplicate z-index values');
  }

  const invalidFocused = windows.filter((w) => w.focused && w.mode === 'minimized');
  if (invalidFocused.length > 0) {
    errors.push(`Minimized focused windows: ${invalidFocused.length}`);
  }

  const invalidZIndexes = windows.filter((w) => w.zIndex < 1 || !Number.isInteger(w.zIndex));
  if (invalidZIndexes.length > 0) {
    errors.push(`Invalid z-index values: ${invalidZIndexes.length}`);
  }

  return { valid: errors.length === 0, errors };
}
