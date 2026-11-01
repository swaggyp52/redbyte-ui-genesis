import { describe, expect, it } from 'vitest';
import type { HardwareMappingDocumentV2 } from '@redbyte/rb-utils';
import { applyMaterializedPinToHardwareMappingV2 } from '@redbyte/rb-utils';
import {
  applyScalarResourceMetadata,
  buildHardwareMappingV2FromProjectIoRows,
  deriveMappingCompleteness,
  enrichProjectIoRowsWithV2Metadata,
  materializedIoRowsFromHardwareMappingV2,
  synchronizeScalarHardwareMappingV2WithProjectIoRows,
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

  it('does not copy clock metadata onto an unrelated duplicated input', () => {
    const source: HardwareMappingDocumentV2 = {
      schemaVersion: '2.0',
      boardId: 'basys3',
      entries: [{
        kind: 'scalar',
        width: 1,
        id: 'clk',
        direction: 'in',
        nodeId: 'clock-node',
        port: 'out',
        portName: 'CLK',
        label: 'CLK',
        pin: '',
        timingRole: 'clock',
        boardResourceType: 'clock_pin',
      }],
    };

    const synchronized = synchronizeScalarHardwareMappingV2WithProjectIoRows(source, [{
      id: 'reset',
      nodeId: 'reset-node',
      port: 'out',
      label: 'RESET',
      direction: 'in',
      pin: '',
      required: true,
    }]);
    const reset = synchronized.entries[0];

    expect(reset?.kind).toBe('scalar');
    if (reset?.kind === 'scalar') {
      expect(reset.boardResourceType).toBeUndefined();
      expect(reset.timingRole).toBeUndefined();
    }
  });

  it('replaces stale clock metadata when RESET is assigned to a button', () => {
    const source: HardwareMappingDocumentV2 = {
      schemaVersion: '2.0',
      boardId: 'basys3',
      entries: [{
        kind: 'scalar',
        width: 1,
        id: 'reset',
        direction: 'in',
        nodeId: 'reset-node',
        port: 'out',
        portName: 'RESET',
        label: 'RESET',
        pin: 'U18',
        timingRole: 'clock',
        boardResourceType: 'clock_pin',
      }],
    };

    const repaired = applyScalarResourceMetadata(source, 'reset', 'U18');
    const reset = repaired.entries[0];

    expect(reset?.kind).toBe('scalar');
    if (reset?.kind === 'scalar') {
      expect(reset.boardResourceType).toBe('button');
      expect(reset.timingRole).toBe('reset');
    }
  });
  it('infers resource kinds from whole tokens: CARRY is not a seven-segment cathode, Reset (BTNC) is a button', () => {
    const source: HardwareMappingDocumentV2 = {
      schemaVersion: '2.0',
      boardId: 'basys3',
      entries: [
        {
          kind: 'scalar', width: 1, id: 'carry-out', direction: 'out', nodeId: 'carry-out', port: 'in',
          portName: 'CARRY', label: 'CARRY', pin: 'W18', boardResourceType: 'led',
        },
        {
          kind: 'scalar', width: 1, id: 'reset', direction: 'in', nodeId: 'reset-node', port: 'out',
          portName: 'RESET', label: 'Reset (BTNC)', pin: '',
        },
      ],
    };

    const cleared = applyScalarResourceMetadata(source, 'carry-out', '');
    const carry = cleared.entries.find((entry) => entry.id === 'carry-out');
    expect(carry?.kind).toBe('scalar');
    if (carry?.kind === 'scalar') expect(carry.boardResourceType).not.toBe('seven_seg');

    const withReset = applyScalarResourceMetadata(source, 'reset', '');
    const reset = withReset.entries.find((entry) => entry.id === 'reset');
    if (reset?.kind === 'scalar') expect(reset.boardResourceType).toBe('button');
  });
});
