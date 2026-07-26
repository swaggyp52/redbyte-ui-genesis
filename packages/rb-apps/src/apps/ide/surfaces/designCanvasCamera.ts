export interface DesignCanvasViewport {
  width: number;
  height: number;
}

export interface DesignCanvasCamera {
  x: number;
  y: number;
  zoom: number;
}

export interface DesignCanvasGraphAnchor {
  x: number;
  y: number;
}

export function readDesignCanvasViewport(
  width: number,
  height: number
): DesignCanvasViewport | null {
  const measuredWidth = Math.floor(width);
  const measuredHeight = Math.floor(height);
  if (
    !Number.isFinite(measuredWidth) ||
    !Number.isFinite(measuredHeight) ||
    measuredWidth <= 0 ||
    measuredHeight <= 0
  ) {
    return null;
  }
  return { width: measuredWidth, height: measuredHeight };
}

function isFiniteCamera(camera: DesignCanvasCamera): boolean {
  return (
    Number.isFinite(camera.x) &&
    Number.isFinite(camera.y) &&
    Number.isFinite(camera.zoom) &&
    camera.zoom > 0
  );
}

function isFiniteGraphAnchor(anchor: DesignCanvasGraphAnchor): boolean {
  return Number.isFinite(anchor.x) && Number.isFinite(anchor.y);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Reconciles a camera after its real host changes size.
 *
 * The world point at the old viewport center remains at the new viewport center,
 * preserving the student's zoom and pan intent. If that would leave every node
 * anchor outside the useful viewport, translation is clamped just far enough to
 * restore the nearest real node anchor without resetting zoom.
 */
export function reconcileDesignCanvasCamera(
  camera: DesignCanvasCamera,
  previousViewport: DesignCanvasViewport,
  nextViewport: DesignCanvasViewport,
  graphAnchors: readonly DesignCanvasGraphAnchor[] = []
): DesignCanvasCamera | null {
  if (!isFiniteCamera(camera)) return null;
  if (
    !Number.isFinite(previousViewport.width) ||
    !Number.isFinite(previousViewport.height) ||
    !Number.isFinite(nextViewport.width) ||
    !Number.isFinite(nextViewport.height) ||
    previousViewport.width <= 0 ||
    previousViewport.height <= 0 ||
    nextViewport.width <= 0 ||
    nextViewport.height <= 0
  ) {
    return null;
  }

  const worldCenterX = (previousViewport.width / 2 - camera.x) / camera.zoom;
  const worldCenterY = (previousViewport.height / 2 - camera.y) / camera.zoom;
  let x = nextViewport.width / 2 - worldCenterX * camera.zoom;
  let y = nextViewport.height / 2 - worldCenterY * camera.zoom;

  const finiteGraphAnchors = graphAnchors.filter(isFiniteGraphAnchor);
  if (finiteGraphAnchors.length > 0) {
    const horizontalInset = Math.min(48, nextViewport.width / 4);
    const verticalInset = Math.min(48, nextViewport.height / 4);
    const anchorIsVisible = (anchor: DesignCanvasGraphAnchor) => {
      const screenX = anchor.x * camera.zoom + x;
      const screenY = anchor.y * camera.zoom + y;
      return (
        screenX >= horizontalInset &&
        screenX <= nextViewport.width - horizontalInset &&
        screenY >= verticalInset &&
        screenY <= nextViewport.height - verticalInset
      );
    };
    if (finiteGraphAnchors.some(anchorIsVisible)) {
      return { x, y, zoom: camera.zoom };
    }

    const nearestAnchor = finiteGraphAnchors.reduce((nearest, candidate) => {
      const nearestDistance =
        (nearest.x - worldCenterX) ** 2 + (nearest.y - worldCenterY) ** 2;
      const candidateDistance =
        (candidate.x - worldCenterX) ** 2 + (candidate.y - worldCenterY) ** 2;
      return candidateDistance < nearestDistance ? candidate : nearest;
    });
    const screenAnchorX = nearestAnchor.x * camera.zoom + x;
    const screenAnchorY = nearestAnchor.y * camera.zoom + y;
    const clampedAnchorX = clamp(
      screenAnchorX,
      horizontalInset,
      nextViewport.width - horizontalInset
    );
    const clampedAnchorY = clamp(
      screenAnchorY,
      verticalInset,
      nextViewport.height - verticalInset
    );
    x += clampedAnchorX - screenAnchorX;
    y += clampedAnchorY - screenAnchorY;
  }

  return { x, y, zoom: camera.zoom };
}

/**
 * Focuses a selection without throwing the rest of a compact circuit away.
 *
 * The selected bounds stay inside a safe viewport inset. Within that budget,
 * the camera moves toward the full graph center so a narrow Split view retains
 * enough surrounding logic for the student to understand what was selected.
 */
export function centerDesignSelectionWithContext(
  camera: DesignCanvasCamera,
  viewport: DesignCanvasViewport,
  selectionAnchors: readonly DesignCanvasGraphAnchor[],
  graphAnchors: readonly DesignCanvasGraphAnchor[],
  safeInset = 48
): DesignCanvasCamera | null {
  if (!isFiniteCamera(camera)) return null;
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return null;
  }

  const selected = selectionAnchors.filter(isFiniteGraphAnchor);
  if (selected.length === 0) return null;
  const graph = graphAnchors.filter(isFiniteGraphAnchor);
  const context = graph.length > 0 ? graph : selected;

  const bounds = (anchors: readonly DesignCanvasGraphAnchor[]) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const anchor of anchors) {
      minX = Math.min(minX, anchor.x);
      maxX = Math.max(maxX, anchor.x);
      minY = Math.min(minY, anchor.y);
      maxY = Math.max(maxY, anchor.y);
    }
    return { minX, maxX, minY, maxY };
  };

  const selectionBounds = bounds(selected);
  const graphBounds = bounds(context);
  const selectionCenterX = (selectionBounds.minX + selectionBounds.maxX) / 2;
  const selectionCenterY = (selectionBounds.minY + selectionBounds.maxY) / 2;
  const graphCenterX = (graphBounds.minX + graphBounds.maxX) / 2;
  const graphCenterY = (graphBounds.minY + graphBounds.maxY) / 2;
  const selectionHalfWidth = (selectionBounds.maxX - selectionBounds.minX) / 2;
  const selectionHalfHeight = (selectionBounds.maxY - selectionBounds.minY) / 2;
  const horizontalInset = Math.min(safeInset, viewport.width / 4) / camera.zoom;
  const verticalInset = Math.min(safeInset, viewport.height / 4) / camera.zoom;
  const horizontalContextBudget = Math.max(
    0,
    viewport.width / (2 * camera.zoom) - horizontalInset - selectionHalfWidth
  );
  const verticalContextBudget = Math.max(
    0,
    viewport.height / (2 * camera.zoom) - verticalInset - selectionHalfHeight
  );
  const worldCenterX = clamp(
    graphCenterX,
    selectionCenterX - horizontalContextBudget,
    selectionCenterX + horizontalContextBudget
  );
  const worldCenterY = clamp(
    graphCenterY,
    selectionCenterY - verticalContextBudget,
    selectionCenterY + verticalContextBudget
  );

  return {
    x: viewport.width / 2 - worldCenterX * camera.zoom,
    y: viewport.height / 2 - worldCenterY * camera.zoom,
    zoom: camera.zoom,
  };
}
