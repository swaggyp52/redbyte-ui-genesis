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

export interface DesignCanvasRegion {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * The smallest pan that brings a world-space region inside the viewport, at the camera's own
 * zoom. A region already in view returns the camera untouched; one larger than the viewport is
 * aligned to its leading edge. The zoom is never changed: opening a pane beside the sheet must
 * not rescale the work a student is looking at.
 */
export function keepRegionInView(
  camera: DesignCanvasCamera,
  viewport: DesignCanvasViewport,
  region: DesignCanvasRegion,
  inset = 24
): DesignCanvasCamera {
  if (!isFiniteCamera(camera) || viewport.width <= 0 || viewport.height <= 0) return camera;
  const shift = (start: number, end: number, size: number): number => {
    const pad = Math.min(inset, size / 4);
    if (end - start > size - pad * 2) return pad - start;
    if (start < pad) return pad - start;
    if (end > size - pad) return size - pad - end;
    return 0;
  };
  const dx = shift(region.minX * camera.zoom + camera.x, region.maxX * camera.zoom + camera.x, viewport.width);
  const dy = shift(region.minY * camera.zoom + camera.y, region.maxY * camera.zoom + camera.y, viewport.height);
  return dx === 0 && dy === 0 ? camera : { x: camera.x + dx, y: camera.y + dy, zoom: camera.zoom };
}

/**
 * A sheet and where its top-left sits on the screen. The camera is measured from that corner,
 * so when the corner moves (the library is shown or hidden) the same camera draws every part
 * somewhere else on the screen.
 */
export interface DesignCanvasFrame extends DesignCanvasViewport {
  left: number;
  top: number;
}

/** The world point drawn at the middle of the sheet, or null for an unusable camera or sheet. */
export function designCanvasWorldCenter(
  camera: DesignCanvasCamera,
  viewport: DesignCanvasViewport
): DesignCanvasGraphAnchor | null {
  if (!isFiniteCamera(camera) || viewport.width <= 0 || viewport.height <= 0) return null;
  return {
    x: (viewport.width / 2 - camera.x) / camera.zoom,
    y: (viewport.height / 2 - camera.y) / camera.zoom,
  };
}

/**
 * The camera at `zoom` that draws `point` at the middle of the sheet. A view switch (Schematic,
 * Split, Code) uses it to keep the part of the circuit the student was looking at in the middle
 * of the sheet they chose.
 */
export function centerDesignCanvasOn(
  point: DesignCanvasGraphAnchor,
  viewport: DesignCanvasViewport,
  zoom: number
): DesignCanvasCamera {
  return { x: viewport.width / 2 - point.x * zoom, y: viewport.height / 2 - point.y * zoom, zoom };
}

/**
 * Keeps every part where it is on the screen when the sheet's top-left moves: the camera takes
 * up the move. A sheet whose corner did not move (the inspector opening on the right) returns
 * the very same camera.
 */
export function holdDesignCanvasOnPage(
  camera: DesignCanvasCamera,
  previous: DesignCanvasFrame,
  next: DesignCanvasFrame
): DesignCanvasCamera {
  const dx = previous.left - next.left;
  const dy = previous.top - next.top;
  if (!isFiniteCamera(camera) || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)) return camera;
  return { x: camera.x + dx, y: camera.y + dy, zoom: camera.zoom };
}

/**
 * Where a student was working, per project and module, for this session. Design unmounts when
 * another workspace is opened; without this it reframed the whole circuit on every return and
 * discarded a deliberate zoom. It is view state only and is never saved with the project.
 */
const workingCameras = new Map<string, DesignCanvasCamera>();
/** Keys whose remembered camera is the untouched frame of the work, not a view the student chose. */
const framedCameraKeys = new Set<string>();

export function designCameraKey(projectId: string | null | undefined, moduleId: string): string {
  return `${projectId?.trim() || 'project'}\u0000${moduleId}`;
}

export function rememberDesignCamera(key: string, camera: DesignCanvasCamera, framed = false): void {
  if (!isFiniteCamera(camera)) return;
  workingCameras.set(key, { x: camera.x, y: camera.y, zoom: camera.zoom });
  if (framed) framedCameraKeys.add(key);
  else framedCameraKeys.delete(key);
}

/** Whether the remembered camera is still the untouched frame (it is framed again for a new sheet). */
export function wasFramedDesignCamera(key: string): boolean {
  return framedCameraKeys.has(key);
}

export function recallDesignCamera(key: string): DesignCanvasCamera | null {
  const camera = workingCameras.get(key);
  return camera ? { ...camera } : null;
}

/** Clears the session memory. Used by tests; the app keeps it for the life of the page. */
export function forgetDesignCameras(): void {
  workingCameras.clear();
  framedCameraKeys.clear();
}
