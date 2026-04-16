import { describe, expect, it } from 'vitest';
import {
  buildBusEntryFromMemberRows,
  buildGuidedBoundaryOptions,
  buildGuidedHdlCatalogFromText,
  suggestEntryIdFromHdl,
} from '../hardwareMappingGuidance';

describe('hardwareMappingGuidance', () => {
  it('buildGuidedBoundaryOptions keeps only rows with node ids', () => {
    const options = buildGuidedBoundaryOptions([
      { id: 'a', nodeId: 'n1', port: 'out', label: 'Alpha', direction: 'in' },
      { id: 'b', label: 'Beta', direction: 'out' },
    ]);
    expect(options).toHaveLength(1);
    expect(options[0]?.rowId).toBe('a');
    expect(options[0]?.nodeId).toBe('n1');
  });

  it('buildGuidedHdlCatalogFromText groups expanded std_logic_vector bits into one bus entry', () => {
    const vhd = [
      'entity top is',
      '  port (',
      '    sw : in std_logic_vector(1 downto 0);',
      '    y : out std_logic',
      '  );',
      'end top;',
    ].join('\n');
    const catalog = buildGuidedHdlCatalogFromText(vhd);
    const bus = catalog.find((e) => e.kind === 'vector');
    const scalar = catalog.find((e) => e.kind === 'scalar' && e.portName === 'y');
    expect(bus?.kind).toBe('vector');
    if (bus?.kind === 'vector') {
      expect(bus.baseName).toBe('sw');
      expect(bus.msb).toBe(1);
      expect(bus.lsb).toBe(0);
    }
    expect(scalar?.portName).toBe('y');
  });

  it('suggestEntryIdFromHdl returns scalar or bus base name', () => {
    expect(
      suggestEntryIdFromHdl({
        kind: 'scalar',
        key: 'k',
        portName: 'clk',
        direction: 'in',
        displayLabel: 'x',
      }),
    ).toBe('clk');
    expect(
      suggestEntryIdFromHdl({
        kind: 'vector',
        key: 'k',
        baseName: 'data',
        direction: 'out',
        msb: 3,
        lsb: 0,
        displayLabel: 'x',
      }),
    ).toBe('data');
  });

  it('buildBusEntryFromMemberRows wires one node per bit in order', () => {
    const entry = buildBusEntryFromMemberRows({
      entryId: 'sw_bus',
      portName: 'sw',
      direction: 'in',
      memberRows: [
        { rowId: 'sw0', label: 'sw0', nodeId: 'sw0_n', port: 'out', direction: 'in' },
        { rowId: 'sw1', label: 'sw1', nodeId: 'sw1_n', port: 'out', direction: 'in' },
      ],
      pins: ['V17', 'V16'],
    });
    expect(entry?.kind).toBe('bus');
    if (entry?.kind === 'bus') {
      expect(entry.width).toBe(2);
      expect(entry.bits[0]?.nodeId).toBe('sw0_n');
      expect(entry.bits[1]?.pin).toBe('V16');
    }
  });
});
