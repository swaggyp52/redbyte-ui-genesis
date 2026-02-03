// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, expect, it } from 'vitest';
import { getSchematicViewBounds, getVisibleSchematicNodes } from '../components/SchematicView';
describe('schematic viewport culling', () => {
    it('filters render nodes without mutating selection state', () => {
        const nodes = [
            { id: 'near', x: 0, y: 0 },
            { id: 'far', x: 5000, y: 5000 },
        ];
        const selectedNodeIds = new Set(['far']);
        const nearBounds = getSchematicViewBounds({ x: 0, y: 0, zoom: 1 }, 800, 600);
        const nearVisible = getVisibleSchematicNodes(nodes, nearBounds).map((node) => node.id);
        expect(nearVisible).toEqual(['near']);
        expect(selectedNodeIds.has('far')).toBe(true);
        const farBounds = getSchematicViewBounds({ x: -5000, y: -5000, zoom: 1 }, 800, 600);
        const farVisible = getVisibleSchematicNodes(nodes, farBounds).map((node) => node.id);
        expect(farVisible).toContain('far');
        expect(selectedNodeIds.has('far')).toBe(true);
    });
});
