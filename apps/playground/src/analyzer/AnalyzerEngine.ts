import type { VoxelBlock } from "../world3d/VoxelWorld";
import { WORLD_SIZE, getAllVoxels } from "../world3d/VoxelWorld";
import { subscribeSimHistory } from "../world3d/SimMetrics";

export interface LoopInfo {
  cycle: string[];
  length: number;
}

export interface OscillationInfo {
  key: string;
  frequency: number;
  period: number;
}

export interface FanoutInfo {
  key: string;
  fanout: number;
}

export interface DepthInfo {
  maxDepth: number;
  deepestNode: string;
}

export interface AnalysisResult {
  loops: LoopInfo[];
  oscillators: OscillationInfo[];
  fanout: FanoutInfo[];
  depth: DepthInfo;
}

let prevStates: Map<string, boolean>[] = [];

const MAX_SNAP = 32;

const neighbors = [
  { dx: -1, dy: 0, dz: 0 },
  { dx: 1, dy: 0, dz: 0 },
  { dx: 0, dy: -1, dz: 0 },
  { dx: 0, dy: 1, dz: 0 },
  { dx: 0, dy: 0, dz: -1 },
  { dx: 0, dy: 0, dz: 1 },
];

function key(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function buildMap(vox: VoxelBlock[]) {
  const m = new Map<string, VoxelBlock>();
  for (const b of vox) m.set(key(b.x, b.y, b.z), b);
  return m;
}

function inBounds(x: number, y: number, z: number) {
  return (
    x >= 0 &&
    x < WORLD_SIZE &&
    y >= 0 &&
    y < WORLD_SIZE &&
    z >= 0 &&
    z < WORLD_SIZE
  );
}

function getNeighbors(map: Map<string, VoxelBlock>, k: string) {
  const [x, y, z] = k.split(",").map(Number);
  const result: string[] = [];
  for (const n of neighbors) {
    const nx = x + n.dx;
    const ny = y + n.dy;
    const nz = z + n.dz;
    if (!inBounds(nx, ny, nz)) continue;
    const nk = key(nx, ny, nz);
    if (map.has(nk)) result.push(nk);
  }
  return result;
}

function detectLoops(map: Map<string, VoxelBlock>): LoopInfo[] {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const loops: LoopInfo[] = [];

  function dfs(node: string, path: string[]) {
    if (stack.has(node)) {
      const idx = path.indexOf(node);
      if (idx >= 0) {
        const cycle = path.slice(idx);
        loops.push({ cycle, length: cycle.length });
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);
    const neigh = getNeighbors(map, node);
    for (const nxt of neigh) {
      dfs(nxt, path.concat([nxt]));
    }
    stack.delete(node);
  }

  for (const k of map.keys()) dfs(k, [k]);
  return loops;
}

function detectOscillations(): OscillationInfo[] {
  if (prevStates.length < MAX_SNAP) return [];

  const periodMap = new Map<string, number>();
  const freqMap = new Map<string, number>();

  const nFrames = prevStates.length;

  const keys = new Set<string>();
  for (const snap of prevStates) {
    for (const k of snap.keys()) keys.add(k);
  }

  for (const k of keys) {
    let toggles = 0;
    let last = prevStates[0].get(k);

    for (let i = 1; i < nFrames; i++) {
      const now = prevStates[i].get(k);
      if (now !== last) toggles++;
      last = now;
    }

    if (toggles >= 4) {
      const period = Math.floor(nFrames / toggles);
      periodMap.set(k, period);
      freqMap.set(k, toggles / nFrames);
    }
  }

  const out: OscillationInfo[] = [];
  for (const [k, p] of periodMap) {
    out.push({ key: k, period: p, frequency: freqMap.get(k) ?? 0 });
  }
  return out;
}

function computeFanout(map: Map<string, VoxelBlock>): FanoutInfo[] {
  const result: FanoutInfo[] = [];
  for (const k of map.keys()) {
    const neigh = getNeighbors(map, k);
    result.push({ key: k, fanout: neigh.length });
  }
  return result.sort((a, b) => b.fanout - a.fanout);
}

function computeDepth(map: Map<string, VoxelBlock>): DepthInfo {
  let maxDepth = 0;
  let deepestNode = "";

  for (const k of map.keys()) {
    const visited = new Set([k]);
    const queue: { k: string; d: number }[] = [{ k, d: 0 }];

    while (queue.length) {
      const { k: cur, d } = queue.shift()!;
      if (d > maxDepth) {
        maxDepth = d;
        deepestNode = cur;
      }
      const neigh = getNeighbors(map, cur);
      for (const n of neigh) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push({ k: n, d: d + 1 });
        }
      }
    }
  }

  return { maxDepth, deepestNode };
}

let listeners: ((r: AnalysisResult) => void)[] = [];

export function subscribeAnalysis(listener: (r: AnalysisResult) => void) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notify(r: AnalysisResult) {
  for (const l of listeners) {
    try {
      l(r);
    } catch {}
  }
}

subscribeSimHistory(() => {
  const vox = getAllVoxels();
  const map = buildMap(vox);

  const snapMap = new Map<string, boolean>();
  for (const b of vox) snapMap.set(key(b.x, b.y, b.z), b.powered);

  prevStates.push(snapMap);
  if (prevStates.length > MAX_SNAP) {
    prevStates = prevStates.slice(prevStates.length - MAX_SNAP);
  }

  const loops = detectLoops(map);
  const oscillators = detectOscillations();
  const fanout = computeFanout(map);
  const depth = computeDepth(map);

  notify({ loops, oscillators, fanout, depth });
});

