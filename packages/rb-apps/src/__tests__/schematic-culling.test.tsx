// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, expect, it } from 'vitest';
import { getCanvasViewBounds, getVisibleCanvasNodes } from '@redbyte/rb-logic-view';

describe('schematic viewport culling', () => {
  it('filters render nodes without mutating selection state', () => {
    const nodes = [
      { id: 'near', type: 'INPUT', position: { x: 0, y: 0 } },
      { id: 'far', type: 'INPUT', position: { x: 5000, y: 5000 } },
    ];
    const selectedNodeIds = new Set(['far']);
    const originalNodes = JSON.stringify(nodes);

    const nearBounds = getCanvasViewBounds({ x: 0, y: 0, zoom: 1 }, 800, 600);
    const nearVisible = getVisibleCanvasNodes(nodes, nearBounds).map((node) => node.id);

    expect(nearVisible).toEqual(['near']);
    expect(selectedNodeIds.has('far')).toBe(true);

    const farBounds = getCanvasViewBounds({ x: -5000, y: -5000, zoom: 1 }, 800, 600);
    const farVisible = getVisibleCanvasNodes(nodes, farBounds).map((node) => node.id);

    expect(farVisible).toContain('far');
    expect(JSON.stringify(nodes)).toBe(originalNodes);
    expect(nodes.map((node) => node.id)).toEqual(['near', 'far']);
    expect(selectedNodeIds.has('far')).toBe(true);
  });
});
