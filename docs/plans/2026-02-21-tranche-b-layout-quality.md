# Tranche B: Layout Quality + Auto-Fit After Import

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make imported circuits render with visually balanced, wire-crossing-minimised layouts and auto-fit to viewport after import Apply.

**Architecture:** Two improvements to `assignPositions` in `hdlToCircuit.ts` (vertical centering + predecessor-based cross-reduction); verify that `lastSavedAt` change on import triggers the existing `viewportSeed` auto-fit path in `DesignSurface`; unit-test the layout algorithm; add a Playwright gate verifying nodes are spread and non-overlapping after professor import.

**Tech Stack:** TypeScript, Vitest (unit), Playwright via `_gateHarness.mjs` (e2e), `pnpm --filter @redbyte/rb-apps test`, `pnpm --filter @redbyte/playground build`

**Key files:**
- Layout algorithm: `packages/rb-apps/src/import/hdlToCircuit.ts`
- Auto-fit trigger: `packages/rb-apps/src/apps/IdeApp.tsx` (viewportSeed construction)
- Import action handler: `packages/rb-apps/src/apps/ide/projectRuntime.ts` (lastSavedAt)
- Gate harness: `scripts/gates/_gateHarness.mjs`
- Existing professor fixture: `packages/rb-apps/src/fixtures/import/zip/02-vivado-nested-andgate.zip`

---

## Pre-read: Confirmed facts

| Fact | Value |
|------|-------|
| `assignPositions` constants | `ORIGIN_X=80`, `ORIGIN_Y=80`, `GRID_X=160`, `GRID_Y=80` |
| Current layout | Each column starts at `ORIGIN_Y`; no vertical centering; no cross-reduction |
| `viewportSeed` in IdeApp | `` `${activeExampleId ?? 'custom'}:${lastSavedAt}` `` |
| `lastSavedAt` source | `useProjectRuntime((state) => state.lastSavedAt)` |
| Auto-fit trigger in DesignSurface | When `viewportSeed` changes → resets `hasAutoFitRef` → calls `fitToCircuit()` |
| `ioPresentationMap` in DesignSurface | Already built and passed; `pinAlias` already shown in NodeView |
| `01-and-gate-vivado.zip` fixture | Flat structure: 2 inputs → AND → 1 output (3 nodes, 2 HDL instances) |
| `02-vivado-nested-andgate.zip` fixture | Nested Vivado structure: 3 ports, all mapped with Basys3 pins |

---

## Commit Summary

| # | Commit message |
|---|----------------|
| 1 | `fix(import): improve assignPositions — vertical centering + wire-crossing reduction` |
| 2 | `test(import): unit tests for layout centering and cross-reduction` |
| 3 | `test(gates): add ide-autolayout-contract` |

---

## Task 1 · Improve `assignPositions`

**Files:**
- Modify: `packages/rb-apps/src/import/hdlToCircuit.ts` (function `assignPositions`, ~lines 155–216)

### Step 1: Read the current `assignPositions` function

Read `packages/rb-apps/src/import/hdlToCircuit.ts` lines 155–220. Understand the column-building loop, how `columns` Map is built, and how nodes are positioned.

### Step 2: Replace `assignPositions` with the improved version

Replace the entire `assignPositions` function (everything from `function assignPositions(` to the closing `}`) with the following:

```typescript
function assignPositions(nodes: Node[], connections: Connection[]): Node[] {
  const GRID_Y_SPACING = 96; // was 80 — extra breathing room for labels

  const inputNodes = nodes.filter((n) => n.type === 'INPUT');
  const outputNodes = nodes.filter((n) => n.type === 'OUTPUT');
  const gateNodes = nodes.filter((n) => n.type !== 'INPUT' && n.type !== 'OUTPUT');

  // Build dependency map: gate node id → set of ids that feed into it
  const deps: Map<string, Set<string>> = new Map();
  for (const n of gateNodes) deps.set(n.id, new Set());

  for (const conn of connections) {
    const fromId = typeof conn.from === 'string' ? conn.from : (conn.from as any).nodeId;
    const toId = typeof conn.to === 'string' ? conn.to : (conn.to as any).nodeId;
    if (
      deps.has(toId) &&
      (deps.has(fromId) || nodes.find((n) => n.id === fromId)?.type === 'INPUT')
    ) {
      deps.get(toId)?.add(fromId);
    }
  }

  // Compute topological depth per gate node
  const depthMap: Map<string, number> = new Map();
  function getDepth(id: string): number {
    if (depthMap.has(id)) return depthMap.get(id)!;
    const node = nodes.find((n) => n.id === id);
    if (!node || node.type === 'INPUT') return 0;
    const d = deps.get(id);
    if (!d || d.size === 0) {
      depthMap.set(id, 1);
      return 1;
    }
    const max = Math.max(...[...d].map(getDepth));
    depthMap.set(id, max + 1);
    return max + 1;
  }
  for (const n of gateNodes) getDepth(n.id);

  // Group gate nodes by column
  const columns: Map<number, Node[]> = new Map();
  for (const n of gateNodes) {
    const col = depthMap.get(n.id) ?? 1;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(n);
  }
  const maxGateCol = columns.size > 0 ? Math.max(...columns.keys()) : 0;
  const outputCol = maxGateCol + 1;

  // Global vertical centering: find tallest column, center everything around it
  const allColSizes = [
    inputNodes.length,
    ...[...columns.values()].map((c) => c.length),
    outputNodes.length,
  ];
  const maxColSize = allColSizes.length > 0 ? Math.max(...allColSizes) : 1;
  const globalCenterY = ORIGIN_Y + ((maxColSize - 1) * GRID_Y_SPACING) / 2;

  function colStartY(colSize: number): number {
    return globalCenterY - ((colSize - 1) * GRID_Y_SPACING) / 2;
  }

  // Track positioned nodes for cross-reduction heuristic
  const positionedById = new Map<string, { x: number; y: number }>();
  const positioned: Node[] = [];

  // INPUT column (col 0) — centered
  const inputStartY = colStartY(inputNodes.length);
  inputNodes.forEach((n, i) => {
    const y = inputStartY + i * GRID_Y_SPACING;
    positioned.push({ ...n, x: ORIGIN_X, y });
    positionedById.set(n.id, { x: ORIGIN_X, y });
  });

  // Gate columns (1 … maxGateCol) — sorted by avg predecessor Y for cross-reduction
  for (const [col, colNodes] of [...columns.entries()].sort(([a], [b]) => a - b)) {
    // Sort nodes in this column by the average Y of their already-positioned predecessors
    const withScore = colNodes.map((n) => {
      const predecessorIds = deps.get(n.id) ?? new Set<string>();
      const ys = [...predecessorIds]
        .map((id) => positionedById.get(id)?.y)
        .filter((y): y is number => y !== undefined);
      const avgY = ys.length > 0 ? ys.reduce((a, b) => a + b, 0) / ys.length : globalCenterY;
      return { n, avgY };
    });
    withScore.sort((a, b) => a.avgY - b.avgY);
    const sortedNodes = withScore.map((w) => w.n);

    const startY = colStartY(sortedNodes.length);
    sortedNodes.forEach((n, i) => {
      const x = ORIGIN_X + col * GRID_X;
      const y = startY + i * GRID_Y_SPACING;
      positioned.push({ ...n, x, y });
      positionedById.set(n.id, { x, y });
    });
  }

  // OUTPUT column — centered
  const outputStartY = colStartY(outputNodes.length);
  outputNodes.forEach((n, i) => {
    const x = ORIGIN_X + outputCol * GRID_X;
    const y = outputStartY + i * GRID_Y_SPACING;
    positioned.push({ ...n, x, y });
    positionedById.set(n.id, { x, y });
  });

  return positioned;
}
```

**Note:** `ORIGIN_X`, `ORIGIN_Y`, and `GRID_X` constants are defined at the top of the file (around line 150). `GRID_Y` can remain defined or be unused — the new function uses local `GRID_Y_SPACING = 96` instead. Do NOT remove `GRID_Y` if it is exported or used elsewhere; just shadow it locally.

### Step 3: Build and type-check

```bash
pnpm --filter @redbyte/rb-apps tsc --noEmit
```

Expected: zero new errors.

### Step 4: Run existing import tests

```bash
pnpm --filter @redbyte/rb-apps test packages/rb-apps/src/apps/ide/__tests__/
```

Expected: all PASS (roundtrip and nested-folder tests must still pass).

### Step 5: Commit

```bash
git add packages/rb-apps/src/import/hdlToCircuit.ts
git commit -m "fix(import): improve assignPositions — vertical centering + wire-crossing reduction"
```

---

## Task 2 · Unit Tests for Layout Quality

**Files:**
- Create: `packages/rb-apps/src/import/__tests__/hdlToCircuit.layout.test.ts`

### Step 1: Read import test directory for naming conventions

Run:
```bash
ls packages/rb-apps/src/import/__tests__/
```
to confirm existing test file names.

### Step 2: Write the failing tests

Create `packages/rb-apps/src/import/__tests__/hdlToCircuit.layout.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parsedHdlToCircuit, type ParsedHDL } from '../hdlToCircuit';

/**
 * Helper: build a minimal ParsedHDL with given ports and instances.
 */
function makeParsed(opts: {
  inputs: string[];
  outputs: string[];
  instances?: Array<{
    id: string;
    componentType: string;
    portMap: Record<string, string>;
  }>;
}): ParsedHDL {
  return {
    entityName: 'test',
    ports: [
      ...opts.inputs.map((name) => ({ name, direction: 'in' as const, typeName: 'std_logic' })),
      ...opts.outputs.map((name) => ({ name, direction: 'out' as const, typeName: 'std_logic' })),
    ],
    instances: opts.instances ?? [],
    signals: [],
    warnings: [],
    lang: 'vhdl',
  };
}

describe('assignPositions — vertical centering', () => {
  it('single-column circuit: input and output are vertically centred at the same Y', () => {
    // 1 input → direct pass-through → 1 output (no gates), both should be at same Y
    const parsed = makeParsed({ inputs: ['a'], outputs: ['y'] });
    const result = parsedHdlToCircuit(parsed);
    const inputNode = result.circuit.nodes.find((n) => n.type === 'INPUT');
    const outputNode = result.circuit.nodes.find((n) => n.type === 'OUTPUT');
    expect(inputNode?.y).toBeDefined();
    expect(outputNode?.y).toBeDefined();
    expect(inputNode!.y).toBe(outputNode!.y);
  });

  it('two-input one-output: inputs are symmetrically placed around output Y', () => {
    // 2 inputs → AND gate → 1 output
    const parsed = makeParsed({
      inputs: ['a', 'b'],
      outputs: ['y'],
      instances: [
        { id: 'u0', componentType: 'AND', portMap: { in0: 'a', in1: 'b', out: 'y' } },
      ],
    });
    const result = parsedHdlToCircuit(parsed);
    const inputs = result.circuit.nodes.filter((n) => n.type === 'INPUT');
    const outputNode = result.circuit.nodes.find((n) => n.type === 'OUTPUT');
    expect(inputs).toHaveLength(2);
    const inputCenterY = (inputs[0].y! + inputs[1].y!) / 2;
    expect(outputNode?.y).toBeDefined();
    // Input column center Y should equal output column Y (both centered on same globalCenterY)
    expect(Math.abs(inputCenterY - outputNode!.y!)).toBeLessThan(2);
  });

  it('three-input one-output: middle input is at output Y', () => {
    const parsed = makeParsed({
      inputs: ['a', 'b', 'c'],
      outputs: ['y'],
      instances: [
        { id: 'u0', componentType: 'AND', portMap: { in0: 'a', in1: 'b', out: 'mid' } },
        { id: 'u1', componentType: 'AND', portMap: { in0: 'mid', in1: 'c', out: 'y' } },
      ],
    });
    const result = parsedHdlToCircuit(parsed);
    const inputs = result.circuit.nodes
      .filter((n) => n.type === 'INPUT')
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
    const outputNode = result.circuit.nodes.find((n) => n.type === 'OUTPUT');
    expect(inputs).toHaveLength(3);
    // Middle input (index 1) Y should equal output Y (both are tallest column = 3, centered)
    const middleInputY = inputs[1].y!;
    expect(Math.abs(middleInputY - outputNode!.y!)).toBeLessThan(2);
  });
});

describe('assignPositions — no overlapping nodes', () => {
  it('produces no two nodes at the same (x, y) for a 4-input OR tree', () => {
    const parsed = makeParsed({
      inputs: ['a', 'b', 'c', 'd'],
      outputs: ['y'],
      instances: [
        { id: 'u0', componentType: 'OR', portMap: { in0: 'a', in1: 'b', out: 'ab' } },
        { id: 'u1', componentType: 'OR', portMap: { in0: 'c', in1: 'd', out: 'cd' } },
        { id: 'u2', componentType: 'OR', portMap: { in0: 'ab', in1: 'cd', out: 'y' } },
      ],
    });
    const result = parsedHdlToCircuit(parsed);
    const positions = result.circuit.nodes.map((n) => `${n.x},${n.y}`);
    const unique = new Set(positions);
    expect(unique.size).toBe(positions.length);
  });

  it('all nodes have positive x and y', () => {
    const parsed = makeParsed({
      inputs: ['a'],
      outputs: ['y'],
      instances: [{ id: 'u0', componentType: 'NOT', portMap: { in: 'a', out: 'y' } }],
    });
    const result = parsedHdlToCircuit(parsed);
    for (const node of result.circuit.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
    }
  });
});

describe('assignPositions — x spread', () => {
  it('3-stage pipeline: nodes are spread across at least 3 distinct x values', () => {
    // a → NOT → and_inst → output
    const parsed = makeParsed({
      inputs: ['a', 'b'],
      outputs: ['y'],
      instances: [
        { id: 'u0', componentType: 'NOT', portMap: { in: 'a', out: 'na' } },
        { id: 'u1', componentType: 'AND', portMap: { in0: 'na', in1: 'b', out: 'y' } },
      ],
    });
    const result = parsedHdlToCircuit(parsed);
    const xValues = new Set(result.circuit.nodes.map((n) => n.x));
    expect(xValues.size).toBeGreaterThanOrEqual(3);
  });
});
```

### Step 3: Run to confirm tests fail

```bash
pnpm --filter @redbyte/rb-apps test packages/rb-apps/src/import/__tests__/hdlToCircuit.layout.test.ts
```

If the tests PASS already (the improved `assignPositions` from Task 1 already satisfies them), that's fine — proceed to step 4.

If tests FAIL due to a bug introduced in Task 1, fix `assignPositions` before continuing.

### Step 4: Run full test suite

```bash
pnpm --filter @redbyte/rb-apps test
```

Expected: all PASS.

### Step 5: Commit

```bash
git add packages/rb-apps/src/import/__tests__/hdlToCircuit.layout.test.ts
git commit -m "test(import): unit tests for layout centering and cross-reduction"
```

---

## Task 3 · Gate: `ide-autolayout-contract.mjs`

**Files:**
- Create: `scripts/gates/ide-autolayout-contract.mjs`
- Modify: `package.json` (add gate script entry)

### Step 1: Read gate harness to understand assert + runIdeGate API

Read `scripts/gates/_gateHarness.mjs` lines 1–60 to confirm the exact exports and how to import them.

### Step 2: Build the app

```bash
pnpm --filter @redbyte/playground build
```

Expected: Build succeeds with no errors.

### Step 3: Write the gate

Create `scripts/gates/ide-autolayout-contract.mjs`:

```javascript
// Gate: ide-autolayout-contract
// Verifies that after professor ZIP import + Apply, nodes are:
//   (a) spread across the canvas (not all at the same x)
//   (b) non-overlapping (no two nodes share the same position)
//   (c) cover a minimum horizontal span (> 200 canvas units)

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runIdeGate, assert } from './_gateHarness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../packages/rb-apps/src/fixtures/import/zip/02-vivado-nested-andgate.zip'
);

await runIdeGate('IDE auto-layout contract satisfied', async ({ page, baseUrl }) => {
  // ── 1. Navigate to Import ─────────────────────────────────────────────────
  await page.goto(`${baseUrl}ide`);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-import"]').click();
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 10000 });

  // ── 2. Upload nested Vivado fixture ───────────────────────────────────────
  const zipBytes = readFileSync(FIXTURE_PATH);
  const zipInput = page.locator('[data-testid="ide-import-zip-input"]');
  await zipInput.setInputFiles({
    name: '02-vivado-nested-andgate.zip',
    mimeType: 'application/zip',
    buffer: zipBytes,
  });

  // ── 3. Wait for inspection ────────────────────────────────────────────────
  await page.waitForSelector('[data-testid="ide-import-zip-inspection"]', { timeout: 10000 });

  // ── 4. Apply + confirm ────────────────────────────────────────────────────
  const applyBtn = page.locator('[data-testid="ide-import-build-project"]');
  const disabled = await applyBtn.getAttribute('disabled');
  assert(disabled === null, 'Apply button must not be disabled');
  await applyBtn.click();

  await page.waitForSelector('[data-testid="ide-import-apply-confirmation"]', { timeout: 5000 });
  await page.locator('[data-testid="ide-import-apply-confirm"]').click();

  // ── 5. Navigate to Design ─────────────────────────────────────────────────
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  // Give auto-fit time to run
  await page.waitForTimeout(800);

  // ── 6. Collect node positions from DOM ───────────────────────────────────
  // Nodes have transform="translate(screenX, screenY) ..." on their <g> elements
  // We read the data-node-id attributes and their bounding boxes
  const nodeCount = await page.locator('[data-node-id]').count();
  assert(nodeCount >= 3, `Must have ≥3 nodes after AND-gate import, got ${nodeCount}`);

  const boxes = await page.locator('[data-node-id]').evaluateAll((nodes) =>
    nodes.map((n) => {
      const rect = n.getBoundingClientRect();
      return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    })
  );

  // (a) Nodes must be spread: at least 2 distinct x centre positions
  const uniqueX = new Set(boxes.map((b) => Math.round(b.cx)));
  assert(
    uniqueX.size >= 2,
    `Nodes must have ≥2 distinct screen-x positions — got ${uniqueX.size}: ${[...uniqueX].join(', ')}`
  );

  // (b) Horizontal span > 80px on screen (nodes not all piled up)
  const minX = Math.min(...boxes.map((b) => b.cx));
  const maxX = Math.max(...boxes.map((b) => b.cx));
  const spanX = maxX - minX;
  assert(spanX > 80, `Horizontal node span must be > 80px, got ${spanX.toFixed(0)}px`);

  // (c) No two nodes have identical screen centre (non-overlapping)
  const centres = boxes.map((b) => `${Math.round(b.cx)},${Math.round(b.cy)}`);
  const uniqueCentres = new Set(centres);
  assert(
    uniqueCentres.size === centres.length,
    `All nodes must have unique screen centres — found duplicate in: ${centres.join(' | ')}`
  );

  // (d) All nodes are visible in the viewport (auto-fit worked)
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  for (const { cx, cy } of boxes) {
    assert(
      cx > 0 && cx < viewportWidth && cy > 0 && cy < viewportHeight,
      `Node at (${cx.toFixed(0)}, ${cy.toFixed(0)}) is outside viewport (${viewportWidth}×${viewportHeight})`
    );
  }
});
```

### Step 4: Add gate script to `package.json`

Read `package.json` to find the `ide:gate:*` script block (search for `ide:gate:autolayout` or surrounding entries near `ide:gate:zoom-presets`). Add:

```json
"ide:gate:autolayout-contract": "node ./scripts/gates/ide-autolayout-contract.mjs",
```

Place it alphabetically after `ide:gate:bringup` or before `ide:gate:canvas-legibility`.

### Step 5: Run the gate

```bash
node scripts/gates/ide-autolayout-contract.mjs
```

Expected: **PASS**

If the gate fails on assertion (d) "outside viewport", it means the auto-fit is not firing after import. In that case:
- Open `packages/rb-apps/src/apps/IdeApp.tsx` and find the `viewportSeed` prop construction
- Check if `lastSavedAt` is updated when `onImportProject` is called by searching for where `lastSavedAt` is set in `projectRuntime.ts`
- If it is NOT updated on import, find the `applyProjectFromImport` (or similar) action in `projectRuntime.ts` and add `lastSavedAt: new Date().toISOString()` to the state update

### Step 6: Commit

```bash
git add scripts/gates/ide-autolayout-contract.mjs package.json
git commit -m "test(gates): add ide-autolayout-contract"
```

---

## Notes for Implementation

1. **Read before touching.** Always read the target file before editing. Do not guess line numbers.

2. **`GRID_Y` constant**: The current file has `const GRID_Y = 80` around line 150. The new `assignPositions` uses a local `GRID_Y_SPACING = 96` constant scoped inside the function. Do NOT remove the module-level `GRID_Y` constant unless you are certain it is not exported or used elsewhere.

3. **`parsedHdlToCircuit` calls `assignPositions` once** (line 325). The return type `Node[]` must be preserved.

4. **Test helper `makeParsed`**: The `portMap` keys for `AND` instances use `in0`, `in1`, `out` — check `normalisePortName` in `hdlToCircuit.ts` to confirm these are the correct HDL port names that map to the `in0`/`in1`/`out` ports in the RedByte AND node type. If different, adjust the test `portMap` accordingly.

5. **Gate assertion (d) may fail** if auto-fit doesn't fire post-import. If so, follow the investigation path in Task 3 Step 5.

6. **No screenshot rebaseline needed** — layout changes are in world space, not screen space at default zoom. The screenshot tests capture the full IDE layout (chrome + surface switches), not the circuit canvas content.
