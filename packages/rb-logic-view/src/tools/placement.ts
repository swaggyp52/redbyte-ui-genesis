import type { Node } from '@redbyte/rb-logic-core';
import type { Camera } from '../useLogicViewStore';
import { resolvePortGeometry } from '../symbols/portGeometry';

export const GRID_SIZE = 16;
export const NODE_SIZE = 48; // Standard node body size in world-space pixels
export const NODE_CLEARANCE = GRID_SIZE; // Keep one visible grid cell between bodies
export const SPAWN_OFFSET = NODE_SIZE + NODE_CLEARANCE;

/**
 * What the caller is about to put on the canvas. Placement used to assume every symbol was
 * a 48px gate, so placing four five-port module instances - each about twice that in both
 * axes - produced a pile in which some symbols had no exposed body left to click.
 */
export interface SpawnFootprint {
    /** How many slots the caller is about to fill, including the first. Buses fill one per bit. */
    slots?: number;
    /** World-space distance between consecutive slots, downwards. */
    spacing?: number;
    /** World-space width of ONE placed symbol. Defaults to a standard gate. */
    width?: number;
    /** World-space height of ONE placed symbol. Defaults to a standard gate. */
    height?: number;
}

/** The rendered body size of a node, from the same geometry the schematic draws with. */
export function measureNodeSize(node: Node): { width: number; height: number } {
    try {
        const body = resolvePortGeometry(node).body;
        const width = Math.abs(body.maxX - body.minX);
        const height = Math.abs(body.maxY - body.minY);
        return {
            width: Number.isFinite(width) && width > 0 ? width : NODE_SIZE,
            height: Number.isFinite(height) && height > 0 ? height : NODE_SIZE,
        };
    } catch {
        // A node type the symbol table does not know still deserves standard clearance.
        return { width: NODE_SIZE, height: NODE_SIZE };
    }
}

export function findSmartSpawnPosition(
    existingNodes: Node[],
    center: { x: number; y: number },
    gridSize: number = GRID_SIZE,
    footprint?: SpawnFootprint
): { x: number; y: number } {
    const safeGridSize = Number.isFinite(gridSize) && gridSize > 0 ? gridSize : GRID_SIZE;
    const safeCenterX = Number.isFinite(center.x) ? center.x : 0;
    const safeCenterY = Number.isFinite(center.y) ? center.y : 0;
    const baseX = Math.round(safeCenterX / safeGridSize) * safeGridSize;
    const baseY = Math.round(safeCenterY / safeGridSize) * safeGridSize;
    // The symbol being placed, and every symbol already on the canvas, are measured with the
    // geometry the schematic actually draws. Assuming a 48px gate for both is what let four
    // module instances land on top of one another.
    const placedWidth =
        footprint && Number.isFinite(footprint.width) && (footprint.width as number) > 0
            ? (footprint.width as number)
            : NODE_SIZE;
    const placedHeight =
        footprint && Number.isFinite(footprint.height) && (footprint.height as number) > 0
            ? (footprint.height as number)
            : NODE_SIZE;

    const occupied = existingNodes
        .filter(
            (node) =>
                node.position != null &&
                Number.isFinite(node.position.x) &&
                Number.isFinite(node.position.y)
        )
        .map((node) => {
            const size = measureNodeSize(node);
            return {
                x: (node.position as { x: number; y: number }).x,
                y: (node.position as { x: number; y: number }).y,
                // Two bodies clear each other when their centres are at least half of each
                // body apart on one axis, plus a visible gap.
                separationX: (placedWidth + size.width) / 2 + safeGridSize,
                separationY: (placedHeight + size.height) / 2 + safeGridSize,
            };
        });

    // Step far enough that the walk escapes even the largest symbol in play.
    const widestSeparation = occupied.reduce(
        (widest, entry) => Math.max(widest, entry.separationX, entry.separationY),
        placedWidth + safeGridSize
    );
    const spawnOffset = Math.ceil(widestSeparation / safeGridSize) * safeGridSize;

    const slotCount =
        footprint && Number.isFinite(footprint.slots) && (footprint.slots as number) > 1
            ? Math.floor(footprint.slots as number)
            : 1;
    const slotSpacing =
        footprint && Number.isFinite(footprint.spacing) && (footprint.spacing as number) > 0
            ? (footprint.spacing as number)
            : 0;
    const slotOffsets = Array.from(
        { length: slotCount },
        (_unused, slot) => slot * slotSpacing
    );

    // A point can block at most two candidates on this evenly spaced diagonal,
    // so 2n + 1 candidates guarantees a free footprint for n finite nodes. Each
    // further slot the caller will fill can be blocked by the same points again.
    const candidateCount = occupied.length * 2 * slotCount + 1;
    for (let step = 0; step < candidateCount; step += 1) {
        const candidate = {
            x: baseX + step * spawnOffset,
            y: baseY + step * spawnOffset,
        };
        const isFree = occupied.every((entry) =>
            slotOffsets.every(
                (offset) =>
                    Math.abs(candidate.x - entry.x) >= entry.separationX ||
                    Math.abs(candidate.y + offset - entry.y) >= entry.separationY
            )
        );
        if (isFree) return candidate;
    }

    // The candidate bound above is exhaustive; retain a deterministic fallback
    // for defensive completeness if the footprint rule changes in the future.
    return {
        x: baseX + candidateCount * spawnOffset,
        y: baseY + candidateCount * spawnOffset,
    };
}
