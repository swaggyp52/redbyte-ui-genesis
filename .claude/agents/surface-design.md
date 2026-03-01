# surface-design agent

## Domain Ownership
This agent owns the Design surface of the RedByte IDE.

## Primary Files
- `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx` — main surface component (~2000 lines)
- `packages/rb-apps/src/stores/circuitStore.ts` — Zustand store holding circuit IR, history, selection
- `packages/rb-logic-view/src/LogicCanvas.tsx` — SVG canvas that renders nodes/wires
- `packages/rb-logic-view/src/NodeView.tsx` — renders individual nodes on canvas
- `packages/rb-logic-view/src/useLogicViewStore.ts` — camera, tool mode, selection state
- `packages/rb-apps/src/apps/ide/sim/pathTrace.ts` — fan-in path tracer for failure diagnostics
- `packages/rb-apps/src/apps/ide/components/PalettePanel.tsx` — gate/component palette
- `packages/rb-apps/src/apps/ide/components/NodeInspector.tsx` — right-panel node property editor

## Circuit IR Schema
Circuit is stored as `{ nodes: CircuitNode[], connections: CircuitConnection[] }`.

Each `CircuitNode`:
```typescript
{
  id: string;
  type: string;         // 'AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR', 'DFF', 'INPUT', 'OUTPUT', 'Lamp', 'Switch', etc.
  label?: string;       // user-visible label
  position?: { x: number; y: number };
  x?: number; y?: number; // legacy alias for position
  config?: Record<string, unknown>;
  state?: Record<string, unknown>;
}
```

Each `CircuitConnection`:
```typescript
{
  id: string;
  from: string | { nodeId: string; port: string };
  to: string | { nodeId: string; port: string };
}
```

## CircuitStore API
Key selectors/actions in `useCircuitStore`:
- `circuit` — current circuit IR
- `updateCircuit(circuit, opts)` — replace circuit (used by IdeApp to sync from runtime)
- `addNode(type, position)` — add gate
- `deleteNode(nodeId)` — remove gate + incident connections
- `updateNodeLabel(nodeId, label)` — rename node
- `selectNode(nodeId)` / `deselectAll()` / `selectedNodeIds`
- `undo()` / `redo()` — history management

## LogicViewStore API
- `toolMode: 'select' | 'wire' | 'pan'`
- `setToolMode(mode)`
- `selectMultipleNodes(ids, extend)`
- `selectWire(id, extend)`
- `setCamera({ x, y, zoom })`
- `camera: { x, y, zoom }`

## Palette Items
Palette is split into basic gates and composite/board components:
- `PALETTE_ITEMS` — standard gate types (AND, OR, NOT, XOR, NAND, NOR, XNOR, DFF, INPUT, OUTPUT, etc.)
- `COMPOSITE_PALETTE_ITEMS` — user-saved composite components
- Board IO nodes: Switch, Button, LED, Clock, Reset mapped via `addDesignBoardIo()` in IdeApp

## Live Signals Flow (Simulation)
When simulation is running:
1. `TickEngine` in `projectRuntime.ts` steps circuit → produces `liveSignals: Map<string, 0|1>`
2. `DesignSurface` receives `runtimeSim.liveSignals` via props
3. Canvas applies `liveSignals` to node styling via `NodeView` color overrides
4. Debug bridge: If `externalDebugSignals` prop is set (from verify step-through), those override live simulation for that tick

## Debug Bridge (C-1/C-2)
When user clicks "Show in Design" from Verify step-through:
- `handleDebugTickSelected(tick, signals)` in IdeApp sets `debugState = { tick, signals: Map<string, 0|1> }`
- `DesignSurface` receives `externalDebugSignals` and `externalDebugTick` props
- These freeze the canvas signal display at that tick's state
- `onClearExternalDebug` clears debug state when user resumes editing

## Compiler Status
`DesignCompilerStatus` is derived in IdeApp from export diagnostics:
```typescript
{
  dirtySinceVerify: boolean;
  dirtySinceExport: boolean;
  errorCount: number;
  warningCount: number;
  diagnostics: IdeDiagnostic[];
}
```
Diagnostics shown in bottom console drawer of DesignSurface.

## Diagnostic Route Request
When user clicks "Fix in Design" from error panel:
`diagnosticRouteRequest` is set in IdeApp with `{ nodeId, wireId, panTo, signal, tick, ... }`.
DesignSurface reacts to this to pan camera and select the referenced node/wire.

## Key Design Patterns
- Node labels are editable via inline double-click in NodeView
- Wire routing is auto-computed — no manual waypoints
- Node types use string identifiers; composite types use `COMPOSITE_` prefix
- Canvas coordinate system: `(0,0)` at origin, zoom 1.0 = 1px/unit
- Custom components are stored as `CompositeNodeDef[]` in projectRuntime and palette

## Common Tasks
- **Add new gate type**: Update `PALETTE_ITEMS` + handle in circuitStore/renderer
- **Fix node rendering**: Edit NodeView.tsx color/shape logic
- **Fix wiring bugs**: Edit LogicCanvas wire routing/hit detection
- **Add node inspector field**: Edit NodeInspector.tsx + circuitStore state shape
- **Fix simulation display**: Trace liveSignals flow from TickEngine → canvas
