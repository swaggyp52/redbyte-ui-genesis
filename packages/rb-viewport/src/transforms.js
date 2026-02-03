// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Unified coordinate transform helpers
/**
 * Convert screen coordinates to world coordinates
 */
export function screenToWorld(screenX, screenY, camera) {
    return {
        x: (screenX - camera.x) / camera.zoom,
        y: (screenY - camera.y) / camera.zoom,
    };
}
/**
 * Convert world coordinates to screen coordinates
 */
export function worldToScreen(worldX, worldY, camera) {
    return {
        x: worldX * camera.zoom + camera.x,
        y: worldY * camera.zoom + camera.y,
    };
}
/**
 * Calculate camera position to fit bounds in view
 *
 * @param bounds - Content bounds in world space
 * @param viewportWidth - Viewport width in pixels
 * @param viewportHeight - Viewport height in pixels
 * @param marginPx - Margin around content (default 60px)
 * @param maxZoom - Maximum zoom level (default 4.0)
 */
export function fitToBounds(bounds, viewportWidth, viewportHeight, marginPx = 60, maxZoom = 4.0) {
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    // Empty content - return centered camera
    if (contentWidth === 0 || contentHeight === 0) {
        return { x: viewportWidth / 2, y: viewportHeight / 2, zoom: 1.0 };
    }
    // Calculate zoom to fit content with margin
    const availableWidth = viewportWidth - marginPx * 2;
    const availableHeight = viewportHeight - marginPx * 2;
    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    const zoom = Math.min(scaleX, scaleY, maxZoom, 4.0); // Enforce 4.0 max
    // Center content in viewport
    const contentCenterX = (bounds.minX + bounds.maxX) / 2;
    const contentCenterY = (bounds.minY + bounds.maxY) / 2;
    const x = viewportWidth / 2 - contentCenterX * zoom;
    const y = viewportHeight / 2 - contentCenterY * zoom;
    return { x, y, zoom };
}
/**
 * Snap value to grid
 */
export function snapToGrid(value, gridSize) {
    return Math.round(value / gridSize) * gridSize;
}
