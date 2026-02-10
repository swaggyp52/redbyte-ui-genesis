# Circuit Designer (Pro) MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Circuit Designer (Pro) as a new isolated plugin view with minimal gate set (AND/OR/NOT/XOR), canvas-based wires, live evaluation, persistence in LabDoc v2, and auto-fallback to Classic if Pro crashes.

**Architecture:** 
- LabDoc schema bumps to v2 with new `circuitDesigner` block (migrated from v1 auto)
- Pro engine: deterministic node/wire evaluation, no SVG (canvas for wires + DOM nodes)
- Pro view: new plugin `lab3/circuit-designer` with its own Canvas + toolbar
- Fallback: Classic `lab3/circuit` remains untouched; auto-open Classic if Pro throws
- Persistence: Pro state serialized in LabDoc, includes in snapshots/exports

**Tech Stack:** React 19, TypeScript, Zustand (store), HTML canvas, Tailwind

---

## Task 1: Extend LabDoc types to v2 + CircuitDesignerDoc

**Files:**
- Modify: `apps/lab3-webapp/src/plugins/LabDoc.ts`
- Create: `apps/lab3-webapp/src/circuit-designer-pro/types.ts`
- Test: `apps/lab3-webapp/src/__tests__/labdoc-v2-migration.test.ts`

**Step 1: Write failing migration test**

```typescript
// apps/lab3-webapp/src/__tests__/labdoc-v2-migration.test.ts
import { migrateV1toV2, createEmptyCircuitDesigner } from '../store/labStore';
import { deserializeSnapshot, validateSnapshotV2 } from '../store/labStore';

describe('LabDoc v2 Migration', () => {
  test('should migrate v1 snapshot to v2 with empty circuitDesigner', () => {
    // Create v1 snapshot (truth table only)
    const v1LabDoc = {
      schemaVersion: 1,
      meta: {
        id: 'test-123',
        name: 'Test Lab',
        createdAt: '2026-02-09T00:00:00Z',
        updatedAt: '2026-02-09T00:00:00Z',
      },
      truthTable: [
        {
          b3: 0, b2: 0, b1: 0, b0: 0,
          seg: [1, 1, 1, 1, 1, 1, 1],
          isDontCare: false,
        },
      ],
      kMaps: {},
      expressions: {},
      results: {},
    };

    const v2Doc = migrateV1toV2(v1LabDoc);

    // Should have schemaVersion 2
    expect(v2Doc.schemaVersion).toBe(2);

    // Should preserve all v1 fields
    expect(v2Doc.meta).toEqual(v1LabDoc.meta);
    expect(v2Doc.truthTable).toEqual(v1LabDoc.truthTable);

    // Should add circuitDesigner default
    expect(v2Doc.circuitDesigner).toBeDefined();
    expect(v2Doc.circuitDesigner.nodes).toEqual([]);
    expect(v2Doc.circuitDesigner.wires).toEqual([]);

    // Should add meta.useProByDefault
    expect(v2Doc.meta.useProByDefault).toBe(false);
  });

  test('should validate v2 snapshot', () => {
    const v2Doc = {
      schemaVersion: 2,
      meta: {
        id: 'test-123',
        name: 'Test Lab',
        createdAt: '2026-02-09T00:00:00Z',
        updatedAt: '2026-02-09T00:00:00Z',
        useProByDefault: false,
      },
      truthTable: [],
      kMaps: {},
      expressions: {},
      results: {},
      circuitDesigner: {
        nodes: [],
        wires: [],
        view: { panX: 0, panY: 0, zoom: 1 },
        selection: null,
        metadata: { createdAt: '2026-02-09T00:00:00Z', updatedAt: '2026-02-09T00:00:00Z', toolVersion: '1.0' },
      },
    };

    expect(validateSnapshotV2(v2Doc)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/labdoc-v2-migration.test.ts
```

Expected: FAIL — `migrateV1toV2` not defined, `validateSnapshotV2` not defined.

**Step 3: Write LabDoc v2 types**

```typescript
// apps/lab3-webapp/src/plugins/LabDoc.ts (add to file)

/**
 * Circuit Designer node (world coordinates, stable)
 */
export interface CircuitNode {
  id: string;
  type: 'AND' | 'OR' | 'NOT' | 'XOR' | 'INPUT' | 'OUTPUT' | 'CONST_0' | 'CONST_1';
  x: number;
  y: number;
  rotation?: number; // 0, 90, 180, 270
  config?: {
    label?: string;
    inputCount?: number; // For AND/OR/XOR gates with variable inputs
    [key: string]: unknown;
  };
}

/**
 * Circuit Designer wire (optional routing points for custom paths)
 */
export interface CircuitWire {
  id: string;
  from: { nodeId: string; port: number }; // port 0 = output, 1+ = inputs
  to: { nodeId: string; port: number };
  points?: Array<{ x: number; y: number }>; // Optional custom routing points
}

/**
 * Circuit Designer viewport state (UI-only, optional)
 */
export interface CircuitViewport {
  panX: number;
  panY: number;
  zoom: number;
}

/**
 * Circuit Designer metadata
 */
export interface CircuitMetadata {
  createdAt: string;
  updatedAt: string;
  toolVersion: string;
}

/**
 * Full Circuit Designer state (persisted in LabDoc v2)
 */
export interface CircuitDesignerDoc {
  nodes: CircuitNode[];
  wires: CircuitWire[];
  view?: CircuitViewport;
  selection?: {
    selectedNodeIds?: string[];
    selectedWireIds?: string[];
  } | null;
  metadata?: CircuitMetadata;
}

/**
 * Extended LabDocMeta for v2 (adds useProByDefault)
 */
export interface LabDocMetaV2 extends LabDocMeta {
  useProByDefault?: boolean; // Whether to open Circuit Designer (Pro) by default
}

/**
 * LabDoc v2 (schema bump)
 */
export interface LabDocV2 {
  schemaVersion: 2;
  meta: LabDocMetaV2;
  truthTable: TruthTableRow[];
  kMaps: Record<string, unknown>;
  expressions: Record<string, unknown>;
  results: Record<string, unknown>;
  circuitDesigner: CircuitDesignerDoc; // NEW in v2
}

/**
 * Union type for LabDoc (v1 or v2)
 */
export type LabDoc = 
  | { schemaVersion: 1; meta: LabDocMeta; truthTable: TruthTableRow[]; kMaps: Record<string, unknown>; expressions: Record<string, unknown>; results: Record<string, unknown>; }
  | LabDocV2;
```

**Step 4: Write migration + empty circuit designer**

```typescript
// apps/lab3-webapp/src/store/labStore.ts (add functions)

/**
 * Create empty CircuitDesignerDoc
 */
export function createEmptyCircuitDesigner(): CircuitDesignerDoc {
  return {
    nodes: [],
    wires: [],
    view: { panX: 0, panY: 0, zoom: 1 },
    selection: null,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      toolVersion: '1.0',
    },
  };
}

/**
 * Migrate v1 LabDoc to v2
 * Keeps all v1 fields, adds circuitDesigner + useProByDefault flag
 */
export function migrateV1toV2(v1Doc: any): LabDocV2 {
  return {
    schemaVersion: 2,
    meta: {
      ...v1Doc.meta,
      useProByDefault: false, // Default to Classic for now
    },
    truthTable: v1Doc.truthTable || [],
    kMaps: v1Doc.kMaps || {},
    expressions: v1Doc.expressions || {},
    results: v1Doc.results || {},
    circuitDesigner: createEmptyCircuitDesigner(),
  };
}

/**
 * Validate v2 snapshot (strict)
 */
export function validateSnapshotV2(obj: unknown): obj is LabDocV2 {
  if (!obj || typeof obj !== 'object') return false;
  
  const doc = obj as Record<string, unknown>;
  
  // Must be v2
  if (doc.schemaVersion !== 2) return false;
  
  // Check meta
  if (!doc.meta || typeof doc.meta !== 'object') return false;
  const meta = doc.meta as Record<string, unknown>;
  if (typeof meta.id !== 'string') return false;
  if (typeof meta.name !== 'string') return false;
  if (typeof meta.createdAt !== 'string') return false;
  if (typeof meta.updatedAt !== 'string') return false;
  
  // Check truthTable array
  if (!Array.isArray(doc.truthTable)) return false;
  
  // Check circuitDesigner block
  if (!doc.circuitDesigner || typeof doc.circuitDesigner !== 'object') return false;
  const cd = doc.circuitDesigner as Record<string, unknown>;
  
  if (!Array.isArray(cd.nodes)) return false;
  if (!Array.isArray(cd.wires)) return false;
  
  // Check other v2 fields exist
  if (typeof doc.kMaps !== 'object') return false;
  if (typeof doc.expressions !== 'object') return false;
  if (typeof doc.results !== 'object') return false;
  
  return true;
}
```

**Step 5: Update deserializeSnapshot to handle migration**

```typescript
// apps/lab3-webapp/src/store/labStore.ts (modify deserializeSnapshot)

/**
 * Deserialize LabDoc from JSON + auto-upgrade v1 to v2
 */
export function deserializeSnapshot(json: string): LabDocV2 {
  const parsed = JSON.parse(json) as any;
  
  // If v1, migrate to v2
  if (parsed.schemaVersion === 1) {
    return migrateV1toV2(parsed);
  }
  
  // If v2, validate and return
  if (validateSnapshotV2(parsed)) {
    return parsed;
  }
  
  // If invalid, return empty v2 doc
  console.warn('Invalid LabDoc snapshot, using empty v2 doc');
  return {
    schemaVersion: 2,
    meta: {
      id: crypto.randomUUID(),
      name: 'Untitled Lab',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      useProByDefault: false,
    },
    truthTable: [],
    kMaps: {},
    expressions: {},
    results: {},
    circuitDesigner: createEmptyCircuitDesigner(),
  };
}
```

**Step 6: Run test to verify it passes**

```bash
pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/labdoc-v2-migration.test.ts
```

Expected: PASS (2 tests).

**Step 7: Commit**

```bash
git add apps/lab3-webapp/src/plugins/LabDoc.ts apps/lab3-webapp/src/store/labStore.ts apps/lab3-webapp/src/__tests__/labdoc-v2-migration.test.ts
git commit -m "feat: LabDoc v2 schema + CircuitDesigner types + v1->v2 auto-migration"
```

---

## Task 2: Create Circuit Designer (Pro) types + evaluation engine

**Files:**
- Create: `apps/lab3-webapp/src/circuit-designer-pro/types.ts`
- Create: `apps/lab3-webapp/src/circuit-designer-pro/engine.ts`
- Test: `apps/lab3-webapp/src/__tests__/pro-engine.test.ts`

**Step 1: Write failing engine tests**

```typescript
// apps/lab3-webapp/src/__tests__/pro-engine.test.ts
import { evaluateCircuit, addNode, connectWire } from '../circuit-designer-pro/engine';
import type { CircuitDesignerDoc, CircuitNode, CircuitWire } from '../plugins/LabDoc';

describe('Circuit Designer Pro Engine', () => {
  test('should evaluate AND gate with two inputs', () => {
    const circuit: CircuitDesignerDoc = {
      nodes: [
        { id: 'in1', type: 'INPUT', x: 0, y: 0, config: { value: true } },
        { id: 'in2', type: 'INPUT', x: 0, y: 50, config: { value: true } },
        { id: 'and1', type: 'AND', x: 100, y: 25, config: { inputCount: 2 } },
        { id: 'out1', type: 'OUTPUT', x: 200, y: 25 },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'in1', port: 0 }, to: { nodeId: 'and1', port: 1 } },
        { id: 'w2', from: { nodeId: 'in2', port: 0 }, to: { nodeId: 'and1', port: 2 } },
        { id: 'w3', from: { nodeId: 'and1', port: 0 }, to: { nodeId: 'out1', port: 1 } },
      ],
    };

    const result = evaluateCircuit(circuit);
    // AND(true, true) = true
    const andOutput = result.get('and1');
    expect(andOutput).toBe(true);
  });

  test('should detect combinational loops and report error', () => {
    const circuit: CircuitDesignerDoc = {
      nodes: [
        { id: 'g1', type: 'OR', x: 0, y: 0 },
        { id: 'g2', type: 'AND', x: 100, y: 0 },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'g1', port: 0 }, to: { nodeId: 'g2', port: 1 } },
        { id: 'w2', from: { nodeId: 'g2', port: 0 }, to: { nodeId: 'g1', port: 1 } }, // Loop!
      ],
    };

    const result = evaluateCircuit(circuit);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('combinational loop');
  });

  test('should add node and return new CircuitDesignerDoc', () => {
    const circuit: CircuitDesignerDoc = { nodes: [], wires: [] };

    const newCircuit = addNode(circuit, 'AND', 100, 100);

    expect(newCircuit.nodes).toHaveLength(1);
    expect(newCircuit.nodes[0].type).toBe('AND');
    expect(newCircuit.nodes[0].x).toBe(100);
    expect(newCircuit.nodes[0].y).toBe(100);
  });

  test('should connect two nodes with a wire', () => {
    const circuit: CircuitDesignerDoc = {
      nodes: [
        { id: 'g1', type: 'AND', x: 0, y: 0 },
        { id: 'g2', type: 'OR', x: 100, y: 0 },
      ],
      wires: [],
    };

    const newCircuit = connectWire(circuit, 'g1', 0, 'g2', 1);

    expect(newCircuit.wires).toHaveLength(1);
    expect(newCircuit.wires[0].from.nodeId).toBe('g1');
    expect(newCircuit.wires[0].to.nodeId).toBe('g2');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/pro-engine.test.ts
```

Expected: FAIL — `evaluateCircuit`, `addNode`, `connectWire` not defined.

**Step 3: Write engine types**

```typescript
// apps/lab3-webapp/src/circuit-designer-pro/types.ts
import type { CircuitNode, CircuitWire, CircuitDesignerDoc } from '../plugins/LabDoc';

/**
 * Evaluation result: Map of nodeId → output value (boolean)
 * Also includes optional error message for circuit validation issues
 */
export interface EvaluationResult {
  values: Map<string, boolean | undefined>;
  error?: string;
}

/**
 * Action types for Circuit Designer
 */
export type CircuitAction =
  | { type: 'ADD_NODE'; gateType: CircuitNode['type']; x: number; y: number }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'MOVE_NODE'; nodeId: string; x: number; y: number }
  | { type: 'CONNECT_WIRE'; fromNodeId: string; fromPort: number; toNodeId: string; toPort: number }
  | { type: 'DELETE_WIRE'; wireId: string }
  | { type: 'SET_INPUT_VALUE'; nodeId: string; value: boolean }
  | { type: 'SELECT_NODE'; nodeId: string }
  | { type: 'DESELECT' }
  | { type: 'SET_VIEWPORT'; panX: number; panY: number; zoom: number };
```

**Step 4: Write evaluation engine**

```typescript
// apps/lab3-webapp/src/circuit-designer-pro/engine.ts
import type { CircuitDesignerDoc, CircuitNode } from '../plugins/LabDoc';
import type { EvaluationResult } from './types';

const GATE_TYPE_INPUTS: Record<CircuitNode['type'], number> = {
  AND: 2,
  OR: 2,
  NOT: 1,
  XOR: 2,
  INPUT: 0,
  OUTPUT: 1,
  CONST_0: 0,
  CONST_1: 0,
};

/**
 * Evaluate circuit: compute output values for all nodes
 * Uses topological sort from inputs → outputs to detect combinational loops
 */
export function evaluateCircuit(circuit: CircuitDesignerDoc): EvaluationResult & { error?: string; get: (nodeId: string) => boolean | undefined } {
  const values = new Map<string, boolean | undefined>();

  // Initialize INPUT, CONST nodes
  circuit.nodes.forEach(node => {
    if (node.type === 'INPUT') {
      values.set(node.id, node.config?.value === true);
    } else if (node.type === 'CONST_0') {
      values.set(node.id, false);
    } else if (node.type === 'CONST_1') {
      values.set(node.id, true);
    }
  });

  // Build adjacency map: nodeId → list of target nodeIds
  const adjacency = new Map<string, string[]>();
  circuit.nodes.forEach(node => adjacency.set(node.id, []));

  circuit.wires.forEach(wire => {
    const targets = adjacency.get(wire.from.nodeId) || [];
    targets.push(wire.to.nodeId);
    adjacency.set(wire.from.nodeId, targets);
  });

  // Topological sort with cycle detection (DFS)
  const visited = new Set<string>();
  const recStack = new Set<string>();
  let hasCycle = false;

  const dfs = (nodeId: string) => {
    if (hasCycle) return;
    visited.add(nodeId);
    recStack.add(nodeId);

    const targets = adjacency.get(nodeId) || [];
    for (const target of targets) {
      if (!visited.has(target)) {
        dfs(target);
      } else if (recStack.has(target)) {
        hasCycle = true;
        return;
      }
    }

    recStack.delete(nodeId);
  };

  circuit.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  });

  if (hasCycle) {
    return {
      values,
      error: 'Combinational loop detected in circuit',
      get: (nodeId: string) => values.get(nodeId),
    };
  }

  // Evaluate gates in topological order
  const evaluationOrder: string[] = [];
  const tempVisited = new Set<string>();
  const tempRecStack = new Set<string>();

  const topoDfs = (nodeId: string) => {
    tempVisited.add(nodeId);
    tempRecStack.add(nodeId);

    const targets = adjacency.get(nodeId) || [];
    for (const target of targets) {
      if (!tempVisited.has(target)) {
        topoDfs(target);
      }
    }

    tempRecStack.delete(nodeId);
    evaluationOrder.unshift(nodeId); // Reverse for topological order
  };

  circuit.nodes.forEach(node => {
    if (!tempVisited.has(node.id)) {
      topoDfs(node.id);
    }
  });

  // Evaluate gates
  evaluationOrder.forEach(nodeId => {
    const node = circuit.nodes.find(n => n.id === nodeId);
    if (!node || node.type === 'INPUT' || node.type === 'OUTPUT' || node.type.startsWith('CONST')) return;

    // Find input wires for this node
    const inputWires = circuit.wires.filter(w => w.to.nodeId === nodeId).sort((a, b) => a.to.port - b.to.port);
    const inputValues = inputWires.map(w => values.get(w.from.nodeId) === true);

    let output: boolean | undefined;

    switch (node.type) {
      case 'AND':
        output = inputValues.length > 0 && inputValues.every(v => v);
        break;
      case 'OR':
        output = inputValues.some(v => v);
        break;
      case 'NOT':
        output = inputValues.length > 0 ? !inputValues[0] : undefined;
        break;
      case 'XOR':
        output = inputValues.filter(v => v).length % 2 === 1;
        break;
      default:
        output = undefined;
    }

    values.set(nodeId, output);
  });

  return {
    values,
    get: (nodeId: string) => values.get(nodeId),
  };
}

/**
 * Add a node to the circuit (returns new doc, doesn't mutate)
 */
export function addNode(circuit: CircuitDesignerDoc, gateType: CircuitNode['type'], x: number, y: number): CircuitDesignerDoc {
  const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newNode: CircuitNode = {
    id: newId,
    type: gateType,
    x,
    y,
    config: {
      inputCount: (GATE_TYPE_INPUTS[gateType] || 2),
    },
  };

  return {
    ...circuit,
    nodes: [...circuit.nodes, newNode],
  };
}

/**
 * Delete a node and all connected wires
 */
export function deleteNode(circuit: CircuitDesignerDoc, nodeId: string): CircuitDesignerDoc {
  return {
    ...circuit,
    nodes: circuit.nodes.filter(n => n.id !== nodeId),
    wires: circuit.wires.filter(w => w.from.nodeId !== nodeId && w.to.nodeId !== nodeId),
  };
}

/**
 * Connect two nodes with a wire
 */
export function connectWire(circuit: CircuitDesignerDoc, fromNodeId: string, fromPort: number, toNodeId: string, toPort: number): CircuitDesignerDoc {
  const newWire = {
    id: `wire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    from: { nodeId: fromNodeId, port: fromPort },
    to: { nodeId: toNodeId, port: toPort },
  };

  return {
    ...circuit,
    wires: [...circuit.wires, newWire],
  };
}

/**
 * Delete a wire
 */
export function deleteWire(circuit: CircuitDesignerDoc, wireId: string): CircuitDesignerDoc {
  return {
    ...circuit,
    wires: circuit.wires.filter(w => w.id !== wireId),
  };
}

/**
 * Move a node
 */
export function moveNode(circuit: CircuitDesignerDoc, nodeId: string, x: number, y: number): CircuitDesignerDoc {
  return {
    ...circuit,
    nodes: circuit.nodes.map(n => n.id === nodeId ? { ...n, x, y } : n),
  };
}

/**
 * Set input node value
 */
export function setNodeValue(circuit: CircuitDesignerDoc, nodeId: string, value: boolean): CircuitDesignerDoc {
  return {
    ...circuit,
    nodes: circuit.nodes.map(n =>
      n.id === nodeId ? { ...n, config: { ...n.config, value } } : n
    ),
  };
}
```

**Step 5: Run test to verify it passes**

```bash
pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/pro-engine.test.ts
```

Expected: PASS (4 tests).

**Step 6: Commit**

```bash
git add apps/lab3-webapp/src/circuit-designer-pro/ apps/lab3-webapp/src/__tests__/pro-engine.test.ts
git commit -m "feat(pro): Circuit Designer engine + evaluation + graph traversal"
```

---

## Task 3: Create Circuit Designer (Pro) Canvas UI + Mouse Interactions

**Files:**
- Create: `apps/lab3-webapp/src/circuit-designer-pro/CircuitDesignerPro.tsx`
- Create: `apps/lab3-webapp/src/circuit-designer-pro/CanvasRenderer.tsx`
- Create: `apps/lab3-webapp/src/circuit-designer-pro/Toolbar.tsx`

**Step 1: Write CanvasRenderer for wires + grid**

```typescript
// apps/lab3-webapp/src/circuit-designer-pro/CanvasRenderer.tsx
import React, { useEffect, useRef } from 'react';
import type { CircuitDesignerDoc } from '../plugins/LabDoc';
import type { EvaluationResult } from './types';

interface CanvasRendererProps {
  circuit: CircuitDesignerDoc;
  evaluation: EvaluationResult & { get: (nodeId: string) => boolean | undefined };
  panX: number;
  panY: number;
  zoom: number;
  selectedNodeIds?: Set<string>;
  hoveredWireId?: string;
}

const GRID_SIZE = 20;
const WIRE_WIDTH = 2;
const WIRE_WIDTH_HOVER = 3;

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  circuit,
  evaluation,
  panX,
  panY,
  zoom,
  selectedNodeIds = new Set(),
  hoveredWireId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += GRID_SIZE * zoom) {
      ctx.beginPath();
      ctx.moveTo(x + panX, 0);
      ctx.lineTo(x + panX, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += GRID_SIZE * zoom) {
      ctx.beginPath();
      ctx.moveTo(0, y + panY);
      ctx.lineTo(canvas.width, y + panY);
      ctx.stroke();
    }

    // Draw wires
    circuit.wires.forEach(wire => {
      const fromNode = circuit.nodes.find(n => n.id === wire.from.nodeId);
      const toNode = circuit.nodes.find(n => n.id === wire.to.nodeId);

      if (!fromNode || !toNode) return;

      const isHovered = wire.id === hoveredWireId;
      const isActive = evaluation.get(wire.from.nodeId) === true;

      // Calculate port positions (simplified: centered on node)
      const fromX = (fromNode.x + 60) * zoom + panX; // Right side of node (60px wide)
      const fromY = (fromNode.y + 30) * zoom + panY; // Center vertical
      const toX = toNode.x * zoom + panX; // Left side
      const toY = (toNode.y + 30) * zoom + panY;

      // Draw wire
      ctx.strokeStyle = isActive ? '#10b981' : '#64748b';
      ctx.lineWidth = isHovered ? WIRE_WIDTH_HOVER * zoom : WIRE_WIDTH * zoom;

      if (isActive) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#10b981';
      }

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);

      // Bezier curve (Manhattan-style routing)
      const midX = (fromX + toX) / 2;
      ctx.bezierCurveTo(midX, fromY, midX, toY, toX, toY);
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }, [circuit, evaluation, panX, panY, zoom, selectedNodeIds, hoveredWireId]);

  return (
    <canvas
      ref={canvasRef}
      width={canvas?.width || 1200}
      height={canvas?.height || 600}
      className="absolute inset-0 bg-slate-900"
    />
  );
};
```

Actually, let me keep this simpler for the plan. The detailed code will be written during execution. Let me continue with the structural outline:

**Step 2: Write Toolbar**

```typescript
// apps/lab3-webapp/src/circuit-designer-pro/Toolbar.tsx (outline)
// Toolbar with buttons: Add AND, OR, NOT, XOR, INPUT, OUTPUT
// Plus: Delete, Undo, Redo, Validate, Export
// Shows tool mode (pointer, wire, delete)
```

**Step 3: Write main CircuitDesignerPro component (outline)**

```typescript
// apps/lab3-webapp/src/circuit-designer-pro/CircuitDesignerPro.tsx
// Main component that:
// - Integrates CanvasRenderer + DOM nodes + Toolbar
// - Manages mouse events: drag nodes, draw wires, click ports
// - Updates doc.circuitDesigner on every action
// - Emits events for Console logging
// - Validates against truth table on demand
// - Crash boundary: if render fails, shows fallback "Switch to Classic"
```

**Step 4–6: Commit main UI bundle**

This will be implemented in the execution phase with more granular steps.

---

## Task 4: Register Pro view in plugin registry + fallback logic

**Files:**
- Modify: `apps/lab3-webapp/src/plugins/registerLab3.tsx`
- Modify: `apps/lab3-webapp/src/workspace/OverviewView.tsx`
- Create: `apps/lab3-webapp/src/circuit-designer-pro/ProErrorBoundary.tsx`

**Step 1: Create error boundary for Pro**

```typescript
// apps/lab3-webapp/src/circuit-designer-pro/ProErrorBoundary.tsx
import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ProErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('Circuit Designer (Pro) crashed:', error);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

**Step 2: Add Pro view to registerLab3.tsx**

```typescript
// apps/lab3-webapp/src/plugins/registerLab3.tsx (add to views array)
import { CircuitDesignerPro } from '../circuit-designer-pro/CircuitDesignerPro';
import { CircuitEditor } from '../circuit-editor'; // Keep Classic

// Add to lab3Views:
{
  pluginId: 'lab3',
  viewId: 'circuit-designer',
  title: 'Circuit Designer (Pro)',
  icon: 'Zap',
  Component: CircuitDesignerPro,
},
// Keep classic:
{
  pluginId: 'lab3',
  viewId: 'circuit',
  title: 'Circuit (Classic)',
  icon: 'Cpu',
  Component: CircuitEditor,
},
```

**Step 3: Add toggle to OverviewView**

```typescript
// apps/lab3-webapp/src/workspace/OverviewView.tsx (add)
import useLabStore from '../store/labStore';

// Add checkbox:
const doc = useLabStore((s) => s.doc);
const setDoc = useLabStore((s) => s.setDoc);

const handleTogglePro = () => {
  setDoc({
    ...doc,
    meta: {
      ...doc.meta,
      useProByDefault: !(doc.meta.useProByDefault ?? false),
    },
  });
};

// In JSX:
<label className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={doc.meta.useProByDefault ?? false}
    onChange={handleTogglePro}
  />
  Use Circuit Designer (Pro) by default
</label>
```

---

## Task 5: Hook Pro state to LabDoc + Persistence

**Files:**
- Modify: `apps/lab3-webapp/src/store/labStore.ts` (add actions)
- Modify: `apps/lab3-webapp/src/circuit-designer-pro/CircuitDesignerPro.tsx` (wire emitEvent + setDoc)

**Step 1: Add store action for circuit updates**

```typescript
// apps/lab3-webapp/src/store/labStore.ts (add to LabStoreState)
updateCircuitDesigner: (circuitDesigner: CircuitDesignerDoc) => void;

// Implementation:
updateCircuitDesigner: (circuitDesigner: CircuitDesignerDoc) => {
  const state = get();
  set({
    doc: {
      ...state.doc,
      circuitDesigner,
    },
  });
  state.emitEvent('circuit.updated', {
    nodeCount: circuitDesigner.nodes.length,
    wireCount: circuitDesigner.wires.length,
  });
},
```

**Step 2: Update CircuitDesignerPro to call updateCircuitDesigner**

```typescript
// Pseudocode:
const updateCircuitDesigner = useLabStore((s) => s.updateCircuitDesigner);
const emitEvent = useLabStore((s) => s.emitEvent);

// On add node:
const newCircuit = addNode(circuit, gateType, x, y);
updateCircuitDesigner(newCircuit);
emitEvent('circuit.addNode', { type: gateType, x, y });

// On wire connect:
const newCircuit = connectWire(circuit, fromId, fromPort, toId, toPort);
updateCircuitDesigner(newCircuit);
emitEvent('circuit.connect', { from: fromId, to: toId });
```

---

## Task 6: Add validation + truth table comparison

**Files:**
- Create: `apps/lab3-webapp/src/circuit-designer-pro/validation.ts`
- Modify: `apps/lab3-webapp/src/circuit-designer-pro/CircuitDesignerPro.tsx` (add "Validate" button)

**Step 1: Write validation logic**

```typescript
// apps/lab3-webapp/src/circuit-designer-pro/validation.ts
import { evaluateCircuit } from './engine';
import type { CircuitDesignerDoc, LabDocV2 } from '../plugins/LabDoc';

export interface ValidationResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  failures?: Array<{
    inputRow: number;
    expectedOutputs: number[];
    actualOutputs: number[];
  }>;
}

/**
 * Validate circuit against truth table
 * Runs all 16 input combinations, compares segment outputs
 */
export function validateCircuitAgainstTruthTable(circuit: CircuitDesignerDoc, doc: LabDocV2): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    failures: [],
  };

  // For each truth table row, set inputs and evaluate
  doc.truthTable.forEach((row, idx) => {
    result.totalTests++;

    // Set INPUT nodes to match truth table row
    const circuit_with_inputs = {
      ...circuit,
      nodes: circuit.nodes.map(n => {
        if (n.type === 'INPUT') {
          const inputIndex = parseInt(n.config?.label?.replace(/^IN_/, '') || '0');
          const inputValue = [row.b3, row.b2, row.b1, row.b0][inputIndex] === 1;
          return { ...n, config: { ...n.config, value: inputValue } };
        }
        return n;
      }),
    };

    // Evaluate
    const evaluation = evaluateCircuit(circuit_with_inputs);

    // Extract outputs from OUTPUT nodes
    const actualOutputs = circuit.nodes
      .filter(n => n.type === 'OUTPUT')
      .map(n => (evaluation.get(n.id) ? 1 : 0));

    // Compare with truth table row
    const expectedOutputs = row.seg; // Segment outputs

    if (JSON.stringify(actualOutputs) === JSON.stringify(expectedOutputs)) {
      result.passedTests++;
    } else {
      result.passed = false;
      result.failedTests++;
      result.failures?.push({
        inputRow: idx,
        expectedOutputs,
        actualOutputs,
      });
    }
  });

  return result;
}
```

---

## Task 7: Default landing + view selection logic

**Files:**
- Modify: `apps/lab3-webapp/src/App.tsx` (update window spawning logic)

**Step 1: Update App.tsx to respect useProByDefault**

```typescript
// Pseudocode:
// When spawning default windows on first boot:
const useProByDefault = doc.meta.useProByDefault ?? false;
const circuitViewId = useProByDefault ? 'circuit-designer' : 'circuit';

// Spawn with appropriate view
openWindow('lab3', circuitViewId, { x: 400, y: 100, w: 600, h: 400 });
```

---

## Task 8: Build + Test Gate

**Files:**
- Test: All existing tests + new tests pass
- Command: `pnpm --filter @redbyte/lab3-webapp run build` + `pnpm -w exec vitest run`

**Step 1–5: Build gate**

- All TypeScript code must compile without errors (`tsc --noEmit`)
- All tests must pass (unit + integration)
- Bundle size must not exceed 900 KB minified
- No console errors when App boots with Pro views registered

**Acceptance Criteria:**
- ✅ v1 snapshot migrates to v2 silently + auto-recovers
- ✅ Pro engine evaluates AND/OR/NOT/XOR gates correctly
- ✅ Canvas renders without SVG removeChild errors
- ✅ Dragging nodes updates positions in real-time
- ✅ Connecting ports creates wires with visual feedback
- ✅ Validation button compares circuit outputs vs truth table
- ✅ Events logged to Console window
- ✅ If Pro crashes, auto-opens Classic with fallback banner
- ✅ useProByDefault toggle persists in LabDoc

---

## Execution Summary

This plan implements a complete, isolated Circuit Designer (Pro) MVP that:
1. Extends LabDoc to v2 with auto-migration
2. Provides a deterministic, testable evaluation engine (no SVG reconciliation hell)
3. Renders canvas-based wires + DOM nodes
4. Persists state in LabDoc (same as truth table)
5. Falls back gracefully to Classic if Pro crashes
6. Logs all actions for debugging in Console
7. Validates circuits against truth table on demand

**After MVP ships**, the next phase would add: NAND/NOR/XNOR gates, multi-input gates, bus wires, labels, grouping, smart routing, oscilloscope overlay, 3D board preview, animated signal propagation.

---

**Execution:** Use superpowers:executing-plans to run tasks 1–8 sequentially with git commits after each task.
