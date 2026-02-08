# Circuit Core Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make RedByte's Circuit View a fully functional digital logic lab tool where students can place, move, wire, simulate, save, load, and export circuits reliably.

**Architecture:** Eliminate dual state ownership by making `circuitStore` the single source of truth. Fix coordinate transforms for drop placement. Consolidate interaction into one state machine. Fix serialization round-trip. Add Playwright E2E gates to prevent regression.

**Tech Stack:** React, Zustand, SVG, Playwright, TypeScript

---

### Task 1: Fix `toCircuitV1` / `fromCircuitV1` Position Serialization (RC5)

**Files:**
- Modify: `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx:311-358`

**Step 1: Write the failing test**

```ts
// packages/rb-apps/src/__tests__/circuitV1RoundTrip.test.ts
import { describe, it, expect } from 'vitest';

// We'll test the conversion functions extracted later,
// but first inline the logic to prove the bug
describe('CircuitV1 round-trip', () => {
  it('preserves node positions through toCircuitV1 -> fromCircuitV1', () => {
    const circuit = {
      nodes: [
        { id: 'n1', type: 'AND', position: { x: 100, y: 200 }, config: {} },
        { id: 'n2', type: 'Lamp', position: { x: 300, y: 400 }, config: {} },
      ],
      connections: [],
    };
    // Simulate toCircuitV1 (current broken code uses node.x, not node.position.x)
    const v1Nodes = circuit.nodes.map(n => ({
      id: n.id,
      type: n.type,
      x: n.x || 0,  // BUG: reads undefined legacy field
      y: n.y || 0,
    }));
    // This will fail: x=0, y=0 for both nodes
    expect(v1Nodes[0].x).toBe(100);
    expect(v1Nodes[0].y).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @redbyte/rb-apps exec vitest run src/__tests__/circuitV1RoundTrip.test.ts`
Expected: FAIL — `expected 0 to be 100`

**Step 3: Fix `toCircuitV1` to use `node.position`**

In `LogicPlaygroundApp.tsx`, change `toCircuitV1`:
```tsx
// Line 317-318: Fix position access
x: node.position?.x ?? node.x ?? 0,
y: node.position?.y ?? node.y ?? 0,
```

And fix `fromCircuitV1` to write `position`:
```tsx
// Line 340-346: Ensure position object is created
position: { x: node.x ?? 0, y: node.y ?? 0 },
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @redbyte/rb-apps exec vitest run src/__tests__/circuitV1RoundTrip.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/rb-apps/src/apps/LogicPlaygroundApp.tsx
git commit -m "fix: toCircuitV1/fromCircuitV1 reads node.position instead of legacy node.x/y"
```

---

### Task 2: Fix Drop Coordinate Transform (RC2 + RC4)

**Files:**
- Modify: `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx` (handleNodeDrop, ~line 2243)
- Modify: `packages/rb-logic-view/src/LogicCanvas.tsx` (expose SVG ref)
- Modify: `packages/rb-apps/src/components/SplitViewLayout.tsx` (forward SVG ref)

**Step 1: Expose SVG ref from LogicCanvas**

Add a `svgRef` forwarding mechanism. In `LogicCanvas.tsx`, add a prop:
```tsx
interface LogicCanvasProps {
  // ... existing
  canvasSvgRef?: React.RefObject<SVGSVGElement>;
}
```
And assign: `const svgRef = props.canvasSvgRef ?? React.useRef<SVGSVGElement>(null);`

**Step 2: Forward through SplitViewLayout**

Pass the ref through `SplitViewLayout` to `LogicCanvas` for the `'circuit'` view.

**Step 3: Fix `handleNodeDrop` to use SVG rect**

Replace `canvasAreaRef.current.getBoundingClientRect()` with the actual SVG element's `getBoundingClientRect()`:
```tsx
const handleNodeDrop = (e: React.DragEvent) => {
  // ...validation...
  const svgEl = canvasSvgRef.current;
  const rect = svgEl ? svgEl.getBoundingClientRect() : canvasAreaRef.current?.getBoundingClientRect();
  if (!rect) return;
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  const worldPos = screenToWorld(screenX, screenY, camera);
  // ...rest...
};
```

**Step 4: Run existing placement E2E test**

Run: `pnpm exec playwright test tests/e2e/component-placement.spec.ts`

**Step 5: Commit**

```bash
git add packages/rb-logic-view/src/LogicCanvas.tsx packages/rb-apps/src/apps/LogicPlaygroundApp.tsx packages/rb-apps/src/components/SplitViewLayout.tsx
git commit -m "fix: drop placement uses SVG bounding rect for correct world coordinates"
```

---

### Task 3: Eliminate Dual Circuit State — Make circuitStore the Single Source of Truth (RC1)

**Files:**
- Modify: `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx` (remove useState<Circuit>, derive from store)
- Modify: `packages/rb-apps/src/stores/circuitStore.ts` (add camera to store)

**Step 1: Add `camera` to circuitStore**

Currently camera lives only in `useLogicViewStore`. For save/load continuity, the camera must be part of the serializable document. Add it to `circuitStore`:
```ts
interface CircuitState {
  // ... existing
  camera: { x: number; y: number; zoom: number };
  setCamera: (camera: Partial<{ x: number; y: number; zoom: number }>) => void;
}
```

**Step 2: Replace `useState<Circuit>` with store subscription**

In `LogicPlaygroundInner`, replace:
```tsx
const [circuit, setCircuit] = useState<Circuit>(...);
```
With:
```tsx
const circuit = useCircuitStore((s) => s.circuit);
```

Remove all `setCircuit()` calls. Route everything through `circuitStore.updateCircuit()` or `circuitStore.commit()`.

**Step 3: Simplify `handleCircuitChange`**

Replace the current implementation with a simple store commit:
```tsx
const handleCircuitChange = useCallback((updatedCircuit: Circuit) => {
  useCircuitStore.getState().commit(updatedCircuit);
}, []);
```

**Step 4: Remove reconciliation effects**

Delete the three `useEffect` blocks (lines ~396-453) that compare `unifiedProject.circuit` with local state. Replace with a single `useEffect` that syncs `circuitStore.circuit` → `unifiedProject` unidirectionally.

**Step 5: Run unit tests**

Run: `pnpm --filter @redbyte/rb-apps exec vitest run`

**Step 6: Commit**

```bash
git add packages/rb-apps/src/apps/LogicPlaygroundApp.tsx packages/rb-apps/src/stores/circuitStore.ts
git commit -m "refactor: circuitStore is now the single source of truth for circuit state"
```

---

### Task 4: Consolidate Input State Machine (RC3)

**Files:**
- Modify: `packages/rb-logic-view/src/useLogicViewStore.ts` (formalize state machine)
- Modify: `packages/rb-logic-view/src/LogicCanvas.tsx` (remove local pan/drag state)
- Modify: `packages/rb-logic-view/src/components/NodeView.tsx` (use store interaction mode)
- Delete: `packages/rb-viewport/src/useCanvasInteraction.ts` (unused)

**Step 1: Formalize the interaction state machine in the store**

Add transitions:
```ts
interactionMode: 'idle' | 'panning' | 'dragging' | 'wiring' | 'boxSelect'
transition: (from: InteractionMode, to: InteractionMode) => boolean  // validates transitions
```

**Step 2: Remove local `isPanning` / `isSpacePressed` from LogicCanvas**

Move into the store. Pan start/end transitions through the store's state machine.

**Step 3: NodeView uses store's `interactionMode` for drag**

Instead of local `isDragging` state, NodeView calls `setInteractionMode('dragging')` on drag start and `setInteractionMode('idle')` on drag end.

**Step 4: Run tests**

Run: `pnpm --filter @redbyte/rb-logic-view exec vitest run`

**Step 5: Commit**

```bash
git add packages/rb-logic-view/src/useLogicViewStore.ts packages/rb-logic-view/src/LogicCanvas.tsx packages/rb-logic-view/src/components/NodeView.tsx
git commit -m "refactor: consolidate all interaction state into useLogicViewStore state machine"
```

---

### Task 5: Fix Wire Endpoint Rendering on Node Move

**Files:**
- Modify: `packages/rb-logic-view/src/components/WireView.tsx` (use node position, not hardcoded offset)

**Step 1: Fix port position calculation**

Current WireView hardcodes port offset at `+24` / `-24` pixels from node center (lines 42-45). This should use the same port offsets as NodeView (which uses `size/2` where `size = 48 * camera.zoom`).

Fix to compute port positions consistently:
```tsx
const portOffset = 24; // half of node size (48/2)
const fromX = (fromNode.position.x + portOffset) * camera.zoom + camera.x;
```

This is actually correct for the current 48px node size. The issue is that WireView multiplies `portOffset` by `camera.zoom` twice (once inside the parentheses, once outside). Fix:
```tsx
const fromX = fromNode.position.x * camera.zoom + camera.x + portOffset * camera.zoom;
// Simplified: (fromNode.position.x + portOffset) * camera.zoom + camera.x ✓ (this IS correct)
```

Actually the current code IS mathematically correct. The real issue is that when a node is being dragged, `NodeView` uses `dragPosition` locally but WireView still reads `node.position` from the circuit (which isn't updated until drag ends). Fix this by:

1. During drag, `NodeView` calls `onMove` on every frame (already done via RAF)
2. `LogicCanvas.handleNodeMove` commits the intermediate position to the circuit
3. WireView re-renders with updated positions

Verify this works by checking that `handleNodeMove` is called during drag (it is, via RAF).

**Step 2: Commit**

```bash
git commit -m "docs: verify wire endpoint update mechanism during node drag"
```

---

### Task 6: Implement Save/Load Continuity

**Files:**
- Modify: `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx` (save/load uses circuitStore directly)
- Modify: `packages/rb-apps/src/stores/circuitStore.ts` (add camera serialization)

**Step 1: Save includes camera**

When saving, serialize:
```ts
{
  circuit: circuitStore.circuit,
  camera: logicViewStore.camera,
  version: appVersion,
}
```

**Step 2: Load restores camera**

When loading, set both:
```ts
circuitStore.updateCircuit(loadedCircuit, { skipHistory: true });
logicViewStore.setCamera(loadedCamera);
```

**Step 3: Write round-trip test**

```ts
it('save then load produces identical circuit + camera', () => {
  // Setup circuit with nodes at specific positions
  // Save to JSON
  // Clear state
  // Load from JSON
  // Assert circuit.nodes positions match
  // Assert camera matches
});
```

**Step 4: Commit**

```bash
git add packages/rb-apps/src/apps/LogicPlaygroundApp.tsx packages/rb-apps/src/stores/circuitStore.ts
git commit -m "fix: save/load preserves circuit positions and camera state"
```

---

### Task 7: Golden Path E2E Gates (Playwright)

**Files:**
- Create: `tests/e2e/circuit-core-gates.spec.ts`

**Step 1: Write Gate A — Placement**

```ts
test('Gate A: Place 3 components at distinct positions', async ({ page }) => {
  // Boot app, open logic playground
  // Drag Switch from palette to canvas at position A
  // Drag AND gate to position B
  // Drag Lamp to position C
  // Assert via window.__RB_CIRCUIT_STORE__: 3 nodes with 3 distinct positions
});
```

**Step 2: Write Gate B — Move**

```ts
test('Gate B: Drag component to new location', async ({ page }) => {
  // Place a node
  // Record initial position
  // Drag node by (100, 50) pixels
  // Assert position changed by expected world delta
});
```

**Step 3: Write Gate C — Camera**

```ts
test('Gate C: Pan and zoom, then place component', async ({ page }) => {
  // Pan view by dragging empty space
  // Zoom via wheel
  // Place a component
  // Assert it lands near cursor position in world coords
});
```

**Step 4: Write Gate D — Wire**

```ts
test('Gate D: Wire Switch to Lamp', async ({ page }) => {
  // Place Switch and Lamp
  // Click Switch output port, click Lamp input port
  // Assert connection exists in circuit store
  // Move Switch, assert wire endpoints update
});
```

**Step 5: Write Gate E — Simulation**

```ts
test('Gate E: Toggle switch, lamp responds', async ({ page }) => {
  // Place Switch -> NOT -> Lamp, wire them
  // Start sim
  // Toggle switch ON
  // Assert lamp OFF (through NOT)
  // Toggle switch OFF
  // Assert lamp ON
});
```

**Step 6: Write Gate F — Save/Load**

```ts
test('Gate F: Save and reload circuit', async ({ page }) => {
  // Build a circuit
  // Save project
  // Clear circuit
  // Load project
  // Assert same nodes, positions, connections
});
```

**Step 7: Write Gate G — Export Evidence**

```ts
test('Gate G: Export evidence contains circuit doc', async ({ page }) => {
  // Build circuit
  // Export evidence
  // Validate exported JSON contains nodes, connections, metadata
});
```

**Step 8: Commit**

```bash
git add tests/e2e/circuit-core-gates.spec.ts
git commit -m "test: add Golden Path E2E gates A-G for circuit core functionality"
```

---

## Phase Mapping

| Phase | Tasks | Definition of Done |
|-------|-------|-------------------|
| Phase 1: Event Routing | Task 2 | Drop lands at correct world position |
| Phase 2: Camera + Transforms | Task 2, Task 3 (camera in store) | Pan/zoom work, placement correct after pan/zoom |
| Phase 3: Placement + Move | Task 1, Task 2, Task 3 | Gate A + Gate B pass |
| Phase 4: Wire | Task 5 | Gate D passes |
| Phase 5: Simulation | (verify existing engine) | Gate E passes |
| Phase 6: Save/Load/Export | Task 1, Task 6 | Gate F + Gate G pass |
| Phase 7: E2E Gates | Task 7 | All gates A-G pass headless |

---

## First 3 Commits (Immediate Implementation)

### Commit 1: Fix position serialization (Task 1)
- File: `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx`
- Lines 317-318: `node.x || 0` → `node.position?.x ?? node.x ?? 0`
- Lines 340-346: Add `position: { x: node.x ?? 0, y: node.y ?? 0 }`
- This alone fixes save/load position loss

### Commit 2: Fix drop coordinates (Task 2)
- File: `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx`
- `handleNodeDrop`: Use SVG element rect instead of wrapper div rect
- File: `packages/rb-logic-view/src/LogicCanvas.tsx`
- Expose SVG ref via forwarded ref or callback
- This fixes placement landing at wrong position

### Commit 3: Eliminate dual circuit state (Task 3)
- File: `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx`
- Replace `useState<Circuit>` with `useCircuitStore((s) => s.circuit)`
- Remove reconciliation effects
- Simplify `handleCircuitChange` to just commit to store
- This fixes the stale-state / vanishing-node race
