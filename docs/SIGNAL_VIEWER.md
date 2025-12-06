# Signal viewer / waveform scope

The Signal Scope app lets users pick logic nodes or specific voxel coordinates to watch as the redstone simulation runs. Watches are stored in the shared project model so every session remembers what the user is probing.

## Data flow
- **ProjectContext** persists `signal.watches`, each describing a node/net to probe, the target layer, and whether it is visible.
- **logicWorldBridge** maps `LogicTemplate` nodes to voxel coordinates for a given Y layer, which are used to place probes when possible.
- **ProbeBus** holds the active probe list and records samples on every `SimMetrics` tick by reading voxel power states.
- **SignalScopeApp** renders the watch list and waveforms, delegating add/remove/toggle events back to `ProjectContext` so they persist.

## Key files
- `src/os/context/ProjectTypes.ts` — defines `ProjectSignalWatch` and the `signal` model on `ProjectState`.
- `src/os/context/ProjectContext.tsx` — helper methods to add/remove/toggle signal watches; normalizes stored projects.
- `src/os/apps/SignalScope.tsx` — OS shell that maps watches to voxel probe definitions, keeps the ProbeBus in sync, and presents node/layer pickers.
- `src/apps/SignalScopeApp.tsx` — the waveform viewer and probe list UI; uses `ProbeBus` to stream samples and draw traces.
- `src/scope/ProbeBus.ts` — manages probe definitions, stores recent samples, and emits updates to listeners.

## Typical flow
1. User selects a logic output (or enters coordinates) and clicks **Add probe**.
2. `ProjectContext` records a new `ProjectSignalWatch`, tied to the current layer.
3. `SignalScopeShell` maps watches to voxel coordinates with `projectNodePositions` and calls `replaceProbes` on `ProbeBus` (resetting waveform history so traces start aligned).
4. When the 3D world simulates, `ProbeBus` samples the watched voxels on every tick (via `subscribeSimHistory`) and pushes new `ProbeSample` entries.
5. `SignalScopeApp` listens for samples, refreshes the probe list from `ProbeBus`, and draws waveforms in `WaveformCanvas` for visible probes.

## Extending the viewer
- Add net-based watches by populating `netId` on `ProjectSignalWatch` and mapping nets to voxel coordinates during normalization.
- Style waveforms per-probe (e.g., color hints stored on the watch) by extending `WaveformCanvas` to use probe metadata.
- Surface watch presets in the OS (e.g., auto-watch all IO pins) by seeding `signal.watches` when loading a project.
