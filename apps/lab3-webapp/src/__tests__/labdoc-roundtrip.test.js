import { describe, it, expect } from 'vitest';
import { createEmptyLabDoc, serializeSnapshot, deserializeSnapshot } from '../store/labStore';
describe('LabDoc roundtrip serialization', () => {
    it('should preserve truthTable data through serialization', () => {
        // Create empty doc
        const doc = createEmptyLabDoc();
        // Add some test data
        doc.truthTable = [
            { b3: 0, b2: 0, b1: 0, b0: 0, seg: [1, 1, 1, 1, 1, 1, 0], isDontCare: false },
            { b3: 0, b2: 0, b1: 0, b0: 1, seg: [0, 1, 1, 0, 0, 0, 0], isDontCare: false },
        ];
        // Serialize and deserialize
        const json = serializeSnapshot(doc);
        const restored = deserializeSnapshot(json);
        // Verify roundtrip
        expect(restored.truthTable).toEqual(doc.truthTable);
        expect(restored.meta.id).toBe(doc.meta.id);
        expect(restored.schemaVersion).toBe(2);
    });
});
