export const GRID_SIZE = 16;
export const NODE_SIZE = 48; // Standard node size
export const SPAWN_OFFSET = GRID_SIZE * 2; // Offset for each step
/**
 * Calculates a smart spawn position for a new node to avoid exact overlaps.
 * Uses a grid-based spiral or linear offset strategy around the center.
 */
export function findSmartSpawnPosition(existingNodes, center, gridSize = GRID_SIZE) {
    // Snap center to grid first
    let baseX = Math.round(center.x / gridSize) * gridSize;
    let baseY = Math.round(center.y / gridSize) * gridSize;
    // Simple heuristic: check if specific spots are occupied
    // We'll check a few spots in a diagonal line first, then maybe spiral?
    // Let's keep it deterministic and simple:
    // Check (0,0), (+1, +1), (+2, +2)... up to some limit.
    // Or better: just scan existing nodes to find ones that are "too close".
    const occupied = new Set();
    for (const node of existingNodes) {
        const nx = Math.round(node.position.x / gridSize);
        const ny = Math.round(node.position.y / gridSize);
        occupied.add(`${nx},${ny}`);
    }
    // Try positions in a diagonal line first (down-right)
    // This mimics standard "window cascading" behavior which is intuitive
    for (let step = 0; step < 10; step++) {
        const offsetX = baseX + (step * SPAWN_OFFSET);
        const offsetY = baseY + (step * SPAWN_OFFSET);
        // Check if this spot is roughly occupied
        const gx = Math.round(offsetX / gridSize);
        const gy = Math.round(offsetY / gridSize);
        // We check a small radius around the spot to avoid "visual" overlap
        let isFree = true;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (occupied.has(`${gx + dx},${gy + dy}`)) {
                    isFree = false;
                    break;
                }
            }
            if (!isFree)
                break;
        }
        if (isFree) {
            return { x: offsetX, y: offsetY };
        }
    }
    // Fallback: Just return the center if everything is full, 
    // users will have to move manually.
    return { x: baseX, y: baseY };
}
