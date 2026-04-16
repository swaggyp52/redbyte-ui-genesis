import { describe, expect, it } from 'vitest';
import type { HardwareMappingDocumentV2 } from '@redbyte/rb-utils';
import { applyMaterializedPinToHardwareMappingV2 } from '@redbyte/rb-utils';
import {
  buildHardwareMappingV2FromProjectIoRows,
  deriveMappingCompleteness,
  enrichProjectIoRowsWithV2Metadata,
  materializedIoRowsFromHardwareMappingV2,
} from '../hardwareMappingBridge';

describe('hardwareMappingBridge', () => {
  describe('deriveMappingCompleteness', () => {
    it('marks required rows without a pin as unmapped', () => {
      expect(deriveMappingCompleteness({ required: true, pin: '' })).toBe('unmapped');
      expect(deriveMappingCompleteness({ required: true, pin: '   ' })).toBe('unmapped');
    });

    it('marks required rows with a pin as complete', () => {
      expect(deriveMappingCompleteness({ required: true, pin: 'V17' })).toBe('complete');
    });

    it('treats optional rows without a pin as partial', () => {
      expect(deriveMappingCompleteness({ required: false, pin: '' })).toBe('partial');
    });

    it('treats optional rows with a pin as complete', () => {
      expect(deriveMappingCompleteness({ required: false, pin: 'U16' })).toBe('complete');
    });
  });

  describe('enrichProjectIoRowsWithV2Metadata', () => {
    it('applies slice bit metadata for synthetic ids', () => {
      const v2: HardwareMappingDocumentV2 = {
        schemaVersion: '2.0',
        boardId: 'basys3',
        entries: [
          {
            kind: 'slice',
            id: 'data',
            direction: 'in',
            portName: 'data',
            nodeId: 'n1',
            port: 'out',
            msb: 1,
            lsb: 0,
            pins: ['V1', 'V2'],
            timingRole: 'generic',
            boardResourceType: 'switch',
          },
        ],
      };
      const rows = [
        {
          id: 'data[0]',
          nodeId: 'n1',
          port: 'out',
          label: 'data[0]',
          direction: 'in' as const,
          pin: 'V1',
          required: true,
        },
      ];
      const enriched = enrichProjectIoRowsWithV2Metadata(rows, v2);
      expect(enriched[0]?.mappingKind).toBe('slice');
      expect(enriched[0]?.boardResourceType).toBe('switch');
    });
  });

  describe('materializedIoRowsFromHardwareMappingV2', () => {
    it('reflects pin updates applied on the V2 document', () => {
      const doc: HardwareMappingDocumentV2 = {
        schemaVersion: '2.0',
        boardId: 'basys3',
        entries: [
          {
            kind: 'scalar',
            id: 'a',
            direction: 'in',
            width: 1,
            portName: 'a',
            nodeId: 'n1',
            port: 'out',
            label: 'a',
            pin: '',
          },
        ],
      };
      const pinned = applyMaterializedPinToHardwareMappingV2(doc, 'a', 'V17');
      const rows = materializedIoRowsFromHardwareMappingV2(pinned);
      expect(rows[0]?.pin).toBe('V17');
    });
  });

  describe('buildHardwareMappingV2FromProjectIoRows', () => {
    it('persists timing and resource hints on scalar entries', () => {
      const doc = buildHardwareMappingV2FromProjectIoRows([
        {
          id: 'clk',
          nodeId: 'clk',
          port: 'out',
          label: 'clk',
          direction: 'in',
          pin: 'E3',
          required: true,
          timingRole: 'clock',
          boardResourceType: 'clock_pin',
        },
      ]);
      const scalar = doc.entries.find((e) => e.id === 'clk');
      expect(scalar?.kind).toBe('scalar');
      if (scalar?.kind === 'scalar') {
        expect(scalar.timingRole).toBe('clock');
        expect(scalar.boardResourceType).toBe('clock_pin');
      }
    });
  });
});
