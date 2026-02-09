# Combined Lite Workspace Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish the combined-lite workspace foundation (plugin views contract + single store boundary + persistence/recovery + event log) before window mechanics.

**Architecture:** Introduce a lightweight plugin registry that exposes views as Components, a single Zustand store that owns LabDoc + windows + events, and an atomic localStorage snapshot with validation and recovery banner. No drag/resize/z-order work in this plan.

**Tech Stack:** React 19, Zustand, TypeScript, Vitest (unit tests), Playwright (deferred to window mechanics phase).

---

### Task 1: Define core types for plugin views and LabDoc

**Files:**
- Create: `apps/lab3-webapp/src/plugins/LabPlugin.ts`
- Create: `apps/lab3-webapp/src/plugins/LabDoc.ts`
- Create: `apps/lab3-webapp/src/window/windowTypes.ts`

**Step 1: Write the failing type-only test (roundtrip target types)**

Create `apps/lab3-webapp/src/__tests__/labdoc-roundtrip.test.ts` with the expected shape used in serialization (uses new `LabDoc` types).

```ts
import { describe, it, expect } from 'vitest';
import { createEmptyLabDoc, serializeSnapshot, deserializeSnapshot } from '../store/labStore';

describe('LabDoc snapshot roundtrip', () => {
  it('preserves schema and truth table data', () => {
    const doc = createEmptyLabDoc();
    doc.truthTable[0].b3 = 1;
    const snap = serializeSnapshot({
      schemaVersion: 1,
      sessionId: 'test',
      savedAt: 'now',
      doc,
      windows: [],
      events: [],
      eventSeq: 1,
    });
    const restored = deserializeSnapshot(snap);
    expect(restored?.schemaVersion).toBe(1);
    expect(restored?.doc.version).toBe(1);
    expect(restored?.doc.truthTable[0].b3).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/labdoc-roundtrip.test.ts`
Expected: FAIL (functions/types not defined).

**Step 3: Write minimal type definitions**

Create the following:

`apps/lab3-webapp/src/plugins/LabDoc.ts`
```ts
export type LabDoc = {
  version: 1;
  meta: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  truthTable: Array<{
    b3: 0 | 1; b2: 0 | 1; b1: 0 | 1; b0: 0 | 1;
    seg: [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1];
    isDontCare: boolean;
  }>;
  kMaps: Record<string, { grid: (0 | 1 | 'X')[] }>; // minimal
  expressions: Record<string, string>;
  results: Record<string, unknown>;
};
```

`apps/lab3-webapp/src/plugins/LabPlugin.ts`
```ts
import type { LabDoc } from './LabDoc';

export type PluginView = {
  id: string;
  title: string;
  icon?: string;
  Component: React.FC;
};

export type LabPlugin = {
  id: string;
  title: string;
  icon: string;
  views: PluginView[];
};
```

`apps/lab3-webapp/src/window/windowTypes.ts`
```ts
export type WindowState = {
  id: string;
  title: string;
  pluginId: string;
  viewId: string;
  x: number; y: number; w: number; h: number;
  z: number;
  minimized?: boolean;
  maximized?: boolean;
};
```

**Step 4: Re-run test**

Run: `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/labdoc-roundtrip.test.ts`
Expected: FAIL (store functions not defined).

**Step 5: Commit**

```bash
git add apps/lab3-webapp/src/plugins/LabDoc.ts apps/lab3-webapp/src/plugins/LabPlugin.ts apps/lab3-webapp/src/window/windowTypes.ts apps/lab3-webapp/src/__tests__/labdoc-roundtrip.test.ts
git commit -m "feat(lab3): add lab doc and plugin view types"
```

---

### Task 2: Create the single source of truth store + snapshot helpers

**Files:**
- Create: `apps/lab3-webapp/src/store/labStore.ts`
- Modify: `apps/lab3-webapp/src/store.ts` (re-export or switch to new store)

**Step 1: Write failing tests for snapshot validation**

Add to `apps/lab3-webapp/src/__tests__/labdoc-roundtrip.test.ts`:

```ts
import { validateSnapshotV1 } from '../store/labStore';

it('rejects invalid snapshot shape', () => {
  expect(validateSnapshotV1({ schemaVersion: 2 })).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/labdoc-roundtrip.test.ts`
Expected: FAIL (validateSnapshotV1 missing).

**Step 3: Implement store + snapshot helpers**

`apps/lab3-webapp/src/store/labStore.ts` should export:
- `createEmptyLabDoc()`
- `serializeSnapshot()` returns JSON string
- `deserializeSnapshot()` parses and validates
- `validateSnapshotV1(snapshot): boolean`
- Zustand store with state: `{ doc, windows, activeWindowId, zCounter, events, eventSeq }`
- Actions: `setDoc`, `setWindows`, `setActiveWindowId`, `emitEvent`, `hydrateFromSnapshot`, `discardRecovery`

Rules:
- `eventSeq` monotonic; event id = `${sessionId}:${eventSeq++}`
- `emitEvent` caps at 200
- `validateSnapshotV1` enforces: schemaVersion=1, doc.version=1, windows required fields
- `serializeSnapshot` includes `{ schemaVersion, sessionId, savedAt, doc, windows, events, eventSeq }`

**Step 4: Run tests**

Run: `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/labdoc-roundtrip.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/lab3-webapp/src/store/labStore.ts apps/lab3-webapp/src/store.ts apps/lab3-webapp/src/__tests__/labdoc-roundtrip.test.ts
git commit -m "feat(lab3): add lab store with snapshot helpers"
```

---

### Task 3: Persistence + recovery banner (debounced)

**Files:**
- Modify: `apps/lab3-webapp/src/App.tsx`
- Create: `apps/lab3-webapp/src/store/persistence.ts`
- Create: `apps/lab3-webapp/src/__tests__/recovery-banner.test.tsx`

**Step 1: Write the failing recovery banner test**

```ts
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';

const KEY = 'rb.lab3.session.v1';

afterEach(() => localStorage.clear());

it('shows and dismisses recovery banner', () => {
  localStorage.setItem(KEY, JSON.stringify({
    schemaVersion: 1,
    sessionId: 'test',
    savedAt: new Date().toISOString(),
    eventSeq: 1,
    doc: { version: 1, meta: { id: '1', name: 'Doc', createdAt: 'x', updatedAt: 'x' }, truthTable: [], kMaps: {}, expressions: {}, results: {} },
    windows: [],
    events: [],
  }));

  render(<App />);
  expect(screen.getByText(/Recover last session/i)).toBeInTheDocument();
  fireEvent.click(screen.getByText(/Discard/i));
  expect(screen.queryByText(/Recover last session/i)).not.toBeInTheDocument();
  expect(localStorage.getItem(KEY)).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/recovery-banner.test.tsx`
Expected: FAIL (banner + persistence not implemented).

**Step 3: Implement persistence and banner**

- `persistence.ts` exports `loadSnapshot()`, `saveSnapshotDebounced()`
- Debounce writes at 350ms
- `loadSnapshot()` validates via `validateSnapshotV1`
- `App.tsx` shows a recovery banner when snapshot valid; actions call `hydrateFromSnapshot` or `discardRecovery`

**Step 4: Run tests**

Run: `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/recovery-banner.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/lab3-webapp/src/store/persistence.ts apps/lab3-webapp/src/App.tsx apps/lab3-webapp/src/__tests__/recovery-banner.test.tsx
git commit -m "feat(lab3): add session persistence and recovery banner"
```

---

### Task 4: Event emission wiring (no UI yet)

**Files:**
- Modify: `apps/lab3-webapp/src/truth-table.tsx`
- Modify: `apps/lab3-webapp/src/kmap-viewer-interactive.tsx`
- Modify: `apps/lab3-webapp/src/simulator.tsx`
- Modify: `apps/lab3-webapp/src/verilog.tsx`
- Modify: `apps/lab3-webapp/src/pdf-exporter.tsx`

**Step 1: Write minimal event hooks**

Add `emitEvent` calls to:
- Truth table cell updates: `truthTable.updated`
- K-map regenerate/group changes: `kmap.regenerated`
- Simulation runs: `sim.vectorRun`
- Verilog import/export: `verilog.export` / `verilog.import`
- PDF export: `export.pdf`

**Step 2: Run unit tests**

Run: `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/labdoc-roundtrip.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/lab3-webapp/src/truth-table.tsx apps/lab3-webapp/src/kmap-viewer-interactive.tsx apps/lab3-webapp/src/simulator.tsx apps/lab3-webapp/src/verilog.tsx apps/lab3-webapp/src/pdf-exporter.tsx
git commit -m "feat(lab3): emit events for lab actions"
```

---

### Task 5: Registry stub + Lab 3 views wiring (no windows yet)

**Files:**
- Create: `apps/lab3-webapp/src/plugins/PluginRegistry.ts`
- Create: `apps/lab3-webapp/src/plugins/lab3/registerLab3.ts`

**Step 1: Implement registry**

`PluginRegistry.ts` should export `registerPlugin`, `getPlugin`, `getPlugins`, `getView(pluginId, viewId)`.

**Step 2: Register Lab 3 views**

`registerLab3.ts` should register views with Components:
- `overview` -> existing overview component
- `truth-table` -> `TruthTableEditor`
- `kmap` -> `KMapViewer`
- `sim` -> `Simulator`
- `export` -> `VerilogExporter`
- `console` -> placeholder component for now
- `inspector` -> placeholder component for now

**Step 3: Commit**

```bash
git add apps/lab3-webapp/src/plugins/PluginRegistry.ts apps/lab3-webapp/src/plugins/lab3/registerLab3.ts
git commit -m "feat(lab3): add plugin registry and lab3 view registration"
```

---

## Notes / Constraints

- Do not implement window drag/resize/z-order in this plan.
- Views must remain stateless and consume store state via hooks.
- Snapshot validation must be strict; invalid snapshots are ignored silently.
- Recovery banner is only shown when snapshot validation passes.
- Events are deterministic; no random UUIDs.

---

## Verification Summary

- `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/labdoc-roundtrip.test.ts`
- `pnpm -w exec vitest run apps/lab3-webapp/src/__tests__/recovery-banner.test.tsx`

---

## Next Plan (Window Mechanics)

After this foundation passes tests, draft the next plan for:
- Window manager (drag/resize/z-order)
- DraggableWindow component
- Window chrome + status LED
- Console/Inspector view UI
- Playwright smoke test (5 windows + drag + export)
