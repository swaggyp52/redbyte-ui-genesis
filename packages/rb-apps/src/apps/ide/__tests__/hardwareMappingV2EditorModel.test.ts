import { describe, expect, it } from 'vitest';
import type { HardwareMappingDocumentV2 } from '@redbyte/rb-utils';
import {
  applyHardwareMappingV2Edit,
  buildStructuredHardwareEntryViews,
  buildSequentialPins,
  parsePinsInput,
} from '../hardwareMappingV2EditorModel';

function makeDoc(): HardwareMappingDocumentV2 {
  return {
    schemaVersion: '2.0',
    boardId: 'basys3',
    entries: [
      {
        kind: 'scalar',
        id: 'reset',
        direction: 'in',
        width: 1,
        portName: 'reset',
        nodeId: 'reset_node',
        port: 'out',
        label: 'reset',
        pin: '',
      },
      {
        kind: 'bus',
        id: 'switch_bus',
        direction: 'in',
        portName: 'sw',
        width: 2,
        bits: [
          { id: 'switch_bus[0]', bitIndex: 0, nodeId: 'sw_node', port: 'out', pin: '' },
          { id: 'switch_bus[1]', bitIndex: 1, nodeId: 'sw_node', port: 'out', pin: '' },
        ],
      },
    ],
  };
}

describe('hardwareMappingV2EditorModel', () => {
  it('maps and clears pins for bus entries', () => {
    const mapped = applyHardwareMappingV2Edit(makeDoc(), {
      type: 'map_entry_pins',
      entryId: 'switch_bus',
      pins: ['V17', 'V16'],
    });
    const bus = mapped.entries.find((entry) => entry.id === 'switch_bus');
    expect(bus?.kind).toBe('bus');
    if (bus?.kind === 'bus') {
      expect(bus.bits.map((bit) => bit.pin)).toEqual(['V17', 'V16']);
    }
    const cleared = applyHardwareMappingV2Edit(mapped, {
      type: 'clear_entry_pins',
      entryId: 'switch_bus',
    });
    const clearedBus = cleared.entries.find((entry) => entry.id === 'switch_bus');
    expect(clearedBus?.kind).toBe('bus');
    if (clearedBus?.kind === 'bus') {
      expect(clearedBus.bits.map((bit) => bit.pin)).toEqual(['', '']);
    }
  });

  it('upserts and removes group entries with member cleanup', () => {
    const withGroup = applyHardwareMappingV2Edit(makeDoc(), {
      type: 'upsert_entry',
      entry: {
        kind: 'group',
        id: 'inputs_group',
        direction: 'in',
        portName: 'inputs',
        memberIds: ['reset', 'switch_bus'],
      },
    });
    expect(withGroup.entries.some((entry) => entry.id === 'inputs_group')).toBe(true);

    const removedMember = applyHardwareMappingV2Edit(withGroup, {
      type: 'remove_entry',
      entryId: 'switch_bus',
    });
    const group = removedMember.entries.find((entry) => entry.id === 'inputs_group');
    expect(group?.kind).toBe('group');
    if (group?.kind === 'group') {
      expect(group.memberIds).toEqual(['reset']);
    }
  });

  it('reports completeness per structured entry', () => {
    const mapped = applyHardwareMappingV2Edit(makeDoc(), {
      type: 'map_entry_pins',
      entryId: 'switch_bus',
      pins: ['V17'],
    });
    const views = buildStructuredHardwareEntryViews(mapped);
    const bus = views.find((entry) => entry.id === 'switch_bus');
    expect(bus?.completeness).toBe('partial');
  });

  it('parses pin input and generates sequential pin aliases', () => {
    expect(parsePinsInput(' sw0, sw1 ,, sw2 ')).toEqual(['SW0', 'SW1', 'SW2']);
    expect(buildSequentialPins('ld', 0, 3)).toEqual(['LD0', 'LD1', 'LD2']);
  });
});
