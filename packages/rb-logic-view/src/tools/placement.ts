import type { Node } from '@redbyte/rb-logic-core';
import type { Camera } from '../useLogicViewStore';

export const GRID_SIZE = 16;
export const NODE_SIZE = 48; // Standard node body size in world-space pixels
export const NODE_CLEARANCE = GRID_SIZE; // Keep one visible grid cell between bodies
export const SPAWN_OFFSET = NODE_SIZE + NODE_CLEARANCE;

/**
 * Calculates a smart spawn position for a new node without overlapping the
 * rendered footprint of an existing standard node. Placement is evaluated in
 * world space, so camera zoom and pan do not change the clearance contract.
 */
/**
 * A spawn that occupies more than one slot - a bus drops one symbol per bit,
 * stacked downwards from the returned position. Clearing only the first slot
 * lets the remaining bits land on top of symbols that are already there.
 */
export interface SpawnFootprint {
    /** How many slots the caller is about to fill, including the first. */
    slots: number;
    /** World-space distance between consecutive slots, downwards. */
    spacing: number;
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
    const minimumCenterSeparation = NODE_SIZE + safeGridSize;
    const spawnOffset =
        Math.ceil(minimumCenterSeparation / safeGridSize) * safeGridSize;
    const occupiedPositions = existingNodes
        .map((node) => node.position)
        .filter(
            (position): position is { x: number; y: number } =>
                position != null &&
                Number.isFinite(position.x) &&
                Number.isFinite(position.y)
        );

    const slotCount =
        footprint && Number.isFinite(footprint.slots) && footprint.slots > 1
            ? Math.floor(footprint.slots)
            : 1;
    const slotSpacing =
        footprint && Number.isFinite(footprint.spacing) && footprint.spacing > 0
            ? footprint.spacing
            : 0;
    const slotOffsets = Array.from(
        { length: slotCount },
        (_unused, slot) => slot * slotSpacing
    );

    // A point can block at most two candidates on this evenly spaced diagonal,
    // so 2n + 1 candidates guarantees a free footprint for n finite nodes. Each
    // further slot the caller will fill can be blocked by the same points again.
    const candidateCount = occupiedPositions.length * 2 * slotCount + 1;
    for (let step = 0; step < candidateCount; step += 1) {
        const candidate = {
            x: baseX + step * spawnOffset,
            y: baseY + step * spawnOffset,
        };
        const isFree = occupiedPositions.every((position) =>
            slotOffsets.every(
                (offset) =>
                    Math.abs(candidate.x - position.x) >= minimumCenterSeparation ||
                    Math.abs(candidate.y + offset - position.y) >= minimumCenterSeparation
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
