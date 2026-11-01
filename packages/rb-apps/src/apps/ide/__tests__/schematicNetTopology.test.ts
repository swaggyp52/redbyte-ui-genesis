import { describe, expect, it } from 'vitest';
import { inputPinsOf, type Circuit, type Node } from '@redbyte/rb-logic-core';
import { buildGeometryIndex, findPin, pinWorldPoint, routeCircuit } from '@redbyte/rb-logic-view';
import { getDesignChipMetadata } from '../designChipMetadata';
import { IDE_EXAMPLES } from '../examplesCatalog';
import { LAB_STARTERS } from '../labStarters';
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
 *
 * Every connection must also be drawn, between the two pins it names. Until 2026-11-01 the Lab 8
 * lock's eight flip-flop resets (a real connection the simulator and the VHDL both honour) were
 * drawn as dashed stubs into each flip-flop's corner, because the drawing's DFlipFlop had no RST.
 */
type Point = { x: number; y: number };
type Segment = { net: string; wire: string; a: Point; b: Point };

type ModulePorts = { name: string; displayName?: string; ports: Array<{ name: string; direction: string }> };
type Drawing = { name: string; circuit: Circuit; modules: ModulePorts[] };

const drawings: Drawing[] = [
  ...IDE_EXAMPLES.flatMap((example) => {
    const modules = (example.hierarchy?.modules ?? []) as unknown as ModulePorts[];
    return [
      { name: example.id, circuit: example.circuit, modules },
      ...(example.hierarchy?.modules ?? []).map((module) => ({ name: `${example.id}/${module.name}`, circuit: module.circuit, modules })),
    ];
  }),
  ...LAB_STARTERS.map((lab) => ({ name: `lab:${lab.id}`, circuit: lab.example.circuit as Circuit, modules: [] })),
];

function geometryOf({ circuit, modules }: Drawing) {
  const byName = new Map(modules.map((module) => [module.name, module]));
  return buildGeometryIndex(circuit.nodes, (type: string, node?: Node) => {
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
}

function route(drawing: Drawing) {
  return routeCircuit(drawing.circuit, geometryOf(drawing));
}

/**
 * Connections the drawing does not show between the pins they name: a wire missing from the
 * routed nets, drawn degenerate, ending anywhere but its two pins, or ending on a pin the
 * simulator reads as a different input (a port-name alias landing on the wrong pin).
 */
function misdrawnConnections(drawing: Drawing): string[] {
  const geometry = geometryOf(drawing);
  const wires = new Map(routeCircuit(drawing.circuit, geometry).flatMap((net) => net.wires).map((wire) => [`${wire.fromNodeId}.${wire.fromPort}>${wire.toNodeId}.${wire.toPort}`, wire]));
  return drawing.circuit.connections.flatMap((connection) => {
    const { from, to } = connection;
    if (typeof from === 'string' || typeof to === 'string') return [`${String(connection.id)}: not a canonical { nodeId, portName } connection`];
    const label = `${from.nodeId}.${from.portName} -> ${to.nodeId}.${to.portName}`;
    const wire = wires.get(`${from.nodeId}.${from.portName}>${to.nodeId}.${to.portName}`);
    if (!wire) return [`${label}: not drawn`];
    if (wire.degenerate) return [`${label}: no pin to draw it to`];
    const start = pinWorldPoint(geometry.get(from.nodeId), from.portName);
    const end = pinWorldPoint(geometry.get(to.nodeId), to.portName);
    const [first, last] = [wire.points[0], wire.points[wire.points.length - 1]];
    const problems: string[] = [];
    if (!start || start.pin.direction !== 'out' || start.x !== first.x || start.y !== first.y) problems.push(`${label}: does not start on ${from.portName}`);
    if (!end || end.pin.direction !== 'in' || end.x !== last.x || end.y !== last.y) problems.push(`${label}: does not end on ${to.portName}`);
    const target = geometry.get(to.nodeId)!;
    const reads = inputPinsOf(target.node.type, target.node.config as Record<string, unknown> | undefined);
    const pin = findPin(target.geometry, to.portName);
    if (reads && pin && !reads.some((input) => input.names.includes(to.portName) && input.names.includes(pin.id))) {
      problems.push(`${label}: drawn to ${pin.id}, which the simulator does not read as ${to.portName}`);
    }
    return problems;
  });
}

function segmentsOf(nets: ReturnType<typeof routeCircuit>): Segment[] {
  return nets.flatMap((net) => net.wires.filter((wire) => !wire.degenerate).flatMap((wire) =>
    wire.points.slice(1).map((b, i) => ({ net: net.netId, wire: wire.wireId, a: wire.points[i], b }))));
}

/** Pairs of symbols whose bodies overlap: the lower one hides the other's pins and the wires on them. */
function overlappingSymbols(drawing: Drawing): string[] {
  const boxes = [...geometryOf(drawing).values()].map((entry) => ({
    id: entry.node.id,
    minX: entry.x + entry.geometry.body.minX, maxX: entry.x + entry.geometry.body.maxX,
    minY: entry.y + entry.geometry.body.minY, maxY: entry.y + entry.geometry.body.maxY,
  }));
  const found: string[] = [];
  for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
    const [p, q] = [boxes[i], boxes[j]];
    const dx = Math.min(p.maxX, q.maxX) - Math.max(p.minX, q.minX);
    const dy = Math.min(p.maxY, q.maxY) - Math.max(p.minY, q.minY);
    if (dx > 0 && dy > 0) found.push(`${p.id} and ${q.id} overlap by ${dx}x${dy}px`);
  }
  return found;
}

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
  it.each(drawings)('$name draws every connection between its two pins, no two nets along one line and no junction on another net', (drawing) => {
    const nets = route(drawing);
    const segments = segmentsOf(nets);
    expect(misdrawnConnections(drawing)).toEqual([]);
    expect(overlappingSymbols(drawing)).toEqual([]);
    expect(sharedVerticalRuns(segments)).toEqual([]);
    expect(sharedHorizontalRuns(segments)).toEqual([]);
    expect(junctionsOnOtherNets(nets, segments)).toEqual([]);
  });

  it('draws the Lab 8 lock\'s eight flip-flop resets to their RST pins', () => {
    const drawing = drawings.find((d) => d.name === '23_lab8-fsm-lock-starter-basys3')!;
    const geometry = geometryOf(drawing);
    const resets = route(drawing).flatMap((net) => net.wires).filter((wire) => wire.toPort === 'RST');
    expect(resets).toHaveLength(8);
    for (const wire of resets) {
      const pin = pinWorldPoint(geometry.get(wire.toNodeId), 'RST')!;
      expect(wire.degenerate).toBe(false);
      expect(pin.pin.id).toBe('RST');
      const end = wire.points[wire.points.length - 1];
      expect({ x: end.x, y: end.y }).toEqual({ x: pin.x, y: pin.y });
    }
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
