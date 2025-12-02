import type { RedstoneGrid, RedstoneCell, RedstoneCellType } from "../sim/RedstoneTypes";
import {
  WORLD_SIZE,
  VoxelType,
  setVoxel,
  getSliceGrid,
} from "./VoxelWorld";
import {
  loadBlueprint,
  saveBlueprint,
} from "../sim/RedstoneBlueprints";

function mapCellTypeToVoxel(type: RedstoneCellType): VoxelType {
  switch (type) {
    case "empty":
      return "air";
    case "wire":
      return "wire";
    case "source":
      return "source";
    case "gate_and":
      return "gate_and";
    case "gate_or":
      return "gate_or";
    case "gate_not":
      return "gate_not";
    case "output":
      return "output";
    default:
      return "air";
  }
}

function mapVoxelTypeToCell(type: VoxelType): RedstoneCellType {
  switch (type) {
    case "air":
      return "empty";
    case "wire":
      return "wire";
    case "source":
      return "source";
    case "gate_and":
      return "gate_and";
    case "gate_or":
      return "gate_or";
    case "gate_not":
      return "gate_not";
    case "output":
      return "output";
    default:
      return "empty";
  }
}

/**
 * Project a 2D RedstoneGrid into a single Y-level layer of the 3D voxel world.
 * Grid index: grid[y][x] -> voxel(xOffset + x, yLevel, zOffset + y)
 */
export function writeGridToVoxelLayer(
  grid: RedstoneGrid,
  yLevel: number,
  options?: {
    offsetX?: number;
    offsetZ?: number;
    clearLayer?: boolean;
  }
) {
  const offsetX = options?.offsetX ?? 0;
  const offsetZ = options?.offsetZ ?? 0;
  const y = Math.max(0, Math.min(WORLD_SIZE - 1, Math.floor(yLevel)));

  if (options?.clearLayer) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        setVoxel(x, y, z, "air", false);
      }
    }
  }

  const height = grid.length;
  const width = height > 0 ? grid[0].length : 0;

  for (let gy = 0; gy < height; gy++) {
    const row = grid[gy];
    for (let gx = 0; gx < width; gx++) {
      const cell = row[gx];
      const wx = offsetX + gx;
      const wz = offsetZ + gy;

      if (wx < 0 || wx >= WORLD_SIZE || wz < 0 || wz >= WORLD_SIZE) {
        continue;
      }

      const voxelType = mapCellTypeToVoxel(cell.type);
      if (voxelType === "air") {
        setVoxel(wx, y, wz, "air", false);
      } else {
        setVoxel(wx, y, wz, voxelType, !!cell.powered);
      }
    }
  }
}

/**
 * Extract a Y-level slice from the 3D voxel world and represent it as a 2D RedstoneGrid.
 * Slice index: slice[z][x] -> grid[y][x], where grid row index y corresponds to world z.
 */
export function extractVoxelLayerToGrid(yLevel: number): RedstoneGrid {
  const y = Math.max(0, Math.min(WORLD_SIZE - 1, Math.floor(yLevel)));
  const slice = getSliceGrid(y);

  const height = slice.length;
  const width = height > 0 ? slice[0].length : 0;

  const grid: RedstoneGrid = [];

  for (let gz = 0; gz < height; gz++) {
    const row = slice[gz];
    const gridRow: RedstoneCell[] = [];
    for (let gx = 0; gx < width; gx++) {
      const cell = row[gx];
      const type = mapVoxelTypeToCell(cell.type);
      const powered = !!cell.powered;
      gridRow.push({ type, powered });
    }
    grid.push(gridRow);
  }

  return grid;
}

/**
 * Load a named 2D blueprint and project it into a Y-level of the voxel world.
 */
export function importBlueprintIntoWorld(
  blueprintName: string,
  yLevel: number,
  options?: {
    offsetX?: number;
    offsetZ?: number;
    clearLayer?: boolean;
  }
): boolean {
  const grid = loadBlueprint(blueprintName);
  if (!grid) return false;

  writeGridToVoxelLayer(grid, yLevel, options);
  return true;
}

/**
 * Take a Y-level slice of the voxel world and save it as a 2D blueprint.
 */
export function exportSliceToBlueprint(
  blueprintName: string,
  yLevel: number
) {
  const grid = extractVoxelLayerToGrid(yLevel);
  saveBlueprint(blueprintName, grid);
}
