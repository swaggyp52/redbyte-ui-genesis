import { mapLogicToRedstone } from "../../logic/LogicToRedstone";
import { LogicTemplate } from "../../logic/LogicTypes";
import { ProjectState } from "../context/ProjectTypes";
import {
  WORLD_SIZE,
  clearWorld,
  setVoxel,
  type VoxelType,
} from "../../world3d/VoxelWorld";

export interface LogicWorldMapping {
  blocks: number;
  nodePositions: Record<string, { x: number; y: number; z: number }>;
}

export interface ProjectWorldMapping extends LogicWorldMapping {
  nets: number;
  clocks: number;
  ioPins: number;
  layer: number;
  description: string;
}

const TYPE_TRANSLATION: Record<string, VoxelType> = {
  lever: "source",
  repeater_clock: "repeater",
  redstone_repeater: "repeater",
  redstone_dust: "wire",
  redstone_torch: "torch",
  redstone_lamp: "output",
};

function translateType(type: string): VoxelType {
  return TYPE_TRANSLATION[type] ?? "wire";
}

function clampLayer(layer: number): number {
  return Math.max(0, Math.min(WORLD_SIZE - 1, Math.floor(layer)));
}

interface NormalizedBlock {
  x: number;
  y: number;
  z: number;
  type: VoxelType;
  logicNodeId?: string;
  power?: number;
}

function normalizeMapping(
  template: LogicTemplate,
  layer: number
): { blocks: NormalizedBlock[]; nodePositions: Record<string, NormalizedBlock> } {
  const mapping = mapLogicToRedstone(template);
  if (!mapping.blocks.length) {
    return { blocks: [], nodePositions: {} };
  }

  const minX = Math.min(...mapping.blocks.map((b) => b.x));
  const maxX = Math.max(...mapping.blocks.map((b) => b.x));
  const minZ = Math.min(...mapping.blocks.map((b) => b.z));
  const maxZ = Math.max(...mapping.blocks.map((b) => b.z));

  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const margin = 1;
  const available = Math.max(1, WORLD_SIZE - margin * 2);
  const scale = Math.min(available / spanX, available / spanZ);

  const nodePositions: Record<string, NormalizedBlock> = {};
  const normalized: NormalizedBlock[] = mapping.blocks.map((block) => {
    const nx = margin + Math.floor((block.x - minX) * scale);
    const nz = margin + Math.floor((block.z - minZ) * scale);
    const ny = clampLayer(layer);
    const mapped: NormalizedBlock = {
      x: Math.min(WORLD_SIZE - 1, nx),
      y: ny,
      z: Math.min(WORLD_SIZE - 1, nz),
      type: translateType(block.type),
      logicNodeId: block.logicNodeId,
      power: block.power,
    };
    if (block.logicNodeId && !nodePositions[block.logicNodeId]) {
      nodePositions[block.logicNodeId] = mapped;
    }
    return mapped;
  });

  return { blocks: normalized, nodePositions };
}

export function buildLogicProjectIntoWorld(
  template: LogicTemplate,
  layer: number
): LogicWorldMapping {
  const { blocks, nodePositions } = normalizeMapping(template, layer);
  clearWorld();
  for (const block of blocks) {
    setVoxel(block.x, block.y, block.z, block.type, Boolean(block.power));
  }
  return { blocks: blocks.length, nodePositions };
}

export function buildProjectIntoWorld(
  project: ProjectState,
  layer: number
): ProjectWorldMapping {
  const { blocks, nodePositions } = normalizeMapping(project.logic.template, layer);

  clearWorld();
  for (const block of blocks) {
    setVoxel(block.x, block.y, block.z, block.type, Boolean(block.power));
  }

  return {
    blocks: blocks.length,
    nets: project.logic.nets.length,
    clocks: project.logic.clocks.length,
    ioPins: project.logic.ioPins.length,
    layer,
    description: `${project.meta.name} mapped to layer ${layer}`,
    nodePositions,
  };
}

export function projectNodePositions(
  template: LogicTemplate,
  layer: number
): Record<string, { x: number; y: number; z: number }> {
  const { nodePositions } = normalizeMapping(template, layer);
  return Object.fromEntries(
    Object.entries(nodePositions).map(([key, value]) => [key, value])
  );
}
