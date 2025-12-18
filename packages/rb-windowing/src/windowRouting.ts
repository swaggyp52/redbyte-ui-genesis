// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { WindowState, WindowId } from './types';

/**
 * PHASE_AC: Deterministic window routing resolver for open-with intents.
 *
 * Pure function: resolveTargetWindowId(appId, preferNewWindow, windows) → windowId | null
 *
 * Routing policy:
 * - If preferNewWindow=true: return null (always create new window)
 * - Get all windows for appId
 * - If no windows exist: return null (create new)
 * - If windows exist:
 *   - Filter to normal/maximized mode windows (skip minimized)
 *   - If focus history available: return most-recently-focused window ID
 *   - Else: return oldest window ID (stable tie-break using ID sort)
 *
 * @param appId - Target app ID (e.g., "text-viewer", "logic-playground")
 * @param preferNewWindow - If true, always create new window (ignores existing)
 * @param windows - Current window store state
 * @returns windowId to reuse, or null to create new window
 */
export function resolveTargetWindowId(
  appId: string,
  preferNewWindow: boolean,
  windows: WindowState[]
): WindowId | null {
  // Prefer new window override → always create new
  if (preferNewWindow) {
    return null;
  }

  // Get all windows for this appId
  const appWindows = windows.filter((w) => w.contentId === appId);

  // No windows exist → create new
  if (appWindows.length === 0) {
    return null;
  }

  // Filter to normal/maximized mode windows (skip minimized)
  const reuseableWindows = appWindows.filter((w) => w.mode !== 'minimized');

  // If all windows minimized → create new
  if (reuseableWindows.length === 0) {
    return null;
  }

  // If focus history available: return most-recently-focused window
  const windowsWithFocusHistory = reuseableWindows.filter((w) => w.lastFocusedAt !== undefined);

  if (windowsWithFocusHistory.length > 0) {
    // Sort by lastFocusedAt descending (most recent first)
    const sorted = [...windowsWithFocusHistory].sort((a, b) => {
      const aTime = a.lastFocusedAt ?? 0;
      const bTime = b.lastFocusedAt ?? 0;
      return bTime - aTime; // Descending
    });
    return sorted[0].id;
  }

  // No focus history → return oldest window (deterministic tie-break using ID sort)
  const sorted = [...reuseableWindows].sort((a, b) => a.id.localeCompare(b.id));
  return sorted[0].id;
}
