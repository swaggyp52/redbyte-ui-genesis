// Copyright © 2025 Connor Angiel — RedByte OS Genesis
let activeCanvasId: string | null = null;

export function setActiveCanvas(id: string | null) {
  activeCanvasId = id;
}

export function isCanvasActive(id: string) {
  return activeCanvasId === id;
}

export function clearIfActive(id: string) {
  if (activeCanvasId === id) activeCanvasId = null;
}

export function getActiveCanvasId() {
  return activeCanvasId;
}
