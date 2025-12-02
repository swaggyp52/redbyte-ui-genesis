export type VoxelType =
  | "air"
  | "wire"
  | "source"
  | "gate_and"
  | "gate_or"
  | "gate_not"
  | "repeater"
  | "comparator"
  | "torch"
  | "output";

export type Orientation =
  | "north"
  | "south"
  | "east"
  | "west"
  | "up"
  | "down";

export interface VoxelBlock {
  x: number;
  y: number;
  z: number;
  type: VoxelType;
  /**
   * Legacy boolean view of power (kept for existing apps).
   * Always kept in sync with powerLevel > 0.
   */
  powered: boolean;
  /**
   * Integer power level (0–15).
   */
  powerLevel: number;
  /**
   * Optional orientation for directional components.
   */
  orientation?: Orientation;
  /**
   * Arbitrary per-block state (delay, mode, cooldowns, etc.).
   */
  meta?: Record<string, unknown>;
}

export const WORLD_SIZE = 16;

interface WorldState {
  blocks: Map<string, VoxelBlock>;
}

const state: WorldState = {
  blocks: new Map(),
};

type Listener = (voxels: VoxelBlock[]) => void;
const listeners: Listener[] = [];

function key(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}

export function inBounds(x: number, y: number, z: number): boolean {
  return (
    x >= 0 &&
    x < WORLD_SIZE &&
    y >= 0 &&
    y < WORLD_SIZE &&
    z >= 0 &&
    z < WORLD_SIZE
  );
}

function snapshot(): VoxelBlock[] {
  return Array.from(state.blocks.values()).map((b) => ({ ...b }));
}

function notify() {
  const snap = snapshot();
  for (const l of listeners) {
    try {
      l(snap);
    } catch {
      // ignore
    }
  }
}

export function subscribeWorld(listener: Listener) {
  listeners.push(listener);
  listener(snapshot());
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function getAllVoxels(): VoxelBlock[] {
  return snapshot();
}

export function getVoxel(
  x: number,
  y: number,
  z: number
): VoxelBlock | null {
  if (!inBounds(x, y, z)) return null;
  return state.blocks.get(key(x, y, z)) ?? null;
}

/**
 * Low-level setter used by tools and sims.
 * orientation/meta are optional; powerLevel is derived from powered when omitted.
 */
export function setVoxel(
  x: number,
  y: number,
  z: number,
  type: VoxelType,
  powered = false,
  options?: {
    powerLevel?: number;
    orientation?: Orientation;
    meta?: Record<string, unknown>;
  }
) {
  if (!inBounds(x, y, z)) return;

  const k = key(x, y, z);

  if (type === "air") {
    if (state.blocks.has(k)) {
      state.blocks.delete(k);
      notify();
    }
    return;
  }

  const powerLevel =
    typeof options?.powerLevel === "number"
      ? Math.max(0, Math.min(15, Math.floor(options.powerLevel)))
      : powered
      ? 15
      : 0;

  const block: VoxelBlock = {
    x,
    y,
    z,
    type,
    powered: powerLevel > 0,
    powerLevel,
    orientation: options?.orientation,
    meta: options?.meta,
  };

  state.blocks.set(k, block);
  notify();
}

export function clearWorld() {
  state.blocks.clear();
  notify();
}

export function cycleVoxelType(current: VoxelType): VoxelType {
  switch (current) {
    case "air":
      return "wire";
    case "wire":
      return "source";
    case "source":
      return "gate_and";
    case "gate_and":
      return "gate_or";
    case "gate_or":
      return "gate_not";
    case "gate_not":
      return "repeater";
    case "repeater":
      return "comparator";
    case "comparator":
      return "torch";
    case "torch":
      return "output";
    case "output":
    default:
      return "air";
  }
}

export interface SliceCell {
  x: number;
  z: number;
  type: VoxelType;
  powered: boolean;
  powerLevel: number;
}

export function getSliceGrid(y: number): SliceCell[][] {
  const rows: SliceCell[][] = [];
  const yy = Math.max(0, Math.min(WORLD_SIZE - 1, Math.floor(y)));

  for (let z = 0; z < WORLD_SIZE; z++) {
    const row: SliceCell[] = [];
    for (let x = 0; x < WORLD_SIZE; x++) {
      const b = getVoxel(x, yy, z);
      row.push({
        x,
        z,
        type: b?.type ?? "air",
        powered: b?.powered ?? false,
        powerLevel: b?.powerLevel ?? 0,
      });
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Replace the entire world with a new snapshot of blocks.
 * Only non-air blocks inside bounds are kept.
 * Used by the simulation engine.
 */
export function setWorldSnapshot(blocks: VoxelBlock[]) {
  state.blocks.clear();
  for (const b of blocks) {
    if (!inBounds(b.x, b.y, b.z)) continue;
    if (b.type === "air") continue;

    const powerLevel =
      typeof b.powerLevel === "number"
        ? Math.max(0, Math.min(15, Math.floor(b.powerLevel)))
        : b.powered
        ? 15
        : 0;

    state.blocks.set(key(b.x, b.y, b.z), {
      x: b.x,
      y: b.y,
      z: b.z,
      type: b.type,
      powered: powerLevel > 0,
      powerLevel,
      orientation: b.orientation,
      meta: b.meta ? { ...b.meta } : undefined,
    });
  }
  notify();
}

/**
 * Seed a small demo world so the 3D + 2D views have something interesting to show.
 */
export function seedTestWorld() {
  clearWorld();
  const midY = Math.floor(WORLD_SIZE / 2);
  const midZ = Math.floor(WORLD_SIZE / 2);

  // Horizontal line of dust with a source and output
  setVoxel(2, midY, midZ, "source", true, { powerLevel: 15 });
  for (let x = 3; x < 10; x++) {
    setVoxel(x, midY, midZ, "wire", false, { powerLevel: 0 });
  }
  setVoxel(10, midY, midZ, "output", false);

  // Simple vertical tower with a repeater at the top
  for (let y = midY; y < Math.min(WORLD_SIZE, midY + 3); y++) {
    setVoxel(5, y, midY + 3, "wire", false);
  }
  setVoxel(5, midY + 3, midZ + 3, "repeater", false, {
    orientation: "east",
    meta: { delay: 2, timer: 0, targetPowered: false },
  });

  // A torch inverter: torch sitting above a wire
  setVoxel(8, midY - 1, midZ - 3, "wire", false);
  setVoxel(8, midY, midZ - 3, "torch", true);

  // Small comparator demo (primary from west, sides north/south)
  setVoxel(4, midY, midZ + 2, "wire", false);
  setVoxel(5, midY, midZ + 2, "comparator", false, {
    orientation: "east",
    meta: { mode: "compare" },
  });
}
