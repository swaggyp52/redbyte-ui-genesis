# Learning overlays and guided tutorial

This repository now includes a lightweight onboarding layer that walks a new operator through the core RedByte OS flow: design logic → view in 3D → inspect signals → read the code representation. The overlays are intentionally small, OS-native cards that live inside existing app shells so users never leave the context of their work.

## Tutorial steps
1. **Build a 2-input AND gate** (Logic Designer)
   - Add two `INPUT_TOGGLE` nodes, one `GATE_AND`, and a `OUTPUT_LAMP` wired together to see the truth table.
   - The step auto-completes when any AND gate exists in the project and can be manually marked done.
2. **View it in 3D** (3D Viewer)
   - Rebuild the voxel world from the active project, scrub layers, and orbit around the mapping. The step completes when the 3D app initializes or via the overlay button.
3. **Inspect timing** (Signal Scope)
   - Add probes for watched nodes to view waveforms. This step auto-completes when a probe stream is observed and can also be toggled via the overlay.
4. **View code representation** (Logic Export & Code)
   - Export the project as JSON, Verilog-style text, or a redstone block listing. Mark the step done from the overlay after reviewing the output.

Progress persists locally in `localStorage` under `redbyte-learning-progress` so users can leave and return without losing tutorial state. Use the overlay buttons to reset/mark steps if you want to replay the flow.

## Inline explanations
- **Logic Designer:** The overlay explains inputs → nets → gate → output propagation, timing profile usage, and how clocks attach to nets.
- **3D Viewer:** Notes on how logic nodes become voxel clusters, how wires are rendered as redstone dust, and how the layer slider slices vertically.
- **Signal Scope:** Highlights propagation and timing, how probes map to voxel coordinates, and the connection to the project timing profile.
- **Code View:** Clarifies how JSON mirrors `ProjectContext`, where Verilog labels come from, and how the redstone block list aligns with the 3D mapping.

## Key files
- `src/os/context/LearningContext.tsx` – shared tutorial state, auto-completion hooks, persistence.
- `src/os/ui/LearningOverlay.tsx` – reusable overlay component for each app.
- `src/os/apps/LogicDesigner.tsx`, `World3D.tsx`, `SignalScope.tsx`, `LogicExports.tsx` – app-level overlays and completion triggers.
- `src/apps/World3DApp.tsx`, `src/apps/SignalScopeApp.tsx` – component hooks that emit completion events when users interact with 3D or waveforms.

## Extending
- Add new steps to `defaultSteps` in `LearningContext` with an `id`, `title`, `description`, and `targetApp`.
- Use `useLearning` + `LearningOverlay` inside any app to show contextual guidance and wire `completeStep(id)` calls to meaningful interactions.
- Keep overlays short and actionable to preserve the OS feel while teaching key mental models.
