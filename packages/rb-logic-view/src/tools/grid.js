import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Render an infinite grid using SVG
 */
export function renderGrid(camera, width, height, config) {
    const { size, color, majorLineInterval = 5, majorLineColor = '#444' } = config;
    const lines = [];
    // Calculate visible grid range
    const startX = Math.floor(-camera.x / (size * camera.zoom)) * size;
    const endX = Math.ceil((width - camera.x) / (size * camera.zoom)) * size;
    const startY = Math.floor(-camera.y / (size * camera.zoom)) * size;
    const endY = Math.ceil((height - camera.y) / (size * camera.zoom)) * size;
    let lineKey = 0;
    // Vertical lines
    for (let x = startX; x <= endX; x += size) {
        const screenX = x * camera.zoom + camera.x;
        const isMajor = x % (size * majorLineInterval) === 0;
        lines.push(_jsx("line", { x1: screenX, y1: 0, x2: screenX, y2: height, stroke: isMajor ? majorLineColor : color, strokeWidth: isMajor ? 1 : 0.5, opacity: isMajor ? 0.4 : 0.2 }, `v${lineKey++}`));
    }
    // Horizontal lines
    for (let y = startY; y <= endY; y += size) {
        const screenY = y * camera.zoom + camera.y;
        const isMajor = y % (size * majorLineInterval) === 0;
        lines.push(_jsx("line", { x1: 0, y1: screenY, x2: width, y2: screenY, stroke: isMajor ? majorLineColor : color, strokeWidth: isMajor ? 1 : 0.5, opacity: isMajor ? 0.4 : 0.2 }, `h${lineKey++}`));
    }
    return _jsx("g", { children: lines });
}
