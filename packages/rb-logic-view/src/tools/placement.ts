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
export function findSmartSpawnPosition(
    existingNodes: Node[],
    center: { x: number; y: number },
    gridSize: number = GRID_SIZE
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

    // A point can block at most two candidates on this evenly spaced diagonal,
    // so 2n + 1 candidates guarantees a free footprint for n finite nodes.
    const candidateCount = occupiedPositions.length * 2 + 1;
    for (let step = 0; step < candidateCount; step += 1) {
        const candidate = {
            x: baseX + step * spawnOffset,
            y: baseY + step * spawnOffset,
        };
        const isFree = occupiedPositions.every(
            (position) =>
                Math.abs(candidate.x - position.x) >= minimumCenterSeparation ||
                Math.abs(candidate.y - position.y) >= minimumCenterSeparation
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
