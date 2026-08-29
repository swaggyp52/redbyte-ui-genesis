// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  SEMANTIC_ZOOM_DETAIL_FROM,
  SEMANTIC_ZOOM_FALLBACK,
  SEMANTIC_ZOOM_MAX,
  SEMANTIC_ZOOM_MIN,
  SEMANTIC_ZOOM_OVERVIEW_BELOW,
  clampSemanticZoom,
  projectSemanticZoom,
  resolveSemanticZoomTier,
  type SemanticZoomObjectKind,
  type SemanticZoomTier,
} from '../semanticZoomProjection';

const IDLE = { selected: false, focused: false } as const;

const ALL_KINDS: SemanticZoomObjectKind[] = [
  'module-instance',
  'primitive',
  'port',
  'net-label',
  'diagnostic',
  'value-badge',
];

/** Representative zoom per tier, safely inside each band. */
const ZOOM_FOR_TIER: Record<SemanticZoomTier, number> = {
  overview: 0.3,
  working: 1,
  detail: 2,
};

interface ExpectedFlags {
  visible: boolean;
  showLabel: boolean;
  showDetailAnnotations: boolean;
}

/** Full expected presentation matrix: kind x tier. */
const EXPECTED_MATRIX: Record<SemanticZoomObjectKind, Record<SemanticZoomTier, ExpectedFlags>> = {
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

describe('resolveSemanticZoomTier', () => {
  it('maps zoom bands to tiers with the named threshold constants', () => {
    expect(resolveSemanticZoomTier(SEMANTIC_ZOOM_MIN)).toBe('overview');
    expect(resolveSemanticZoomTier(0.3)).toBe('overview');
    expect(resolveSemanticZoomTier(1)).toBe('working');
    expect(resolveSemanticZoomTier(2)).toBe('detail');
    expect(resolveSemanticZoomTier(SEMANTIC_ZOOM_MAX)).toBe('detail');
  });

  it('treats the overview threshold as exclusive (at threshold => working)', () => {
    expect(resolveSemanticZoomTier(SEMANTIC_ZOOM_OVERVIEW_BELOW)).toBe('working');
    expect(resolveSemanticZoomTier(SEMANTIC_ZOOM_OVERVIEW_BELOW - 0.001)).toBe('overview');
  });

  it('treats the detail threshold as inclusive (at threshold => detail)', () => {
    expect(resolveSemanticZoomTier(SEMANTIC_ZOOM_DETAIL_FROM)).toBe('detail');
    expect(resolveSemanticZoomTier(SEMANTIC_ZOOM_DETAIL_FROM - 0.001)).toBe('working');
  });

  it('clamps out-of-domain zoom into the camera range', () => {
    expect(resolveSemanticZoomTier(0.01)).toBe('overview');
    expect(resolveSemanticZoomTier(100)).toBe('detail');
  });

  it('falls back to the working tier for ANY non-finite zoom (NaN and Infinity alike)', () => {
    expect(clampSemanticZoom(Number.NaN)).toBe(SEMANTIC_ZOOM_FALLBACK);
    expect(clampSemanticZoom(Number.POSITIVE_INFINITY)).toBe(SEMANTIC_ZOOM_FALLBACK);
    expect(resolveSemanticZoomTier(Number.NaN)).toBe('working');
    expect(resolveSemanticZoomTier(Number.POSITIVE_INFINITY)).toBe('working');
    expect(resolveSemanticZoomTier(Number.NEGATIVE_INFINITY)).toBe('working');
  });
});

describe('projectSemanticZoom — full kind x tier matrix (idle context)', () => {
  for (const kind of ALL_KINDS) {
    for (const tier of ['overview', 'working', 'detail'] as SemanticZoomTier[]) {
      it(`${kind} at ${tier} zoom`, () => {
        const projection = projectSemanticZoom(ZOOM_FOR_TIER[tier], kind, IDLE);
        expect(projection.tier).toBe(tier);
        expect(projection.baseTier).toBe(tier);
        expect(projection.promoted).toBe(false);
        expect(projection.visible).toBe(EXPECTED_MATRIX[kind][tier].visible);
        expect(projection.showLabel).toBe(EXPECTED_MATRIX[kind][tier].showLabel);
        expect(projection.showDetailAnnotations).toBe(
          EXPECTED_MATRIX[kind][tier].showDetailAnnotations,
        );
      });
    }
  }

  it('keeps value badges non-interactive and every other visible kind interactive', () => {
    for (const kind of ALL_KINDS) {
      const projection = projectSemanticZoom(ZOOM_FOR_TIER.detail, kind, IDLE);
      expect(projection.interactive).toBe(kind !== 'value-badge');
    }
  });

  it('never exposes an invisible object as interactive', () => {
    for (const kind of ALL_KINDS) {
      const projection = projectSemanticZoom(ZOOM_FOR_TIER.overview, kind, IDLE);
      if (!projection.visible) expect(projection.interactive).toBe(false);
    }
  });
});

describe('projectSemanticZoom — selection/focus promotion', () => {
  const CONTEXTS = [
    { selected: true, focused: false },
    { selected: false, focused: true },
    { selected: true, focused: true },
  ] as const;

  for (const context of CONTEXTS) {
    const label = `selected=${context.selected} focused=${context.focused}`;
    it(`promotes every kind to at least working at overview zoom (${label})`, () => {
      for (const kind of ALL_KINDS) {
        const projection = projectSemanticZoom(ZOOM_FOR_TIER.overview, kind, context);
        expect(projection.tier).toBe('working');
        expect(projection.baseTier).toBe('overview');
        expect(projection.promoted).toBe(true);
        expect(projection.visible).toBe(true);
      }
    });
  }

  it('promoted objects present working-tier flags (e.g. hidden port becomes visible without label)', () => {
    const projection = projectSemanticZoom(ZOOM_FOR_TIER.overview, 'port', {
      selected: true,
      focused: false,
    });
    expect(projection.visible).toBe(true);
    expect(projection.showLabel).toBe(false);
    expect(projection.showDetailAnnotations).toBe(false);
    expect(projection.interactive).toBe(true);
  });

  it('does not demote detail-tier objects (promotion is a floor, not a ceiling)', () => {
    for (const kind of ALL_KINDS) {
      const projection = projectSemanticZoom(3, kind, { selected: true, focused: true });
      expect(projection.tier).toBe('detail');
      expect(projection.baseTier).toBe('detail');
      expect(projection.promoted).toBe(false);
      expect(projection.showDetailAnnotations).toBe(true);
    }
  });

  it('is a no-op at working zoom (already at the promotion floor)', () => {
    for (const kind of ALL_KINDS) {
      const idle = projectSemanticZoom(1, kind, IDLE);
      const emphasized = projectSemanticZoom(1, kind, { selected: true, focused: false });
      expect(emphasized.tier).toBe(idle.tier);
      expect(emphasized.promoted).toBe(false);
      expect(emphasized.visible).toBe(idle.visible);
      expect(emphasized.showLabel).toBe(idle.showLabel);
    }
  });
});

describe('projectSemanticZoom — determinism', () => {
  it('returns identical projections for identical inputs', () => {
    const first = projectSemanticZoom(0.42, 'net-label', { selected: false, focused: true });
    const second = projectSemanticZoom(0.42, 'net-label', { selected: false, focused: true });
    expect(second).toEqual(first);
  });
});
