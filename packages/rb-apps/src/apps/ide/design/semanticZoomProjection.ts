// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Semantic zoom projection — a PURE presentation policy for the Design canvas.
 *
 * Given the current camera zoom, the kind of canvas object, and its
 * selection/focus context, this module answers one question deterministically:
 * "at this zoom, how much of this object should the canvas present?"
 *
 * It owns NO state and reads NO stores. Callers (DesignSurface / LogicCanvas
 * render layers) pass the zoom they already have from useLogicViewStore's
 * camera and apply the returned flags. The zoom domain mirrors the store's
 * camera clamp (0.25–4, useLogicViewStore.ts) and the thresholds sit inside
 * DesignSurface's FIT_ZOOM_STEPS range (0.5–2.4).
 */

export type SemanticZoomTier = 'overview' | 'working' | 'detail';

export type SemanticZoomObjectKind =
  | 'module-instance'
  | 'primitive'
  | 'port'
  | 'net-label'
  | 'diagnostic'
  | 'value-badge';

export interface SemanticZoomObjectContext {
  /** The object is part of the current canvas selection. */
  selected: boolean;
  /** The object is the current inspector/trace focus target. */
  focused: boolean;
}

export interface SemanticZoomProjection {
  /** Effective tier after selection/focus promotion. */
  tier: SemanticZoomTier;
  /** Tier implied by zoom alone, before promotion. */
  baseTier: SemanticZoomTier;
  /** True when selection/focus lifted the object above its base tier. */
  promoted: boolean;
  /** Render the object at all. */
  visible: boolean;
  /** Render the object's text label. */
  showLabel: boolean;
  /** Render close-up annotations (pin names, full values, repair hints). */
  showDetailAnnotations: boolean;
  /** Expose hit targets for pointer interaction. */
  interactive: boolean;
}

/** Camera zoom domain — mirrors useLogicViewStore's clamp (0.25 … 4). */
export const SEMANTIC_ZOOM_MIN = 0.25;
export const SEMANTIC_ZOOM_MAX = 4;

/** Zoom strictly below this value reads as a structural overview. */
export const SEMANTIC_ZOOM_OVERVIEW_BELOW = 0.55;

/** Zoom at or above this value reads as close-up detail work. */
export const SEMANTIC_ZOOM_DETAIL_FROM = 1.4;

/** Zoom used when the input is not a finite number (defensive fallback). */
export const SEMANTIC_ZOOM_FALLBACK = 1;

const TIER_RANK: Record<SemanticZoomTier, number> = {
  overview: 0,
  working: 1,
  detail: 2,
};

interface TierPresentation {
  visible: boolean;
  showLabel: boolean;
  showDetailAnnotations: boolean;
}

/**
 * Presentation matrix. Invariant: every kind is visible at 'working' so that
 * selection/focus promotion (which guarantees at least 'working') always
 * yields a visible object.
 */
const PRESENTATION_MATRIX: Record<
  SemanticZoomObjectKind,
  Record<SemanticZoomTier, TierPresentation>
> = {
  'module-instance': {
    overview: { visible: true, showLabel: false, showDetailAnnotations: false },
    working: { visible: true, showLabel: true, showDetailAnnotations: false },
    detail: { visible: true, showLabel: true, showDetailAnnotations: true },
  },
  primitive: {
    overview: { visible: true, showLabel: false, showDetailAnnotations: false },
    working: { visible: true, showLabel: true, showDetailAnnotations: false },
    detail: { visible: true, showLabel: true, showDetailAnnotations: true },
  },
  port: {
    overview: { visible: false, showLabel: false, showDetailAnnotations: false },
    working: { visible: true, showLabel: false, showDetailAnnotations: false },
    detail: { visible: true, showLabel: true, showDetailAnnotations: true },
  },
  'net-label': {
    overview: { visible: false, showLabel: false, showDetailAnnotations: false },
    working: { visible: true, showLabel: true, showDetailAnnotations: false },
    detail: { visible: true, showLabel: true, showDetailAnnotations: true },
  },
  diagnostic: {
    overview: { visible: true, showLabel: false, showDetailAnnotations: false },
    working: { visible: true, showLabel: true, showDetailAnnotations: false },
    detail: { visible: true, showLabel: true, showDetailAnnotations: true },
  },
  'value-badge': {
    overview: { visible: false, showLabel: false, showDetailAnnotations: false },
    working: { visible: true, showLabel: false, showDetailAnnotations: false },
    detail: { visible: true, showLabel: true, showDetailAnnotations: true },
  },
};

/** Value badges are read-only overlays; everything else takes pointer input. */
const NON_INTERACTIVE_KINDS: ReadonlySet<SemanticZoomObjectKind> = new Set([
  'value-badge',
]);

/** Clamp a zoom value into the camera domain; non-finite input falls back. */
export function clampSemanticZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return SEMANTIC_ZOOM_FALLBACK;
  return Math.min(SEMANTIC_ZOOM_MAX, Math.max(SEMANTIC_ZOOM_MIN, zoom));
}

/** Tier implied by zoom alone (no object context). */
export function resolveSemanticZoomTier(zoom: number): SemanticZoomTier {
  const clamped = clampSemanticZoom(zoom);
  if (clamped < SEMANTIC_ZOOM_OVERVIEW_BELOW) return 'overview';
  if (clamped >= SEMANTIC_ZOOM_DETAIL_FROM) return 'detail';
  return 'working';
}

/**
 * Project one canvas object's presentation for the current zoom.
 * Selected or focused objects are promoted to at least 'working' so the
 * student never loses the thing they are pointing at.
 */
export function projectSemanticZoom(
  zoom: number,
  objectKind: SemanticZoomObjectKind,
  context: SemanticZoomObjectContext,
): SemanticZoomProjection {
  const baseTier = resolveSemanticZoomTier(zoom);
  const emphasized = context.selected || context.focused;
  const tier: SemanticZoomTier =
    emphasized && TIER_RANK[baseTier] < TIER_RANK.working ? 'working' : baseTier;
  const promoted = tier !== baseTier;

  const presentation = PRESENTATION_MATRIX[objectKind][tier];
  // Defense in depth: a promoted (selected/focused) object is always visible,
  // even if the matrix were ever edited to hide its kind at 'working'.
  const visible = presentation.visible || promoted;

  return {
    tier,
    baseTier,
    promoted,
    visible,
    showLabel: presentation.showLabel,
    showDetailAnnotations: presentation.showDetailAnnotations,
    interactive: visible && !NON_INTERACTIVE_KINDS.has(objectKind),
  };
}
