import { describe, expect, it } from 'vitest';
import {
  buildCrossProbeIndex,
  designTargetsForRange,
  linkAtSourcePosition,
  linksForModule,
  linksForNode,
  linksForSource,
  type CrossProbeLink,
} from '../sourceCrossProbe';
import { position, range } from '../sourceDiagnostics';

const LINKS: CrossProbeLink[] = [
  { kind: 'module', moduleId: 'm_top', sourceId: 'src-top-vhd', range: range(1, 1, 20, 1), label: 'top' },
  { kind: 'port', moduleId: 'm_top', nodeId: 'sw0', elementKey: 'SW0', sourceId: 'src-top-vhd', range: range(3, 5, 3, 8) },
  { kind: 'instance', moduleId: 'm_top', nodeId: 'u1', sourceId: 'src-top-vhd', range: range(10, 3, 10, 30) },
  { kind: 'signal', moduleId: 'm_top', elementKey: 'net_a', sourceId: '' }, // dropped: no sourceId
  { kind: 'node', moduleId: 'm_sub', nodeId: 'g1', sourceId: 'src-sub-v', range: range(2, 1, 2, 10) },
];

describe('buildCrossProbeIndex', () => {
  it('drops links without a source id and sorts deterministically', () => {
    const index = buildCrossProbeIndex(LINKS);
    expect(index.links).toHaveLength(4);
    // sorted by sourceId then range: src-sub-v comes before src-top-vhd
    expect(index.links[0].sourceId).toBe('src-sub-v');
    const topLinks = index.links.filter((l) => l.sourceId === 'src-top-vhd');
    expect(topLinks.map((l) => l.range?.start.line)).toEqual([1, 3, 10]);
  });

  it('is stable — building twice yields the same order', () => {
    const a = buildCrossProbeIndex(LINKS);
    const b = buildCrossProbeIndex([...LINKS].reverse());
    expect(a.links.map((l) => l.sourceId + ':' + (l.range?.start.line ?? 'x'))).toEqual(
      b.links.map((l) => l.sourceId + ':' + (l.range?.start.line ?? 'x'))
    );
  });
});

describe('forward queries (design → source)', () => {
  const index = buildCrossProbeIndex(LINKS);
  it('finds links by module and by node', () => {
    expect(linksForModule(index, 'm_top')).toHaveLength(3);
    expect(linksForNode(index, 'u1').map((l) => l.kind)).toEqual(['instance']);
    expect(linksForNode(index, 'nope')).toEqual([]);
  });
  it('lists a source file in source order', () => {
    expect(linksForSource(index, 'src-top-vhd').map((l) => l.range?.start.line)).toEqual([1, 3, 10]);
  });
});

describe('reverse queries (source → design)', () => {
  const index = buildCrossProbeIndex(LINKS);
  it('returns the innermost link containing a position', () => {
    // position 3:6 sits inside the port range (3:5–3:8) which is inside the module range (1–20)
    const link = linkAtSourcePosition(index, 'src-top-vhd', position(3, 6));
    expect(link?.kind).toBe('port');
    // a position only inside the module range returns the module link
    expect(linkAtSourcePosition(index, 'src-top-vhd', position(15, 1))?.kind).toBe('module');
    // outside any range → undefined
    expect(linkAtSourcePosition(index, 'src-top-vhd', position(50, 1))).toBeUndefined();
  });
  it('returns all design targets overlapping a source range', () => {
    const targets = designTargetsForRange(index, 'src-top-vhd', range(3, 1, 3, 20));
    // overlaps the module range and the port range
    expect(targets.map((l) => l.kind).sort()).toEqual(['module', 'port']);
  });
});
