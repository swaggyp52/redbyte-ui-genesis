import type { Circuit, Connection } from '@redbyte/rb-logic-core';
import { GRID, pinWorldPoint, type GeometryIndexEntry } from '../symbols/portGeometry';

/**
 * Deterministic orthogonal net router for the schematic instrument.
 *
 * One net = one driver pin + N load pins. Each net is routed as:
 *   - single load, target to the right: 3-segment H-V-H through a vertical
 *     channel chosen to avoid symbol bodies (then nearest to the midpoint);
 *   - fanout: one shared vertical trunk at that channel, one horizontal branch
 *     per load, a junction dot where each branch leaves the trunk;
 *   - backward / feedback (target not clearly to the right): 5-segment
 *     H-V-H-V-H detour that clears the union bounding box of both symbols.
 * Crossings are plain crossings; only T-junctions get dots.
 *
 * Pure and byte-stable: nets sort by driver key, loads by (y, x, wireId), and
 * channel candidates are enumerated on the grid — no randomness, no wall clock.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RoutedWire {
  readonly wireId: string;
  readonly netId: string;
  readonly fromNodeId: string;
  readonly fromPort: string;
  readonly toNodeId: string;
  readonly toPort: string;
  /** World-space polyline from the driver pin to this load pin. */
  readonly points: readonly Point[];
  /** True when an endpoint could not be resolved to a pin (drawn degenerate). */
  readonly degenerate: boolean;
}

export interface RoutedNet {
  readonly netId: string;
  readonly driver: { readonly nodeId: string; readonly port: string };
  readonly wires: readonly RoutedWire[];
  /** Junction dots (world space) where a branch leaves the shared trunk. */
  readonly junctions: readonly Point[];
  /** Anchor for an optional net label: midpoint of the longest horizontal run. */
  readonly labelAnchor: Point | null;
}

export interface RouteOptions {
  readonly grid?: number;
}

interface Endpoint {
  nodeId: string;
  port: string;
}

function endpoint(raw: Connection['from'] | Connection['to'], fallbackPort: string, aliases: (string | undefined)[]): Endpoint {
  if (typeof raw === 'string') return { nodeId: raw, port: aliases.find((a) => a) ?? fallbackPort };
  return { nodeId: raw.nodeId, port: raw.portName ?? raw.port ?? aliases.find((a) => a) ?? fallbackPort };
}

export function connectionEndpoints(connection: Connection): { from: Endpoint; to: Endpoint; wireId: string } {
  const from = endpoint(connection.from, 'out', [connection.fromPin, connection.fromPort]);
  const to = endpoint(connection.to, 'in', [connection.toPin, connection.toPort]);
  return { from, to, wireId: `${from.nodeId}.${from.port}-${to.nodeId}.${to.port}` };
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function bodyBox(entry: GeometryIndexEntry, pad = 4): Box {
  return {
    minX: entry.x + entry.geometry.body.minX - pad,
    minY: entry.y + entry.geometry.body.minY - pad,
    maxX: entry.x + entry.geometry.body.maxX + pad,
    maxY: entry.y + entry.geometry.body.maxY + pad,
  };
}

/** Number of symbol bodies a vertical segment at `x` spanning [y1,y2] would cross. */
function verticalCollisions(boxes: readonly Box[], x: number, y1: number, y2: number): number {
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  let n = 0;
  for (const box of boxes) {
    if (x > box.minX && x < box.maxX && hi > box.minY && lo < box.maxY) n += 1;
  }
  return n;
}

function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

/** Pick the vertical channel x between `left` and `right` with the fewest body crossings, nearest the midpoint. */
function chooseChannel(boxes: readonly Box[], left: number, right: number, yLo: number, yHi: number, grid: number): number {
  const mid = (left + right) / 2;
  const first = snap(left + grid, grid);
  const last = snap(right - grid, grid);
  if (last < first) return snap(mid, grid);
  let best = snap(mid, grid);
  let bestScore = Number.POSITIVE_INFINITY;
  for (let x = first; x <= last; x += grid) {
    const score = verticalCollisions(boxes, x, yLo, yHi) * 10_000 + Math.abs(x - mid);
    if (score < bestScore) {
      bestScore = score;
      best = x;
    }
  }
  return best;
}

function dedupe(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    const prev = out[out.length - 1];
    if (prev && prev.x === point.x && prev.y === point.y) continue;
    out.push(point);
  }
  // Remove collinear middle points.
  const cleaned: Point[] = [];
  for (let i = 0; i < out.length; i += 1) {
    const a = cleaned[cleaned.length - 1];
    const b = out[i];
    const c = out[i + 1];
    if (a && c && ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y))) continue;
    cleaned.push(b);
  }
  return cleaned;
}

export function routeCircuit(
  circuit: Circuit,
  index: ReadonlyMap<string, GeometryIndexEntry>,
  options: RouteOptions = {}
): RoutedNet[] {
  const grid = options.grid ?? GRID;
  const boxes = Array.from(index.values()).map((entry) => bodyBox(entry));

  // Group by driver pin.
  const byDriver = new Map<string, { driver: Endpoint; loads: { to: Endpoint; wireId: string }[] }>();
  for (const connection of circuit.connections) {
    const { from, to, wireId } = connectionEndpoints(connection);
    const key = `${from.nodeId}.${from.port}`;
    const group = byDriver.get(key) ?? { driver: from, loads: [] };
    group.loads.push({ to, wireId });
    byDriver.set(key, group);
  }

  const nets: RoutedNet[] = [];
  for (const [netId, group] of Array.from(byDriver.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const source = pinWorldPoint(index.get(group.driver.nodeId), group.driver.port);
    const sourceEntry = index.get(group.driver.nodeId);
    const loads = group.loads
      .map((load) => ({ ...load, point: pinWorldPoint(index.get(load.to.nodeId), load.to.port), entry: index.get(load.to.nodeId) }))
      .sort((a, b) => (a.point?.y ?? 0) - (b.point?.y ?? 0) || (a.point?.x ?? 0) - (b.point?.x ?? 0) || (a.wireId < b.wireId ? -1 : 1));

    if (!source) {
      // Driver pin unknown: draw straight degenerate stubs so the wire is still visible.
      const sx = sourceEntry?.x ?? 0;
      const sy = sourceEntry?.y ?? 0;
      nets.push({
        netId,
        driver: group.driver,
        wires: loads.map((load) => ({
          wireId: load.wireId,
          netId,
          fromNodeId: group.driver.nodeId,
          fromPort: group.driver.port,
          toNodeId: load.to.nodeId,
          toPort: load.to.port,
          points: [{ x: sx, y: sy }, { x: load.point?.x ?? load.entry?.x ?? sx, y: load.point?.y ?? load.entry?.y ?? sy }],
          degenerate: true,
        })),
        junctions: [],
        labelAnchor: null,
      });
      continue;
    }

    const s = { x: source.x, y: source.y };
    const forwardLoads = loads.filter((load) => load.point && load.point.x >= s.x + 2 * grid);
    const backwardLoads = loads.filter((load) => !load.point || load.point.x < s.x + 2 * grid);
    const wires: RoutedWire[] = [];
    const junctions: Point[] = [];
    let longestRun: { len: number; anchor: Point } | null = null;
    const trackRun = (a: Point, b: Point) => {
      if (a.y !== b.y) return;
      const len = Math.abs(b.x - a.x);
      if (!longestRun || len > longestRun.len) longestRun = { len, anchor: { x: (a.x + b.x) / 2, y: a.y } };
    };

    if (forwardLoads.length > 0) {
      const nearestX = Math.min(...forwardLoads.map((load) => load.point!.x));
      const yLo = Math.min(s.y, ...forwardLoads.map((load) => load.point!.y));
      const yHi = Math.max(s.y, ...forwardLoads.map((load) => load.point!.y));
      const channel = chooseChannel(boxes, s.x, nearestX, yLo, yHi, grid);
      const trunkOwners = forwardLoads.length;
      for (const load of forwardLoads) {
        const t = load.point!;
        const points = dedupe([s, { x: channel, y: s.y }, { x: channel, y: t.y }, t]);
        for (let i = 1; i < points.length; i += 1) trackRun(points[i - 1], points[i]);
        wires.push({
          wireId: load.wireId,
          netId,
          fromNodeId: group.driver.nodeId,
          fromPort: group.driver.port,
          toNodeId: load.to.nodeId,
          toPort: load.to.port,
          points,
          degenerate: false,
        });
        if (trunkOwners > 1 && t.y !== s.y) junctions.push({ x: channel, y: t.y });
      }
      if (trunkOwners > 1) {
        // The source enters the trunk at s.y; that corner is a junction only when
        // branches leave in both directions (otherwise it is a plain corner).
        const above = forwardLoads.some((load) => load.point!.y < s.y);
        const below = forwardLoads.some((load) => load.point!.y > s.y);
        const level = forwardLoads.some((load) => load.point!.y === s.y);
        if ((above && below) || ((above || below) && level)) junctions.push({ x: channel, y: s.y });
      }
    }

    for (const load of backwardLoads) {
      const t = load.point;
      if (!t) {
        wires.push({
          wireId: load.wireId,
          netId,
          fromNodeId: group.driver.nodeId,
          fromPort: group.driver.port,
          toNodeId: load.to.nodeId,
          toPort: load.to.port,
          points: [s, { x: load.entry?.x ?? s.x, y: load.entry?.y ?? s.y }],
          degenerate: true,
        });
        continue;
      }
      // Detour: leave the driver to the right, cross back through the clear
      // corridor between the two bodies (or outside both when they overlap
      // vertically), then descend/ascend on the far side of the target. Each
      // vertical leg is pushed outside any body whose y-range it would cross.
      const sBox = sourceEntry ? bodyBox(sourceEntry) : { minX: s.x, minY: s.y, maxX: s.x, maxY: s.y };
      const tBox = load.entry ? bodyBox(load.entry) : { minX: t.x, minY: t.y, maxX: t.x, maxY: t.y };
      const targetBelow = t.y >= s.y;
      const gapLo = targetBelow ? sBox.maxY : tBox.maxY;
      const gapHi = targetBelow ? tBox.minY : sBox.minY;
      const clearY =
        gapHi - gapLo >= grid
          ? snap((gapLo + gapHi) / 2, grid)
          : targetBelow
            ? snap(Math.max(sBox.maxY, tBox.maxY) + grid, grid)
            : snap(Math.min(sBox.minY, tBox.minY) - grid, grid);
      const spans = (a: number, b: number, box: { minY: number; maxY: number }) =>
        Math.min(a, b) < box.maxY && Math.max(a, b) > box.minY;
      let x1 = Math.max(s.x + grid, sBox.maxX + grid);
      if (spans(s.y, clearY, tBox)) x1 = Math.max(x1, tBox.maxX + grid);
      let x2 = Math.min(t.x - grid, tBox.minX - grid);
      if (spans(clearY, t.y, sBox)) x2 = Math.min(x2, sBox.minX - grid);
      x1 = snap(x1, grid);
      x2 = snap(x2, grid);
      const points = dedupe([s, { x: x1, y: s.y }, { x: x1, y: clearY }, { x: x2, y: clearY }, { x: x2, y: t.y }, t]);
      for (let i = 1; i < points.length; i += 1) trackRun(points[i - 1], points[i]);
      wires.push({
        wireId: load.wireId,
        netId,
        fromNodeId: group.driver.nodeId,
        fromPort: group.driver.port,
        toNodeId: load.to.nodeId,
        toPort: load.to.port,
        points,
        degenerate: false,
      });
      if (forwardLoads.length > 0) junctions.push({ x: x1, y: s.y });
    }

    // Stable junction order.
    const uniqueJunctions = Array.from(new Map(junctions.map((j) => [`${j.x},${j.y}`, j])).values()).sort((a, b) => a.y - b.y || a.x - b.x);
    nets.push({ netId, driver: group.driver, wires, junctions: uniqueJunctions, labelAnchor: longestRun ? (longestRun as { anchor: Point }).anchor : null });
  }
  return nets;
}

/** Axis-aligned bounds of every routed point (for fit-to-view). */
export function routeBounds(nets: readonly RoutedNet[]): Box | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const net of nets) {
    for (const wire of net.wires) {
      for (const point of wire.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

export function polylinePath(points: readonly Point[], toScreen: (p: Point) => Point): string {
  return points
    .map((point, index) => {
      const s = toScreen(point);
      return `${index === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
    })
    .join(' ');
}
