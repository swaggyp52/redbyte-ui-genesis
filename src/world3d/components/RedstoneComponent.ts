import type { VoxelBlock } from "../VoxelWorld";

export interface ComponentContext {
  getBlock(x: number, y: number, z: number): VoxelBlock | null;
  getNeighbors(x: number, y: number, z: number): VoxelBlock[];
}

export interface ComponentResult {
  /**
   * Boolean view of power. Will be mirrored into block.powered.
   */
  powered: boolean;
  /**
   * Integer power level (0–15). Will be mirrored into block.powerLevel.
   */
  powerLevel: number;
  /**
   * Optional updated meta payload for this block.
   */
  meta?: Record<string, unknown>;
}

export interface RedstoneComponent {
  id: string;
  /**
   * Given the current block and the simulation context, compute its next state.
   * This is pure logic; the engine will write the result back into a new VoxelBlock snapshot.
   */
  tick(block: VoxelBlock, ctx: ComponentContext): ComponentResult;
}
