/**
 * Model-driven semantic zoom for the Design canvas.
 *
 * The circuit canvas (`LogicCanvas`/`NodeView`) already renders two density
 * tiers: `dense` (compact, for close editing) and `classroom` (larger nodes,
 * ports, and labels for legibility). DesignSurface used to pin `dense`. This
 * derives the tier from the camera zoom (a model value): once the engineer
 * zooms out past a threshold — reading the whole design rather than editing a
 * corner — the canvas switches to the legible `classroom` tier, and switches
 * back on zoom-in. Hysteresis around the threshold prevents flicker when the
 * zoom hovers exactly on the boundary.
 */

export type SemanticZoomTier = 'dense' | 'classroom';

/** Below this zoom the design is being read/overviewed → legible tier. */
export const SEMANTIC_ZOOM_ENTER_CLASSROOM = 0.72;
/** Above this zoom the design is being edited closely → compact tier. */
export const SEMANTIC_ZOOM_EXIT_CLASSROOM = 0.85;

export function deriveSemanticZoomTier(
  zoom: number,
  previousTier: SemanticZoomTier = 'dense'
): SemanticZoomTier {
  if (!Number.isFinite(zoom)) return previousTier;
  // Hysteresis: only cross a tier boundary once clearly past it.
  if (previousTier === 'classroom') {
    return zoom >= SEMANTIC_ZOOM_EXIT_CLASSROOM ? 'dense' : 'classroom';
  }
  return zoom <= SEMANTIC_ZOOM_ENTER_CLASSROOM ? 'classroom' : 'dense';
}

/** Short human label for the active tier (for the canvas indicator). */
export function semanticZoomTierLabel(tier: SemanticZoomTier): string {
  return tier === 'classroom' ? 'Overview' : 'Detail';
}
