import { describe, expect, it } from 'vitest';
import {
  centerDesignSelectionWithContext,
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
