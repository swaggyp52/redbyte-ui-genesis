# Interaction Contract: Playground, 2D Lab, & 3D Viewer

**Core Principle:** A single, deterministic "Circuit State" drives all views.

## 1. Playground (The Shell)

**Role:** entry + navigation + consistency.

- **Routing:** "Lab Assignment" / "ECE Lab" always opens **2D ECE Lab**.
- **Hardware:** Only offered if Bridge is reachable; otherwise behaves as "Sim Only".
- **Export:** Produces `.rb-lab.zip` (Standard Format).

## 2. 2D Lab (ECE Lab)

**Role:** The **Canonical Editor** & Source of Truth.

- **Topology:** Only the 2D Lab allows adding, moving, wiring, or deleting nodes.
- **Simulation:** Toggling inputs here drives the shared `CircuitEngine`.
- **Export:** Captures the current circuit state, snapshot, and verification hashes.
- **Empty State:** Must provide a "Load Starter Circuit" option if empty.

## 3. 3D Viewer (Reference View)

**Role:** Read-Only Visualization.

- **Badge:** Must display "3D VIEW (READ-ONLY)".
- **Interaction:**
  - **Selection:** Allowed (Syncs metadata/inspector).
  - **Editing:** **DISABLED**. Drag/Wire/Delete attempts show "Edit in 2D View" message.
- **Sync:** Reflects the 2D circuit state. Updates on every 2D mutation.

## Synchronization Rules

1. **Mutation:** 2D Edits -> Update `Circuit` -> Re-render 2D & 3D.
2. **Divergence:** If 3D view state desyncs, it must offer a "Refresh" or re-mount, never persist stale state.
