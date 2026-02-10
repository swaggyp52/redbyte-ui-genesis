import { describe, test, expect } from 'vitest';
import { migrateV1toV2, createEmptyCircuitDesigner, deserializeSnapshot, validateSnapshotV2 } from '../store/labStore';

describe('LabDoc v2 Migration', () => {
  test('should migrate v1 snapshot to v2 with empty circuitDesigner', () => {
    // Create v1 snapshot (truth table only)
    const v1LabDoc = {
      schemaVersion: 1,
      meta: {
        id: 'test-123',
        name: 'Test Lab',
        createdAt: '2026-02-09T00:00:00Z',
        updatedAt: '2026-02-09T00:00:00Z',
      },
      truthTable: [
        {
          b3: 0, b2: 0, b1: 0, b0: 0,
          seg: [1, 1, 1, 1, 1, 1, 1],
          isDontCare: false,
        },
      ],
      kMaps: {},
      expressions: {},
      results: {},
    };

    const v2Doc = migrateV1toV2(v1LabDoc);

    // Should have schemaVersion 2
    expect(v2Doc.schemaVersion).toBe(2);

    // Should preserve all v1 fields
    expect(v2Doc.meta.id).toEqual(v1LabDoc.meta.id);
    expect(v2Doc.meta.name).toEqual(v1LabDoc.meta.name);
    expect(v2Doc.truthTable).toEqual(v1LabDoc.truthTable);

    // Should add circuitDesigner default
    expect(v2Doc.circuitDesigner).toBeDefined();
    expect(v2Doc.circuitDesigner.nodes).toEqual([]);
    expect(v2Doc.circuitDesigner.wires).toEqual([]);

    // Should add meta.useProByDefault
    expect(v2Doc.meta.useProByDefault).toBe(false);
  });

  test('should validate v2 snapshot', () => {
    const v2Doc = {
      schemaVersion: 2,
      meta: {
        id: 'test-123',
        name: 'Test Lab',
        createdAt: '2026-02-09T00:00:00Z',
        updatedAt: '2026-02-09T00:00:00Z',
        useProByDefault: false,
      },
      truthTable: [],
      kMaps: {},
      expressions: {},
      results: {},
      circuitDesigner: {
        nodes: [],
        wires: [],
        view: { panX: 0, panY: 0, zoom: 1 },
        selection: null,
        metadata: { createdAt: '2026-02-09T00:00:00Z', updatedAt: '2026-02-09T00:00:00Z', toolVersion: '1.0' },
      },
    };

    expect(validateSnapshotV2(v2Doc)).toBe(true);
  });
});
