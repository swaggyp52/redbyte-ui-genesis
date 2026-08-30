import { describe, expect, it } from 'vitest';
import {
  SEMANTIC_ZOOM_ENTER_CLASSROOM,
  SEMANTIC_ZOOM_EXIT_CLASSROOM,
  deriveSemanticZoomTier,
  semanticZoomTierLabel,
} from '../semanticZoom';

describe('deriveSemanticZoomTier — model-driven semantic zoom', () => {
  it('enters the legible classroom tier when zoomed out', () => {
    expect(deriveSemanticZoomTier(0.5, 'dense')).toBe('classroom');
    expect(deriveSemanticZoomTier(SEMANTIC_ZOOM_ENTER_CLASSROOM, 'dense')).toBe('classroom');
  });

  it('stays dense while zoomed in', () => {
    expect(deriveSemanticZoomTier(1, 'dense')).toBe('dense');
    expect(deriveSemanticZoomTier(0.9, 'dense')).toBe('dense');
  });

  it('applies hysteresis around the boundary to prevent flicker', () => {
    // Between the two thresholds, the tier holds its previous value.
    const mid = (SEMANTIC_ZOOM_ENTER_CLASSROOM + SEMANTIC_ZOOM_EXIT_CLASSROOM) / 2;
    expect(deriveSemanticZoomTier(mid, 'dense')).toBe('dense');
    expect(deriveSemanticZoomTier(mid, 'classroom')).toBe('classroom');
  });

  it('exits classroom only after clearly zooming back in', () => {
    expect(deriveSemanticZoomTier(SEMANTIC_ZOOM_EXIT_CLASSROOM, 'classroom')).toBe('dense');
    expect(deriveSemanticZoomTier(SEMANTIC_ZOOM_EXIT_CLASSROOM - 0.01, 'classroom')).toBe('classroom');
  });

  it('holds the previous tier for a non-finite zoom', () => {
    expect(deriveSemanticZoomTier(Number.NaN, 'classroom')).toBe('classroom');
    expect(deriveSemanticZoomTier(Number.NaN, 'dense')).toBe('dense');
  });

  it('labels the tiers', () => {
    expect(semanticZoomTierLabel('classroom')).toBe('Overview');
    expect(semanticZoomTierLabel('dense')).toBe('Detail');
  });
});
