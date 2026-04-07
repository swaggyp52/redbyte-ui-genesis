# Inspector Truth Overhaul — Implementation Plan (Slice 8)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove five categories of developer internals from the Design inspector so students see only authoring-relevant information.

**Architecture:** Five surgical changes to `DesignSurface.tsx` only. No cross-surface changes. Each change removes a node/section/prop that exposes pipeline-layer concepts to students.

**Tech Stack:** React 19, TypeScript strict, Vitest + @testing-library/react (jsdom), Zustand stores (circuitStore, layoutStore, useLogicViewStore)

---

## Background: The Five Problems

| # | Problem | Location in DesignSurface.tsx |
|---|---------|-------------------------------|
| 1 | Raw IR code (`IR006`) in bold next to error messages | `renderSelectionHealth()` |
| 2 | "Compiler diagnostics" section label | `renderSelectionHealth()` |
| 3 | "Dirty since verify" + "Dirty since export" rows | `renderAdvancedDetails()` |
| 4 | Live Simulation pinned open forever (`disableCollapse`) | Both Live Simulation `IdeInspectorSection` instances |
| 5 | "Single-object state only" dead-end callout on multi-select | `renderSelectionState()` |
| 6 | Per-tick waveform history buttons in Signal Probe | Signal Probe section |

---

## Task 1: Write All Failing Tests (RED)

**File:** `packages/rb-apps/src/apps/ide/__tests__/designSurface.inspectorTruth.test.tsx` (new)

**Step 1: Create the test file with all 6 tests**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import type { DesignCompilerStatus } from '../surfaces/DesignSurface';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

const BASE_CIRCUIT: Circuit = {
  nodes: [
    { id: 'sw0_node', type: 'INPUT', label: 'SW0', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: { isOn: 1 } },
    { id: 'and0_node', type: 'AND', position: { x: 100, y: 0 }, rotation: 0, config: {}, state: {} },
    { id: 'ld0_node', type: 'OUTPUT', label: 'LD0', position: { x: 200, y: 0 }, rotation: 0, config: {}, state: {} },
  ],
  connections: [
    { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'and0_node', portName: 'a' } },
    { from: { nodeId: 'and0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
  ],
};

function makePassiveSim(): RuntimeSimState { /* ... tick:0, running:false, etc */ }
function makeSimWithTrace(): RuntimeSimState { /* ... tick:5, probes, selectedSignalKey */ }
function makeStatusWithIrDiagnostics(): DesignCompilerStatus {
  return {
    dirtySinceVerify: true,
    dirtySinceExport: true,
    errorCount: 1,
    warningCount: 0,
    diagnostics: [{
      id: 'ir006-test', blocking: true, code: 'IR006',
      title: 'Combinational loop', severity: 'error',
      message: 'Combinational feedback loop detected.',
      hint: ['A signal output feeds back to its own input.'],
      owner: { kind: 'node', nodeId: 'and0_node' },
      location: { nodeId: 'and0_node' },
      stage: 'design', origin: 'elaborator', actions: [],
    }],
  };
}

// ... beforeEach (installResizeObserver, useLayoutStore.resetLayout, useLogicViewStore.setState)
// ... afterEach (cleanup)
// ... renderSurface helper

describe('Inspector Truth — no developer internals exposed to students', () => {
  it('hides raw IR diagnostic codes from the inspector when a node with compiler errors is selected');
  it('does not render a "Compiler diagnostics" label in the inspector');
  it('does not show "Dirty since verify" or "Dirty since export" in Advanced Details when expanded');
  it('shows "Hide" on the Live Simulation toggle (not "Live") — meaning the section is collapsible');
  it('does not show a "Single-object state only" callout when multiple nodes are selected');
  it('does not render tick-history buttons in the Signal Probe section when opened');
});
```

**Step 2: Run tests to verify all 6 fail**

```bash
pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/designSurface.inspectorTruth.test.tsx
```

Expected: 6 failures (tests not yet implemented or features still present)

**Step 3: Commit the failing tests**

```bash
git add packages/rb-apps/src/apps/ide/__tests__/designSurface.inspectorTruth.test.tsx
git commit -m "test(ide): add failing inspector truth tests — Slice 8 RED"
```

---

## Task 2: Remove Raw IR Code and "Compiler diagnostics" Label (GREEN 1+2)

**File:** `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`

**Step 1: Find `renderSelectionHealth()` — look for `diagnostic.code`**

The current pattern:
```tsx
<span className="ide-design-inspector-group-label">Compiler diagnostics</span>
<ul>
  {selectedNodeDiagnostics.slice(0, 3).map((diagnostic) => (
    <li key={...}>
      <strong>{diagnostic.code}</strong>  {/* REMOVE THIS */}
      <span>{diagnostic.message}</span>
    </li>
  ))}
</ul>
```

**Step 2: Replace with**

```tsx
<ul className="ide-design-inspector-diagnostic-list">
  {selectedNodeDiagnostics.slice(0, 3).map((diagnostic) => (
    <li key={diagnostic.id ?? diagnostic.code} className={`ide-design-inspector-diagnostic ide-design-inspector-diagnostic--${diagnostic.severity}`}>
      <span>{diagnostic.message}</span>
    </li>
  ))}
</ul>
```

**Step 3: Run tests for problems 1+2**

```bash
pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/designSurface.inspectorTruth.test.tsx
```

Expected: 2 tests now pass (IR code + Compiler diagnostics label)

---

## Task 3: Remove "Dirty since verify/export" from Advanced Details (GREEN 3)

**File:** `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`

**Step 1: Find `renderAdvancedDetails()` — look for `Dirty since verify`**

The current pattern:
```tsx
{compilerStatus?.dirtySinceVerify && (
  <tr><td>Dirty since verify</td><td>Yes</td></tr>
)}
{compilerStatus?.dirtySinceExport && (
  <tr><td>Dirty since export</td><td>Yes</td></tr>
)}
```

**Step 2: Delete both `tr` blocks** (do NOT touch the developer `showDetails` strip below ~line 5232)

**Step 3: Run tests**

```bash
pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/designSurface.inspectorTruth.test.tsx
```

Expected: 3 tests now pass

---

## Task 4: Make Live Simulation Collapsible (GREEN 4)

**File:** `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`

**Step 1: Find both instances of `` with `disableCollapse`**

Search for: `testId="ide-design-live-sim-section"`

There are two instances (one in has-selection branch, one in no-selection branch).

**Step 2: Remove `disableCollapse` prop from both**

Before: `<IdeInspectorSection title="Live Simulation" testId="ide-design-live-sim-section" defaultOpen disableCollapse>`
After: `<IdeInspectorSection title="Live Simulation" testId="ide-design-live-sim-section" defaultOpen>`

**Step 3: Run tests — 4 should now pass**

---

## Task 5: Remove "Single-object state only" Multi-Select Callout (GREEN 5)

**File:** `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`

**Step 1: Find `renderSelectionState()` — look for `hasMultiNodeSelection`**

The current pattern:
```tsx
if (hasMultiNodeSelection || hasMultiWireSelection) {
  return (
    <IdeCallout tone="info" title="Single-object state only">
      Pick one node, wire, or signal when you want live values...
    </IdeCallout>
  );
}
```

**Step 2: Replace with**

```tsx
if (hasMultiNodeSelection || hasMultiWireSelection) {
  return null;
}
```

**Step 3: Run tests — 5 should now pass**

---

## Task 6: Remove Signal Probe Tick-History Buttons (GREEN 6)

**File:** `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`

**Step 1: Find `ide-design-signal-history` in Signal Probe section**

Look for:
```tsx
<div className="ide-design-signal-history">
  {/* per-tick value buttons */}
  {sim.trace.map((frame) => (
    <button
      key={frame.tick}
      data-testid="ide-design-signal-history-point"
      ...
    >
```

**Step 2: Delete the entire `ide-design-signal-history` div** (~16 lines)

**Step 3: Run all 6 tests — all should pass**

```bash
pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/designSurface.inspectorTruth.test.tsx
```

Expected: 6/6 pass

---

## Task 7: Full Regression Check

**Step 1: Run full design surface test suite**

```bash
pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/
```

Expected: all pass (was 152/152 before this slice; now 158/158 with the 6 new tests)

**Step 2: Run full project suite**

```bash
pnpm -w exec vitest run --config vitest.config.ts
```

Expected: no new failures

---

## Task 8: Documentation + Commit

**Step 1: Update `AI_STATE.md`** — prepend Inspector Truth Overhaul change log entry

**Step 2: Update `03 Architecture/Design Surface.md`**
- Change Live Simulation rule (line ~97) to reflect collapsible, not pinned
- Add inspector truth rules to the Rules section
- Add RESOLVED entry in Open Questions for inspector developer-internals leakage

**Step 3: Commit everything**

```bash
git add \
  packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx \
  packages/rb-apps/src/apps/ide/__tests__/designSurface.inspectorTruth.test.tsx \
  AI_STATE.md \
  "03 Architecture/Design Surface.md"
git commit -m "ide: remove developer internals from Design inspector (Slice 8)"
```

---

## Status: COMPLETE (2026-04-07)

All 6 tests pass. 158/158 design surface tests pass. Documentation updated.
