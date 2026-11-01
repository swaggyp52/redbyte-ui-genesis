import { describe, expect, it } from 'vitest';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import { buildGeometryIndex, routeCircuit } from '@redbyte/rb-logic-view';
import { getDesignChipMetadata } from '../designChipMetadata';
import { IDE_EXAMPLES } from '../examplesCatalog';
import { getDesignChipMetadataForNode } from '../registerFamilyChipMetadata';

/**
 * A schematic must not draw two different nets as one wire. Before 2026-10-30 the router gave
 * each net its own vertical trunk at the corridor's midpoint, so inputs stacked in one column and
 * feeding gates in the next laid their trunks on the same line: the Full Adder's A and B (and
 * Logic Gates' SW0 and SW1) read as one shorted net, with each net's junction dots drawn on the
 * other. Inside the hierarchical FullAdderCell a gate one grid from the next was routed as a
 * detour through that gate and along its output wire. Until 2026-10-31 a driver's leg could also
 * run through a symbol in its row and along that symbol's output (the 2-Bit Counter's CLK along
 * XOR0's output). These checks are on the drawing itself, not on counts or sizes.
 *
 * Parts resolve their pins exactly as SchematicProjection does: without the chip and module
 * definitions, flip-flop and module-instance wires come out degenerate and would go unchecked.
 */
type Point = { x: number; y: number };
type Segment = { net: string; wire: string; a: Point; b: Point };

type ModulePorts = { name: string; displayName?: string; ports: Array<{ name: string; direction: string }> };
type Drawing = { name: string; circuit: Circuit; modules: ModulePorts[] };

const drawings: Drawing[] = IDE_EXAMPLES.flatMap((example) => {
  const modules = (example.hierarchy?.modules ?? []) as unknown as ModulePorts[];
  return [
    { name: example.id, circuit: example.circuit, modules },
    ...(example.hierarchy?.modules ?? []).map((module) => ({ name: `${example.id}/${module.name}`, circuit: module.circuit, modules })),
  ];
});

function route({ circuit, modules }: Drawing) {
  const byName = new Map(modules.map((module) => [module.name, module]));
  const geometry = buildGeometryIndex(circuit.nodes, (type: string, node?: Node) => {
    const definitionId = node && typeof node.config?.moduleDefinitionId === 'string' ? node.config.moduleDefinitionId : null;
    const definition = (definitionId ? byName.get(definitionId) : undefined) ?? byName.get(type);
    if (definition) {
      return {
        name: definition.displayName || definition.name,
        inputs: definition.ports.filter((port) => port.direction === 'input').map((port) => ({ id: port.name, name: port.name })),
        outputs: definition.ports.filter((port) => port.direction === 'output').map((port) => ({ id: port.name, name: port.name })),
        color: '#5b68d8',
        layer: 1,
      };
    }
    return node ? getDesignChipMetadataForNode(node) ?? getDesignChipMetadata(type) : getDesignChipMetadata(type);
  });
  return routeCircuit(circuit, geometry);
}

function segmentsOf(nets: ReturnType<typeof routeCircuit>): Segment[] {
  return nets.flatMap((net) => net.wires.filter((wire) => !wire.degenerate).flatMap((wire) =>
    wire.points.slice(1).map((b, i) => ({ net: net.netId, wire: wire.wireId, a: wire.points[i], b }))));
}

/**
 * Wires whose pin the part does not declare, so the router cannot place them. The Lab 8 lock's
 * flip-flops are wired to RST, which DFlipFlop does not expose; that is a separate defect.
 */
const UNRESOLVED_PINS = new Map([['23_lab8-fsm-lock-starter-basys3', /\.RST$/]]);

const vertical = (s: Segment) => s.a.x === s.b.x && s.a.y !== s.b.y;
const overlap = (a1: number, a2: number, b1: number, b2: number) =>
  Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2));

function sharedVerticalRuns(segments: Segment[]): string[] {
  const found: string[] = [];
  const runs = segments.filter(vertical);
  for (let i = 0; i < runs.length; i += 1) for (let j = i + 1; j < runs.length; j += 1) {
    const [p, q] = [runs[i], runs[j]];
    if (p.net === q.net || p.a.x !== q.a.x) continue;
    const length = overlap(p.a.y, p.b.y, q.a.y, q.b.y);
    if (length > 0) found.push(`${p.wire} and ${q.wire} share ${length}px at x=${p.a.x}`);
  }
  return found;
}

const horizontal = (s: Segment) => s.a.y === s.b.y && s.a.x !== s.b.x;

function sharedHorizontalRuns(segments: Segment[]): string[] {
  const found: string[] = [];
  const runs = segments.filter(horizontal);
  for (let i = 0; i < runs.length; i += 1) for (let j = i + 1; j < runs.length; j += 1) {
    const [p, q] = [runs[i], runs[j]];
    if (p.net === q.net || p.a.y !== q.a.y) continue;
    const length = overlap(p.a.x, p.b.x, q.a.x, q.b.x);
    if (length > 0) found.push(`${p.wire} and ${q.wire} share ${length}px at y=${p.a.y}`);
  }
  return found;
}

function junctionsOnOtherNets(nets: ReturnType<typeof routeCircuit>, segments: Segment[]): string[] {
  const on = (p: Point, s: Segment) =>
    (s.a.x === s.b.x && p.x === s.a.x && p.y >= Math.min(s.a.y, s.b.y) && p.y <= Math.max(s.a.y, s.b.y)) ||
    (s.a.y === s.b.y && p.y === s.a.y && p.x >= Math.min(s.a.x, s.b.x) && p.x <= Math.max(s.a.x, s.b.x));
  return nets.flatMap((net) => net.junctions.flatMap((dot) =>
    segments.filter((s) => s.net !== net.netId && on(dot, s)).map((s) => `${net.netId} dot at ${dot.x},${dot.y} lies on ${s.wire}`)));
}

describe('schematic net topology of every starter', () => {
  it.each(drawings)('$name draws every wire, no two nets along one line and no junction on another net', (drawing) => {
    const nets = route(drawing);
    const segments = segmentsOf(nets);
    expect(nets.flatMap((net) => net.wires.filter((wire) => wire.degenerate).map((wire) => wire.wireId))
      .filter((wireId) => !UNRESOLVED_PINS.has(drawing.name) || !UNRESOLVED_PINS.get(drawing.name)!.test(wireId))).toEqual([]);
    expect(sharedVerticalRuns(segments)).toEqual([]);
    expect(sharedHorizontalRuns(segments)).toEqual([]);
    expect(junctionsOnOtherNets(nets, segments)).toEqual([]);
  });

  it('keeps the 2-Bit Counter clock off XOR0 and its output', () => {
    const drawing = drawings.find((d) => d.name === 'two-bit-counter')!;
    const clock = segmentsOf(route(drawing)).filter((s) => s.net === 'clk_node.out' && horizontal(s) && s.a.y === 100);
    expect(clock.every((s) => Math.max(s.a.x, s.b.x) < 246)).toBe(true);
  });

  it('keeps the Full Adder inputs A and B on separate trunks', () => {
    const nets = route(drawings.find((d) => d.name === 'full-adder')!);
    const trunkX = (netId: string) => new Set(segmentsOf(nets).filter((s) => s.net === netId && vertical(s)).map((s) => s.a.x));
    const a = trunkX('sw0_node.out');
    const b = trunkX('sw1_node.out');
    expect(a.size).toBeGreaterThan(0);
    expect([...a].filter((x) => b.has(x))).toEqual([]);
  });
});
