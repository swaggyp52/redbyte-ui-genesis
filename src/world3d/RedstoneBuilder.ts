import { mapLogicToRedstone } from "../logic/LogicToRedstone";

export interface World3DHandle {
  setBlock(x: number, y: number, z: number, type: string): void;
  clearArea(cx: number, cy: number, cz: number, radius: number): void;
}

let worldHandle: World3DHandle | null = null;

export function registerWorld3D(h: World3DHandle) {
  worldHandle = h;
}

export function buildLogicInto3D(template: any) {
  if (!worldHandle) return;

  const mapping = mapLogicToRedstone(template);
  worldHandle.clearArea(50, 20, 50, 64);

  for (const block of mapping.blocks) {
    worldHandle.setBlock(block.x, block.y, block.z, block.type);
  }
}


