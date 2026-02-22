# IoBus + Reality Link Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a derived `useIoBus` hook that reads SW/LD live values from the existing runtime sim, then wire it into DesignSurface (Reality Link), HardwareSurface (Live Signals), and ProjectSurface (live dot indicators).

**Architecture:** `useIoBus` is a pure derived hook — no new Zustand store. It computes `sw[16]` / `ld[16]` / `btn[5]` arrays from `runtimeSim.inputs` + `runtimeSim.signals` keyed by `nodeId` from `ioRows`. The three surfaces call it locally; IdeApp passes the extra `runtimeSim` + optional `setInput` props only to HardwareSurface and ProjectSurface (DesignSurface already has them).

**Tech Stack:** React, TypeScript, Vitest, `renderHook` + `act` from `@testing-library/react`

---

## Key types (do not re-explore)

```ts
// packages/rb-apps/src/apps/ide/examplesCatalog.ts
interface IdeExampleIoRow {
  id: string;
  nodeId: string;       // circuit node ID — the sim lookup key
  port: string;
  label: string;        // "SW0", "SW1", "LD0", "LD1", "BTNC", etc.
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
}

// packages/rb-apps/src/apps/ide/sim/simTypes.ts
interface RuntimeSimState {
  inputs:  Record<string, 0 | 1>;  // keyed by nodeId
  signals: Record<string, 0 | 1>;  // all signal values
  running: boolean;
  tick: number;
  // …other fields not needed
}
```

`runtimeSim.inputs[nodeId]` → current input value (switches)
`runtimeSim.signals[nodeId]` → current output/signal value (LEDs)

**IdeApp.tsx wiring today:**
- `DesignSurface` ← `runtimeSim`, `onRuntimeSimSetInput={setRuntimeSimInput}`, `ioRows={projectIoRows}`  ✅ has everything
- `HardwareSurface` ← `mappingRows={projectIoRows}` only — **no sim**
- `ProjectSurface` ← `mappingRows={projectIoRows}`, `simRunning` only — **no sim inputs/signals**

---

## Task 1: Create `ioBus.ts`

**Files:**
- Create: `packages/rb-apps/src/apps/ide/ioBus.ts`

**Step 1: Write the file**

```ts
import { useMemo } from 'react';
import type { RuntimeSimState } from './sim/simTypes';

export type Bit = 0 | 1;

export interface IoBusState {
  sw:  Bit[]; // length 16
  btn: Bit[]; // length 5
  ld:  Bit[]; // length 16
}

export interface IoBusActions {
  setSwitch(i: number, v: Bit): void;
  toggleSwitch(i: number): void;
  setButton(i: number, v: Bit): void;
}

export interface IoBusMeta {
  swNodeIds:  (string | null)[];  // length 16
  ldNodeIds:  (string | null)[];  // length 16
  btnNodeIds: (string | null)[];  // length 5
}

const BTN_LABELS = ['BTNC', 'BTNU', 'BTND', 'BTNL', 'BTNR'] as const;
const SW_RE  = /^SW(\d+)$/i;
const LD_RE  = /^LD(\d+)$/i;
const BTN_RE = /^BTN([A-Z]+)$/i;

function readBit(sim: RuntimeSimState, nodeId: string | null): Bit {
  if (!nodeId) return 0;
  const v =
    sim.inputs[nodeId]  ??
    sim.signals[nodeId] ??
    sim.signals[`${nodeId}.out`] ??
    0;
  return v === 1 ? 1 : 0;
}

export function useIoBus(args: {
  ioRows: Array<{ nodeId: string; label: string; direction: 'in' | 'out' }>;
  runtimeSim: RuntimeSimState;
  setInput: (nodeId: string, v: Bit) => void;
}): { state: IoBusState; actions: IoBusActions; meta: IoBusMeta } {
  const { ioRows, runtimeSim, setInput } = args;

  const meta: IoBusMeta = useMemo(() => {
    const swNodeIds:  (string | null)[] = Array(16).fill(null);
    const ldNodeIds:  (string | null)[] = Array(16).fill(null);
    const btnNodeIds: (string | null)[] = Array(5).fill(null);

    for (const row of ioRows) {
      const label = row.label.trim().toUpperCase();
      const swM = SW_RE.exec(label);
      if (swM && row.direction === 'in') {
        const idx = parseInt(swM[1], 10);
        if (idx >= 0 && idx < 16) swNodeIds[idx] = row.nodeId;
        continue;
      }
      const ldM = LD_RE.exec(label);
      if (ldM && row.direction === 'out') {
        const idx = parseInt(ldM[1], 10);
        if (idx >= 0 && idx < 16) ldNodeIds[idx] = row.nodeId;
        continue;
      }
      const btnM = BTN_RE.exec(label);
      if (btnM) {
        const suffix = btnM[1];
        const btnIdx = BTN_LABELS.indexOf(`BTN${suffix}` as typeof BTN_LABELS[number]);
        if (btnIdx >= 0) btnNodeIds[btnIdx] = row.nodeId;
      }
    }
    return { swNodeIds, ldNodeIds, btnNodeIds };
  }, [ioRows]);

  const state: IoBusState = useMemo(() => ({
    sw:  meta.swNodeIds.map((id)  => readBit(runtimeSim, id)),
    ld:  meta.ldNodeIds.map((id)  => readBit(runtimeSim, id)),
    btn: meta.btnNodeIds.map((id) => readBit(runtimeSim, id)),
  }), [meta, runtimeSim]);

  const actions: IoBusActions = useMemo(() => ({
    setSwitch(i: number, v: Bit) {
      const nodeId = meta.swNodeIds[i];
      if (nodeId) setInput(nodeId, v);
    },
    toggleSwitch(i: number) {
      const nodeId = meta.swNodeIds[i];
      if (nodeId) {
        const current = readBit(runtimeSim, nodeId);
        setInput(nodeId, current === 1 ? 0 : 1);
      }
    },
    setButton(i: number, v: Bit) {
      const nodeId = meta.btnNodeIds[i];
      if (nodeId) setInput(nodeId, v);
    },
  }), [meta, runtimeSim, setInput]);

  return { state, actions, meta };
}
```

**Step 2: Verify TypeScript compiles**
```bash
cd /c/Users/conno/redbyte-ui/packages/rb-apps && npx tsc --noEmit 2>&1 | grep ioBus
```
Expected: no output (no errors in the new file)

---

## Task 2: Write unit tests for `useIoBus`

**Files:**
- Create: `packages/rb-apps/src/__tests__/ioBus.test.ts`

**Step 1: Write the test file**

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIoBus } from '../apps/ide/ioBus';
import type { RuntimeSimState } from '../apps/ide/sim/simTypes';

const baseSim: RuntimeSimState = {
  tick: 0,
  running: false,
  speedHz: 1,
  irHash: '',
  traceHash: '',
  inputs:  { 'n-sw0': 1, 'n-sw1': 0 },
  signals: { 'n-ld0': 1, 'n-ld1': 0 },
  trace: [],
  selectedSignalKey: null,
  probes: [],
};

const baseIoRows = [
  { nodeId: 'n-sw0', label: 'SW0', direction: 'in'  as const },
  { nodeId: 'n-sw1', label: 'SW1', direction: 'in'  as const },
  { nodeId: 'n-ld0', label: 'LD0', direction: 'out' as const },
  { nodeId: 'n-ld1', label: 'LD1', direction: 'out' as const },
];

describe('useIoBus', () => {
  it('reads sw and ld values from sim state', () => {
    const { result } = renderHook(() =>
      useIoBus({ ioRows: baseIoRows, runtimeSim: baseSim, setInput: vi.fn() })
    );
    expect(result.current.state.sw[0]).toBe(1);  // inputs['n-sw0'] = 1
    expect(result.current.state.sw[1]).toBe(0);  // inputs['n-sw1'] = 0
    expect(result.current.state.ld[0]).toBe(1);  // signals['n-ld0'] = 1
    expect(result.current.state.ld[1]).toBe(0);  // signals['n-ld1'] = 0
  });

  it('arrays are always length 16/5 even with empty ioRows', () => {
    const { result } = renderHook(() =>
      useIoBus({ ioRows: [], runtimeSim: baseSim, setInput: vi.fn() })
    );
    expect(result.current.state.sw.length).toBe(16);
    expect(result.current.state.ld.length).toBe(16);
    expect(result.current.state.btn.length).toBe(5);
    // all zeros
    expect(result.current.state.sw.every((v) => v === 0)).toBe(true);
  });

  it('toggleSwitch calls setInput with the flipped value', () => {
    const setInput = vi.fn();
    const { result } = renderHook(() =>
      useIoBus({ ioRows: baseIoRows, runtimeSim: baseSim, setInput })
    );
    // SW0 is currently 1, toggling should call setInput with 0
    act(() => { result.current.actions.toggleSwitch(0); });
    expect(setInput).toHaveBeenCalledWith('n-sw0', 0);
    // SW1 is currently 0, toggling should call setInput with 1
    act(() => { result.current.actions.toggleSwitch(1); });
    expect(setInput).toHaveBeenCalledWith('n-sw1', 1);
  });

  it('actions are no-ops when no mapping exists', () => {
    const setInput = vi.fn();
    const { result } = renderHook(() =>
      useIoBus({ ioRows: [], runtimeSim: baseSim, setInput })
    );
    act(() => { result.current.actions.toggleSwitch(0); });
    act(() => { result.current.actions.setSwitch(0, 1); });
    act(() => { result.current.actions.setButton(0, 1); });
    expect(setInput).not.toHaveBeenCalled();
  });

  it('label matching is case-insensitive', () => {
    const rows = [
      { nodeId: 'n-sw3', label: 'sw3', direction: 'in' as const },
      { nodeId: 'n-ld5', label: 'ld5', direction: 'out' as const },
    ];
    const sim: RuntimeSimState = { ...baseSim, inputs: { 'n-sw3': 1 }, signals: { 'n-ld5': 1 } };
    const { result } = renderHook(() =>
      useIoBus({ ioRows: rows, runtimeSim: sim, setInput: vi.fn() })
    );
    expect(result.current.state.sw[3]).toBe(1);
    expect(result.current.state.ld[5]).toBe(1);
  });
});
```

**Step 2: Run the tests**
```bash
cd /c/Users/conno/redbyte-ui && pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/__tests__/ioBus.test.ts 2>&1 | tail -15
```
Expected: `5 passed`

---

## Task 3: Wire DesignSurface — Reality Link

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`

**Context:** DesignSurface already has `ioRows`, `runtimeSim`, and `onRuntimeSimSetInput`. The inspector has a "Board Signal" stub at line ~967. `selectedNode` is computed at line ~680. No new props needed.

**Step 1: Replace the "Board Signal" stub section**

Find and replace this exact block (lines ~967–971):
```tsx
          <IdeInspectorSection title="Board Signal" defaultOpen>
            <p className="ide-copy" style={{ color: 'var(--ide-text-soft)', fontSize: 'var(--rb-font-size-1)' }}>
              Select a node to see its board pin mapping.
            </p>
          </IdeInspectorSection>
```

Replace with:
```tsx
          <IdeInspectorSection title="Board Signal" defaultOpen>
            {(() => {
              if (!selectedNode) {
                return (
                  <p className="ide-copy" style={{ color: 'var(--ide-text-soft)', fontSize: 'var(--rb-font-size-1)' }}>
                    Select a node to see its board pin mapping.
                  </p>
                );
              }
              const ioRow = (ioRows ?? []).find((r) => r.nodeId === selectedNode.id);
              if (!ioRow) {
                return (
                  <p className="ide-copy" style={{ color: 'var(--ide-text-soft)', fontSize: 'var(--rb-font-size-1)' }}>
                    No board mapping for this node.
                  </p>
                );
              }
              const liveValue =
                runtimeSim.inputs[ioRow.nodeId] ??
                runtimeSim.signals[ioRow.nodeId] ??
                runtimeSim.signals[`${ioRow.nodeId}.out`] ??
                0;
              return (
                <div className="ide-kv-list">
                  <div className="ide-kv-row">
                    <span>Label</span>
                    <code style={{ fontFamily: 'var(--rb-font-mono)' }}>{ioRow.label}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Pin</span>
                    <code style={{ fontFamily: 'var(--rb-font-mono)' }}>{ioRow.pin || '—'}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Dir</span>
                    <span>{ioRow.direction === 'in' ? 'IN' : 'OUT'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Value</span>
                    <span
                      data-testid="ide-design-board-signal-value"
                      style={{
                        fontFamily: 'var(--rb-font-mono)',
                        fontWeight: 600,
                        color: liveValue ? 'var(--rb-signal)' : 'var(--ide-text-soft)',
                      }}
                    >
                      {liveValue ? 'HIGH' : 'LOW'}
                    </span>
                  </div>
                </div>
              );
            })()}
          </IdeInspectorSection>
```

**Step 2: Verify no TS errors in DesignSurface**
```bash
cd /c/Users/conno/redbyte-ui/packages/rb-apps && npx tsc --noEmit 2>&1 | grep "DesignSurface"
```
Expected: no output

---

## Task 4: Wire HardwareSurface — Live Signals

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx`
- Modify: `packages/rb-apps/src/apps/IdeApp.tsx`

### HardwareSurface.tsx changes

**Step 1: Add import for `RuntimeSimState` and `useIoBus`**

At the top of HardwareSurface.tsx, after the existing imports, add:
```tsx
import type { RuntimeSimState } from '../sim/simTypes';
import { useIoBus } from '../ioBus';
```

**Step 2: Add `nodeId` to `HardwareMappingRow` and new props**

Change:
```ts
export interface HardwareMappingRow {
  id: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
}
```
To:
```ts
export interface HardwareMappingRow {
  id: string;
  nodeId?: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
}
```

Add new optional props to `HardwareSurfaceProps`:
```ts
  runtimeSim?: RuntimeSimState;
  onSimSetInput?: (nodeId: string, v: 0 | 1) => void;
```

**Step 3: Destructure new props and call `useIoBus`**

In the component function destructuring, add:
```tsx
  runtimeSim,
  onSimSetInput,
```

After the existing `useMemo` declarations (around line 80 in the component), add:
```tsx
  const EMPTY_SIM: RuntimeSimState = {
    tick: 0, running: false, speedHz: 1, irHash: '', traceHash: '',
    inputs: {}, signals: {}, trace: [], selectedSignalKey: null, probes: [],
  };
  const ioBusIoRows = useMemo(
    () => mappingRows
      .filter((r): r is HardwareMappingRow & { nodeId: string } => Boolean(r.nodeId))
      .map((r) => ({ nodeId: r.nodeId, label: r.label, direction: r.direction })),
    [mappingRows]
  );
  const ioBus = useIoBus({
    ioRows: ioBusIoRows,
    runtimeSim: runtimeSim ?? EMPTY_SIM,
    setInput: onSimSetInput ?? (() => {}),
  });
```

**Step 4: Replace the "Live Signals" inspector stub**

Replace:
```tsx
          <IdeInspectorSection title="Live Signals" defaultOpen>
            <p className="ide-copy" style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
              Connect simulation to see live SW / LD values.
            </p>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>SW</span>
                <span>—</span>
              </div>
              <div className="ide-kv-row">
                <span>LD</span>
                <span>—</span>
              </div>
              <div className="ide-kv-row">
                <span>BTN</span>
                <span>—</span>
              </div>
            </div>
          </IdeInspectorSection>
```

With:
```tsx
          <IdeInspectorSection title="Live Signals" defaultOpen>
            {ioBusIoRows.length === 0 ? (
              <p className="ide-copy" style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
                No mapped signals. Add SW/LD IO rows in the Design tab.
              </p>
            ) : (
              <div className="ide-kv-list">
                {([0, 1, 2, 3] as const).map((i) =>
                  ioBus.meta.swNodeIds[i] ? (
                    <div key={`sw${i}`} className="ide-kv-row">
                      <span style={{ fontFamily: 'var(--rb-font-mono)', fontSize: 'var(--rb-font-size-1)' }}>SW{i}</span>
                      <button
                        type="button"
                        data-testid={`ide-hardware-sw-toggle-${i}`}
                        onClick={() => ioBus.actions.toggleSwitch(i)}
                        style={{
                          fontFamily: 'var(--rb-font-mono)',
                          fontSize: 'var(--rb-font-size-1)',
                          fontWeight: 600,
                          color: ioBus.state.sw[i] ? 'var(--rb-signal)' : 'var(--ide-text-soft)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {ioBus.state.sw[i] ? '■ 1' : '□ 0'}
                      </button>
                    </div>
                  ) : null
                )}
                {([0, 1, 2, 3] as const).map((i) =>
                  ioBus.meta.ldNodeIds[i] ? (
                    <div key={`ld${i}`} className="ide-kv-row">
                      <span style={{ fontFamily: 'var(--rb-font-mono)', fontSize: 'var(--rb-font-size-1)' }}>LD{i}</span>
                      <span
                        data-testid={`ide-hardware-ld-value-${i}`}
                        style={{
                          fontFamily: 'var(--rb-font-mono)',
                          fontSize: 'var(--rb-font-size-1)',
                          fontWeight: 600,
                          color: ioBus.state.ld[i] ? 'var(--rb-signal)' : 'var(--ide-text-soft)',
                        }}
                      >
                        {ioBus.state.ld[i] ? '● 1' : '○ 0'}
                      </span>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </IdeInspectorSection>
```

### IdeApp.tsx changes

**Step 5: Pass new props to HardwareSurface**

Find:
```tsx
          <HardwareSurface
            projectName={projectName}
            expectedBehavior={hardwareExpectedBehavior}
            mappingRows={projectIoRows}
            expectedIoRows={hardwareExpectedIoRows}
            vectorsCount={projectVectors.length}
            health={projectHealth}
            onGenerateBringUpVectors={handleGenerateBringUpVectors}
            onOpenExport={() => setCurrentMode('export')}
            onOpenVerify={() => setCurrentMode('verify')}
          />
```

Add two props:
```tsx
          <HardwareSurface
            projectName={projectName}
            expectedBehavior={hardwareExpectedBehavior}
            mappingRows={projectIoRows}
            expectedIoRows={hardwareExpectedIoRows}
            vectorsCount={projectVectors.length}
            health={projectHealth}
            runtimeSim={runtimeSim}
            onSimSetInput={setRuntimeSimInput}
            onGenerateBringUpVectors={handleGenerateBringUpVectors}
            onOpenExport={() => setCurrentMode('export')}
            onOpenVerify={() => setCurrentMode('verify')}
          />
```

**Step 6: Verify TS — no errors in HardwareSurface or IdeApp:**
```bash
cd /c/Users/conno/redbyte-ui/packages/rb-apps && npx tsc --noEmit 2>&1 | grep -E "HardwareSurface|IdeApp"
```
Expected: no output

---

## Task 5: Wire ProjectSurface — live dot indicators

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`
- Modify: `packages/rb-apps/src/apps/IdeApp.tsx`

### ProjectSurface.tsx changes

**Step 1: Add imports**

Add to the existing import block at top of file:
```tsx
import type { RuntimeSimState } from '../sim/simTypes';
import { useIoBus } from '../ioBus';
```

**Step 2: Add `nodeId` to `ProjectMappingRow` and new prop**

Change:
```ts
export interface ProjectMappingRow {
  id: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
  port: string;
}
```
To:
```ts
export interface ProjectMappingRow {
  id: string;
  nodeId?: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
  port: string;
}
```

Add to `ProjectSurfaceProps`:
```ts
  runtimeSim?: RuntimeSimState;
```

**Step 3: Destructure and call `useIoBus`**

After `mappingRows` destructuring, add `runtimeSim` to the destructured props.

After the existing `useMemo` blocks (around where `sortedMappingRows` is defined), add:
```tsx
  const EMPTY_SIM: RuntimeSimState = {
    tick: 0, running: false, speedHz: 1, irHash: '', traceHash: '',
    inputs: {}, signals: {}, trace: [], selectedSignalKey: null, probes: [],
  };
  const ioBusIoRows = useMemo(
    () => mappingRows
      .filter((r): r is ProjectMappingRow & { nodeId: string } => Boolean(r.nodeId))
      .map((r) => ({ nodeId: r.nodeId, label: r.label, direction: r.direction })),
    [mappingRows]
  );
  const ioBus = useIoBus({
    ioRows: ioBusIoRows,
    runtimeSim: runtimeSim ?? EMPTY_SIM,
    setInput: () => {},
  });
```

**Step 4: Add live dot to the mapping table rows**

Find the `mappingRowsUi` useMemo. It currently builds an array of 5 ReactNodes per row:
`[portCell, aliasCell, pinInput, directionString, statusPill]`

Change to add a live dot to the **status cell** (last item). The status cell currently is:
```tsx
          <IdeStatusPill key={`${row.id}-status`} tone={mappingView.statusTone}>
            {mappingView.statusLabel}
          </IdeStatusPill>,
```

Change to:
```tsx
          <span key={`${row.id}-status`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--ide-space-1)' }}>
            <IdeStatusPill tone={mappingView.statusTone}>
              {mappingView.statusLabel}
            </IdeStatusPill>
            {row.nodeId && (() => {
              const swMatch = /^SW(\d+)$/i.exec(row.label);
              const ldMatch = /^LD(\d+)$/i.exec(row.label);
              if (swMatch) {
                const bit = ioBus.state.sw[parseInt(swMatch[1], 10)] ?? 0;
                return (
                  <span
                    data-testid={`ide-project-live-dot-${row.id}`}
                    style={{ fontSize: 10, color: bit ? 'var(--rb-signal)' : 'var(--ide-text-subtle, #4a5568)' }}
                    title={`Live: ${bit ? 'HIGH' : 'LOW'}`}
                  >●</span>
                );
              }
              if (ldMatch) {
                const bit = ioBus.state.ld[parseInt(ldMatch[1], 10)] ?? 0;
                return (
                  <span
                    data-testid={`ide-project-live-dot-${row.id}`}
                    style={{ fontSize: 10, color: bit ? 'var(--rb-signal)' : 'var(--ide-text-subtle, #4a5568)' }}
                    title={`Live: ${bit ? 'HIGH' : 'LOW'}`}
                  >●</span>
                );
              }
              return null;
            })()}
          </span>,
```

Also add `ioBus` to the `useMemo` dependency array for `mappingRowsUi`.

### IdeApp.tsx changes

**Step 5: Pass `runtimeSim` to ProjectSurface**

Find the `<ProjectSurface` render and add:
```tsx
            runtimeSim={runtimeSim}
```
(alongside the existing `simRunning={runtimeSim.running}` prop)

**Step 6: Verify TS:**
```bash
cd /c/Users/conno/redbyte-ui/packages/rb-apps && npx tsc --noEmit 2>&1 | grep -E "ProjectSurface|IdeApp"
```
Expected: no output

---

## Task 6: Run all gates + commit

**Step 1: Run unit tests**
```bash
cd /c/Users/conno/redbyte-ui && pnpm --filter @redbyte/rb-apps test --run 2>&1 | grep "Test Files"
```
Expected: `111 passed | 5 skipped` (or `112 passed` if ioBus.test.ts counts separately — check)

**Step 2: Run autolayout gate**
```bash
cd /c/Users/conno/redbyte-ui && node scripts/gates/ide-autolayout-contract.mjs
```
Expected: `PASS: IDE auto-layout contract satisfied.`

**Step 3: Check no new TS errors in touched files**
```bash
cd /c/Users/conno/redbyte-ui/packages/rb-apps && npx tsc --noEmit 2>&1 | grep -E "surfaces/|ioBus"
```
Expected: no output (pre-existing errors in `__tests__/` are acceptable)

**Step 4: Commit**
```bash
cd /c/Users/conno/redbyte-ui && git add packages/rb-apps/src/apps/ide/ioBus.ts packages/rb-apps/src/__tests__/ioBus.test.ts packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx packages/rb-apps/src/apps/IdeApp.tsx
git commit -m "feat(ide): IoBus hook + Reality Link + live IO indicators

- Add useIoBus derived hook (ioBus.ts) — reads SW/LD values from runtimeSim
  inputs+signals keyed by nodeId; safe with empty/partial mappings
- DesignSurface: Board Signal inspector shows live HIGH/LOW for selected node
- HardwareSurface: Live Signals inspector shows SW0-SW3 toggles + LD0-LD3 read-only
- ProjectSurface: mapping table rows show live ● dot for SW/LD signals
- Wire runtimeSim + onSimSetInput to HardwareSurface and ProjectSurface in IdeApp
- 5 unit tests covering label parsing, toggle action, safe no-op with empty rows

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Notes for executor

**EMPTY_SIM constant:** Used as fallback when `runtimeSim` prop is optional/undefined. Defined inline in each component rather than exported to avoid coupling.

**`useMemo` for `EMPTY_SIM`:** Since `EMPTY_SIM` is defined inside the component but has stable reference (all-zero/empty fields won't change), declare it as a module-level const OUTSIDE the component for HardwareSurface and ProjectSurface to avoid hooks warnings:
```ts
const HARDWARE_EMPTY_SIM: RuntimeSimState = { tick:0, running:false, speedHz:1, irHash:'', traceHash:'', inputs:{}, signals:{}, trace:[], selectedSignalKey:null, probes:[] };
const PROJECT_EMPTY_SIM: RuntimeSimState = { ...HARDWARE_EMPTY_SIM };
```

**`ioBusIoRows` dependency warning:** The `useIoBus` call depends on `ioBusIoRows`. Make sure `ioBusIoRows` is wrapped in `useMemo` (already specified above) to avoid stale closures.

**`mappingRowsUi` deps:** After adding `ioBus` to the deps array, verify the array renders correctly — the IIFE `(() => { ... })()` pattern inside JSX is fine for inline conditionals.

**IdeExampleIoRow already has `nodeId`:** When IdeApp passes `projectIoRows` (which is `IdeExampleIoRow[]`) to both HardwareSurface and ProjectSurface with `mappingRows=`, TypeScript will now correctly type-check the `nodeId` field since we added it as optional to both `HardwareMappingRow` and `ProjectMappingRow`.
