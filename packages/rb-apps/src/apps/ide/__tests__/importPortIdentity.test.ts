import { describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import type { ParsedHDL } from '../../../import/hdlToCircuit';
import type { XdcParseResult } from '../../../import/xdcImport';
import {
  buildZipInspectionMappingRecord,
  isCanonicalImportPortIdentity,
} from '../importPortIdentity';

const VECTOR_PORTS: ParsedHDL = {
  entityName: 'counter',
  lang: 'vhdl',
  ports: [
    { name: 'SW[1]', direction: 'in', typeName: 'STD_LOGIC' },
    { name: 'SW[0]', direction: 'in', typeName: 'STD_LOGIC' },
    { name: 'CLK100MHZ', direction: 'in', typeName: 'STD_LOGIC' },
    { name: 'LED[1]', direction: 'out', typeName: 'STD_LOGIC' },
    { name: 'LED[0]', direction: 'out', typeName: 'STD_LOGIC' },
  ],
  instances: [],
  signals: [],
  warnings: [],
};

const MANIFEST_PROJECT: RBProject = {
  kind: 'rb-project',
  version: 1,
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
  name: 'counter',
  circuit: { nodes: [], connections: [] },
  ioMapping: {
    inputs: [
      { id: 'en', nodeId: 'en_node', port: 'out', label: 'EN', pin: 'SW0' },
      { id: 'rst', nodeId: 'rst_node', port: 'out', label: 'RST', pin: 'SW1' },
      { id: 'clk', nodeId: 'clk_node', port: 'out', label: 'CLK100MHZ', pin: 'CLK100MHZ' },
    ],
    outputs: [
      { id: 'q0', nodeId: 'q0_node', port: 'in', label: 'LD0', pin: 'LD0' },
      { id: 'q1', nodeId: 'q1_node', port: 'in', label: 'LD1', pin: 'LD1' },
    ],
  },
};

const MANIFEST_XDC: XdcParseResult = {
  pinMap: {
    'sw[0]': 'V17',
    'sw[1]': 'V16',
    CLK100MHZ: 'W5',
    'led[0]': 'U16',
    'led[1]': 'E19',
  },
  pinEntries: {},
  warnings: [],
};

describe('canonical Import port identity', () => {
  it.each(['SW', '_clock2', 'SW[0]', 'LED[12]'])(
    'accepts parser-owned scalar or projected identity %s',
    (identity) => {
      expect(isCanonicalImportPortIdentity(identity)).toBe(true);
    },
  );

  it.each([
    '9SW',
    'bad-name',
    'SW[-1]',
    'SW[01]',
    'SW[]',
    'SW(0)',
    'SW[0][1]',
    ' SW[0]',
  ])('keeps malformed scalar/projected identity %s invalid', (identity) => {
    expect(isCanonicalImportPortIdentity(identity)).toBe(false);
  });

  it('projects the manifest-owned XDC onto vector-expanded Review ports', () => {
    const mapping = buildZipInspectionMappingRecord({
      importMode: 'manifest',
      project: MANIFEST_PROJECT,
      parsedHdl: VECTOR_PORTS,
      xdcResult: MANIFEST_XDC,
    });

    expect(mapping).toMatchObject({
      'SW[1]': 'V16',
      'SW[0]': 'V17',
      CLK100MHZ: 'W5',
      'LED[1]': 'E19',
      'LED[0]': 'U16',
    });
  });

  it('does not grant manifest projection authority to a reconstructed ZIP', () => {
    const mapping = buildZipInspectionMappingRecord({
      importMode: 'reconstructed',
      project: MANIFEST_PROJECT,
      parsedHdl: VECTOR_PORTS,
      xdcResult: MANIFEST_XDC,
    });

    expect(mapping['SW[0]']).toBeUndefined();
    expect(mapping['LED[0]']).toBeUndefined();
    expect(mapping).toMatchObject({ EN: 'SW0', RST: 'SW1', LD0: 'LD0', LD1: 'LD1' });
  });
});
