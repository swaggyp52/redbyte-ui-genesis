# RedByte Platform Root Cause Report

> **Date:** 2026-02-08
> **Scope:** Full platform — Shell, Windowing, Input Routing, Persistence, Export, ALL Apps
> **Method:** Systematic code-trace across every package in the monorepo

---

## Executive Summary

RedByte has **10 architectural root causes** spanning every layer of the stack. These are not isolated bugs — they are structural defects in how the platform manages state, routes input, serializes data, and renders apps. Fixing any single one without addressing the others will not produce a working product.

The root causes fall into three tiers:

**Tier 1 — Platform Foundations (blocks everything)**
- RC-P1: Triple source of truth for project/circuit state
- RC-P2: Position serialization bug replicated across 3 files
- RC-P3: No single persistence contract

**Tier 2 — Input & Rendering (blocks usability)**
- RC-P4: No single input controller (3 competing systems in Circuit alone)
- RC-P5: CanvasHost hover-activation model loses input routing
- RC-P6: Drop target coordinate mismatch in Circuit View

**Tier 3 — Architecture & Maintainability (blocks iteration)**
- RC-P7: Shell.tsx is a 3000+ line god component
- RC-P8: Inconsistent format converters (4+ ad-hoc converters)
- RC-P9: Window-app binding is fragile parallel state
- RC-P10: Example loading creates malformed connections

---

## Tier 1: Platform Foundations

### RC-P1: Triple Source of Truth for Project/Circuit State

**Severity:** CRITICAL — blocks all data flow
**Files:**
- `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx:265` — `useState<Circuit>`
- `packages/rb-apps/src/stores/circuitStore.ts` — Zustand `CircuitState`
- `packages/rb-lab-engine/src/stores/unifiedProjectStore.ts` — `LabProjectV1` holder
- `packages/rb-apps/src/apps/ECELabApp.tsx` — its own `useState<Circuit>` + unifiedProject sync
- `packages/rb-shell/src/Shell.tsx` — `currentProjectRef` as yet another source

**Mechanism:**

LogicPlaygroundApp holds `const [circuit, setCircuit] = useState<Circuit>(...)` (line 265). Separately, `circuitStore` holds its own `Circuit` with undo/redo history. And `useUnifiedProjectStore` holds a `LabProjectV1` which contains a `CircuitV1` (different schema).

When a node is added:
1. `circuitStore.addNode()` → updates store circuit + engine
2. `LogicPlaygroundApp.useState` still holds the OLD circuit
3. `LogicCanvas.commitCircuit()` → calls `onCircuitChange` → `setCircuit()` → now local state catches up
4. A `useEffect` (line ~396-453) compares `JSON.stringify(unifiedProject.circuit)` vs `JSON.stringify(toCircuitV1(circuit))` and may overwrite

Shell also holds `currentProjectRef` for export/verify, which is only updated on import/load — it drifts from the actual circuit state as the user edits.

ECELabApp has the exact same pattern: its own `useState<Circuit>` + sync effects with `unifiedProjectStore`.

**Impact:**
- Nodes can appear then vanish (state clobber during reconciliation gap)
- Undo/redo operates on circuitStore but LogicPlaygroundApp's useState may be stale
- Export reads currentProjectRef which may not reflect the latest edits
- Three formats fight: `Circuit` (internal), `CircuitV1` (project), `SerializedCircuitV1` (storage)

---

### RC-P2: Position Serialization Bug (Replicated in 3 Files)

**Severity:** CRITICAL — all save/load/export produces (0,0) positions
**Files with the bug:**
- `packages/rb-apps/src/apps/ECELabApp.tsx:520-521`
- `packages/rb-shell/src/Shell.tsx:1428-1429` (handleExportProof)
- `packages/rb-shell/src/Shell.tsx:1028-1029` (handleLoadExample)

**Files already fixed (staged):**
- `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx:317-318`

**Mechanism:**

The `Node` type (rb-logic-core/types.ts) has BOTH:
```ts
position?: Position;  // { x: number, y: number } — used by current code
x?: number;           // legacy field — always undefined in new nodes
y?: number;           // legacy field — always undefined in new nodes
```

The `toCircuitV1` converters read the WRONG field:
```ts
// ECELabApp.tsx:520
x: node.x || 0,  // BUG: node.x is undefined → always 0
y: node.y || 0,  // BUG: node.y is undefined → always 0
// Should be: node.position?.x ?? node.x ?? 0
```

Shell.tsx:1428 has the identical bug in handleExportProof.
Shell.tsx:1028 uses `x: node.x, y: node.y` from V1 format directly (correct for V1→internal, but creates nodes without `position` field).

**Impact:**
- ALL node positions serialize as (0, 0) — spatial layout is destroyed on save
- Evidence capsule export contains a flat circuit at origin
- Round-trip import→edit→export loses all positions
- Schematic and 3D views receive (0,0) positions from the same source

---

### RC-P3: No Single Persistence Contract

**Severity:** HIGH — no reliable save/load
**Files:**
- `packages/rb-shell/src/persistenceStore.ts` — autosave scheduler + recovery journal
- `packages/rb-apps/src/stores/filesStore.ts` — virtual filesystem
- `packages/rb-lab-engine/src/stores/unifiedProjectStore.ts` — project store
- `packages/rb-windowing/src/store.ts:130` — window layout → localStorage

**Mechanism:**

There are 4 separate persistence mechanisms with no coordination:

1. **Window layout**: `rb:window-layout` in localStorage (written by windowStore)
2. **Recovery journal**: `rb:autosave:<id>.tmp/.good` in localStorage (written by persistenceStore)
3. **Virtual files**: `filesStore` + `fileSystemStore` (in-memory + localStorage)
4. **Project state**: `unifiedProjectStore` (in-memory only — no persistence)

The autosave system (`persistenceStore.ts`) has good infrastructure (journal writes, promotion, recovery check), but:
- Apps register autosave functions via `scheduleAutosave()` but the actual save functions are closures that may capture stale state
- `unifiedProjectStore` has no built-in persistence — it's a transient in-memory store
- When an app writes to `filesStore`, the file content is a JSON string, but the conversion uses the buggy `toCircuitV1` (RC-P2)
- There's no "project save" that atomically persists circuit + simulation + probes + evidence

**Impact:**
- No reliable project persistence across sessions
- Recovery journal may contain stale data from the triple-state race
- File system and project store can disagree about circuit content
- Session restore recovers window positions but not project data

---

## Tier 2: Input & Rendering

### RC-P4: No Single Input Controller (3 Competing Systems)

**Severity:** HIGH — interaction is unreliable
**Files:**
- `packages/rb-logic-view/src/LogicCanvas.tsx:370-405` — pan/select on SVG background
- `packages/rb-logic-view/src/components/NodeView.tsx:174-245` — pointer-capture drag
- `packages/rb-logic-view/src/useLogicViewStore.ts:270` — `interactionMode` enum
- `packages/rb-viewport/src/useCanvasInteraction.ts` — **UNUSED** state machine
- `packages/rb-viewport/src/CanvasHost.tsx` — hover-based keyboard/wheel routing

**Mechanism:**

Three different interaction state systems exist:

1. **useLogicViewStore.interactionMode**: `'idle' | 'placing' | 'dragging' | 'wiring' | 'panning'` — used by LogicCanvas to decide what mouse events mean
2. **NodeView local state**: `isDragging`, `dragStart`, `dragPosition` as separate `useState` hooks — NOT coordinated with the store's interactionMode
3. **useCanvasInteraction()**: A complete interaction state machine defined in rb-viewport — **never imported or used by any app**

Additionally, pan state is tracked via local `useState` in LogicCanvas (`isPanning`, `lastMouse`, `isSpacePressed`), separate from the store's `interactionMode`.

SchematicView has its own completely separate `useState`-based camera + drag handling with no coordination with the circuit view.

**Impact:**
- Node drag and pan can conflict (no mutex between NodeView's pointer capture and LogicCanvas's pan handler)
- `interactionMode` in the store may say 'idle' while NodeView is mid-drag
- Keyboard shortcuts stop working if pointer leaves canvas during CanvasHost deactivation

---

### RC-P5: CanvasHost Hover-Activation Loses Input Routing

**Severity:** MEDIUM — keyboard shortcuts break during normal use
**Files:**
- `packages/rb-viewport/src/CanvasHost.tsx:56-82` — activation model

**Mechanism:**

```tsx
// CanvasHost.tsx line 56-82 (simplified)
onPointerEnter={() => setActiveCanvas(id)}
onPointerLeave={() => clearIfActive(id)}
```

CanvasHost only routes keyboard and wheel events to the canvas when it's "active" (pointer is hovering over it). When the pointer exits:
- Keyboard shortcuts (Delete, Escape, arrow keys) stop working
- Wheel zoom stops working
- No visual indicator that the canvas is inactive

In split-view layouts (Circuit + Schematic + Scope), the user frequently moves between panes. Each transition deactivates one canvas and activates another, but there's no "sticky" focus that survives brief pointer excursions.

**Impact:**
- Users press Delete with a node selected but pointer on another pane → nothing happens
- Zoom stops working when cursor is over the toolbar or dock
- No keyboard-only workflow is possible (no tab-to-focus model)

---

### RC-P6: Drop Target Coordinate Mismatch

**Severity:** HIGH — drag-and-drop is broken
**Files:**
- `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx:2243-2314` — handleNodeDrop
- `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx:3734-3745` — canvasAreaRef

**Mechanism:**

`handleNodeDrop` measures coordinates relative to `canvasAreaRef`:
```tsx
const rect = canvasAreaRef.current.getBoundingClientRect();
const screenX = e.clientX - rect.left;
const screenY = e.clientY - rect.top;
const worldPos = screenToWorld(screenX, screenY, camera);
```

But `canvasAreaRef` is the outer wrapper div that contains `SplitViewLayout`, which contains `LogicCanvas`, which contains the SVG. The offset between the wrapper div and the actual SVG viewport is unaccounted for.

`screenToWorld` expects coordinates relative to the SVG viewport origin. When the SVG is inset (split view gutters, toolbar height, padding), every dropped node lands at the wrong world position. The error scales with zoom.

**Impact:**
- Nodes drop at wrong positions, especially after pan/zoom
- The visual drag preview appears correct (it uses CSS positioning in the wrapper) but the committed position is wrong

---

## Tier 3: Architecture & Maintainability

### RC-P7: Shell.tsx Is a God Component

**Severity:** HIGH — blocks testing and iteration
**File:** `packages/rb-shell/src/Shell.tsx` — 3000+ lines, single component

**Mechanism:**

Shell.tsx manages:
- 15+ overlay boolean states (commandPalette, systemSearch, workspaceSwitcher, macroRunner, windowSwitcher, diagnostics, reproCheck, projectSummary, determinismPanel, onboardingModal, aboutModal, examplePicker, bitstreamProvenance, perfHud, deadZoneScanner, overlayDebug)
- ALL keyboard shortcuts (Escape cascading chain, Ctrl+S/Z/Y, Ctrl+Tab, window snapping, etc.)
- ALL command execution (40+ case branches in executeCommand)
- ALL import/export (evidence capsule, Verilog, bitstream)
- ALL workspace management
- ALL FPGA toolchain operations
- Determinism recording
- Window-app binding state
- Boot sequence

**Impact:**
- Any change to Shell.tsx risks breaking unrelated features
- Impossible to unit test individual Shell behaviors in isolation
- State interactions between 15 boolean flags create 2^15 possible UI states
- The Escape handler alone is a 15-clause cascade that depends on render-order

---

### RC-P8: Inconsistent Format Converters (4+ Ad-Hoc)

**Severity:** MEDIUM — same conversion done differently in every app
**Files:**
- `LogicPlaygroundApp.tsx:311-358` — toCircuitV1 / fromCircuitV1
- `ECELabApp.tsx:485-536` — toCircuitV1 / fromCircuitV1 (different impl)
- `Shell.tsx:1423-1443` — inline conversion in handleExportProof
- `Shell.tsx:1024-1043` — inline conversion in handleLoadExample

**Mechanism:**

Each converter handles fields differently:
- LogicPlaygroundApp (fixed): `node.position?.x ?? node.x ?? 0`
- ECELabApp: `node.x || 0` (bug)
- Shell export: `node.x || 0` (bug)
- Shell load example: reads `node.x` from V1 directly, creates connection as `from: conn.fromNodeId` (string not PortRef)

Connection format also varies:
- Some use `{ from: PortRef }` (structured)
- Some use `{ from: string, fromPin: string }` (legacy)
- Some use `{ fromNodeId, fromPin, toNodeId, toPin }` (V1 format)

**Impact:**
- Same bug appears/reappears in different converters
- Import through one path works, through another path doesn't
- Connection format mismatches cause wire rendering failures

---

### RC-P9: Window-App Binding Is Fragile Parallel State

**Severity:** MEDIUM — window content can desync
**File:** `packages/rb-shell/src/Shell.tsx:455` — `const [bindings, setBindings] = useState<Record<string, WindowAppBinding>>({})`

**Mechanism:**

Shell maintains `bindings` as local `useState` — a parallel mapping from windowId to `{ appId, props }`. The window store also has `contentId` on each window. These are two separate representations of "which app is in which window."

On session restore (line 902-906), bindings are reconstructed from stored window state. But during runtime, bindings and window store can desync:
- Window store is updated via `createWindow()` which sets `contentId`
- `bindings` is updated separately via `setBindings()`
- If a `closeWindow()` call happens without the corresponding `delete bindings[id]`, the binding becomes orphaned

**Impact:**
- Stale bindings can cause apps to receive wrong props
- Session restore may fail if binding reconstruction doesn't match window state

---

### RC-P10: Example Loading Creates Malformed Connections

**Severity:** MEDIUM — examples may render without wires
**File:** `packages/rb-shell/src/Shell.tsx:1024-1043`

**Mechanism:**

```tsx
connections: project.circuit.connections.map((conn) => ({
  id: conn.id,
  from: conn.fromNodeId,     // string, not PortRef
  fromPin: conn.fromPin,     // legacy field
  to: conn.toNodeId,         // string, not PortRef
  toPin: conn.toPin,         // legacy field
})),
```

The internal `Connection` type expects `from: PortRef | string`. When `from` is a string (just the nodeId), wire rendering code that accesses `conn.from.nodeId` will fail — it gets `undefined` because a string doesn't have a `nodeId` property.

Some rendering paths handle both formats via fallback logic, but others don't. This causes inconsistent wire rendering depending on whether the circuit was created via the editor (PortRef) or loaded via example (string).

**Impact:**
- Wires may not render for example circuits
- Wire click/hover interaction may fail for string-format connections

---

## Dependency Graph

```
RC-P1 (Triple state) ──┐
RC-P2 (Position bug) ──┼──→ All save/load/export broken
RC-P3 (No persistence) ┘
RC-P8 (Format converters) ──→ Amplifies P1, P2, P3

RC-P4 (No input controller) ──┐
RC-P5 (Hover activation) ─────┼──→ Interaction unreliable
RC-P6 (Drop coords) ──────────┘

RC-P7 (God component) ──→ All changes risky
RC-P9 (Binding fragility) ──→ Window rendering fragile
RC-P10 (Example format) ──→ Demos broken
```

## Fix Priority Order

1. **RC-P2** — Position serialization (small fix, huge impact, 3 files)
2. **RC-P1** — Single source of truth (eliminate useState<Circuit>, make circuitStore canonical)
3. **RC-P8** — Single format converter (one `toCircuitV1`/`fromCircuitV1`, imported everywhere)
4. **RC-P3** — Persistence contract (atomic project save through single store)
5. **RC-P6** — Drop coordinate fix (measure from SVG, not wrapper div)
6. **RC-P4** — Input controller consolidation
7. **RC-P5** — Replace hover activation with focus-based model
8. **RC-P10** — Normalize example loading to use PortRef
9. **RC-P7** — Extract Shell responsibilities into focused modules
10. **RC-P9** — Merge bindings into window store
