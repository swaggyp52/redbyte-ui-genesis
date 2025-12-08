// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export type WindowId = string;

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WindowMode = "normal" | "maximized" | "minimized";

export interface WindowState {
  id: WindowId;
  title: string;
  bounds: WindowBounds;
  mode: WindowMode;
  zIndex: number;
  focused: boolean;
  resizable: boolean;
  minimizable: boolean;
  maximizable: boolean;
  contentId: string;
}

export interface CreateWindowOptions {
  title?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  contentId: string;
}
