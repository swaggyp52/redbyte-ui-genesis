# RedByte Virtual Lab Bench Specification

## 1. Vision

A professional-grade virtual laboratory embedded in RedByte OS. Students can place virtual components (Arduino, breadboards, LEDs), wire them in 3D, write code, and simulate behavior deterministically.

**Core Philosophy:** Determinism. Every interaction (placement, wiring, code run) is an event in a replayable timeline. The 3D view is an instrumentation of this state.

## 2. MVP-1 Scope: "Arduino Blink Lab"

The initial release focuses on the "Hello World" of electronics:

- **Parts:** Arduino Nano (or Uno), Half-size Breadboard, LED (5mm), Resistor (DIP), Jumper Wires.
- **Interaction:**
  - Drag & Drop parts from palette.
  - Wire parts by clicking pins (snap-to-pin, auto-route visuals).
  - Write Arduino C++ in RedByte Editor.
  - "Run" compiles/simulates behavior (LED blinks).
- **Visualization:**
  - 3D Bench View (Breadboard + animated LED).
  - 2D Schematic Overlay (Simplified topological view).
- **Output:** Lab Capsule (signed artifact containing graph, code, timeline).

## 3. Architecture

### 3.1 Layer 1: Lab Graph (Data Model)

The canonical source of truth. Fully serializable.

**Entities:**

- **`LabNode` (Part):** `id`, `type` (e.g., 'arduino-nano', 'led-red'), `pose` (x,y,rotation), `properties` (value, color).
- **`LabPin`:** Defined by the Part type (e.g., Arduino 'D13', LED 'anode').
- **`LabConnection` (Wire):** `id`, `source` (nodeId, pinId), `target` (nodeId, pinId), `color`, `path` (3D control points).
- **`LabNet`:** Computed set of connected pins.

**State:**

- `tick`: Integer (simulation time).
- `pinState`: Map<pinId, value> (HIGH/LOW/Analog).
- `partState`: Map<nodeId, internalState> (e.g., MCU registers, LED brightness).

### 3.2 Layer 2: Execution Engines

Pluggable backends driven by the Graph.

- **`ArduinoBehaviorEngine` (MVP):**
  - **Not** full AVR emulation yet.
  - Interprets "Arduino-like" events.
  - Supports: `digitalWrite`, `delay` (tick-based), `pinMode`.
  - Runs in a WebWorker or simulated thread.
  - Emits: `PinChange` events.

### 3.3 Layer 3: Renderers

- **`Rb3DSceneLab`:** Renders the bench.
  - Uses `Rb3DViewport` (from 3D upgrade).
  - Instantiates `PartMesh` components based on `LabNode` type.
  - Draws `WireMesh` for connections.
  - Animates state (LED color/intensity) based on `tick`.
- **`SchematicRenderer`:** 2D SVG/Canvas overlay.

## 4. Determinism & Replay

**The Timeline:**

- Sequence of `LabUserEvent` (Place, Wire, CodeEdit) and `LabSimEvent` (Tick, PinChange).
- **Replay:** Reconstruct `LabGraph` state at any tick $T$ by playing events $0 \dots T$.
- **Scrubbing:** Updates 3D visual state instantly.

**Capsule Format:**

```json
{
  "meta": { "lab": "blink-101", "author": "student" },
  "graph": { ...initial_snapshot... },
  "timeline": [
    { "t": 100, "type": "WIRE_ADD", "data": { ... } },
    { "t": 200, "type": "CODE_COMPILE", "source": "..." },
    { "t": 201, "type": "SIM_START" }
  ],
  "artifacts": { "main.ino": "..." }
}
```

## 5. Implementation Plan

### Phase 1: Data & State (Core)

- Define TypeScript interfaces for LabGraph.
- Implement `LabStore` (Zustand) with Timeline log.
- Create `LabSerializer`.

### Phase 2: 3D Visualization (Renderer)

- Create `Rb3DPart` base component.
- Implement specific parts: `ArduinoNanoMesh`, `BreadboardMesh`, `LEDMesh`.
- Implement `WireInteraction` (Click-to-wire).

### Phase 3: Simulation (Behavioral)

- Implement basic `BlinkController` (fakes the MCU running the code).
- Connect `digitalWrite` events to Virtual LED state.

### Phase 4: Integration

- Build `LabApp` container in `packages/rb-apps`.
- Integrate Code Editor and 3D Viewport.

## 6. Verification

- [ ] **Wiring:** Connect D13 to LED Anode -> Validates constraint (if set) or allows.
- [ ] **Sim:** Run "Blink" -> LED mesh toggles color/emission.
- [ ] **Replay:** Seek timeline -> Board state restores exactly.
- [ ] **Export:** Save capsule -> Load capsule restores session.

## 7. Future Proofing

- **Hybrid Mode:** Replace `ArduinoBehaviorEngine` with `SerialBridgeEngine` to drive virtual graph from real USB strings.
- **Wokwi Integration:** Replace `ArduinoBehaviorEngine` with Wokwi core later for full AVR emulation.
