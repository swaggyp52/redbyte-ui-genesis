import {
  WORLD_SIZE,
  type VoxelBlock,
  getAllVoxels,
  setWorldSnapshot,
} from "./VoxelWorld";
import { buildSampleFromWorld, pushSimSample } from "./SimMetrics";
import { evaluateBlock } from "./components/registry";

function key(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}

function buildWorldMap(blocks: VoxelBlock[]): Map<string, VoxelBlock> {
  const m = new Map<string, VoxelBlock>();
  for (const b of blocks) {
    m.set(key(b.x, b.y, b.z), b);
  }
  return m;
}

function inBounds(x: number, y: number, z: number): boolean {
  return (
    x >= 0 &&
    x < WORLD_SIZE &&
    y >= 0 &&
    y < WORLD_SIZE &&
    z >= 0 &&
    z < WORLD_SIZE
  );
}

function neighborCoords(x: number, y: number, z: number) {
  return [
    { x: x - 1, y, z },
    { x: x + 1, y, z },
    { x, y: y - 1, z },
    { x, y: y + 1, z },
    { x, y, z: z - 1 },
    { x, y, z: z + 1 },
  ].filter((c) => inBounds(c.x, c.y, c.z));
}

/**
 * Compute dust (wire) power levels using a BFS from strong sources.
 * - Strong sources: any non-wire block with powerLevel>0 or powered=true.
 * - BFS spreads only through wire blocks, attenuating 1 level per block.
 */
function computeDustPower(blocks: VoxelBlock[]): Map<string, number> {
  const world = buildWorldMap(blocks);
  const dustPower = new Map<string, number>();

  type QueueItem = { x: number; y: number; z: number; level: number };
  const queue: QueueItem[] = [];

  // Seed from strong sources into adjacent wires
  for (const b of blocks) {
    if (b.type === "wire") continue;
    const level = b.powerLevel > 0 ? b.powerLevel : b.powered ? 15 : 0;
    if (level <= 0) continue;

    for (const n of neighborCoords(b.x, b.y, b.z)) {
      const nb = world.get(key(n.x, n.y, n.z));
      if (!nb || nb.type !== "wire") continue;
      const nextLevel = level - 1;
      if (nextLevel <= 0) continue;
      queue.push({ x: n.x, y: n.y, z: n.z, level: nextLevel });
    }
  }

  while (queue.length) {
    const item = queue.shift()!;
    if (item.level <= 0) continue;

    const k = key(item.x, item.y, item.z);
    const existing = dustPower.get(k);
    if (existing !== undefined && existing >= item.level) {
      continue;
    }
    dustPower.set(k, item.level);

    // Propagate to neighboring wires
    for (const n of neighborCoords(item.x, item.y, item.z)) {
      const nb = world.get(key(n.x, n.y, n.z));
      if (!nb || nb.type !== "wire") continue;
      const nextLevel = item.level - 1;
      if (nextLevel <= 0) continue;
      queue.push({ x: n.x, y: n.y, z: n.z, level: nextLevel });
    }
  }

  return dustPower;
}

/**
 * Compute the next world snapshot from the current one using:
 * 1) Dust BFS power solver
 * 2) Component framework for all non-wire blocks
 */
export function computeNextWorld(blocks: VoxelBlock[]): VoxelBlock[] {
  if (!blocks.length) return [];

  // 1) Dust power from BFS
  const dustPower = computeDustPower(blocks);

  // 2) Build a world map with dust already updated
  const worldWithDust = new Map<string, VoxelBlock>();
  for (const b of blocks) {
    if (b.type === "wire") {
      const lvl = dustPower.get(key(b.x, b.y, b.z)) ?? 0;
      const powered = lvl > 0;
      worldWithDust.set(key(b.x, b.y, b.z), {
        ...b,
        powerLevel: lvl,
        powered,
      });
    } else {
      worldWithDust.set(key(b.x, b.y, b.z), { ...b });
    }
  }

  // 3) Evaluate components using the updated dust
  const nextBlocks: VoxelBlock[] = [];
  for (const b of worldWithDust.values()) {
    if (b.type === "wire") {
      // Dust is fully solved by BFS; keep as-is.
      nextBlocks.push({ ...b });
    } else {
      const next = evaluateBlock(b, worldWithDust);
      nextBlocks.push(next);
    }
  }

  return nextBlocks;
}

/**
 * Advance the global voxel world by one simulation step.
 * Also records a metrics sample for the Redstone Stats app.
 * Returns the new snapshot.
 */
export function stepVoxelWorldOnce(): VoxelBlock[] {
  const current = getAllVoxels();
  const t0 =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  const next = computeNextWorld(current);
  const t1 =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  const evalMs = t1 - t0;

  setWorldSnapshot(next);

  const sample = buildSampleFromWorld(current, next, evalMs);
  pushSimSample(sample);

  return next;
}
