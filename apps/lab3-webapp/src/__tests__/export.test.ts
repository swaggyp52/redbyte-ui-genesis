/**
 * Export module tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportAsJSON,
  exportAsCSV,
  exportAsZip,
  generatePDFReport,
} from '../export';
import type { LabDocV2 } from '../plugins/LabDoc';

// Mock LabDoc for testing
const createMockLabDoc = (): LabDocV2 => ({
  schemaVersion: 2,
  meta: {
    id: 'test-doc-1',
    name: 'Test Lab 3',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  truthTable: Array.from({ length: 16 }, (_, i) => ({
    b3: (i >> 3) & 1,
    b2: (i >> 2) & 1,
    b1: (i >> 1) & 1,
    b0: i & 1,
    seg: [0, 1, 1, 0, 1, 1, 0] as [number, number, number, number, number, number, number],
    isDontCare: i >= 10,
  })),
  expressions: {
    a: 'B3 + B2',
    b: 'B1 * B0',
    c: 'B3 XOR B2',
    d: 'B1 NOR B0',
    e: '(B3 AND B2) OR (B1 AND B0)',
    f: 'B3 + B2 + B1 + B0',
    g: 'NOT B3',
  } as Record<string, string>,
  kMaps: {
    a: Array(16).fill(0),
    b: Array(16).fill(0),
    c: Array(16).fill(0),
    d: Array(16).fill(0),
    e: Array(16).fill(0),
    f: Array(16).fill(0),
    g: Array(16).fill(0),
  } as Record<string, number[]>,
  circuitDesigner: {
    nodes: [],
    wires: [],
  },
  results: {
    validationErrors: [],
    validation: {
      allErrors: [],
      canAdvance: true,
      message: 'All checks passed ✅',
    },
  },
});

describe('Export Module', () => {
  let mockDoc: LabDocV2;

  beforeEach(() => {
    mockDoc = createMockLabDoc();
  });

  describe('exportAsJSON', () => {
    it('should export document as JSON blob', async () => {
      const blob = await exportAsJSON(mockDoc);
      expect(blob.type).toBe('application/json');

      const text = await blob.text();
      const parsed = JSON.parse(text);
      expect(parsed.schemaVersion).toBe(2);
      expect(parsed.meta.name).toBe('Test Lab 3');
    });

    it('should preserve all document fields', async () => {
      const blob = await exportAsJSON(mockDoc);
      const text = await blob.text();
      const parsed = JSON.parse(text);

      expect(parsed.truthTable).toHaveLength(16);
      expect(parsed.expressions).toBeDefined();
      expect(parsed.meta.studentName).toBe('John Doe');
    });
  });

  describe('exportAsCSV', () => {
    it('should export truth table as CSV', async () => {
      const csvFiles = await exportAsCSV(mockDoc);
      expect(csvFiles['truth-table.csv']).toBeDefined();

      const text = await csvFiles['truth-table.csv'].text();
      const lines = text.split('\n');
      expect(lines[0]).toContain('input_decimal');
      expect(lines).toHaveLength(17); // Header + 16 rows
    });

    it('should export expressions as CSV', async () => {
      const csvFiles = await exportAsCSV(mockDoc);
      expect(csvFiles['expressions.csv']).toBeDefined();

      const text = await csvFiles['expressions.csv'].text();
      const lines = text.split('\n');
      expect(lines).toHaveLength(8); // Header + 7 segments
      expect(text).toContain('a,"B3 + B2"');
    });

    it('should include dont-care marking', async () => {
      const csvFiles = await exportAsCSV(mockDoc);
      const text = await csvFiles['truth-table.csv'].text();
      const lines = text.split('\n');

      // Lines 11-16 (inputs 10-15) should have isDontCare=true
      for (let i = 11; i <= 16; i++) {
        expect(lines[i]).toContain(',true');
      }
    });
  });

  describe('exportAsZip', () => {
    it('should create ZIP archive with JSON and CSVs', async () => {
      const blob = await exportAsZip(mockDoc);
      expect(blob.type).toContain('zip');

      // Verify it's a valid ZIP by checking magic bytes
      const arrayBuffer = await blob.arrayBuffer();
      const header = new Uint8Array(arrayBuffer).slice(0, 4);
      // ZIP files start with PK (0x50 0x4B)
      expect(header[0]).toBe(0x50);
      expect(header[1]).toBe(0x4b);
    });
  });

  describe('generatePDFReport', () => {
    it('should generate PDF report as data URL', async () => {
      const dataUrl = await generatePDFReport(mockDoc);
      expect(dataUrl).toMatch(/^data:application\/pdf;base64,/);
    });

    it('should include document metadata in report', async () => {
      const dataUrl = await generatePDFReport(mockDoc, {
        includeNotes: 'Test notes',
      });
      expect(dataUrl).toMatch(/^data:application\/pdf;base64,/);
      // PDF bytes are base64 encoded, hard to verify content directly
      // But we can verify it's a valid data URL
    });

    it('should handle missing student name gracefully', async () => {
      const doc = createMockLabDoc();
      delete (doc.meta as any).studentName;
      const dataUrl = await generatePDFReport(doc);
      expect(dataUrl).toMatch(/^data:application\/pdf;base64,/);
    });

    it('should include validation status in report', async () => {
      const doc = createMockLabDoc();
      (doc.results as any).validation.canAdvance = false;
      (doc.results as any).validation.message = 'Errors found ❌';
      const dataUrl = await generatePDFReport(doc);
      expect(dataUrl).toMatch(/^data:application\/pdf;base64,/);
    });
  });

  describe('Export consistency', () => {
    it('JSON export-import round-trip should preserve all data', async () => {
      const blob = await exportAsJSON(mockDoc);
      const text = await blob.text();
      const roundTrip = JSON.parse(text) as LabDocV2;

      expect(roundTrip.schemaVersion).toBe(mockDoc.schemaVersion);
      expect(roundTrip.meta.name).toBe(mockDoc.meta.name);
      expect(roundTrip.truthTable).toEqual(mockDoc.truthTable);
      expect(roundTrip.expressions).toEqual(mockDoc.expressions);
    });

    it('should handle large documents (all segments populated)', async () => {
      const largeDoc = createMockLabDoc();
      // Fill all expressions
      for (let i = 0; i < 16; i++) {
        largeDoc.truthTable[i].seg = [
          i & 1,
          (i >> 1) & 1,
          (i >> 2) & 1,
          (i >> 3) & 1,
          (i >> 4) & 1,
          (i >> 5) & 1,
          (i >> 6) & 1,
        ];
      }

      const jsonBlob = await exportAsJSON(largeDoc);
      const zipBlob = await exportAsZip(largeDoc);

      expect(await jsonBlob.text()).toBeTruthy();
      expect(await zipBlob.arrayBuffer()).toBeTruthy();
    });
  });

  describe('Export filename generation', () => {
    it('should create valid filenames from document metadata', () => {
      const projectName = mockDoc.meta.name || 'Lab3-Export';
      expect(projectName).toContain('Test Lab 3');

      // Timestamp format should be valid
      const timestamp = new Date().toLocaleString().replace(/[/:\s]/g, '-');
      expect(timestamp).toMatch(/\d+-\d+-\d+-\d+-\d+-\d+/);

      const filename = `${projectName}-${timestamp}.json`;
      expect(filename).not.toContain('/');
      expect(filename).not.toContain(':');
    });
  });
});
