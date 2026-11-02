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
  /**
   * Also count symbol bodies crossed by the horizontal legs (driver to channel, channel to each
   * load) when choosing a net's vertical channel. On by default since 2026-10-31: without it a
   * driver leg could run through a symbol in its row and along that symbol's output (the 2-Bit
   * Counter's CLK through XOR0). Pass `false` only to reproduce the legacy routes.
   */
  readonly avoidBodiesOnLegs?: boolean;
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

/** Number of symbol bodies a horizontal segment at `y` spanning [x1,x2] would cross. */
function horizontalCollisions(boxes: readonly Box[], y: number, x1: number, x2: number): number {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  let n = 0;
  for (const box of boxes) {
    if (y > box.minY && y < box.maxY && hi > box.minX && lo < box.maxX) n += 1;
  }
  return n;
}

function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

/** A vertical run another net already drew, from `lo` to `hi` at `x`. */
interface ClaimedRun {
  readonly x: number;
  readonly lo: number;
  readonly hi: number;
}

/** Number of other nets' vertical runs a vertical segment at `x` spanning [y1,y2] would lie along. */
function sharedRuns(claimed: readonly ClaimedRun[], x: number, y1: number, y2: number): number {
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  let n = 0;
  for (const run of claimed) {
    if (Math.abs(run.x - x) < 0.5 && Math.min(hi, run.hi) - Math.max(lo, run.lo) > 0.5) n += 1;
  }
  return n;
}

/**
 * Pick the vertical channel x between `left` and `right` with the fewest body crossings, nearest the
 * midpoint. Two nets on one vertical line read as one wire, with each net's junction dots on the
 * other, so a lane another net already uses over an overlapping height counts as worse than
 * crossing a body: inputs stacked in one column, feeding gates in the next, used to share a trunk
 * and look shorted together.
 */
function chooseChannel(
  boxes: readonly Box[],
  left: number,
  right: number,
  yLo: number,
  yHi: number,
  grid: number,
  legs?: { readonly source: Point; readonly loads: readonly Point[] },
  claimed: readonly ClaimedRun[] = [],
): number {
  const mid = (left + right) / 2;
  const first = snap(left + grid, grid);
  const last = snap(right - grid, grid);
  if (last < first) return snap(mid, grid);
  let best = snap(mid, grid);
  let bestScore = Number.POSITIVE_INFINITY;
  for (let x = first; x <= last; x += grid) {
    let crossings = verticalCollisions(boxes, x, yLo, yHi);
    if (legs) {
      crossings += horizontalCollisions(boxes, legs.source.y, legs.source.x, x);
      for (const load of legs.loads) crossings += horizontalCollisions(boxes, load.y, x, load.x);
    }
    const score = crossings * 10_000 + sharedRuns(claimed, x, yLo, yHi) * 20_000 + Math.abs(x - mid);
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
  const boxById = new Map(Array.from(index.entries()).map(([id, entry]) => [id, bodyBox(entry)]));
  /** Bodies a wire may not pass: every symbol but the two it connects. */
  const bodiesBetween = (fromId: string, toId: string) =>
    Array.from(boxById.entries()).filter(([id]) => id !== fromId && id !== toId).map(([, box]) => box);
  const crossesAny = (points: readonly Point[], bodies: readonly Box[]) =>
    points.slice(1).some((b, i) => {
      const a = points[i];
      return a.x === b.x ? verticalCollisions(bodies, a.x, a.y, b.y) > 0 : horizontalCollisions(bodies, a.y, a.x, b.x) > 0;
    });

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
  // Vertical runs drawn so far, so a later net does not lay its trunk along an earlier net's.
  const claimed: ClaimedRun[] = [];
  const claim = (x: number, y1: number, y2: number) => {
    if (y1 !== y2) claimed.push({ x, lo: Math.min(y1, y2), hi: Math.max(y1, y2) });
  };
  // Horizontal runs back across a corridor, in the same form with x and y swapped.
  const claimedAcross: ClaimedRun[] = [];
  const claimAcross = (y: number, x1: number, x2: number) => {
    if (x1 !== x2) claimedAcross.push({ x: y, lo: Math.min(x1, x2), hi: Math.max(x1, x2) });
  };
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
    // A load a grid or more to the right is forward, with its jog between the two pins. Counted
    // as backward below two grids, a gate's output feeding the next gate's input one grid away
    // detoured through that gate and along its output wire, and read as joined to it.
    const forwardLoads = loads.filter((load) => load.point && load.point.x >= s.x + grid);
    const backwardLoads = loads.filter((load) => !load.point || load.point.x < s.x + grid);
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
      const channel = chooseChannel(boxes, s.x, nearestX, yLo, yHi, grid,
        options.avoidBodiesOnLegs !== false ? { source: s, loads: forwardLoads.map((load) => load.point!) } : undefined, claimed);
      // A load whose three runs would cross a part between its two ends is drawn through the
      // nearest clear lane instead (H-V-H-V-H, as a feedback detour is): crossing a part on one
      // of its pin rows read as wired to that pin, as FullAdderCell's a1 output did through a2.
      // Where no lane is clear the three runs stay, so no drawing gets worse.
      const routes = forwardLoads.map((load) => {
        const t = load.point!;
        const direct = dedupe([s, { x: channel, y: s.y }, { x: channel, y: t.y }, t]);
        const bodies = bodiesBetween(group.driver.nodeId, load.to.nodeId);
        if (options.avoidBodiesOnLegs === false || !crossesAny(direct, bodies)) return { load, points: direct, branchY: t.y, x1: channel };
        const tBox = load.entry ? bodyBox(load.entry) : { minX: t.x, minY: t.y, maxX: t.x, maxY: t.y };
        const x2 = snap(Math.min(t.x - grid, tBox.minX - grid), grid);
        const starts: number[] = [];
        if (horizontalCollisions(bodies, s.y, s.x, channel) === 0) starts.push(channel);
        if (forwardLoads.length === 1) {
          const sBox = sourceEntry ? bodyBox(sourceEntry) : { minX: s.x, minY: s.y, maxX: s.x, maxY: s.y };
          for (let x = snap(Math.max(s.x + grid, sBox.maxX + grid), grid); x < x2 && starts.length < 6; x += grid) {
            if (x !== channel && horizontalCollisions(bodies, s.y, s.x, x) === 0) starts.push(x);
          }
        }
        for (const x1 of starts) {
          if (x1 >= x2) continue;
          for (let k = 0; k <= 24; k += 1) {
            const laneY = snap(t.y, grid) + (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * grid;
            const points = dedupe([s, { x: x1, y: s.y }, { x: x1, y: laneY }, { x: x2, y: laneY }, { x: x2, y: t.y }, t]);
            if (crossesAny(points, bodies)) continue;
            if (x1 !== channel && sharedRuns(claimed, x1, s.y, laneY) > 0) continue;
            if (sharedRuns(claimed, x2, laneY, t.y) > 0 || sharedRuns(claimedAcross, laneY, x1, x2) > 0) continue;
            if (x1 !== channel) claim(x1, s.y, laneY);
            claim(x2, laneY, t.y);
            claimAcross(laneY, x1, x2);
            return { load, points, branchY: laneY, x1 };
          }
        }
        return { load, points: direct, branchY: t.y, x1: channel };
      });
      const trunk = routes.filter((route) => route.x1 === channel);
      const trunkLo = Math.min(s.y, ...trunk.map((route) => route.branchY));
      const trunkHi = Math.max(s.y, ...trunk.map((route) => route.branchY));
      claim(channel, trunkLo, trunkHi);
      for (const { load, points, branchY, x1 } of routes) {
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
        // A branch leaving a trunk end is an L corner, not a T junction.
        if (x1 === channel && trunk.length > 1 && branchY !== s.y && branchY !== trunkLo && branchY !== trunkHi) junctions.push({ x: channel, y: branchY });
      }
      if (trunk.length > 1) {
        // The source enters the trunk at s.y; that corner is a junction only when
        // branches leave in both directions (otherwise it is a plain corner).
        const above = trunk.some((route) => route.branchY < s.y);
        const below = trunk.some((route) => route.branchY > s.y);
        const level = trunk.some((route) => route.branchY === s.y);
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
      const baseClearY =
        gapHi - gapLo >= grid
          ? snap((gapLo + gapHi) / 2, grid)
          : targetBelow
            ? snap(Math.max(sBox.maxY, tBox.maxY) + grid, grid)
            : snap(Math.min(sBox.minY, tBox.minY) - grid, grid);
      const spans = (a: number, b: number, box: { minY: number; maxY: number }) =>
        Math.min(a, b) < box.maxY && Math.max(a, b) > box.minY;
      const legsAt = (y: number) => {
        let left = Math.max(s.x + grid, sBox.maxX + grid);
        if (spans(s.y, y, tBox)) left = Math.max(left, tBox.maxX + grid);
        let right = Math.min(t.x - grid, tBox.minX - grid);
        if (spans(y, t.y, sBox)) right = Math.min(right, sBox.minX - grid);
        return { x1: snap(left, grid), x2: snap(right, grid) };
      };
      // The run back across the corridor takes the first height, nearest the corridor's middle,
      // that no other net already runs along: two feedback wires between the same pair of parts
      // otherwise crossed back on one line and read as one wire.
      let clearY = baseClearY;
      for (const offset of [0, grid, -grid, 2 * grid, -2 * grid]) {
        const { x1: a, x2: b } = legsAt(baseClearY + offset);
        if (sharedRuns(claimedAcross, baseClearY + offset, a, b) === 0) {
          clearY = baseClearY + offset;
          break;
        }
      }
      let { x1, x2 } = legsAt(clearY);
      // Step a leg off a lane another net already runs along (outward, a grid at a time), so a
      // feedback wire is not drawn on top of a forward net's trunk beside the same target.
      for (let step = 0; step < 4 && sharedRuns(claimed, x1, s.y, clearY) > 0; step += 1) x1 += grid;
      for (let step = 0; step < 4 && sharedRuns(claimed, x2, clearY, t.y) > 0; step += 1) x2 -= grid;
      let points = dedupe([s, { x: x1, y: s.y }, { x: x1, y: clearY }, { x: x2, y: clearY }, { x: x2, y: t.y }, t]);
      // That detour only clears its own two parts. When it crosses another, take the nearest legs
      // and crossing height that cross none and share no other net's run; the 4-bit adder's
      // carries otherwise crossed the next stage's XOR output and SUM pin on their rows.
      const others = bodiesBetween(group.driver.nodeId, load.to.nodeId);
      if (options.avoidBodiesOnLegs !== false && crossesAny(points, others)) {
        search: for (let k = 0; k <= 24; k += 1) {
          const y = baseClearY + (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * grid;
          const legs = legsAt(y);
          for (let i = 0; i < 8; i += 1) for (let j = 0; j < 8; j += 1) {
            const [a, b] = [legs.x1 + i * grid, legs.x2 - j * grid];
            const candidate = dedupe([s, { x: a, y: s.y }, { x: a, y }, { x: b, y }, { x: b, y: t.y }, t]);
            if (crossesAny(candidate, others) || sharedRuns(claimed, a, s.y, y) > 0 || sharedRuns(claimed, b, y, t.y) > 0
              || sharedRuns(claimedAcross, y, a, b) > 0) continue;
            [x1, x2, clearY, points] = [a, b, y, candidate];
            break search;
          }
        }
      }
      claim(x1, s.y, clearY);
      claim(x2, clearY, t.y);
      claimAcross(clearY, x1, x2);
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
