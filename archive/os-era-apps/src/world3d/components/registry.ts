import {
  WORLD_SIZE,
  type VoxelType,
  type VoxelBlock,
  type Orientation,
} from "../VoxelWorld";
import type {
  RedstoneComponent,
  ComponentContext,
  ComponentResult,
} from "./RedstoneComponent";

type WorldMap = Map<string, VoxelBlock>;

function key(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
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

function makeContext(world: WorldMap): ComponentContext {
  return {
    getBlock(x, y, z) {
      if (!inBounds(x, y, z)) return null;
      return world.get(key(x, y, z)) ?? null;
    },
    getNeighbors(x, y, z) {
      const coords = [
        { x: x - 1, y, z },
        { x: x + 1, y, z },
        { x, y: y - 1, z },
        { x, y: y + 1, z },
        { x, y, z: z - 1 },
        { x, y, z: z + 1 },
      ].filter((c) => inBounds(c.x, c.y, c.z));

      const result: VoxelBlock[] = [];
      for (const c of coords) {
        const b = world.get(key(c.x, c.y, c.z));
        if (b) result.push(b);
      }
      return result;
    },
  };
}

// Utility: clamp power level
function clampPower(level: number): number {
  if (!Number.isFinite(level)) return 0;
  const v = Math.floor(level);
  if (v < 0) return 0;
  if (v > 15) return 15;
  return v;
}

function orientationToVector(ori: Orientation | undefined): {
  dx: number;
  dy: number;
  dz: number;
} {
  switch (ori) {
    case "north":
      return { dx: 0, dy: 0, dz: -1 };
    case "south":
      return { dx: 0, dy: 0, dz: 1 };
    case "west":
      return { dx: -1, dy: 0, dz: 0 };
    case "east":
      return { dx: 1, dy: 0, dz: 0 };
    case "up":
      return { dx: 0, dy: 1, dz: 0 };
    case "down":
      return { dx: 0, dy: -1, dz: 0 };
    default:
      // default facing east
      return { dx: 1, dy: 0, dz: 0 };
  }
}

function sideVectors(ori: Orientation | undefined): { dx: number; dz: number }[] {
  switch (ori) {
    case "north":
      return [
        { dx: -1, dz: 0 },
        { dx: 1, dz: 0 },
      ];
    case "south":
      return [
        { dx: 1, dz: 0 },
        { dx: -1, dz: 0 },
      ];
    case "west":
      return [
        { dx: 0, dz: -1 },
        { dx: 0, dz: 1 },
      ];
    case "east":
    default:
      return [
        { dx: 0, dz: 1 },
        { dx: 0, dz: -1 },
      ];
  }
}

// Base components
const AirComponent: RedstoneComponent = {
  id: "air",
  tick() {
    return { powered: false, powerLevel: 0 };
  },
};

const SourceComponent: RedstoneComponent = {
  id: "source",
  tick(block) {
    const level = block.powerLevel > 0 ? block.powerLevel : 15;
    return { powered: level > 0, powerLevel: level, meta: block.meta };
  },
};

const WireComponent: RedstoneComponent = {
  id: "wire",
  tick(block, ctx) {
    const neigh = ctx.getNeighbors(block.x, block.y, block.z);
    const maxNeighborPower = neigh.reduce(
      (max, n) => (n.powerLevel > max ? n.powerLevel : max),
      0
    );
    const level = maxNeighborPower > 0 ? 15 : 0;
    return { powered: level > 0, powerLevel: level, meta: block.meta };
  },
};

type RepeaterMeta = {
  delay?: number;
  timer?: number;
  targetPowered?: boolean;
};

const RepeaterComponent: RedstoneComponent = {
  id: "repeater",
  tick(block, ctx) {
    const rawMeta = (block.meta ?? {}) as RepeaterMeta;
    let delay =
      typeof rawMeta.delay === "number" ? Math.floor(rawMeta.delay) : 1;
    if (delay < 1) delay = 1;
    if (delay > 4) delay = 4;

    let timer =
      typeof rawMeta.timer === "number" ? Math.floor(rawMeta.timer) : 0;
    let targetPowered =
      typeof rawMeta.targetPowered === "boolean"
        ? rawMeta.targetPowered
        : block.powered;

    const dir = orientationToVector(block.orientation);
    const backX = block.x - dir.dx;
    const backY = block.y - dir.dy;
    const backZ = block.z - dir.dz;

    let inputPowered = false;
    const inputBlock = ctx.getBlock(backX, backY, backZ);
    if (inputBlock) {
      inputPowered =
        inputBlock.powerLevel > 0 || inputBlock.powered === true;
    }

    if (inputPowered !== targetPowered) {
      targetPowered = inputPowered;
      timer = delay;
    } else if (timer > 0) {
      timer -= 1;
    }

    const nextPowered = timer === 0 ? targetPowered : block.powered;
    const level = nextPowered ? 15 : 0;

    const meta: RepeaterMeta = {
      delay,
      timer,
      targetPowered,
    };

    return {
      powered: nextPowered,
      powerLevel: level,
      meta,
    };
  },
};

type ComparatorMeta = {
  mode?: "compare" | "subtract";
};

const ComparatorComponent: RedstoneComponent = {
  id: "comparator",
  tick(block, ctx) {
    const rawMeta = (block.meta ?? {}) as ComparatorMeta;
    const mode: "compare" | "subtract" =
      rawMeta.mode === "subtract" ? "subtract" : "compare";

    const dir = orientationToVector(block.orientation);

    // Primary input from the back
    const primaryX = block.x - dir.dx;
    const primaryY = block.y - dir.dy;
    const primaryZ = block.z - dir.dz;

    let primary = 0;
    const primaryBlock = ctx.getBlock(primaryX, primaryY, primaryZ);
    if (primaryBlock) {
      primary = Math.max(0, primaryBlock.powerLevel);
      if (primary === 0 && primaryBlock.powered) {
        primary = 15;
      }
    }

    // Side inputs (two side positions)
    const sides = sideVectors(block.orientation);
    let sideMax = 0;
    for (const s of sides) {
      const sx = block.x + s.dx;
      const sy = block.y;
      const sz = block.z + s.dz;
      const sb = ctx.getBlock(sx, sy, sz);
      if (!sb) continue;
      let v = Math.max(0, sb.powerLevel);
      if (v === 0 && sb.powered) v = 15;
      if (v > sideMax) sideMax = v;
    }

    let outLevel = 0;
    if (mode === "subtract") {
      outLevel = Math.max(0, primary - sideMax);
    } else {
      // compare: output primary if it is >= sideMax and > 0
      if (primary > 0 && primary >= sideMax) {
        outLevel = primary;
      } else {
        outLevel = 0;
      }
    }

    outLevel = clampPower(outLevel);

    const meta: ComparatorMeta = {
      mode,
    };

    return {
      powered: outLevel > 0,
      powerLevel: outLevel,
      meta,
    };
  },
};

const TorchComponent: RedstoneComponent = {
  id: "torch",
  tick(block, ctx) {
    const by = block.y - 1;
    let belowPowered = false;
    if (by >= 0 && by < WORLD_SIZE) {
      const below = ctx.getBlock(block.x, by, block.z);
      belowPowered = !!below && (below.powered || below.powerLevel > 0);
    }
    const level = belowPowered ? 0 : 15;
    return { powered: level > 0, powerLevel: level, meta: block.meta };
  },
};

const AndComponent: RedstoneComponent = {
  id: "gate_and",
  tick(block, ctx) {
    const neigh = ctx.getNeighbors(block.x, block.y, block.z);
    const poweredNeighbors = neigh.filter(
      (n) => n.powerLevel > 0 || n.powered
    ).length;
    const level = poweredNeighbors >= 2 ? 15 : 0;
    return { powered: level > 0, powerLevel: level, meta: block.meta };
  },
};

const OrComponent: RedstoneComponent = {
  id: "gate_or",
  tick(block, ctx) {
    const neigh = ctx.getNeighbors(block.x, block.y, block.z);
    const poweredNeighbors = neigh.filter(
      (n) => n.powerLevel > 0 || n.powered
    ).length;
    const level = poweredNeighbors >= 1 ? 15 : 0;
    return { powered: level > 0, powerLevel: level, meta: block.meta };
  },
};

const NotComponent: RedstoneComponent = {
  id: "gate_not",
  tick(block, ctx) {
    const neigh = ctx.getNeighbors(block.x, block.y, block.z);
    const poweredNeighbors = neigh.filter(
      (n) => n.powerLevel > 0 || n.powered
    ).length;
    const level = poweredNeighbors === 0 ? 15 : 0;
    return { powered: level > 0, powerLevel: level, meta: block.meta };
  },
};

const OutputComponent: RedstoneComponent = {
  id: "output",
  tick(block, ctx) {
    const neigh = ctx.getNeighbors(block.x, block.y, block.z);
    const maxNeighborPower = neigh.reduce(
      (max, n) => (n.powerLevel > max ? n.powerLevel : max),
      0
    );
    const level = maxNeighborPower > 0 ? 15 : 0;
    return { powered: level > 0, powerLevel: level, meta: block.meta };
  },
};

const registry = new Map<VoxelType, RedstoneComponent>();

function register(type: VoxelType, comp: RedstoneComponent) {
  registry.set(type, comp);
}

// Default registrations
register("air", AirComponent);
register("source", SourceComponent);
register("wire", WireComponent);
register("repeater", RepeaterComponent);
register("comparator", ComparatorComponent);
register("torch", TorchComponent);
register("gate_and", AndComponent);
register("gate_or", OrComponent);
register("gate_not", NotComponent);
register("output", OutputComponent);

export function getComponent(type: VoxelType): RedstoneComponent {
  return registry.get(type) ?? AirComponent;
}

/**
 * Evaluate a single block with the registered component behavior.
 */
export function evaluateBlock(
  block: VoxelBlock,
  world: WorldMap
): VoxelBlock {
  const ctx = makeContext(world);
  const comp = getComponent(block.type);
  const result: ComponentResult = comp.tick(block, ctx);
  const powerLevel = clampPower(result.powerLevel);
  return {
    ...block,
    powerLevel,
    powered: powerLevel > 0,
    meta: result.meta ?? block.meta,
  };
}

