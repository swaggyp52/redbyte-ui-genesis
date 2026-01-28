# RedByte 3D Visualization Specification

## 1. Overview
This document outlines the architecture and implementation plan for adding high-end, interactive 3D visualization to RedByte OS. The primary targets are the **Logic Playground** and the **Lab** (ECE/Hardware Lab).

**Core Principle:** Determinism. 3D visuals are an instrument panel, not just decoration.
Same inputs + same recorded session → same camera paths, same animations, same state transitions.

## 2. Architecture
The 3D system is built on **Three.js** and **React Three Fiber (R3F)**. It integrates with RedByte's existing deterministic state stores (Capsules/Timeline).

### 2.1 Technology Stack
- **Engine:** Three.js + React Three Fiber (R3F)
- **State Management:** Zustand (integrating with `circuitStore` and `labStore`)
- **Performance:** On-demand rendering loop (gated by `requestAnimationFrame` + visibility), instanced rendering for high-count elements (wires, LEDs).

### 2.2 Determinism & Replay
- **Time Source:** All 3D animations (wire pulses, signal flows) are driven by the simulation **Tick Count**, not `Date.now()`.
- **Camera State:** Camera pose (position, target, FOV) is stored in the application state. During "Record UI", camera movements are captured as deterministic events.
- **Replay:** Playing back a capsule reproduces the exact visual state, including camera angles and signal propagation visuals.

## 3. Component Library
These components will reside in `@redbyte/rb-logic-3d`.

### Core Components
- **`<Rb3DViewport />`**: The main container. Handles:
  - R3F `Canvas` setup.
  - ResizeObserver for robust layout integration.
  - Deterministic render loop management (start/stop based on visibility).
  - Camera controller integration.
- **`<Rb3DReplayController />`**: Connects the 3D scene to the playback timeline. Interpolates state based on current tick.

### Scene Components
- **`<Rb3DSceneBoard />`**: Renders the 3D board model (e.g., generic PCB or Spartan-3E).
  - Supports IO overlays (LEDs, switches).
- **`<Rb3DSceneCircuit />`**: Logic Playground view.
  - Nodes: 3D representations of gates/ICs.
  - Wires: Instanced meshes for signal lines.
  - **Signal Flow:** Shader-based animation of pulses along wires.

## 4. Feature Specifications

### 4.1 Logic Playground 3D
**Goal:** Premium EDA tool feel.
- **View Modes:**
  - **Board View:** Components on a clean 2D/3D plane.
  - **Signal Flow:** Animated pulses showing logic propagation.
- **Camera:** Orbit, Pan, Zoom. Snap presets: Top, Isometric, Free.
- **Interaction:**
  - Hover/Select Net: Highlights wire in 3D (syncs with 2D).
  - Click Component: Focus camera, open inspector.
- **Timing:** Oscilloscope scrubber drives 3D animation frame.

### 4.2 Lab / ECE Lab 3D
**Goal:** "Real hardware" operational feel.
- **Board Model:** Procedural stylized board (Stage 1), GLB model (Stage 2).
- **IO Overlays:**
  - **LEDs:** Light up based on telemetry events.
  - **Switches/Buttons:** Animate based on user input or replay.
- **Mapping:** Hovering a UI signal highlights the physical pin/LED on the 3D board.

### 4.3 OS-Level (Optional)
- **Boot Screen:** Subtle deterministic field lines.
- **Desktop:** Low-power parallax background.

## 5. Performance Strategy
- **Render Loop:** Gated. Pauses when tab/window is hidden or minimized.
- **Instancing:** Used for repeated geometry (wires, pins, LEDs).
- **Shadows:** Baked gradients only. No real-time shadow maps.
- **Performance Mode Toggle:**
  - **Full:** Animated pulses, AA, Bloom.
  - **Reduced:** Static wires, state colors only.
  - **Off:** 3D disabled.
- **Reduce Motion:** Respects OS setting (disables camera swoops and pulses).

## 6. Implementation Plan

### Phase 1: Core Foundation (Current)
- `Rb3DViewport` with deterministic loop.
- Basic Camera Controls.
- `rb-logic-3d` package structure verification.

### Phase 2: Logic Playground MVP
- 3D Circuit Scene (`Rb3DSceneCircuit`).
- Net highlighting.
- Tick-driven wire pulses.

### Phase 3: Lab MVP
- Board View (`Rb3DSceneBoard`).
- Telemetry-driven IO overlays.

### Phase 4: Polish & Integration
- Split View support.
- Performance modes.
- Replay controller refinement.

## 7. Verification Checklist
- [ ] **Layout:** Resize window/pane -> 3D view adapts without clipping.
- [ ] **Determinism:** Replay capsule -> exact visual match.
- [ ] **Performance:** Idle CPU usage is near zero.
- [ ] **Accessibility:** "Reduce Motion" stops animations.
- [ ] **Input:** No dead zones; scroll/click behaves as expected.
