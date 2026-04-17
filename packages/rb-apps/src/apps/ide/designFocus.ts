// Copyright (c) 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Minimal app-level focus-routing primitive.
 *
 * A `DesignFocusRequest` is a one-shot ticket issued by the Project surface
 * (or any future navigator) to tell the Design surface "focus this reusable
 * asset when the student lands here." The Design surface consumes it by
 * reusing its existing selection/palette/insertion authorities:
 *
 *   - kind === 'macro'             → armed for click-to-place insertion
 *   - kind === 'custom-component'  → palette query filters to the component
 *
 * Deliberately a thin value type — not a parallel selection authority. The
 * Design surface is still the single source of truth for what is actually
 * selected/active; this primitive only hands it a pointer to focus.
 *
 * Must not drift into diagnostic routing (`IdeDiagnosticRouteRequest`),
 * which is a separate concern owned by the diagnostics system.
 */

export type DesignFocusKind = 'macro' | 'custom-component';

export interface DesignFocusRequest {
  /** Monotonic id so consumers can run effects on each new request, not each render. */
  requestId: number;
  kind: DesignFocusKind;
  /** Authoritative identifier of the target asset (macro id or component name). */
  targetId: string;
  /** Human-readable label — used as fallback palette query when no tighter hook exists. */
  displayName: string;
}

let focusRequestCounter = 0;

export function createDesignFocusRequest(
  kind: DesignFocusKind,
  targetId: string,
  displayName: string,
): DesignFocusRequest {
  focusRequestCounter += 1;
  return {
    requestId: focusRequestCounter,
    kind,
    targetId,
    displayName,
  };
}

/** Test-only helper: resets the internal counter so request ids are deterministic. */
export function _resetDesignFocusRequestIdsForTests(): void {
  focusRequestCounter = 0;
}
