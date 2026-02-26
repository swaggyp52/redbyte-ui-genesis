import { LogicTemplate } from "./LogicTypes";

export interface RedstoneBlock {
  x: number;
  y: number;
  z: number;
  type: string;
  power?: number;
  logicNodeId?: string;
}

export interface RedstoneMappingResult {
  blocks: RedstoneBlock[];
  description: string;
}

/**
 * Hybrid layout:
 * - uses a clean grid (4-block spacing) for readability
 * - uses authentic redstone parts for gate representation
 *   (lever, lamp, dust, repeater, torch)
 */
const GATE_BLOCK_MAP: Record<string, string> = {
  INPUT_TOGGLE: "lever",
  CLOCK: "repeater_clock",
  GATE_AND: "redstone_repeater",
  GATE_OR: "redstone_dust",
  GATE_NOT: "redstone_torch",
  GATE_XOR: "redstone_dust",
  OUTPUT_LAMP: "redstone_lamp",
};

export function mapLogicToRedstone(
  template: LogicTemplate
): RedstoneMappingResult {
  const blocks: RedstoneBlock[] = [];

  const baseX = 50;
  const baseY = 20;
  const baseZ = 50;
  const SPACING = 4;

  for (const node of template.nodes) {
    const x = baseX + node.x * SPACING;
    const y = baseY;
    const z = baseZ + node.y * SPACING;

    const type = GATE_BLOCK_MAP[node.type] ?? "stone";

    blocks.push({ x, y, z, type, logicNodeId: node.id });
  }

  for (const wire of template.wires) {
    const fromNode = template.nodes.find((n) => n.id === wire.fromNodeId);
    const toNode = template.nodes.find((n) => n.id === wire.toNodeId);
    if (!fromNode || !toNode) continue;

    const x1 = baseX + fromNode.x * SPACING;
    const z1 = baseZ + fromNode.y * SPACING;
    const x2 = baseX + toNode.x * SPACING;
    const z2 = baseZ + toNode.y * SPACING;

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    for (let xx = minX; xx <= maxX; xx++) {
      blocks.push({
        x: xx,
        y: baseY,
        z: z1,
        type: "redstone_dust",
      });
    }

    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);
    for (let zz = minZ; zz <= maxZ; zz++) {
      blocks.push({
        x: x2,
        y: baseY,
        z: zz,
        type: "redstone_dust",
      });
    }
  }

  return {
    blocks,
    description: "Auto-generated hybrid-layout redstone circuit",
  };
}

