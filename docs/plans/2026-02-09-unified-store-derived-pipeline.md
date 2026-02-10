# Unified Store & Derived-Data Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify Lab3 into a single Zustand store with LabDoc as the sole authority, a deterministic derived-data pipeline, structured event system, and atomic persistence — so all views stay in sync and reloads are lossless.

**Architecture:** Kill the dual-store (`store.ts` + `store/labStore.ts`). Make `store/labStore.ts` the single store exporting `useLabStore`. Add `recomputeDerived(doc)` that deterministically produces kMaps, expressions, and validation from truthTable. All mutations go through `updateDoc()` which recomputes derived data and emits events. Persistence saves one atomic snapshot (doc + derived + windows + events).

**Tech Stack:** Zustand 4, React 19, TypeScript 5, Vite 7, vitest (workspace-level)

---

## File Map (what gets touched)

### Created
- `src/derive/recomputeDerived.ts` — deterministic pipeline
- `src/__tests__/derive-determinism.test.ts` — pipeline unit tests
- `src/__tests__/edit-triggers-derived.test.ts` — integration test

### Major Surgery
- `src/store/labStore.ts` — unified store (absorbs classic state + updateDoc + derived)
- `src/store/persistence.ts` — single atomic persistence path

### View Rewires (import swap + selector changes)
- `src/truth-table.tsx`
- `src/kmap-viewer.tsx`
- `src/kmap-viewer-interactive.tsx`
- `src/simulator.tsx`
- `src/verilog.tsx`
- `src/live-validation.tsx`
- `src/circuit-editor.tsx`
- `src/waveform-viewer.tsx`
- `src/waveform-viewer-enhanced.tsx`
- `src/pdf-exporter.tsx`
- `src/progress-tracker.tsx`
- `src/App.tsx`

### Deleted
- `src/store.ts` — old dual store (after all consumers migrated)
- `src/use-auto-save.ts` — redundant second persistence path
- `src/persistence.ts` — old IndexedDB persistence (replaced by single path)

### Tests Updated
- `src/__tests__/labdoc-roundtrip.test.ts`
- `src/__tests__/labdoc-v2-migration.test.ts`

---

## Task 1: Create `recomputeDerived.ts` (pure function, no store dependency)

**Files:**
- Create: `src/derive/recomputeDerived.ts`
- Reference: `src/kmap.ts` (reuse `generateKMapGrid`, `minimizeBooleanExpr`)
- Reference: `src/types.ts` (reuse `TruthTableRow`, `KMapState`)
- Reference: `src/plugins/LabDoc.ts` (reuse `LabDocV2`)

**Step 1: Write the failing test**

Create: `src/__tests__/derive-determinism.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { recomputeDerived } from '../derive/recomputeDerived';
import type { LabDocV2 } from '../plugins/LabDoc';

// Helper to create a minimal doc with standard digit 0 in row 0
function makeDocWithDigit0(): LabDocV2 {
  const truthTable = [];
  for (let i = 0; i < 16; i++) {
    truthTable.push({
      b3: ((i >> 3) & 1) as 0 | 1,
      b2: ((i >> 2) & 1) as 0 | 1,
      b1: ((i >> 1) & 1) as 0 | 1,
      b0: (i & 1) as 0 | 1,
      seg: i === 0
        ? [0, 0, 0, 0, 0, 0, 1] as [number, number, number, number, number, number, number]
        : [1, 1, 1, 1, 1, 1, 1] as [number, number, number, number, number, number, number],
      isDontCare: i >= 10,
    });
  }

  return {
    schemaVersion: 2,
    meta: { id: 'test', name: 'Test', createdAt: '', updatedAt: '', useProByDefault: false },
    truthTable,
    kMaps: {},
    expressions: {},
    results: {},
    circuitDesigner: { nodes: [], wires: [] },
  };
}

describe('recomputeDerived', () => {
  it('is deterministic: same input produces identical output', () => {
    const doc = makeDocWithDigit0();
    const result1 = recomputeDerived(doc);
    const result2 = recomputeDerived(doc);
    expect(result1.kMaps).toEqual(result2.kMaps);
    expect(result1.expressions).toEqual(result2.expressions);
    expect(result1.validationErrors).toEqual(result2.validationErrors);
  });

  it('produces 7 kMap entries (a-g)', () => {
    const doc = makeDocWithDigit0();
    const derived = recomputeDerived(doc);
    expect(Object.keys(derived.kMaps)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('produces 7 expression entries (a-g)', () => {
    const doc = makeDocWithDigit0();
    const derived = recomputeDerived(doc);
    expect(Object.keys(derived.expressions)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('produces a simCache with 16 entries', () => {
    const doc = makeDocWithDigit0();
    const derived = recomputeDerived(doc);
    expect(derived.simCache.length).toBe(16);
  });

  it('returns empty validationErrors when expressions match truth table', () => {
    const doc = makeDocWithDigit0();
    const derived = recomputeDerived(doc);
    // With auto-generated expressions from kmap minimization,
    // they should match the truth table for non-don't-care rows
    expect(Object.keys(derived.validationErrors).length).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/derive-determinism.test.ts`
Expected: FAIL — module `../derive/recomputeDerived` not found

**Step 3: Write minimal implementation**

Create: `src/derive/recomputeDerived.ts`

```typescript
import type { LabDocV2 } from '../plugins/LabDoc';
import type { KMapState } from '../types';
import { generateKMapGrid, minimizeBooleanExpr, evaluateBoolExpr } from '../kmap';

/**
 * DerivedState: Everything computed deterministically from LabDoc.
 * No view may compute these independently — they read from the store.
 */
export interface DerivedState {
  kMaps: KMapState;
  expressions: Record<string, string>;
  validationErrors: Record<string, string[]>;
  simCache: number[]; // evalSeg result for inputs 0-15
}

const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

/**
 * recomputeDerived: The single deterministic pipeline.
 *
 * Input: LabDocV2 (truthTable is the authority)
 * Output: DerivedState (kMaps, expressions, validation, sim cache)
 *
 * Rules:
 * - Pure function. No side effects. No store access.
 * - Same input MUST produce identical output.
 * - Called from exactly one place: updateDoc() in the store.
 */
export function recomputeDerived(doc: LabDocV2): DerivedState {
  const kMaps: KMapState = {};
  const expressions: Record<string, string> = {};

  // Step 1: Generate K-maps and simplified expressions for each segment
  for (let i = 0; i < SEGMENT_NAMES.length; i++) {
    const segName = SEGMENT_NAMES[i];
    const grid = generateKMapGrid(doc.truthTable, i as 0 | 1 | 2 | 3 | 4 | 5 | 6);
    const simplifiedExpr = minimizeBooleanExpr(grid);
    const minTerms = grid
      .map((val, idx) => (val === 1 ? idx : -1))
      .filter((idx) => idx >= 0);

    kMaps[segName] = {
      grid,
      groups: [],
      simplifiedExpr,
      minTerms,
    };
    expressions[segName] = simplifiedExpr;
  }

  // Step 2: Validate expressions against truth table (inputs 0-9 only)
  const validationErrors: Record<string, string[]> = {};
  for (let segIdx = 0; segIdx < SEGMENT_NAMES.length; segIdx++) {
    const segName = SEGMENT_NAMES[segIdx];
    const expr = expressions[segName];
    const errors: string[] = [];

    for (let input = 0; input < 10; input++) {
      const row = doc.truthTable[input];
      if (!row || row.isDontCare) continue;
      const tableValue = row.seg[segIdx];
      const exprValue = evaluateBoolExpr(expr, input) ? 1 : 0;
      if (tableValue !== exprValue) {
        errors.push(`Input ${input}: table=${tableValue}, expr=${exprValue}`);
      }
    }

    if (errors.length > 0) {
      validationErrors[segName] = errors;
    }
  }

  // Step 3: Pre-compute simulator output for all 16 inputs (table-mode)
  const simCache: number[] = [];
  for (let input = 0; input < 16; input++) {
    const row = doc.truthTable[input];
    if (!row) {
      simCache.push(0b1111111);
      continue;
    }
    // segToNumber: pack seg[0..6] into a 7-bit number
    const val = (row.seg[6] << 6) | (row.seg[5] << 5) | (row.seg[4] << 4) |
                (row.seg[3] << 3) | (row.seg[2] << 2) | (row.seg[1] << 1) | row.seg[0];
    simCache.push(val);
  }

  return { kMaps, expressions, validationErrors, simCache };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/derive-determinism.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add apps/lab3-webapp/src/derive/recomputeDerived.ts apps/lab3-webapp/src/__tests__/derive-determinism.test.ts
git commit -m "feat(lab3): add deterministic recomputeDerived pipeline"
```

---

## Task 2: Extend LabDocV2 types for derived + UI state

**Files:**
- Modify: `src/plugins/LabDoc.ts`
- Modify: `src/types.ts` (no changes needed, just reference)

**Step 1: Add DerivedState fields to LabDocV2 interface**

In `src/plugins/LabDoc.ts`, the `LabDocV2` interface already has `kMaps`, `expressions`, `results`. We keep these as the persisted derived cache. No schema change needed — `recomputeDerived` outputs types compatible with existing fields.

Add to `src/plugins/LabDoc.ts` after the existing `LabDoc` type:

```typescript
/**
 * UI-only state that travels with snapshots but is NOT inside LabDoc.
 * Stored in the snapshot wrapper, not in doc itself.
 */
export interface UIState {
  simulationInput: number;
  implMode: 'table' | 'verilogCase' | 'boolExpr';
  verilogCode: string;
}
```

**Step 2: Commit**

```bash
git add apps/lab3-webapp/src/plugins/LabDoc.ts
git commit -m "feat(lab3): add UIState type for snapshot-level UI prefs"
```

---

## Task 3: Unify the store — absorb classic state into labStore

This is the biggest task. We're making `store/labStore.ts` the ONLY store.

**Files:**
- Modify: `src/store/labStore.ts` (major rewrite)
- Reference: `src/derive/recomputeDerived.ts`
- Reference: `src/kmap.ts`

**Step 1: Rewrite `store/labStore.ts`**

The new store must:
1. Own `doc` (LabDocV2) as the authority
2. Own `derived` (DerivedState) computed from doc
3. Own `ui` (simulationInput, implMode, verilogCode) — transient prefs
4. Own `windows`, `events`, `eventSeq`, `zCounter`, `activeWindowId`
5. Expose `updateDoc(mutator, eventType, eventPayload)` — the SINGLE mutation path
6. Call `recomputeDerived(nextDoc)` inside every `updateDoc`
7. Expose selectors for classic views: `truthTable`, `kMaps`, `booleanExpressions`, `validationErrors`, `simCache`
8. Export `useLabStore` as both default AND named export

```typescript
import { create } from 'zustand';
import type { LabDoc, LabDocV2, CircuitDesignerDoc, UIState } from '../plugins/LabDoc';
import type { WindowState, Event } from '../window/windowTypes';
import type { KMapState, ValidationResult, WaveformSample } from '../types';
import { recomputeDerived, type DerivedState } from '../derive/recomputeDerived';
import { evaluateBoolExpr } from '../kmap';
import { DIGIT_PATTERNS, segToNumber, createEmptyTruthTable } from '../types';

// ─── Snapshot Schema ───────────────────────────────────
export interface SerializedSnapshot {
  schemaVersion: 2;
  sessionId: string;
  savedAt: string;
  doc: LabDocV2;
  ui: UIState;
  windows: WindowState[];
  events: Event[];
  eventSeq: number;
}

// ─── Store Shape ───────────────────────────────────────
export type LabStoreState = {
  // === Authority ===
  doc: LabDocV2;

  // === Derived (recomputed, never mutated directly) ===
  derived: DerivedState;

  // === UI prefs (transient, persisted in snapshot) ===
  simulationInput: number;
  implMode: 'table' | 'verilogCase' | 'boolExpr';
  verilogCode: string;

  // === Workspace ===
  windows: WindowState[];
  events: Event[];
  eventSeq: number;
  zCounter: number;
  activeWindowId?: string;

  // === Simulation results (transient, recomputable) ===
  validationResults: ValidationResult[];
  waveformHistory: WaveformSample[];

  // ─── Core mutation ───
  updateDoc: (
    mutator: (doc: LabDocV2) => LabDocV2,
    eventType?: string,
    eventPayload?: unknown
  ) => void;

  // ─── Truth table shortcuts ───
  setTableRow: (index: number, partial: Partial<import('../types').TruthTableRow>) => void;
  toggleDontCare: (index: number) => void;
  fillStandardDigits: () => void;

  // ─── Simulation ───
  setSimulationInput: (value: number) => void;
  runAllVectors: () => void;
  evalSeg: (input: number) => number;

  // ─── Verilog ───
  setVerilogCode: (code: string) => void;
  parseVerilogCase: (code: string) => void;
  generateVerilogFromExpr: () => string;
  setImplMode: (mode: 'table' | 'verilogCase' | 'boolExpr') => void;

  // ─── Boolean expressions ───
  setBooleanExpr: (segmentName: string, expr: string) => void;

  // ─── Circuit ───
  updateCircuitDesigner: (circuitDesigner: CircuitDesignerDoc) => void;

  // ─── Windows ───
  setWindows: (windows: WindowState[]) => void;
  bringToFront: (windowId: string) => void;
  openWindow: (pluginId: string, viewId: string, rect?: { x: number; y: number; w: number; h: number }) => void;
  closeWindow: (windowId: string) => void;

  // ─── Events ───
  emitEvent: (type: string, payload: unknown) => void;

  // ─── Persistence ───
  hydrateFromSnapshot: (snapshot: SerializedSnapshot) => void;
  discardRecovery: () => void;
  exportJSON: () => string;
  importJSON: (json: string) => void;
  reset: () => void;
};

// ─── Factory helpers ──────────────────────────────────

export function createEmptyCircuitDesigner(): CircuitDesignerDoc {
  return { nodes: [], wires: [], view: { panX: 0, panY: 0, zoom: 1 }, selection: null, metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), toolVersion: '1.0' } };
}

export function createEmptyLabDoc(): LabDocV2 {
  const truthTable = createEmptyTruthTable();
  return {
    schemaVersion: 2,
    meta: { id: crypto.randomUUID(), name: 'Untitled Lab', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), useProByDefault: false },
    truthTable,
    kMaps: {},
    expressions: {},
    results: {},
    circuitDesigner: createEmptyCircuitDesigner(),
  };
}

export function migrateV1toV2(v1Doc: any): LabDocV2 {
  return {
    schemaVersion: 2,
    meta: { ...v1Doc.meta, useProByDefault: false },
    truthTable: v1Doc.truthTable || [],
    kMaps: v1Doc.kMaps || {},
    expressions: v1Doc.expressions || {},
    results: v1Doc.results || {},
    circuitDesigner: createEmptyCircuitDesigner(),
  };
}

export function validateSnapshotV2(obj: unknown): obj is LabDocV2 {
  if (!obj || typeof obj !== 'object') return false;
  const doc = obj as Record<string, unknown>;
  if (doc.schemaVersion !== 2) return false;
  if (!doc.meta || typeof doc.meta !== 'object') return false;
  const meta = doc.meta as Record<string, unknown>;
  if (typeof meta.id !== 'string') return false;
  if (typeof meta.name !== 'string') return false;
  if (!Array.isArray(doc.truthTable)) return false;
  if (!doc.circuitDesigner || typeof doc.circuitDesigner !== 'object') return false;
  const cd = doc.circuitDesigner as Record<string, unknown>;
  if (!Array.isArray(cd.nodes)) return false;
  if (!Array.isArray(cd.wires)) return false;
  return true;
}

// Validate full snapshot (v2 format)
export function validateSnapshot(obj: unknown): obj is SerializedSnapshot {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  if (s.schemaVersion !== 2 && s.schemaVersion !== 1) return false;
  if (!s.doc || typeof s.doc !== 'object') return false;
  if (!Array.isArray(s.windows)) return false;
  if (!Array.isArray(s.events)) return false;
  return true;
}

// Kept for backward compat with existing tests
export function validateSnapshotV1(obj: unknown): boolean {
  return validateSnapshot(obj);
}

export function serializeSnapshot(doc: LabDoc): string {
  return JSON.stringify(doc);
}

export function deserializeSnapshot(json: string): LabDocV2 {
  const parsed = JSON.parse(json) as any;
  if (!parsed.schemaVersion || parsed.schemaVersion === 1) return migrateV1toV2(parsed);
  if (validateSnapshotV2(parsed)) return parsed;
  return createEmptyLabDoc();
}

export function serializeStoreSnapshot(
  doc: LabDocV2,
  ui: UIState,
  windows: WindowState[],
  events: Event[],
  eventSeq: number
): string {
  const snapshot: SerializedSnapshot = {
    schemaVersion: 2,
    sessionId: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    doc,
    ui,
    windows,
    events,
    eventSeq,
  };
  return JSON.stringify(snapshot);
}

// ─── Store Creation ───────────────────────────────────

const emptyDoc = createEmptyLabDoc();
const initialDerived = recomputeDerived(emptyDoc);

const useLabStore = create<LabStoreState>((set, get) => ({
  doc: emptyDoc,
  derived: initialDerived,
  simulationInput: 0,
  implMode: 'table' as const,
  verilogCode: '',
  windows: [],
  events: [],
  eventSeq: 0,
  zCounter: 1,
  activeWindowId: undefined,
  validationResults: [],
  waveformHistory: [],

  // ─── Core mutation: ALL doc changes go through here ───
  updateDoc: (mutator, eventType, eventPayload) => {
    const state = get();
    const nextDoc = mutator(state.doc);
    const derived = recomputeDerived(nextDoc);

    const updates: Partial<LabStoreState> = {
      doc: nextDoc,
      derived,
    };

    // Auto-emit event if provided
    if (eventType) {
      const newEvent: Event = {
        id: `evt-${state.eventSeq}`,
        ts: new Date().toISOString(),
        type: eventType,
        payload: eventPayload,
      };
      let newEvents = [...state.events, newEvent];
      if (newEvents.length > 200) newEvents = newEvents.slice(-200);
      updates.events = newEvents;
      updates.eventSeq = state.eventSeq + 1;
    }

    set(updates);
  },

  // ─── Truth table shortcuts ───
  setTableRow: (index, partial) => {
    get().updateDoc(
      (doc) => ({
        ...doc,
        truthTable: doc.truthTable.map((row, i) => (i === index ? { ...row, ...partial } : row)),
      }),
      'truthTable.edit',
      { row: index, changes: partial }
    );
  },

  toggleDontCare: (index) => {
    get().updateDoc(
      (doc) => ({
        ...doc,
        truthTable: doc.truthTable.map((row, i) =>
          i === index
            ? { ...row, isDontCare: !row.isDontCare, seg: !row.isDontCare ? [1, 1, 1, 1, 1, 1, 1] : row.seg }
            : row
        ),
      }),
      'truthTable.toggleDontCare',
      { row: index }
    );
  },

  fillStandardDigits: () => {
    get().updateDoc(
      (doc) => ({
        ...doc,
        truthTable: doc.truthTable.map((row, i) => {
          if (i < 10) return { ...row, seg: DIGIT_PATTERNS[i], isDontCare: false };
          return { ...row, isDontCare: true, seg: [1, 1, 1, 1, 1, 1, 1] as any };
        }),
      }),
      'truthTable.fillStandardDigits',
      {}
    );
  },

  // ─── Simulation ───
  setSimulationInput: (value) => {
    set({ simulationInput: value });
    get().emitEvent('sim.inputChange', { value });
  },

  runAllVectors: () => {
    const state = get();
    const results: ValidationResult[] = [];
    const waveforms: WaveformSample[] = [];

    for (let i = 0; i < 16; i++) {
      const actual = state.evalSeg(i);
      const row = state.doc.truthTable[i];
      const expected = row ? segToNumber(row.seg) : 0b1111111;
      const pass = i < 10 ? actual === expected : true;
      results.push({ input: i, expected, actual, pass });

      waveforms.push({
        time: i,
        inputs: [((i >> 3) & 1) as 0 | 1, ((i >> 2) & 1) as 0 | 1, ((i >> 1) & 1) as 0 | 1, (i & 1) as 0 | 1],
        outputs: [
          ((actual >> 0) & 1) as 0 | 1, ((actual >> 1) & 1) as 0 | 1,
          ((actual >> 2) & 1) as 0 | 1, ((actual >> 3) & 1) as 0 | 1,
          ((actual >> 4) & 1) as 0 | 1, ((actual >> 5) & 1) as 0 | 1,
          ((actual >> 6) & 1) as 0 | 1,
        ],
      });
    }

    set({ validationResults: results, waveformHistory: waveforms });
    get().emitEvent('sim.runAllVectors', { passCount: results.filter(r => r.pass).length, total: 16 });
  },

  evalSeg: (input: number): number => {
    const state = get();
    if (state.implMode === 'verilogCase') {
      const regex = new RegExp(`4'b${input.toString(2).padStart(4, '0')}:\\s*seg\\s*=\\s*7'b([01]{7});`);
      const match = regex.exec(state.verilogCode);
      if (match) return parseInt(match[1], 2);
      return 0b1111111;
    }
    if (state.implMode === 'boolExpr') {
      let result = 0;
      const segNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      for (let i = 0; i < segNames.length; i++) {
        const expr = state.derived.expressions[segNames[i]];
        const val = evaluateBoolExpr(expr, input) ? 1 : 0;
        result |= val << i;
      }
      return result;
    }
    // Default: table mode — use simCache
    return state.derived.simCache[input] ?? 0b1111111;
  },

  // ─── Verilog ───
  setVerilogCode: (code) => set({ verilogCode: code }),
  setImplMode: (mode) => set({ implMode: mode }),

  parseVerilogCase: (code) => {
    const regex = /4'b([01]{4}):\s*seg\s*=\s*7'b([01]{7});/g;
    let match;
    const updates: Array<{ index: number; seg: any }> = [];
    while ((match = regex.exec(code)) !== null) {
      const input = parseInt(match[1], 2);
      const seg = match[2].split('').map((s: string) => (parseInt(s) ? 1 : 0));
      updates.push({ index: input, seg });
    }

    get().updateDoc(
      (doc) => ({
        ...doc,
        truthTable: doc.truthTable.map((row, i) => {
          const update = updates.find(u => u.index === i);
          return update ? { ...row, seg: update.seg, isDontCare: false } : row;
        }),
      }),
      'verilog.import',
      { lineCount: updates.length }
    );
    set({ implMode: 'verilogCase', verilogCode: code });
  },

  generateVerilogFromExpr: () => {
    const state = get();
    const segNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    let code = `module ssd_driver(\n  input [3:0] B,\n  output reg [6:0] seg\n);\n\nalways @(*) begin\n  seg = 7'b0000000;\n`;
    for (let i = 0; i < segNames.length; i++) {
      const expr = state.derived.expressions[segNames[i]];
      code += `  assign seg[${i}] = ${expr};\n`;
    }
    code += `end\n\nendmodule\n`;
    return code;
  },

  // ─── Boolean expressions ───
  setBooleanExpr: (segmentName, expr) => {
    // This is a user override — store in derived for display but don't mutate doc.expressions
    // (The pipeline auto-generates from truth table; manual edits are transient)
    const state = get();
    set({
      derived: {
        ...state.derived,
        expressions: { ...state.derived.expressions, [segmentName]: expr },
      },
    });
  },

  // ─── Circuit ───
  updateCircuitDesigner: (circuitDesigner) => {
    get().updateDoc(
      (doc) => ({ ...doc, circuitDesigner }),
      'circuit.update',
      { nodeCount: circuitDesigner.nodes.length, wireCount: circuitDesigner.wires.length }
    );
  },

  // ─── Windows ───
  setWindows: (windows) => set({ windows }),

  bringToFront: (windowId) => {
    const state = get();
    const newZ = state.zCounter + 1;
    set({
      windows: state.windows.map(w => (w.id === windowId ? { ...w, z: newZ } : w)),
      zCounter: newZ,
      activeWindowId: windowId,
    });
  },

  openWindow: (pluginId, viewId, rect) => {
    const state = get();
    const newZ = state.zCounter + 1;
    const win: WindowState = {
      id: crypto.randomUUID(),
      pluginId, viewId,
      x: rect?.x ?? 100, y: rect?.y ?? 100, w: rect?.w ?? 400, h: rect?.h ?? 300,
      z: newZ, minimized: false, maximized: false,
    };
    set({ windows: [...state.windows, win], zCounter: newZ, activeWindowId: win.id });
  },

  closeWindow: (windowId) => {
    const state = get();
    set({
      windows: state.windows.filter(w => w.id !== windowId),
      activeWindowId: state.activeWindowId === windowId ? undefined : state.activeWindowId,
    });
  },

  // ─── Events ───
  emitEvent: (type, payload) => {
    const state = get();
    const evt: Event = { id: `evt-${state.eventSeq}`, ts: new Date().toISOString(), type, payload };
    let newEvents = [...state.events, evt];
    if (newEvents.length > 200) newEvents = newEvents.slice(-200);
    set({ events: newEvents, eventSeq: state.eventSeq + 1 });
  },

  // ─── Persistence ───
  hydrateFromSnapshot: (snapshot) => {
    if (!validateSnapshot(snapshot)) {
      console.warn('Invalid snapshot, skipping hydration');
      return;
    }

    // Migrate doc if v1
    let doc: LabDocV2;
    if ((snapshot.doc as any).schemaVersion === 1) {
      doc = migrateV1toV2(snapshot.doc);
    } else {
      doc = snapshot.doc as LabDocV2;
    }

    const derived = recomputeDerived(doc);
    const ui = snapshot.ui || { simulationInput: 0, implMode: 'table', verilogCode: '' };

    set({
      doc,
      derived,
      simulationInput: ui.simulationInput ?? 0,
      implMode: ui.implMode ?? 'table',
      verilogCode: ui.verilogCode ?? '',
      windows: snapshot.windows,
      events: snapshot.events,
      eventSeq: snapshot.eventSeq,
    });

    // Emit hydration event
    get().emitEvent('session.hydrate', { docId: doc.meta.id, windowCount: snapshot.windows.length });
  },

  discardRecovery: () => set({ events: [], eventSeq: 0 }),

  exportJSON: () => {
    const state = get();
    return serializeStoreSnapshot(
      state.doc,
      { simulationInput: state.simulationInput, implMode: state.implMode, verilogCode: state.verilogCode },
      state.windows,
      state.events,
      state.eventSeq
    );
  },

  importJSON: (json) => {
    try {
      const parsed = JSON.parse(json);
      // Try as full snapshot first
      if (parsed.schemaVersion && parsed.windows) {
        get().hydrateFromSnapshot(parsed);
        return;
      }
      // Legacy: just a doc
      const doc = deserializeSnapshot(json);
      const derived = recomputeDerived(doc);
      set({ doc, derived });
    } catch (e) {
      console.error('Failed to import JSON:', e);
    }
  },

  reset: () => {
    const doc = createEmptyLabDoc();
    const derived = recomputeDerived(doc);
    set({
      doc, derived,
      simulationInput: 0, implMode: 'table', verilogCode: '',
      windows: [], events: [], eventSeq: 0, zCounter: 1,
      activeWindowId: undefined, validationResults: [], waveformHistory: [],
    });
  },
}));

export { useLabStore };
export default useLabStore;
```

**Step 2: Commit**

```bash
git add apps/lab3-webapp/src/store/labStore.ts
git commit -m "feat(lab3): unify store with updateDoc + derived pipeline"
```

---

## Task 4: Update persistence to use unified store

**Files:**
- Modify: `src/store/persistence.ts`

**Step 1: Rewrite persistence to use new snapshot format**

```typescript
import type { SerializedSnapshot } from './labStore';
import { validateSnapshot, serializeStoreSnapshot } from './labStore';

const STORAGE_KEY = 'rb.lab3.session.v2';
const LEGACY_KEY = 'rb.lab3.session.v1';
const DEBOUNCE_MS = 350;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function loadSnapshot(): SerializedSnapshot | null {
  try {
    // Try v2 first
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Try legacy v1
      raw = localStorage.getItem(LEGACY_KEY);
    }
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!validateSnapshot(parsed)) {
      console.warn('[persistence] Invalid snapshot in localStorage');
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('[persistence] Failed to load:', err);
    return null;
  }
}

export function saveSnapshotDebounced(snapshot: string): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, snapshot);
    } catch (err) {
      console.error('[persistence] Failed to save:', err);
    }
  }, DEBOUNCE_MS);
}

export function initPersistence(store: any): void {
  store.subscribe((state: any) => {
    const snapshot = serializeStoreSnapshot(
      state.doc,
      { simulationInput: state.simulationInput, implMode: state.implMode, verilogCode: state.verilogCode },
      state.windows,
      state.events,
      state.eventSeq
    );
    saveSnapshotDebounced(snapshot);
  });
}
```

**Step 2: Commit**

```bash
git add apps/lab3-webapp/src/store/persistence.ts
git commit -m "feat(lab3): atomic persistence with v2 snapshot format"
```

---

## Task 5: Rewire ALL classic views to use unified store

**Goal:** Replace every `import { useLabStore } from './store'` and `import useNewLabStore from './store/labStore'` with a single `import { useLabStore } from './store/labStore'`. Update selectors to read from `doc` and `derived`.

This is mechanical but must be thorough. Process each file:

### 5a: `src/truth-table.tsx`

**Changes:**
- Remove both old imports
- Add: `import { useLabStore } from './store/labStore';`
- `truthTable` → `useLabStore(s => s.doc.truthTable)`
- `setTableRow` → `useLabStore(s => s.setTableRow)`
- `toggleDontCare` → `useLabStore(s => s.toggleDontCare)`
- `fillStandardDigits` → `useLabStore(s => s.fillStandardDigits)`
- Remove separate `emitEvent` usage (updateDoc handles events now)

### 5b: `src/kmap-viewer.tsx`

**Changes:**
- `import { useLabStore } from './store/labStore'`
- `kMaps` → `useLabStore(s => s.derived.kMaps)`
- `booleanExpressions` → `useLabStore(s => s.derived.expressions)`
- `generateKMaps` → remove (no manual regen needed)
- `setBooleanExpr` → `useLabStore(s => s.setBooleanExpr)`
- Remove or hide "Regenerate" button

### 5c: `src/kmap-viewer-interactive.tsx`

Same pattern as 5b.

### 5d: `src/simulator.tsx`

**Changes:**
- Single import from `./store/labStore`
- `simulationInput` → `useLabStore(s => s.simulationInput)`
- `setSimulationInput` → `useLabStore(s => s.setSimulationInput)`
- `runAllVectors` → `useLabStore(s => s.runAllVectors)`
- `evalSeg` → `useLabStore(s => s.evalSeg)`
- `validationResults` → `useLabStore(s => s.validationResults)`
- Remove separate `emitEvent` calls (store handles it)

### 5e: `src/verilog.tsx`

**Changes:**
- Single import from `./store/labStore`
- `truthTable` → `useLabStore(s => s.doc.truthTable)`
- `booleanExpressions` → `useLabStore(s => s.derived.expressions)`
- `parseVerilogCase` → `useLabStore(s => s.parseVerilogCase)`
- `generateVerilogFromExpr` → `useLabStore(s => s.generateVerilogFromExpr)`
- `validationResults` → `useLabStore(s => s.validationResults)`
- Remove separate `emitEvent` (store handles it)

### 5f: `src/live-validation.tsx`

**Changes:**
- Single import from `./store/labStore`
- `validationErrors` → `useLabStore(s => s.derived.validationErrors)`
- `booleanExpressions` → `useLabStore(s => s.derived.expressions)`

### 5g: `src/circuit-editor.tsx`

**Changes:**
- `import { useLabStore } from './store/labStore'`
- This is the Classic circuit editor — it currently uses `useLabStore` from `./store` but doesn't deeply integrate with doc. Keep its internal state but wire its data reads to the unified store.

### 5h: `src/waveform-viewer.tsx` and `src/waveform-viewer-enhanced.tsx`

**Changes:**
- Single import from `./store/labStore`
- `waveformHistory` → `useLabStore(s => s.waveformHistory)`

### 5i: `src/pdf-exporter.tsx`

**Changes:**
- Single import from `./store/labStore`
- `truthTable` → `useLabStore(s => s.doc.truthTable)`
- `booleanExpressions` → `useLabStore(s => s.derived.expressions)`
- `kMaps` → `useLabStore(s => s.derived.kMaps)`
- `validationResults` → `useLabStore(s => s.validationResults)`
- `verilogCode` → `useLabStore(s => s.verilogCode)`

### 5j: `src/progress-tracker.tsx`

**Changes:**
- `import { useLabStore } from './store/labStore'` — the `useLabProgress` hook reads `truthTable`, `kMaps`, `validationResults`. Update selectors.

### 5k: `src/App.tsx`

**Changes:**
- Remove `import { useLabStore } from './store'`
- Remove `import useNewLabStore from './store/labStore'`
- Add: `import { useLabStore } from './store/labStore'`
- `reset` → `useLabStore(s => s.reset)`
- `exportJSON` → `useLabStore(s => s.exportJSON)`
- `importJSON` → `useLabStore(s => s.importJSON)`
- `openWindow` → `useLabStore(s => s.openWindow)`
- `windows` → `useLabStore(s => s.windows)`
- `doc` → `useLabStore(s => s.doc)`
- Remove `useAutoSave(true)` call
- Remove `import { useAutoSave } from './use-auto-save'`
- `initPersistence(useNewLabStore)` → `initPersistence(useLabStore)`
- `loadSnapshot` stays the same
- `hydrateFromSnapshot` → `useLabStore.getState().hydrateFromSnapshot(snapshot)`
- `discardRecovery` → `useLabStore.getState().discardRecovery()`

**After all 5a-5k are done:**

```bash
git add -A apps/lab3-webapp/src/
git commit -m "refactor(lab3): rewire all views to unified store"
```

---

## Task 6: Delete old store and redundant persistence

**Files:**
- Delete: `src/store.ts`
- Delete: `src/use-auto-save.ts`
- Delete: `src/persistence.ts`

**Step 1: Verify no remaining imports**

Run: `rg "from ['\"]\.\/store['\"]" apps/lab3-webapp/src/ --type ts --type tsx`
Run: `rg "from ['\"]\.\/use-auto-save" apps/lab3-webapp/src/`
Run: `rg "from ['\"]\.\/persistence['\"]" apps/lab3-webapp/src/`

Expected: No matches (only .js build artifacts might match, which we ignore).

**Step 2: Delete files**

```bash
rm apps/lab3-webapp/src/store.ts apps/lab3-webapp/src/use-auto-save.ts apps/lab3-webapp/src/persistence.ts
```

**Step 3: Commit**

```bash
git add -A apps/lab3-webapp/src/
git commit -m "chore(lab3): remove legacy dual store + redundant persistence"
```

---

## Task 7: Update existing tests

**Files:**
- Modify: `src/__tests__/labdoc-roundtrip.test.ts`
- Modify: `src/__tests__/labdoc-v2-migration.test.ts`

Update imports and assertions to match new snapshot format (schemaVersion: 2 for snapshots, `serializeStoreSnapshot` now takes `ui` param). Keep tests passing.

```bash
git add apps/lab3-webapp/src/__tests__/
git commit -m "test(lab3): update existing tests for unified store"
```

---

## Task 8: Write integration test — edit triggers derived update

**Files:**
- Create: `src/__tests__/edit-triggers-derived.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createEmptyLabDoc } from '../store/labStore';
import { recomputeDerived } from '../derive/recomputeDerived';
import { DIGIT_PATTERNS } from '../types';

describe('edit → derived sync', () => {
  it('filling standard digits produces non-empty kMaps', () => {
    const doc = createEmptyLabDoc();
    // Simulate fillStandardDigits
    const filledDoc = {
      ...doc,
      truthTable: doc.truthTable.map((row, i) => {
        if (i < 10) return { ...row, seg: DIGIT_PATTERNS[i], isDontCare: false };
        return { ...row, isDontCare: true, seg: [1, 1, 1, 1, 1, 1, 1] as any };
      }),
    };

    const derived = recomputeDerived(filledDoc);

    // All 7 segments should have non-trivial expressions
    expect(derived.expressions['a']).not.toBe('0');
    expect(derived.expressions['a']).not.toBe('');
    expect(derived.kMaps['a'].minTerms.length).toBeGreaterThan(0);
    expect(derived.simCache[0]).toBeDefined();
    expect(derived.simCache.length).toBe(16);
  });

  it('single cell edit changes kMap for affected segment', () => {
    const doc = createEmptyLabDoc();
    const before = recomputeDerived(doc);

    // Toggle seg_a for input 0 (row 0, seg[0]: 1 → 0)
    const editedDoc = {
      ...doc,
      truthTable: doc.truthTable.map((row, i) =>
        i === 0 ? { ...row, seg: [0, ...row.seg.slice(1)] as any } : row
      ),
    };
    const after = recomputeDerived(editedDoc);

    expect(after.kMaps['a']).not.toEqual(before.kMaps['a']);
    expect(after.expressions['a']).not.toEqual(before.expressions['a']);
  });
});
```

Run: `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/edit-triggers-derived.test.ts`

```bash
git add apps/lab3-webapp/src/__tests__/edit-triggers-derived.test.ts
git commit -m "test(lab3): add edit→derived sync integration test"
```

---

## Task 9: Build & typecheck gate

Run:
```bash
cd apps/lab3-webapp && pnpm run typecheck
```

Fix any TypeScript errors. Then:
```bash
cd apps/lab3-webapp && pnpm run build
```

Fix any build errors.

```bash
git add -A apps/lab3-webapp/
git commit -m "fix(lab3): resolve typecheck + build errors from store unification"
```

---

## Task 10: Run all tests gate

```bash
pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/
```

All tests must pass. Fix any failures.

```bash
git add -A apps/lab3-webapp/
git commit -m "test(lab3): all tests passing after store unification"
```

---

## Hard Gates (must pass before declaring done)

1. `rg "from ['\"]\.\/store['\"]" apps/lab3-webapp/src/ --type-add 'tsx:*.tsx' --type tsx --type ts` → **zero matches** (old store fully eliminated from .ts/.tsx files)
2. `pnpm run typecheck` in `apps/lab3-webapp` → **zero errors**
3. `pnpm run build` in `apps/lab3-webapp` → **builds successfully**
4. `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/` → **all tests pass**
5. Manual smoke: open app, fill truth table → K-maps update instantly → simulator shows correct segments → reload preserves everything
