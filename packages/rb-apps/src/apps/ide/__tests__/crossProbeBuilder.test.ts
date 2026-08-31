import { describe, expect, it } from 'vitest';
import { buildLiveCrossProbeIndex, qualityForLinks, type CrossProbeDesignModule } from '../crossProbeBuilder';
import { linksForModule, linksForSource } from '../sourceCrossProbe';
import { normalizeProjectSourceModel } from '../projectSourceModel';

const sourceModel = normalizeProjectSourceModel({
  files: [
    {
      path: 'rtl/adder.vhd',
      language: 'vhdl',
      fileset: 'design',
      text: [
        'library ieee;',
        'entity adder is',
        '  port ( a : in std_logic; b : in std_logic; sum : out std_logic );',
        'end adder;',
        'architecture rtl of adder is begin',
        '  u_half : half_adder port map ( a, b, sum );',
        'end rtl;',
      ].join('\n'),
    },
    {
      path: 'rtl/mux.v',
      language: 'verilog',
      fileset: 'design',
      text: 'module mux(input a, output y); endmodule\n',
    },
  ],
});

const modules: CrossProbeDesignModule[] = [
  {
    id: 'm_adder',
    name: 'adder',
    ports: [
      { name: 'a', nodeId: 'n_a' },
      { name: 'sum', nodeId: 'n_sum' },
    ],
    instances: [{ name: 'u_half', ofModule: 'half_adder' }],
  },
  { id: 'm_mux', name: 'mux', ports: [{ name: 'y' }] },
  { id: 'm_native', name: 'native_only', ports: [{ name: 'z' }] },
];

describe('buildLiveCrossProbeIndex', () => {
  const index = buildLiveCrossProbeIndex({ modules, sourceModel });

  it('locates a unique entity declaration as an exact module link', () => {
    const adder = linksForModule(index, 'm_adder').find((l) => l.kind === 'module')!;
    expect(adder.quality).toBe('exact');
    // "entity adder" is on line 2 → the identifier sits on line 2.
    expect(adder.range?.start.line).toBe(2);
    expect(adder.sourceId).toBe(sourceModel.files.find((f) => f.path === 'rtl/adder.vhd')!.id);
  });

  it('locates a verilog module declaration as exact', () => {
    const mux = linksForModule(index, 'm_mux').find((l) => l.kind === 'module')!;
    expect(mux.quality).toBe('exact');
    expect(mux.range?.start.line).toBe(1);
  });

  it('links ports and instances within the module source (partial)', () => {
    const links = linksForModule(index, 'm_adder');
    const port = links.find((l) => l.kind === 'port' && l.elementKey === 'a')!;
    expect(port.quality).toBe('partial');
    expect(port.nodeId).toBe('n_a');
    const instance = links.find((l) => l.kind === 'instance')!;
    expect(instance.elementKey).toBe('u_half');
    expect(instance.label).toContain('half_adder');
  });

  it('emits no link for a design element with no backing source', () => {
    expect(linksForModule(index, 'm_native')).toHaveLength(0);
    expect(qualityForLinks(linksForModule(index, 'm_native'))).toBe('unavailable');
  });

  it('reports the best quality among an element’s links', () => {
    expect(qualityForLinks(linksForModule(index, 'm_adder'))).toBe('exact');
  });

  it('adds constraint ↔ XDC links (exact) when constraint text mentions a port', () => {
    const withXdc = buildLiveCrossProbeIndex({
      modules,
      sourceModel,
      constraintText: 'set_property PACKAGE_PIN V17 [get_ports a]\nset_property PACKAGE_PIN V16 [get_ports sum]\n',
    });
    const xdcLinks = linksForSource(withXdc, 'active.xdc');
    expect(xdcLinks.every((l) => l.kind === 'constraint')).toBe(true);
    expect(xdcLinks.map((l) => l.elementKey).sort()).toContain('a');
    expect(xdcLinks.find((l) => l.elementKey === 'a')?.quality).toBe('exact');
  });

  it('is deterministic — same inputs yield the same index', () => {
    const a = buildLiveCrossProbeIndex({ modules, sourceModel });
    const b = buildLiveCrossProbeIndex({ modules, sourceModel });
    const key = (i: typeof a) => i.links.map((l) => `${l.sourceId}:${l.kind}:${l.elementKey}:${l.range?.start.line}`).join('|');
    expect(key(a)).toBe(key(b));
  });
});
