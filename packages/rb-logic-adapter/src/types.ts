// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export type ViewMode = 'circuit' | 'schematic' | 'isometric' | '3d';

export interface ViewNode {
  id: string;
  type: string;
  view: {
    x: number;
    y: number;
    z?: number;
    w: number;
    h: number;
  };
  ports: { [portName: string]: { x: number; y: number } };
}

export interface ViewWire {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  points?: Array<{ x: number; y: number }>;
}

export interface ViewState {
  nodes: ViewNode[];
  wires: ViewWire[];
}
