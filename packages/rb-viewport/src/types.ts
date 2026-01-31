// Copyright © 2025 Connor Angiel — RedByte OS Genesis

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ViewportControls {
  state: ViewportState;
  pan: (dx: number, dy: number) => void;
  zoom: (deltaZoom: number, centerX: number, centerY: number) => void;
  fitToContent: (bounds: ContentBounds) => void;
  reset: () => void;
  toScreenCoords: (worldX: number, worldY: number) => { x: number; y: number };
  toWorldCoords: (screenX: number, screenY: number) => { x: number; y: number };
}

export interface ViewportOptions {
  minZoom?: number;
  maxZoom?: number;
  defaultZoom?: number;
  containerWidth: number;
  containerHeight: number;
}

export type InteractionState =
  | 'idle'
  | 'panning'
  | 'dragging'
  | 'wiring'
  | 'boxSelect'
  | 'blocked';

export interface CanvasInteractionControls {
  state: InteractionState;
  canPan: boolean;
  canWire: boolean;
  canSelect: boolean;
  canDrag: boolean;
  enterState: (state: InteractionState) => void;
  cancelGesture: () => void;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}
