// Copyright Ac 2025 Connor Angiel – RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { buildSelectionMap } from '../Logic3DScene';

describe('Logic3DScene selection sync', () => {
  it('maps selected node IDs to selection flags', () => {
    const nodes = [{ id: 'node-1' }, { id: 'node-2' }];
    const selectedNodeIds = new Set(['node-1']);
    const selectionMap = buildSelectionMap(nodes, selectedNodeIds);

    expect(selectionMap.get('node-1')).toBe(true);
    expect(selectionMap.get('node-2')).toBe(false);
  });
});
