import {
  RedstoneCell,
  RedstoneCellType,
  RedstoneGrid,
  RedstoneSimConfig,
} from "./RedstoneTypes";

export function createGrid(
  config: RedstoneSimConfig = { width: 16, height: 16 }
): RedstoneGrid {
  const rows: RedstoneGrid = [];
  for (let y = 0; y < config.height; y++) {
    const row: RedstoneCell[] = [];
    for (let x = 0; x < config.width; x++) {
      row.push({
        type: "empty",
        powered: false,
      });
    }
    rows.push(row);
  }
  return rows;
}

export function cloneGrid(grid: RedstoneGrid): RedstoneGrid {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

export function inBounds(
  grid: RedstoneGrid,
  x: number,
  y: number
): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;
}

export function getNeighbors(
  grid: RedstoneGrid,
  x: number,
  y: number
): { x: number; y: number }[] {
  const coords = [
    { x: x - 1, y },
    { x: x + 1, y },
    { x: x - 1, y: y - 1 },
    { x: x + 1, y: y - 1 },
    { x: x, y: y - 1 },
    { x: x, y: y + 1 },
  ];
  return coords.filter((c) => inBounds(grid, c.x, c.y));
}

// Cycle through all cell types
export function cycleCellType(type: RedstoneCellType): RedstoneCellType {
  switch (type) {
    case "empty":
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
      return "output";
    case "output":
    default:
      return "empty";
  }
}

export function toggleCell(
  grid: RedstoneGrid,
  x: number,
  y: number
): RedstoneGrid {
  if (!inBounds(grid, x, y)) return grid;
  const next = cloneGrid(grid);
  const cell = next[y][x];

  cell.type = cycleCellType(cell.type);

  if (cell.type === "empty") {
    cell.powered = false;
  }
  if (cell.type === "source") {
    cell.powered = true;
  }

  return next;
}

// One simulation step:
// - Sources stay powered
// - Wires conduct power from powered neighbors
// - AND gates require 2+ powered neighbors
// - OR gates require 1+ powered neighbor
// - NOT gates powered when no powered neighbors
// - Outputs mirror "any powered neighbor"
export function stepGrid(grid: RedstoneGrid): RedstoneGrid {
  const current = cloneGrid(grid);
  const next = cloneGrid(grid);

  for (let y = 0; y < current.length; y++) {
    for (let x = 0; x < current[0].length; x++) {
      const cell = current[y][x];

      if (cell.type === "source") {
        next[y][x].powered = true;
        continue;
      }

      const neighbors = getNeighbors(current, x, y);
      const poweredNeighbors = neighbors.filter((n) => {
        const c = current[n.y][n.x];
        return c.powered && c.type !== "empty";
      });

      switch (cell.type) {
        case "wire": {
          next[y][x].powered = poweredNeighbors.length > 0;
          break;
        }
        case "gate_and": {
          next[y][x].powered = poweredNeighbors.length >= 2;
          break;
        }
        case "gate_or": {
          next[y][x].powered = poweredNeighbors.length >= 1;
          break;
        }
        case "gate_not": {
          next[y][x].powered = poweredNeighbors.length === 0;
          break;
        }
        case "output": {
          next[y][x].powered = poweredNeighbors.length > 0;
          break;
        }
        case "empty":
        default: {
          next[y][x].powered = false;
          break;
        }
      }
    }
  }

  return next;
}
