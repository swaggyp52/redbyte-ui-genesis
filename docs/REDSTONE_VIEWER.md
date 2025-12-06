# Redstone Viewer & 3D world pipeline

This viewer turns the active project into a voxelized redstone world and renders it with `World3DApp` (Three.js) inside the OS window chrome.

## Flow
1. **ProjectContext** exposes the unified `ProjectState` (logic template, nets, IO pins, clocks, CPU metadata).
2. **logic → redstone mapping** happens in `src/os/apps/logicWorldBridge.ts` using `mapLogicToRedstone` to convert `LogicTemplate` nodes/wires to block coordinates, then normalizes into the bounded `WORLD_SIZE` grid.
3. **Voxel world population**: `buildProjectIntoWorld` clears the current world, writes voxels via `setVoxel`, and returns mapping metadata (block count, nets, IO, clocks, layer, node positions).
4. **Rendering + controls**: `src/os/apps/World3D.tsx` hosts `World3DApp` and keeps the layer/running state in sync. The wrapper exposes Run/Pause/Step/Reset and a "Rebuild mapping" action that replays the mapping from the current project while pausing and resetting the simulation so the new layout starts cleanly.
5. **Simulation**: `World3DApp` uses `stepVoxelWorldOnce` on an interval when running; the same API is used for single-step. Powered states are visualized via voxel coloring.

## Key files
- `src/os/apps/World3D.tsx`: OS app wrapper that consumes `ProjectContext`, rebuilds the world when the project or Y-layer changes, and surfaces controls.
- `src/os/apps/logicWorldBridge.ts`: Normalizes logic templates to voxel coordinates, writes them into `VoxelWorld`, and reports mapping stats and node positions.
- `src/logic/LogicToRedstone.ts`: Base conversion from `LogicTemplate` nodes/wires to redstone parts.
- `src/world3d/VoxelWorld.ts`: In-memory voxel store with subscriptions used by the Three renderer.
- `src/apps/World3DApp.tsx`: Three.js renderer + simulation controls (run/pause/step/reset, tick rate, editing tools).

## Extending
- Add richer gate/block translations in `LogicToRedstone` (e.g., directionality, multi-level layouts) and reflect them in `TYPE_TRANSLATION` inside the bridge.
- Use `project.logic.nets` / `nodePositions` to overlay annotations or selection crosshairs in `World3DApp`.
- Pipe simulation metrics into System Monitor or the Signal Scope app via shared events if you need synchronized timelines.
