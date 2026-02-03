// Copyright © 2025 Connor Angiel — RedByte OS Genesis
let activeCanvasId = null;
export function setActiveCanvas(id) {
    activeCanvasId = id;
}
export function isCanvasActive(id) {
    return activeCanvasId === id;
}
export function clearIfActive(id) {
    if (activeCanvasId === id)
        activeCanvasId = null;
}
export function getActiveCanvasId() {
    return activeCanvasId;
}
