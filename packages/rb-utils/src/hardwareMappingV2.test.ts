import { describe, expect, it } from 'vitest';
import type { IoMapping } from './labProjectSchema';
import {
  applyMaterializedPinToHardwareMappingV2,
  type HardwareMappingDocumentV2,
  materializeIoMappingFromHardwareMappingV2,
  migrateIoMappingToHardwareMappingV2,
  resolveIoMappingFromProjectFields,
} from './hardwareMappingV2';

describe('hardwareMappingV2', () => {
  const sampleIo: IoMapping = {
    inputs: [{ id: 'a', nodeId: 'n1', port: 'out', label: 'a', pin: 'V17' }],
    outputs: [{ id: 'y', nodeId: 'n2', port: 'in', label: 'y', pin: 'U16' }],
  };

  it('round-trips legacy IoMapping through V2 migration + materialize', () => {
    const v2 = migrateIoMappingToHardwareMappingV2(sampleIo);
    expect(v2.schemaVersion).toBe('2.0');
    expect(v2.entries).toHaveLength(2);
    const back = materializeIoMappingFromHardwareMappingV2(v2);
    expect(back.inputs).toEqual(sampleIo.inputs);
    expect(back.outputs).toEqual(sampleIo.outputs);
  });

  it('materializes a bus entry to multiple IoMapping rows', () => {
    const doc: HardwareMappingDocumentV2 = {
      schemaVersion: '2.0',
      boardId: 'basys3',
      entries: [
        {
          kind: 'bus',
          id: 'sw_bank',
          direction: 'in',
          portName: 'sw',
          width: 2,
          label: 'Switches',
          bits: [
            { id: 'sw0', bitIndex: 0, nodeId: 'sw0', port: 'out', pin: 'V17', label: 'SW0' },
            { id: 'sw1', bitIndex: 1, nodeId: 'sw1', port: 'out', pin: 'V16', label: 'SW1' },
          ],
        },
      ],
    };
    const io = materializeIoMappingFromHardwareMappingV2(doc);
    expect(io.inputs).toHaveLength(2);
    expect(io.inputs[0]?.pin).toBe('V17');
    expect(io.inputs[1]?.pin).toBe('V16');
  });

  it('materializes a slice with inclusive indices', () => {
    const io = materializeIoMappingFromHardwareMappingV2({
      schemaVersion: '2.0',
      boardId: 'basys3',
      entries: [
        {
          kind: 'slice',
          id: 'data',
          direction: 'in',
          portName: 'd',
          nodeId: 'vec',
          port: 'out',
          msb: 1,
          lsb: 0,
          pins: ['P0', 'P1'],
          label: 'd',
        },
      ],
    });
    expect(io.inputs).toHaveLength(2);
    expect(io.inputs.map((r) => r.pin)).toEqual(['P0', 'P1']);
  });

  it('prefers hardwareMappingV2 over legacy ioMapping when both exist', () => {
    const v2 = migrateIoMappingToHardwareMappingV2(sampleIo);
    const other: IoMapping = {
      inputs: [{ id: 'x', nodeId: 'nx', port: 'out', label: 'x', pin: 'W5' }],
      outputs: [],
    };
    const resolved = resolveIoMappingFromProjectFields({ ioMapping: other, hardwareMappingV2: v2 });
    expect(resolved?.inputs[0]?.id).toBe('a');
  });

  it('applyMaterializedPinToHardwareMappingV2 updates scalar, slice bit, and bus bit pins', () => {
    const doc: HardwareMappingDocumentV2 = {
      schemaVersion: '2.0',
      boardId: 'basys3',
      entries: [
        {
          kind: 'scalar',
          id: 'clk',
          direction: 'in',
          width: 1,
          portName: 'clk',
          nodeId: 'nclk',
          port: 'out',
          label: 'clk',
          pin: 'OLD',
        },
        {
          kind: 'slice',
          id: 'data',
          direction: 'in',
          portName: 'd',
          nodeId: 'vec',
          port: 'out',
          msb: 1,
          lsb: 0,
          pins: ['P0', 'P1'],
          label: 'd',
        },
        {
          kind: 'bus',
          id: 'sw_bank',
          direction: 'in',
          portName: 'sw',
          width: 1,
          label: 'S',
          bits: [{ id: 'sw0', bitIndex: 0, nodeId: 'sw0', port: 'out', pin: 'X' }],
        },
      ],
    };
    let next = applyMaterializedPinToHardwareMappingV2(doc, 'clk', 'W5');
    const clk = next.entries[0];
    expect(clk?.kind).toBe('scalar');
    if (clk?.kind === 'scalar') expect(clk.pin).toBe('W5');
    next = applyMaterializedPinToHardwareMappingV2(next, 'data[1]', 'Z9');
    const slice = next.entries.find((e) => e.kind === 'slice' && e.id === 'data');
    expect(slice?.kind).toBe('slice');
    if (slice?.kind === 'slice') expect(slice.pins).toEqual(['P0', 'Z9']);
    next = applyMaterializedPinToHardwareMappingV2(next, 'sw0', 'V17');
    const bus = next.entries.find((e) => e.kind === 'bus');
    expect(bus?.kind).toBe('bus');
    if (bus?.kind === 'bus') expect(bus.bits[0]?.pin).toBe('V17');
  });
});
