import { beforeEach, describe, expect, it } from 'vitest';
import {
  centerDesignSelectionWithContext,
  designCameraKey,
  forgetDesignCameras,
  keepRegionInView,
  recallDesignCamera,
  rememberDesignCamera,
  readDesignCanvasViewport,
  reconcileDesignCanvasCamera,
} from '../surfaces/designCanvasCamera';

describe('Design canvas camera resize contract', () => {
  it('reports the truthful split host size below the old 640px floor', () => {
    expect(readDesignCanvasViewport(486.9, 521.4)).toEqual({ width: 486, height: 521 });
  });

  it('rejects non-renderable host sizes', () => {
    expect(readDesignCanvasViewport(0, 480)).toBeNull();
    expect(readDesignCanvasViewport(640, Number.NaN)).toBeNull();
  });

  it('preserves zoom and the world point at viewport center when Split narrows the host', () => {
    const camera = { x: -50, y: 20, zoom: 1.25 };
    const previousViewport = { width: 900, height: 600 };
    const nextViewport = { width: 420, height: 540 };
    const beforeWorldCenter = {
      x: (previousViewport.width / 2 - camera.x) / camera.zoom,
      y: (previousViewport.height / 2 - camera.y) / camera.zoom,
    };

    const nextCamera = reconcileDesignCanvasCamera(camera, previousViewport, nextViewport);

    expect(nextCamera).not.toBeNull();
    expect(nextCamera?.zoom).toBe(1.25);
    expect((nextViewport.width / 2 - nextCamera!.x) / nextCamera!.zoom).toBeCloseTo(beforeWorldCenter.x);
    expect((nextViewport.height / 2 - nextCamera!.y) / nextCamera!.zoom).toBeCloseTo(beforeWorldCenter.y);
  });

  it('clamps only translation when the preserved camera would strand every node', () => {
    const nextViewport = { width: 400, height: 300 };
    const nextCamera = reconcileDesignCanvasCamera(
      { x: -1000, y: -600, zoom: 1.25 },
      { width: 900, height: 600 },
      nextViewport,
      [{ x: 200, y: 120 }]
    );

    expect(nextCamera).not.toBeNull();
    expect(nextCamera?.zoom).toBe(1.25);
    const nodeScreenX = 200 * nextCamera!.zoom + nextCamera!.x;
    const nodeScreenY = 120 * nextCamera!.zoom + nextCamera!.y;
    expect(nodeScreenX).toBeGreaterThanOrEqual(48);
    expect(nodeScreenY).toBeGreaterThanOrEqual(48);
  });

  it('restores a real node instead of an empty midpoint for a sparse graph', () => {
    const nextViewport = { width: 400, height: 300 };
    const anchors = [
      { x: -1000, y: -800 },
      { x: 1000, y: 800 },
    ];
    const nextCamera = reconcileDesignCanvasCamera(
      { x: 450, y: 300, zoom: 1 },
      { width: 900, height: 600 },
      nextViewport,
      anchors
    );

    expect(nextCamera).not.toBeNull();
    const visibleAnchors = anchors.filter((anchor) => {
      const screenX = anchor.x * nextCamera!.zoom + nextCamera!.x;
      const screenY = anchor.y * nextCamera!.zoom + nextCamera!.y;
      return screenX >= 48 && screenX <= 352 && screenY >= 48 && screenY <= 252;
    });
    expect(visibleAnchors).toHaveLength(1);
  });

  it('requests the caller fallback for an invalid camera', () => {
    expect(
      reconcileDesignCanvasCamera(
        { x: 0, y: 0, zoom: Number.NaN },
        { width: 900, height: 600 },
        { width: 420, height: 540 }
      )
    ).toBeNull();
  });

  it('rejects non-finite reconciliation viewports', () => {
    expect(
      reconcileDesignCanvasCamera(
        { x: 0, y: 0, zoom: 1 },
        { width: Number.NaN, height: 600 },
        { width: 420, height: 540 }
      )
    ).toBeNull();
  });

  it('does not drift across repeated wide and narrow viewport round trips', () => {
    const wide = { width: 900, height: 600 };
    const narrow = { width: 420, height: 540 };
    const initial = { x: -50, y: 20, zoom: 1.25 };
    const initialWorldCenter = {
      x: (wide.width / 2 - initial.x) / initial.zoom,
      y: (wide.height / 2 - initial.y) / initial.zoom,
    };
    let camera = initial;
    for (let iteration = 0; iteration < 20; iteration += 1) {
      camera = reconcileDesignCanvasCamera(camera, wide, narrow)!;
      camera = reconcileDesignCanvasCamera(camera, narrow, wide)!;
    }

    expect(camera.zoom).toBe(initial.zoom);
    expect((wide.width / 2 - camera.x) / camera.zoom).toBeCloseTo(initialWorldCenter.x, 10);
    expect((wide.height / 2 - camera.y) / camera.zoom).toBeCloseTo(initialWorldCenter.y, 10);
  });

  it('keeps a selected edge node and useful circuit context visible in compact Split view', () => {
    const viewport = { width: 366, height: 378 };
    const graph = [
      { x: 90, y: 120 },
      { x: 90, y: 260 },
      { x: 300, y: 80 },
      { x: 300, y: 190 },
      { x: 300, y: 300 },
      { x: 500, y: 190 },
    ];
    const nextCamera = centerDesignSelectionWithContext(
      { x: -186, y: -48, zoom: 1.25 },
      viewport,
      [graph[0]],
      graph
    );

    expect(nextCamera).not.toBeNull();
    expect(nextCamera?.zoom).toBe(1.25);
    const screenX = (anchor: { x: number }) => anchor.x * nextCamera!.zoom + nextCamera!.x;
    expect(screenX(graph[0])).toBeGreaterThanOrEqual(48);
    expect(screenX(graph[2])).toBeLessThanOrEqual(viewport.width - 48);
  });
});

// Opening the inspector narrows the sheet. The view may slide to keep the selected part on
// it, but it is never rescaled: that is what turned a readable schematic into a small one.
describe('Design canvas camera: a narrower sheet keeps its scale', () => {
  const camera = { x: 40, y: 30, zoom: 1.32 };
  const part = { minX: 100, minY: 100, maxX: 220, maxY: 180 };

  it('returns the very same camera when the selection is already on the sheet', () => {
    expect(keepRegionInView(camera, { width: 900, height: 600 }, part)).toBe(camera);
  });

  it('slides the least distance that brings an off-sheet selection back, at the same zoom', () => {
    // The part's right edge is at 220 * 1.32 + 40 = 330.4; a 300px sheet with a 24px inset ends at 276.
    const next = keepRegionInView(camera, { width: 300, height: 600 }, part);
    expect(next.zoom).toBe(camera.zoom);
    expect(next.y).toBe(camera.y);
    expect(part.maxX * next.zoom + next.x).toBeCloseTo(276, 6);
    expect(next.x - camera.x).toBeCloseTo(276 - 330.4, 6);
  });

  it('slides the other way for a selection left of or above the sheet', () => {
    const offLeft = { x: -400, y: -300, zoom: 1.32 };
    const next = keepRegionInView(offLeft, { width: 900, height: 600 }, part);
    expect(next.zoom).toBe(1.32);
    expect(part.minX * next.zoom + next.x).toBeCloseTo(24, 6);
    expect(part.minY * next.zoom + next.y).toBeCloseTo(24, 6);
  });

  it('shows the leading edge of a selection wider than the sheet instead of zooming out', () => {
    const wide = { minX: 0, minY: 100, maxX: 2000, maxY: 180 };
    const next = keepRegionInView(camera, { width: 600, height: 600 }, wide);
    expect(next.zoom).toBe(camera.zoom);
    expect(wide.minX * next.zoom + next.x).toBeCloseTo(24, 6);
  });

  it('leaves an unusable camera or sheet alone rather than inventing a view', () => {
    const broken = { x: Number.NaN, y: 0, zoom: 1 };
    expect(keepRegionInView(broken, { width: 900, height: 600 }, part)).toBe(broken);
    expect(keepRegionInView(camera, { width: 0, height: 600 }, part)).toBe(camera);
  });
});

describe('Design canvas camera: the working view belongs to a project and a module', () => {
  beforeEach(() => forgetDesignCameras());

  it('keeps one view per project and module', () => {
    const counterTop = designCameraKey('rb-counter', 'top');
    const counterCopyTop = designCameraKey('rb-counter-copy', 'top');
    const counterAdder = designCameraKey('rb-counter', 'adder');
    expect(new Set([counterTop, counterCopyTop, counterAdder]).size).toBe(3);

    rememberDesignCamera(counterTop, { x: 10, y: 20, zoom: 1.5 });
    rememberDesignCamera(counterCopyTop, { x: -5, y: 0, zoom: 0.8 });
    expect(recallDesignCamera(counterTop)).toEqual({ x: 10, y: 20, zoom: 1.5 });
    expect(recallDesignCamera(counterCopyTop)).toEqual({ x: -5, y: 0, zoom: 0.8 });
    expect(recallDesignCamera(counterAdder)).toBeNull();
  });

  it('cannot confuse a project id with a module id that spells the same text', () => {
    expect(designCameraKey('a', 'b:c')).not.toBe(designCameraKey('a:b', 'c'));
    expect(designCameraKey('a', 'b')).not.toBe(designCameraKey('ab', ''));
  });

  it('hands back a copy, so a caller cannot move the remembered view by accident', () => {
    const key = designCameraKey('rb-counter', 'top');
    const given = { x: 1, y: 2, zoom: 1 };
    rememberDesignCamera(key, given);
    given.zoom = 9;
    const first = recallDesignCamera(key)!;
    first.x = 999;
    expect(recallDesignCamera(key)).toEqual({ x: 1, y: 2, zoom: 1 });
  });

  it('does not remember a view that is not a real camera', () => {
    const key = designCameraKey('rb-counter', 'top');
    rememberDesignCamera(key, { x: 0, y: 0, zoom: 1.2 });
    rememberDesignCamera(key, { x: Number.NaN, y: 0, zoom: 1 });
    rememberDesignCamera(key, { x: 0, y: 0, zoom: 0 });
    expect(recallDesignCamera(key)).toEqual({ x: 0, y: 0, zoom: 1.2 });
  });
});
