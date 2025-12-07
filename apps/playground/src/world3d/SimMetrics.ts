import type { VoxelBlock } from "./VoxelWorld";

export interface RedstoneSimSample {
  tick: number;
  poweredCount: number;
  wireCount: number;
  gateCount: number;
  outputCount: number;
  totalBlocks: number;
  changedCount: number;
  evalMs: number;
  clusterCount: number;
  maxClusterSize: number;
}

const MAX_SAMPLES = 256;

let samples: RedstoneSimSample[] = [];
let listeners: ((items: RedstoneSimSample[]) => void)[] = [];
let internalTick = 0;

function notify() {
  const snapshot = samples.map((s) => ({ ...s }));
  for (const l of listeners) {
    try {
      l(snapshot);
    } catch {
      // ignore
    }
  }
}

export function resetSimHistory() {
  samples = [];
  internalTick = 0;
  notify();
}

export function pushSimSample(sample: Omit<RedstoneSimSample, "tick">) {
  internalTick += 1;
  const full: RedstoneSimSample = { tick: internalTick, ...sample };
  samples = [...samples, full];
  if (samples.length > MAX_SAMPLES) {
    samples = samples.slice(samples.length - MAX_SAMPLES);
  }
  notify();
}

export function getSimHistory(): RedstoneSimSample[] {
  return samples.map((s) => ({ ...s }));
}

export function subscribeSimHistory(
  listener: (items: RedstoneSimSample[]) => void
) {
  listeners.push(listener);
  listener(getSimHistory());
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/**
 * Utility used by the engine to build a metrics sample
 * from prev/next voxel snapshots.
 */
export function buildSampleFromWorld(
  prev: VoxelBlock[],
  next: VoxelBlock[],
  evalMs: number
): Omit<RedstoneSimSample, "tick"> {
  const poweredCount = next.filter((b) => b.powered).length;
  const wireCount = next.filter((b) => b.type === "wire").length;
  const gateCount = next.filter((b) =>
    b.type === "gate_and" ||
    b.type === "gate_or" ||
    b.type === "gate_not" ||
    b.type === "repeater" ||
    b.type === "comparator" ||
    b.type === "torch"
  ).length;
  const outputCount = next.filter((b) => b.type === "output").length;
  const totalBlocks = next.length;

  const prevMap = new Map<string, { powered: boolean; powerLevel: number }>();
  for (const b of prev) {
    prevMap.set(`${b.x},${b.y},${b.z}`, {
      powered: b.powered,
      powerLevel: b.powerLevel ?? 0,
    });
  }
  let changedCount = 0;
  for (const b of next) {
    const key = `${b.x},${b.y},${b.z}`;
    const before = prevMap.get(key);
    if (!before) continue;
    if (before.powered !== b.powered || before.powerLevel !== b.powerLevel) {
      changedCount++;
    }
  }

  const poweredPositions = next.filter((b) => b.powered);
  const visited = new Set<string>();
  let clusterCount = 0;
  let maxClusterSize = 0;

  const neighborOffsets = [
    { dx: -1, dy: 0, dz: 0 },
    { dx: 1, dy: 0, dz: 0 },
    { dx: 0, dy: -1, dz: 0 },
    { dx: 0, dy: 1, dz: 0 },
    { dx: 0, dy: 0, dz: -1 },
    { dx: 0, dy: 0, dz: 1 },
  ];

  const mapByKey = new Map<string, VoxelBlock>();
  for (const b of poweredPositions) {
    mapByKey.set(`${b.x},${b.y},${b.z}`, b);
  }

  for (const b of poweredPositions) {
    const k = `${b.x},${b.y},${b.z}`;
    if (visited.has(k)) continue;

    clusterCount++;
    let size = 0;
    const queue: VoxelBlock[] = [b];
    visited.add(k);

    while (queue.length) {
      const cur = queue.shift()!;
      size++;
      for (const o of neighborOffsets) {
        const nx = cur.x + o.dx;
        const ny = cur.y + o.dy;
        const nz = cur.z + o.dz;
        const nk = `${nx},${ny},${nz}`;
        if (!mapByKey.has(nk) || visited.has(nk)) continue;
        visited.add(nk);
        queue.push(mapByKey.get(nk)!);
      }
    }

    if (size > maxClusterSize) {
      maxClusterSize = size;
    }
  }

  return {
    poweredCount,
    wireCount,
    gateCount,
    outputCount,
    totalBlocks,
    changedCount,
    evalMs,
    clusterCount,
    maxClusterSize,
  };
}

