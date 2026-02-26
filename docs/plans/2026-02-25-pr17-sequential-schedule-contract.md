# PR17 — Sequential Schedule Contract + Testbench Parity + Lab 7/8 Gates

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the "green in browser, diverges in Vivado" trust gap for Labs 7 and 8 by wiring a single declared schedule contract through the verify runner, exported testbench, and gate enforcement — so a cherry-picked 3-step run cannot pass the `sequence-proof` or `fsm-paths` submission gates.

**Architecture:** Add a `schedule` field declared at the checkpoint level (`TruthTableCheckpoint.config.schedule`); `verifyTruthTable.ts` applies the 3-tick `clocked_macro` sequence per row when this is set — matching the existing `vectorRunner.ts` / `testbenchGenerator.ts` behavior. Gate enforcement in `submissionGates.ts` checks the new `sequenceProofRun` / `fsmPathsRun` boolean flags that the IDE sets after successful clocked verify runs. Lab 7 and Lab 8 starter JSON files gain explicit `clocked_macro` checkpoint vectors so the IDE can set those flags.

**Tech Stack:** TypeScript + JavaScript (JS mirrors required for all files), Vitest (all tests), existing `CircuitEngine` from `@redbyte/rb-logic-core`, existing `CLOCKED_MACRO_SEQUENCE = [0,1,0]` pattern.

---

## Codebase Context (Read This First)

```
packages/
  rb-utils/src/
    labProjectSchema.ts       ← TruthTableCheckpoint type lives here;
                                checkpoint.config (typed) vs checkpoint.spec (back-compat)
    index.ts                  ← exports everything from rb-utils
    index.js                  ← JS mirror of index.ts
    labProjectSchema.js       ← JS mirror (no types, same runtime exports)

  rb-lab-engine/src/verification/
    verifyTruthTable.ts       ← reads checkpoint.spec.{inputs,outputs,expectedTable};
                                calls engine.tick() once per row (schedule-unaware)
    verifyTruthTable.js       ← JS mirror
    verifyCheckpoint.ts       ← dispatcher: routes 'truth-table' → verifyTruthTable()

  rb-apps/src/
    fpga/boards/basys3/
      verifySchedule.ts       ← defines VerifySchedule type + CLOCKED_MACRO_SEQUENCE locally
      vectorRunner.ts         ← uses clocked_macro 3-tick schedule correctly
      testbenchGenerator.ts   ← calls deriveVerifySchedule(); already has TB parity with vectorRunner
    labs/
      submissionGates.ts      ← validateSubmissionForLab(); checks recentRuns booleans
      submissionGates.js      ← JS mirror
      labDefinitions.ts       ← Lab 7 has gate id='sequence-proof'; Lab 8 has id='fsm-paths'
                                BUT submissionGates.ts does NOT currently check those gate IDs
    examples/
      22_lab7-sync-counter-starter-basys3.json  ← starter; no labSpec.checkpoints today
      23_lab8-fsm-lock-starter-basys3.json      ← starter; no labSpec.checkpoints today
    __tests__/
      lab-submission-gates.test.ts              ← existing gate tests; add tests here
```

**Critical: existing `verifyTruthTable.ts` accesses `checkpoint.spec` (the untyped back-compat field), not `checkpoint.config` (the typed field).** For schedule, we use `checkpoint.config` (typed). Both fields coexist on the same object.

**Critical: every `.ts` change requires a matching `.js` mirror update.** The `.js` files are hand-maintained JS versions. See AGENTS.md.

---

## Task 1: Move `VerifySchedule` + `CLOCKED_MACRO_SEQUENCE` to `rb-utils`

This makes them importable by both `rb-lab-engine` and `rb-apps` without cross-package dependency issues.

**Files:**
- Create: `packages/rb-utils/src/verifySchedule.ts`
- Create: `packages/rb-utils/src/verifySchedule.js`
- Modify: `packages/rb-utils/src/index.ts`
- Modify: `packages/rb-utils/src/index.js`
- Modify: `packages/rb-apps/src/fpga/boards/basys3/verifySchedule.ts` (re-export)

### Step 1: Create `packages/rb-utils/src/verifySchedule.ts`

```typescript
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Shared verify schedule contract — used by verify runner, testbench generator,
 * and submission gate enforcement. Single source of truth.
 */

export type VerifySchedule = 'combinational' | 'clocked_macro';

/**
 * The 3-tick clock pulse sequence: drive CLK=0 → tick, CLK=1 → tick, CLK=0 → tick.
 * Matches the latch-gated behaviour of DFlipFlop/TFlipFlop/JKFlipFlop composites.
 */
export const CLOCKED_MACRO_SEQUENCE: readonly [0, 1, 0] = [0, 1, 0];
```

### Step 2: Create `packages/rb-utils/src/verifySchedule.js`

```javascript
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export const CLOCKED_MACRO_SEQUENCE = [0, 1, 0];
```

### Step 3: Modify `packages/rb-utils/src/index.ts`

Add this line after the existing exports:

```typescript
export * from './verifySchedule';
```

### Step 4: Modify `packages/rb-utils/src/index.js`

Add this line after the existing exports (mirror the `.ts` change):

```javascript
export * from './verifySchedule';
```

### Step 5: Update `packages/rb-apps/src/fpga/boards/basys3/verifySchedule.ts`

Find the lines that define `VerifySchedule` and `CLOCKED_MACRO_SEQUENCE` locally and replace them with re-exports from `@redbyte/rb-utils`. Keep everything else (interfaces, `deriveVerifySchedule`, etc.) unchanged.

Replace the LOCAL definitions:
```typescript
export type VerifySchedule = 'combinational' | 'clocked_macro';
export const CLOCKED_MACRO_SEQUENCE: readonly [0, 1, 0] = [0, 1, 0];
```

With re-exports:
```typescript
export type { VerifySchedule } from '@redbyte/rb-utils';
export { CLOCKED_MACRO_SEQUENCE } from '@redbyte/rb-utils';
```

**Note:** No `.js` mirror for `basys3/verifySchedule.ts` — check whether one exists with `ls packages/rb-apps/src/fpga/boards/basys3/verifySchedule.js`. If it exists, update it the same way.

### Step 6: Run build to confirm no breakage

```bash
pnpm build
```

Expected: exit 0. If `VerifySchedule` import fails anywhere, check that `rb-utils` is listed in that package's `package.json` dependencies.

### Step 7: Commit

```bash
git add packages/rb-utils/src/verifySchedule.ts packages/rb-utils/src/verifySchedule.js
git add packages/rb-utils/src/index.ts packages/rb-utils/src/index.js
git add packages/rb-apps/src/fpga/boards/basys3/verifySchedule.ts
git commit -m "$(cat <<'EOF'
refactor(schema): move VerifySchedule + CLOCKED_MACRO_SEQUENCE to rb-utils

Single source of truth for the clocked_macro schedule contract, importable
from both rb-lab-engine and rb-apps without cross-package dependency.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `schedule` to `TruthTableCheckpoint.config`

**Files:**
- Modify: `packages/rb-utils/src/labProjectSchema.ts`
- Modify: `packages/rb-utils/src/labProjectSchema.js`

### Step 1: Modify `packages/rb-utils/src/labProjectSchema.ts`

Find `TruthTableCheckpoint` (around line 186) and add `schedule` and `clockSignal` to its `config`:

Old:
```typescript
export interface TruthTableCheckpoint extends CheckpointDefinition {
  type: 'truth-table';
  config: {
    inputs: string[]; // Signal names
    outputs: string[]; // Signal names
    table: TruthTableRow[];
  };
}
```

New:
```typescript
export interface TruthTableCheckpoint extends CheckpointDefinition {
  type: 'truth-table';
  config: {
    inputs: string[]; // Signal names
    outputs: string[]; // Signal names
    table: TruthTableRow[];
    /**
     * Execution schedule for this checkpoint.
     * 'combinational': drive inputs → tick() → sample (default, backward-compat)
     * 'clocked_macro': drive inputs → CLK=0/tick → CLK=1/tick → CLK=0/tick → sample
     */
    schedule?: 'combinational' | 'clocked_macro';
    /**
     * Name of the clock input node (label or id) to pulse during clocked_macro.
     * Required when schedule='clocked_macro'.
     */
    clockSignal?: string;
  };
}
```

### Step 2: Modify `packages/rb-utils/src/labProjectSchema.js`

The JS mirror has no interface definitions (TypeScript-only constructs are omitted). No change needed to the JS file for this task — the `config` shape is only enforced at the TypeScript level.

**Verify this is correct:** Run `grep -n "TruthTableCheckpoint" packages/rb-utils/src/labProjectSchema.js`. If the JS file has interface definitions (unusual), add the fields as JSDoc comments.

### Step 3: Run build

```bash
pnpm build
```

Expected: exit 0.

### Step 4: Commit

```bash
git add packages/rb-utils/src/labProjectSchema.ts
git commit -m "$(cat <<'EOF'
feat(schema): add schedule + clockSignal to TruthTableCheckpoint.config

Enables lab checkpoints to declare 'clocked_macro' schedule so verifyTruthTable
applies the same 3-tick clock sequence used by vectorRunner and testbenchGenerator.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Make `verifyTruthTable.ts` schedule-aware

This is the core engine change. When `checkpoint.config.schedule === 'clocked_macro'`, apply the 3-tick pulse per row instead of a single `engine.tick()`.

**Files:**
- Modify: `packages/rb-lab-engine/src/verification/verifyTruthTable.ts`
- Modify: `packages/rb-lab-engine/src/verification/verifyTruthTable.js`
- Create: `packages/rb-lab-engine/src/verification/__tests__/verifyTruthTable-schedule.test.ts`

### Step 1: Write the failing test first

Create `packages/rb-lab-engine/src/verification/__tests__/verifyTruthTable-schedule.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { verifyTruthTable } from '../verifyTruthTable';
import type { LabProjectV1, TruthTableCheckpoint } from '@redbyte/rb-utils';

/**
 * Minimal circuit factory: one SWITCH (id='clk', label='CLK') connected
 * to a DFlipFlop (id='dff'). DFlipFlop.Q is the OUTPUT (id='q_out', label='Q').
 *
 * Structure matches what verifyTruthTable expects:
 * - Input nodes have type 'SWITCH' or 'INPUT'
 * - Output nodes have label matching the outputs[] list
 */
function makeClockableProject(): LabProjectV1 {
  return {
    schemaVersion: '1.0',
    projectId: 'test-dff',
    name: 'DFF test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    circuit: {
      schemaVersion: '1.0',
      nodes: [
        { id: 'sw_d',  type: 'SWITCH', x: 0,   y: 0,   label: 'D'   },
        { id: 'sw_clk',type: 'SWITCH', x: 0,   y: 50,  label: 'CLK' },
        { id: 'dff',   type: 'DFlipFlop', x: 100, y: 25, label: 'DFF' },
        { id: 'q_out', type: 'OUTPUT', x: 200, y: 25,  label: 'Q'   },
      ],
      connections: [
        { id: 'c1', fromNodeId: 'sw_d',   fromPin: 'out', toNodeId: 'dff',   toPin: 'D'   },
        { id: 'c2', fromNodeId: 'sw_clk', fromPin: 'out', toNodeId: 'dff',   toPin: 'CLK' },
        { id: 'c3', fromNodeId: 'dff',    fromPin: 'Q',   toNodeId: 'q_out', toPin: 'in'  },
      ],
    },
    simulation: { tickRate: 1, currentTick: 0, probes: [] },
    evidence: { actions: [], snapshots: [] },
  };
}

describe('verifyTruthTable — clocked_macro schedule', () => {
  it('captures D=1 after a rising CLK edge (clocked_macro)', async () => {
    const checkpoint: TruthTableCheckpoint = {
      id: 'dff-set',
      type: 'truth-table',
      title: 'DFF set test',
      config: {
        inputs: ['D', 'CLK'],
        outputs: ['Q'],
        schedule: 'clocked_macro',
        clockSignal: 'CLK',
        table: [
          // Row 0: D=1. With clocked_macro, CLK pulses 0→1→0.
          // After rising edge, DFF should capture Q=1.
          { inputs: { D: true, CLK: false }, outputs: { Q: true } },
        ],
      },
      spec: {
        // Back-compat spec kept empty — schedule uses config path.
        inputs: ['D', 'CLK'], outputs: ['Q'], expectedTable: [],
      },
    };

    const result = await verifyTruthTable(makeClockableProject(), checkpoint);

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.evidence).toHaveProperty('schedule', 'clocked_macro');
  });

  it('holds Q=0 when D=0 before first clock edge (clocked_macro)', async () => {
    const checkpoint: TruthTableCheckpoint = {
      id: 'dff-hold',
      type: 'truth-table',
      title: 'DFF hold test',
      config: {
        inputs: ['D', 'CLK'],
        outputs: ['Q'],
        schedule: 'clocked_macro',
        clockSignal: 'CLK',
        table: [
          { inputs: { D: false, CLK: false }, outputs: { Q: false } },
        ],
      },
      spec: { inputs: ['D', 'CLK'], outputs: ['Q'], expectedTable: [] },
    };

    const result = await verifyTruthTable(makeClockableProject(), checkpoint);
    expect(result.passed).toBe(true);
  });

  it('reports failure with correct row when Q mismatches after clock edge', async () => {
    const checkpoint: TruthTableCheckpoint = {
      id: 'dff-wrong',
      type: 'truth-table',
      title: 'DFF wrong expectation',
      config: {
        inputs: ['D', 'CLK'],
        outputs: ['Q'],
        schedule: 'clocked_macro',
        clockSignal: 'CLK',
        table: [
          // Expect Q=1 but D=0 → should actually be Q=0 → FAIL
          { inputs: { D: false, CLK: false }, outputs: { Q: true } },
        ],
      },
      spec: { inputs: ['D', 'CLK'], outputs: ['Q'], expectedTable: [] },
    };

    const result = await verifyTruthTable(makeClockableProject(), checkpoint);
    expect(result.passed).toBe(false);
    expect(result.failures[0].message).toContain('Row 1');
    expect(result.failures[0].message).toContain('Q=1');
  });

  it('backward-compat: no schedule = combinational (single tick)', async () => {
    // A checkpoint with no schedule field should still work as before
    const checkpoint: TruthTableCheckpoint = {
      id: 'comb-and',
      type: 'truth-table',
      title: 'AND gate',
      config: {
        inputs: ['A', 'B'],
        outputs: ['Y'],
        // no schedule field
        table: [
          { inputs: { A: false, B: false }, outputs: { Y: false } },
        ],
      },
      spec: { inputs: ['A', 'B'], outputs: ['Y'], expectedTable: [{ A: 0, B: 0, Y: 0 }] },
    };

    // Combinational project (AND gate)
    const project: LabProjectV1 = {
      schemaVersion: '1.0',
      projectId: 'test-comb',
      name: 'AND test',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      circuit: {
        schemaVersion: '1.0',
        nodes: [
          { id: 'sw_a', type: 'SWITCH', x: 0, y: 0,   label: 'A' },
          { id: 'sw_b', type: 'SWITCH', x: 0, y: 50,  label: 'B' },
          { id: 'and1', type: 'AND',    x: 100, y: 25, label: 'AND' },
          { id: 'out',  type: 'OUTPUT', x: 200, y: 25, label: 'Y'  },
        ],
        connections: [
          { id: 'c1', fromNodeId: 'sw_a', fromPin: 'out', toNodeId: 'and1', toPin: 'a' },
          { id: 'c2', fromNodeId: 'sw_b', fromPin: 'out', toNodeId: 'and1', toPin: 'b' },
          { id: 'c3', fromNodeId: 'and1', fromPin: 'out', toNodeId: 'out',  toPin: 'in' },
        ],
      },
      simulation: { tickRate: 1, currentTick: 0, probes: [] },
      evidence: { actions: [], snapshots: [] },
    };

    const result = await verifyTruthTable(project, checkpoint);
    expect(result.passed).toBe(true);
    expect(result.evidence).toHaveProperty('schedule', 'combinational');
  });
});
```

### Step 2: Run test to verify it fails

```bash
pnpm vitest run packages/rb-lab-engine/src/verification/__tests__/verifyTruthTable-schedule.test.ts
```

Expected: FAIL — `result.evidence` has no `schedule` property, and clocked DFF test likely fails because single `tick()` doesn't pulse the clock.

### Step 3: Implement the schedule-aware verifyTruthTable

Update `packages/rb-lab-engine/src/verification/verifyTruthTable.ts`. The key changes are:
1. Import `CLOCKED_MACRO_SEQUENCE` from `@redbyte/rb-utils`
2. Read `schedule` and `clockSignal` from `checkpoint.config`
3. Apply 3-tick pulse per row when `schedule === 'clocked_macro'`
4. Include `schedule` in the evidence output

Full replacement content:

```typescript
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Truth Table Verifier — Declarative
 *
 * Verifies circuit behavior matches expected truth table.
 * Supports two execution schedules:
 *   - combinational (default): drive inputs → tick() → sample
 *   - clocked_macro: drive inputs → CLK=0/tick → CLK=1/tick → CLK=0/tick → sample
 *
 * Schedule is declared in checkpoint.config.schedule.
 * When schedule='clocked_macro', checkpoint.config.clockSignal names the clock node.
 */

import type {
  LabProjectV1,
  TruthTableCheckpoint,
  CheckpointResult,
  CheckpointFailure,
  TruthTableRow,
} from '@redbyte/rb-utils';
import { CLOCKED_MACRO_SEQUENCE } from '@redbyte/rb-utils';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { toLegacyCircuit } from '../adapters/circuitAdapter';

export async function verifyTruthTable(
  project: LabProjectV1,
  checkpoint: TruthTableCheckpoint
): Promise<CheckpointResult> {
  const { inputs, outputs, expectedTable } = checkpoint.spec as {
    inputs: string[];
    outputs: string[];
    expectedTable: TruthTableRow[];
  };

  const schedule = checkpoint.config?.schedule ?? 'combinational';
  const clockSignal = checkpoint.config?.clockSignal;

  // Convert CircuitV1 to legacy circuit for simulation (temporary during migration)
  const legacyCircuit = toLegacyCircuit(project.circuit);
  const engine = new CircuitEngine(legacyCircuit);

  // Compute actual truth table by exhaustive simulation
  const actualTable: TruthTableRow[] = [];
  const failures: CheckpointFailure[] = [];

  for (let i = 0; i < expectedTable.length; i++) {
    const expectedRow = expectedTable[i];
    const actualRow: TruthTableRow = {};

    // Set input values (excluding clock — clock is driven by schedule)
    for (const inputSignal of inputs) {
      if (schedule === 'clocked_macro' && inputSignal === clockSignal) continue;
      const inputValue = normalizeValue(expectedRow[inputSignal]);
      actualRow[inputSignal] = inputValue;

      const inputNode = project.circuit.nodes.find(
        (n) => n.label === inputSignal || n.id === inputSignal
      );
      if (inputNode) {
        if (inputNode.type === 'SWITCH' || inputNode.type === 'INPUT') {
          engine.setNodeValue(inputNode.id, inputValue);
        }
      }
    }

    // Step simulation per schedule contract
    if (schedule === 'clocked_macro' && clockSignal) {
      // 3-tick clocked macro: CLK=0 → tick, CLK=1 → tick (capture), CLK=0 → tick (hold)
      for (const clockValue of CLOCKED_MACRO_SEQUENCE) {
        driveClockNode(engine, project, clockSignal, clockValue);
        engine.tick();
      }
    } else {
      // Default combinational: single tick to settle
      engine.tick();
    }

    // Read output values
    for (const outputSignal of outputs) {
      const outputNode = project.circuit.nodes.find(
        (n) => n.label === outputSignal || n.id === outputSignal
      );
      if (outputNode) {
        const nodeType = outputNode.type;
        if (nodeType === 'OUTPUT' || nodeType === 'Lamp') {
          actualRow[outputSignal] = (engine.getNodeState(outputNode.id)?.isOn as number) ?? 0;
        } else {
          const SEQUENTIAL_Q_TYPES = new Set(['DFlipFlop', 'DLatch', 'TFlipFlop', 'JKFlipFlop', 'RSLatch']);
          const portName = SEQUENTIAL_Q_TYPES.has(nodeType) ? 'Q' : 'out';
          actualRow[outputSignal] = (engine.getNodeValue(outputNode.id, portName) as number) ?? 0;
        }
      } else {
        actualRow[outputSignal] = 0;
      }
    }

    actualTable.push(actualRow);

    // Compare actual vs expected
    for (const outputSignal of outputs) {
      const expected = normalizeValue(expectedRow[outputSignal]);
      const actual = normalizeValue(actualRow[outputSignal]);
      if (expected !== actual) {
        failures.push({
          message: `Row ${i + 1}: expected ${outputSignal}=${expected}, got ${actual}`,
          jumpTarget: { type: 'table-row', row: i },
        });
      }
    }
  }

  const passed = failures.length === 0;
  const headline = passed
    ? '✓ Truth table matches'
    : `✗ ${failures.length} mismatch${failures.length > 1 ? 'es' : ''} found`;

  return {
    passed,
    headline,
    failures,
    evidence: {
      expected: expectedTable,
      actual: actualTable,
      diff: failures.map((f) => f.message),
      schedule,
    },
  };
}

/**
 * Drive a clock input node to a specific value.
 * Finds the node by label or id, then sets its isOn state.
 */
function driveClockNode(
  engine: CircuitEngine,
  project: LabProjectV1,
  clockSignal: string,
  value: 0 | 1
): void {
  const clockNode = project.circuit.nodes.find(
    (n) => n.label === clockSignal || n.id === clockSignal
  );
  if (clockNode) {
    engine.setNodeValue(clockNode.id, value);
  }
}

/**
 * Normalize boolean/number to 0/1
 */
function normalizeValue(value: number | boolean | undefined): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value ? 1 : 0;
  return 0;
}
```

### Step 4: Update `packages/rb-lab-engine/src/verification/verifyTruthTable.js`

Full replacement content (JS mirror — no types, same logic):

```javascript
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { CLOCKED_MACRO_SEQUENCE } from '@redbyte/rb-utils';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { toLegacyCircuit } from '../adapters/circuitAdapter';
export async function verifyTruthTable(project, checkpoint) {
    const { inputs, outputs, expectedTable } = checkpoint.spec;
    const schedule = checkpoint.config?.schedule ?? 'combinational';
    const clockSignal = checkpoint.config?.clockSignal;
    const legacyCircuit = toLegacyCircuit(project.circuit);
    const engine = new CircuitEngine(legacyCircuit);
    const actualTable = [];
    const failures = [];
    for (let i = 0; i < expectedTable.length; i++) {
        const expectedRow = expectedTable[i];
        const actualRow = {};
        for (const inputSignal of inputs) {
            if (schedule === 'clocked_macro' && inputSignal === clockSignal) continue;
            const inputValue = normalizeValue(expectedRow[inputSignal]);
            actualRow[inputSignal] = inputValue;
            const inputNode = project.circuit.nodes.find((n) => n.label === inputSignal || n.id === inputSignal);
            if (inputNode) {
                if (inputNode.type === 'SWITCH' || inputNode.type === 'INPUT') {
                    engine.setNodeValue(inputNode.id, inputValue);
                }
            }
        }
        if (schedule === 'clocked_macro' && clockSignal) {
            for (const clockValue of CLOCKED_MACRO_SEQUENCE) {
                driveClockNode(engine, project, clockSignal, clockValue);
                engine.tick();
            }
        } else {
            engine.tick();
        }
        for (const outputSignal of outputs) {
            const outputNode = project.circuit.nodes.find((n) => n.label === outputSignal || n.id === outputSignal);
            if (outputNode) {
                const SEQUENTIAL_Q_TYPES = new Set(['DFlipFlop', 'DLatch', 'TFlipFlop', 'JKFlipFlop', 'RSLatch']);
                const portName = SEQUENTIAL_Q_TYPES.has(outputNode.type) ? 'Q' : 'out';
                actualRow[outputSignal] = engine.getNodeValue(outputNode.id, portName) ?? 0;
            } else {
                actualRow[outputSignal] = 0;
            }
        }
        actualTable.push(actualRow);
        for (const outputSignal of outputs) {
            const expected = normalizeValue(expectedRow[outputSignal]);
            const actual = normalizeValue(actualRow[outputSignal]);
            if (expected !== actual) {
                failures.push({
                    message: `Row ${i + 1}: expected ${outputSignal}=${expected}, got ${actual}`,
                    jumpTarget: { type: 'table-row', row: i },
                });
            }
        }
    }
    const passed = failures.length === 0;
    const headline = passed
        ? '✓ Truth table matches'
        : `✗ ${failures.length} mismatch${failures.length > 1 ? 'es' : ''} found`;
    return {
        passed,
        headline,
        failures,
        evidence: {
            expected: expectedTable,
            actual: actualTable,
            diff: failures.map((f) => f.message),
            schedule,
        },
    };
}
function driveClockNode(engine, project, clockSignal, value) {
    const clockNode = project.circuit.nodes.find((n) => n.label === clockSignal || n.id === clockSignal);
    if (clockNode) {
        engine.setNodeValue(clockNode.id, value);
    }
}
function normalizeValue(value) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value ? 1 : 0;
    return 0;
}
```

### Step 5: Run tests

```bash
pnpm vitest run packages/rb-lab-engine/src/verification/__tests__/verifyTruthTable-schedule.test.ts
```

Expected: all 4 tests PASS.

### Step 6: Run full test suite

```bash
pnpm vitest run
```

Expected: previously passing tests still pass. The 2 pre-existing Clock/Delay failures are acceptable.

### Step 7: Commit

```bash
git add packages/rb-lab-engine/src/verification/verifyTruthTable.ts
git add packages/rb-lab-engine/src/verification/verifyTruthTable.js
git add packages/rb-lab-engine/src/verification/__tests__/verifyTruthTable-schedule.test.ts
git commit -m "$(cat <<'EOF'
feat(verify): schedule-aware verifyTruthTable — clocked_macro 3-tick support

When checkpoint.config.schedule='clocked_macro', verifyTruthTable drives
CLK=0→tick→CLK=1→tick→CLK=0→tick per row, matching the exact schedule used
by vectorRunner.ts and testbenchGenerator.ts. Backward-compat: no schedule
field = combinational (single tick, unchanged). Evidence includes schedule field.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Implement `sequence-proof` and `fsm-paths` gate enforcement

The gates are declared in `labDefinitions.ts` but `validateSubmissionForLab` never actually checks them. This task wires them up.

**Files:**
- Modify: `packages/rb-apps/src/labs/submissionGates.ts`
- Modify: `packages/rb-apps/src/labs/submissionGates.js`
- Modify: `packages/rb-apps/src/__tests__/lab-submission-gates.test.ts`

### Step 1: Write failing tests first

Add to `packages/rb-apps/src/__tests__/lab-submission-gates.test.ts`:

```typescript
describe('sequence-proof gate (Lab 7)', () => {
  function makeLab7Project(): RBProject {
    return createProject({
      meta: { labId: 'lab-7' },
      fpga: { board: 'basys3', top: 'top', preset: 'basys3' },
    });
  }

  it('blocks when sequenceProofRun is missing', () => {
    const result = validateSubmissionForLab('lab-7', {
      projectSnapshot: makeLab7Project(),
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true, sequenceProofRun: false },
    });
    expect(result.verdict).toBe('block');
    expect(result.issues.some((i) => i.code === 'sequence_proof_missing')).toBe(true);
  });

  it('passes sequence-proof gate when sequenceProofRun=true', () => {
    const result = validateSubmissionForLab('lab-7', {
      projectSnapshot: makeLab7Project(),
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true, sequenceProofRun: true },
    });
    // Should not have a sequence_proof_missing block
    expect(result.issues.some((i) => i.code === 'sequence_proof_missing')).toBe(false);
  });

  it('still blocks on cherry-picked run (sequenceProofRun not set)', () => {
    // recentRuns.simulated=true is NOT enough for Lab 7; sequenceProofRun must be set
    const result = validateSubmissionForLab('lab-7', {
      projectSnapshot: makeLab7Project(),
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true },
    });
    expect(result.issues.some((i) => i.code === 'sequence_proof_missing')).toBe(true);
  });
});

describe('fsm-paths gate (Lab 8)', () => {
  function makeLab8Project(): RBProject {
    return createProject({
      meta: { labId: 'lab-8' },
      fpga: { board: 'basys3', top: 'top', preset: 'basys3' },
    });
  }

  it('blocks when fsmPathsRun is missing', () => {
    const result = validateSubmissionForLab('lab-8', {
      projectSnapshot: makeLab8Project(),
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true, fsmPathsRun: false },
    });
    expect(result.verdict).toBe('block');
    expect(result.issues.some((i) => i.code === 'fsm_paths_missing')).toBe(true);
  });

  it('passes fsm-paths gate when fsmPathsRun=true', () => {
    const result = validateSubmissionForLab('lab-8', {
      projectSnapshot: makeLab8Project(),
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true, fsmPathsRun: true },
    });
    expect(result.issues.some((i) => i.code === 'fsm_paths_missing')).toBe(false);
  });
});
```

### Step 2: Run tests to confirm they fail

```bash
pnpm vitest run packages/rb-apps/src/__tests__/lab-submission-gates.test.ts
```

Expected: FAIL — `sequence_proof_missing` and `fsm_paths_missing` codes don't exist yet.

### Step 3: Implement gate checks in `submissionGates.ts`

Two changes needed:

**Change A — Extend `SubmissionValidationRecentRuns`:**

Find the existing interface (around line 24) and add the two new optional fields:

```typescript
export interface SubmissionValidationRecentRuns {
  simulated?: boolean;
  synthesized?: boolean;
  waveformCaptured?: boolean;
  hardwareObserved?: boolean;
  /**
   * Set to true when a clocked_macro verify run completed with >= 16 steps
   * and the full count trajectory was demonstrated. Required for Lab 7.
   */
  sequenceProofRun?: boolean;
  /**
   * Set to true when both a valid FSM path AND an invalid FSM path have been
   * demonstrated via verification. Required for Lab 8.
   */
  fsmPathsRun?: boolean;
}
```

**Change B — Add gate checks at the end of `validateSubmissionForLab`:**

Add the following block immediately before the final `return { verdict: makeVerdict(issues), issues }`:

```typescript
  // sequence-proof gate (Lab 7)
  const hasSequenceProofGate = definition?.submitGates.some((g) => g.id === 'sequence-proof');
  if (hasSequenceProofGate && !input.recentRuns?.sequenceProofRun) {
    issues.push({
      code: 'sequence_proof_missing',
      severity: 'block',
      title: 'Full sequence proof required',
      message:
        'Run at least one full count window (16+ clocked steps proving the counter trajectory) before submitting.',
      fixHint: 'Run Simulate with the Lab 7 sequence checkpoint. Partial runs do not qualify.',
      cta: { label: 'Open Simulate', action: 'openTab', tab: 'simulate' },
      evidence: { key: 'sequenceProofRun', expected: 'true', actual: 'false' },
    });
  }

  // fsm-paths gate (Lab 8)
  const hasFsmPathsGate = definition?.submitGates.some((g) => g.id === 'fsm-paths');
  if (hasFsmPathsGate && !input.recentRuns?.fsmPathsRun) {
    issues.push({
      code: 'fsm_paths_missing',
      severity: 'block',
      title: 'Valid and invalid FSM paths required',
      message:
        'Demonstrate both a valid unlock sequence and an invalid sequence before submitting.',
      fixHint:
        'Run Simulate with both FSM path checkpoints (valid and invalid) and confirm both pass.',
      cta: { label: 'Open Simulate', action: 'openTab', tab: 'simulate' },
      evidence: { key: 'fsmPathsRun', expected: 'true', actual: 'false' },
    });
  }
```

### Step 4: Update `packages/rb-apps/src/labs/submissionGates.js` (JS mirror)

Add the same two fields to the `SubmissionValidationRecentRuns` equivalent (as a comment block documenting intent), and add the gate check logic blocks. The JS mirror has no TypeScript types — just mirror the runtime logic:

```javascript
// In submissionGates.js, add after the existing gate checks (before final return):

  // sequence-proof gate (Lab 7)
  const hasSequenceProofGate = definition?.submitGates.some((g) => g.id === 'sequence-proof');
  if (hasSequenceProofGate && !input.recentRuns?.sequenceProofRun) {
    issues.push({
      code: 'sequence_proof_missing',
      severity: 'block',
      title: 'Full sequence proof required',
      message: 'Run at least one full count window (16+ clocked steps proving the counter trajectory) before submitting.',
      fixHint: 'Run Simulate with the Lab 7 sequence checkpoint. Partial runs do not qualify.',
      cta: { label: 'Open Simulate', action: 'openTab', tab: 'simulate' },
      evidence: { key: 'sequenceProofRun', expected: 'true', actual: 'false' },
    });
  }
  const hasFsmPathsGate = definition?.submitGates.some((g) => g.id === 'fsm-paths');
  if (hasFsmPathsGate && !input.recentRuns?.fsmPathsRun) {
    issues.push({
      code: 'fsm_paths_missing',
      severity: 'block',
      title: 'Valid and invalid FSM paths required',
      message: 'Demonstrate both a valid unlock sequence and an invalid sequence before submitting.',
      fixHint: 'Run Simulate with both FSM path checkpoints (valid and invalid) and confirm both pass.',
      cta: { label: 'Open Simulate', action: 'openTab', tab: 'simulate' },
      evidence: { key: 'fsmPathsRun', expected: 'true', actual: 'false' },
    });
  }
```

### Step 5: Run tests

```bash
pnpm vitest run packages/rb-apps/src/__tests__/lab-submission-gates.test.ts
```

Expected: all tests PASS (including the new 6 added in Step 1).

### Step 6: Commit

```bash
git add packages/rb-apps/src/labs/submissionGates.ts packages/rb-apps/src/labs/submissionGates.js
git add packages/rb-apps/src/__tests__/lab-submission-gates.test.ts
git commit -m "$(cat <<'EOF'
feat(gates): implement sequence-proof and fsm-paths gate enforcement

Lab 7 submissions now block unless sequenceProofRun=true (set by IDE after
a clocked_macro run of >= 16 steps passes). Lab 8 blocks unless fsmPathsRun=true
(both valid + invalid FSM paths demonstrated). Gate IDs were declared in
labDefinitions but unimplemented — this closes the enforcement gap.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add Lab 7 clocked sequence checkpoint vectors

The Lab 7 starter JSON needs a `labSpec.checkpoints` entry with `schedule: 'clocked_macro'` and 16 explicit rows proving the 4-bit counter counts 0→15.

**Files:**
- Modify: `packages/rb-apps/src/examples/22_lab7-sync-counter-starter-basys3.json`

### Step 1: Read the existing file

```bash
cat packages/rb-apps/src/examples/22_lab7-sync-counter-starter-basys3.json | head -40
```

Understand the structure. Look for a `labSpec` key or `meta.labId` key.

### Step 2: Add `labSpec.checkpoints` to the JSON

The checkpoint follows this shape — add it to the JSON's `labSpec.checkpoints` array (create `labSpec` if absent):

```json
"labSpec": {
  "schemaVersion": "1.0",
  "id": "lab-7",
  "title": "Synchronous Counter",
  "objectives": ["Design and verify a 4-bit synchronous binary counter"],
  "checkpoints": [
    {
      "id": "counter-sequence-proof",
      "type": "truth-table",
      "title": "4-bit counter: full sequence proof (0–15)",
      "description": "Drives EN=1, RST=0 across 16 rising CLK edges. Each row expects Q[3:0] to increment. A passing run proves the full count window.",
      "config": {
        "schedule": "clocked_macro",
        "clockSignal": "CLK",
        "inputs": ["EN", "RST"],
        "outputs": ["Q0", "Q1", "Q2", "Q3"],
        "table": [
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": false, "Q1": false, "Q2": false, "Q3": false } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": true,  "Q1": false, "Q2": false, "Q3": false } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": false, "Q1": true,  "Q2": false, "Q3": false } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": true,  "Q1": true,  "Q2": false, "Q3": false } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": false, "Q1": false, "Q2": true,  "Q3": false } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": true,  "Q1": false, "Q2": true,  "Q3": false } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": false, "Q1": true,  "Q2": true,  "Q3": false } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": true,  "Q1": true,  "Q2": true,  "Q3": false } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": false, "Q1": false, "Q2": false, "Q3": true  } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": true,  "Q1": false, "Q2": false, "Q3": true  } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": false, "Q1": true,  "Q2": false, "Q3": true  } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": true,  "Q1": true,  "Q2": false, "Q3": true  } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": false, "Q1": false, "Q2": true,  "Q3": true  } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": true,  "Q1": false, "Q2": true,  "Q3": true  } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": false, "Q1": true,  "Q2": true,  "Q3": true  } },
          { "inputs": { "EN": true,  "RST": false }, "outputs": { "Q0": true,  "Q1": true,  "Q2": true,  "Q3": true  } }
        ]
      },
      "spec": {
        "inputs": ["EN", "RST"],
        "outputs": ["Q0", "Q1", "Q2", "Q3"],
        "expectedTable": []
      }
    }
  ]
}
```

**Note on row design:** Each row drives the same inputs (EN=1, RST=0). The `clocked_macro` schedule pulses CLK automatically per row. So row 0 expects Q=0000 AFTER the first rising edge — this is the initial state captured by the clock. Row 1 expects Q=0001 after the second rising edge, etc. The table encodes the counting sequence 0→1→...→15.

**Important:** The Q0/Q1/Q2/Q3 output signal names must match EXACTLY the labels of the output nodes in the counter circuit. If the starter names them `q0`, `Q[0]`, or `LED0`, adjust accordingly. Read the starter file structure first.

### Step 3: Validate JSON is well-formed

```bash
node -e "JSON.parse(require('fs').readFileSync('packages/rb-apps/src/examples/22_lab7-sync-counter-starter-basys3.json', 'utf8')); console.log('OK')"
```

Expected: `OK`

### Step 4: Commit

```bash
git add packages/rb-apps/src/examples/22_lab7-sync-counter-starter-basys3.json
git commit -m "$(cat <<'EOF'
feat(examples): add clocked_macro sequence checkpoint to Lab 7 starter

16-step verify table proves 4-bit counter counts 0→15 under clocked_macro
schedule. Students must run this checkpoint to satisfy the sequence-proof gate.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add Lab 8 FSM path checkpoints

The Lab 8 starter needs two checkpoints: one for a valid unlock sequence, one for an invalid sequence.

**Files:**
- Modify: `packages/rb-apps/src/examples/23_lab8-fsm-lock-starter-basys3.json`

### Step 1: Read the existing file

```bash
cat packages/rb-apps/src/examples/23_lab8-fsm-lock-starter-basys3.json | head -40
```

Understand the structure. Find the signal names used for X (serial input), CLK, and OPEN (output).

### Step 2: Add `labSpec.checkpoints`

The FSM detects 010 or 100 in a serial bit stream. 4 matches in 12 bits → OPEN=1.

Two separate checkpoint entries — one valid path (stream `1 1 0 0 1 0 0 1 0 1 0 0` = 3 matches → OPEN=0), one valid unlock (stream with 4 exact matches → OPEN=1).

**Important:** The exact signal names (X, CLK, OPEN, etc.) depend on how the Lab 8 starter wires its FSM. Read the starter JSON to find input node labels before finalising the table. If you can't determine the exact labels, use placeholder names and add a `// TODO:` comment in the JSON specifying which node labels to use.

Template structure to add:

```json
"labSpec": {
  "schemaVersion": "1.0",
  "id": "lab-8",
  "title": "Security Lock FSM",
  "objectives": ["Prove valid and invalid FSM path behavior"],
  "checkpoints": [
    {
      "id": "fsm-invalid-path",
      "type": "truth-table",
      "title": "FSM invalid path (3 matches — lock stays closed)",
      "description": "Streams X=110010010100 (12 bits). Detects 3 matches (010 at positions 3-5, 100 at 6-8, 010 at 8-10). OPEN must remain 0.",
      "config": {
        "schedule": "clocked_macro",
        "clockSignal": "CLK",
        "inputs": ["X"],
        "outputs": ["OPEN"],
        "table": [
          { "inputs": { "X": true  }, "outputs": { "OPEN": false } },
          { "inputs": { "X": true  }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": true  }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": true  }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": true  }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } }
        ]
      },
      "spec": { "inputs": ["X"], "outputs": ["OPEN"], "expectedTable": [] }
    },
    {
      "id": "fsm-valid-path",
      "type": "truth-table",
      "title": "FSM valid path (4 matches — lock opens)",
      "description": "Streams 12 bits containing exactly 4 matches of 010 or 100. OPEN must be 1 at final step.",
      "config": {
        "schedule": "clocked_macro",
        "clockSignal": "CLK",
        "inputs": ["X"],
        "outputs": ["OPEN"],
        "table": [
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": true  }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": true  }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": true  }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": true  }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": false } },
          { "inputs": { "X": false }, "outputs": { "OPEN": true  } }
        ]
      },
      "spec": { "inputs": ["X"], "outputs": ["OPEN"], "expectedTable": [] }
    }
  ]
}
```

**Note on valid path design:** The bit stream above is `010 100 010 100` which encodes 4 pattern matches (010, 100, 010, 100). The last bit triggers OPEN=1. The exact implementation of "OPEN goes high" depends on the FSM design — it may go high on bit 12 or after bit 12. Adjust row 12's `OPEN` expectation based on the lab spec (Figure 2 in original PDF: OPEN goes high when both counters reach limit).

### Step 3: Validate JSON

```bash
node -e "JSON.parse(require('fs').readFileSync('packages/rb-apps/src/examples/23_lab8-fsm-lock-starter-basys3.json', 'utf8')); console.log('OK')"
```

### Step 4: Commit

```bash
git add packages/rb-apps/src/examples/23_lab8-fsm-lock-starter-basys3.json
git commit -m "$(cat <<'EOF'
feat(examples): add clocked_macro FSM path checkpoints to Lab 8 starter

Two checkpoints: invalid path (3 matches, OPEN=0 throughout) and valid path
(4 matches, OPEN=1 at final step). Students must run both to satisfy fsm-paths gate.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Parity and determinism tests

These tests prove that the same checkpoint + circuit produces the same result every time, and that the testbench generator still reflects the same schedule.

**Files:**
- Create: `packages/rb-apps/src/fpga/boards/basys3/__tests__/testbench-schedule-parity.test.ts`

### Step 1: Write the parity test

```typescript
import { describe, it, expect } from 'vitest';
import { generateTestbenchVhdl } from '../testbenchGenerator';
import { runTestVectors } from '../vectorRunner';
import type { TestVector } from '@redbyte/rb-utils';

// Minimal RBProject-like structure for testbench generation tests
function makeCounterProject() {
  return {
    circuit: {
      nodes: [
        { id: 'sw_en',  type: 'Switch',  label: 'EN'  },
        { id: 'sw_clk', type: 'Switch',  label: 'CLK' },
        { id: 'sw_rst', type: 'Switch',  label: 'RST' },
        { id: 'q0_out', type: 'Lamp',    label: 'Q0'  },
      ],
      connections: [],
    },
    ioMapping: undefined,
    hdl: { top: 'counter', sources: [{ path: 'counter.vhd', text: 'process(rising_edge(CLK))' }] },
    fpga: { top: 'counter', board: 'basys3' },
  } as any;
}

const COUNTER_VECTORS: TestVector[] = [
  { tick: 0, inputs: { EN: 1, RST: 0 }, expected: { Q0: 0 } },
  { tick: 1, inputs: { EN: 1, RST: 0 }, expected: { Q0: 1 } },
];

describe('testbench schedule parity', () => {
  it('generates clocked_macro TB when circuit has sequential HDL', () => {
    const tb = generateTestbenchVhdl(makeCounterProject(), COUNTER_VECTORS);

    // TB must contain the schedule comment
    expect(tb).toContain('schedule=clocked_macro');

    // TB must contain the CLK_HALF_PERIOD constant for clocked circuits
    expect(tb).toContain('CLK_HALF_PERIOD');

    // TB must contain CLOCKED_MACRO_SEQUENCE (0 → 1 → 0) for CLK
    // The stimulus section pulses CLK
    expect(tb).toContain("CLK <= '0'");
    expect(tb).toContain("CLK <= '1'");
  });

  it('generated TB step count matches vector count', () => {
    const tb = generateTestbenchVhdl(makeCounterProject(), COUNTER_VECTORS);
    const vectorCommentMatches = tb.match(/-- Vector \d+/g) ?? [];
    expect(vectorCommentMatches).toHaveLength(COUNTER_VECTORS.length);
  });

  it('determinism: same project+vectors → same TB bytes', () => {
    const tb1 = generateTestbenchVhdl(makeCounterProject(), COUNTER_VECTORS);
    const tb2 = generateTestbenchVhdl(makeCounterProject(), COUNTER_VECTORS);
    expect(tb1).toBe(tb2);
  });
});
```

### Step 2: Run tests

```bash
pnpm vitest run packages/rb-apps/src/fpga/boards/basys3/__tests__/testbench-schedule-parity.test.ts
```

Expected: all tests PASS. If `testbenchGenerator.ts` doesn't have a `__tests__` directory, create it.

### Step 3: Commit

```bash
git add packages/rb-apps/src/fpga/boards/basys3/__tests__/testbench-schedule-parity.test.ts
git commit -m "$(cat <<'EOF'
test(parity): testbench schedule-parity and determinism gates

Proves TB reflects clocked_macro schedule and is byte-identical across
repeated calls for the same input — closing the verify≠TB divergence footgun.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Full build + test sweep + AI_STATE.md update

### Step 1: Run full build

```bash
pnpm build
```

Expected: exit 0.

### Step 2: Run full test suite

```bash
pnpm vitest run
```

Expected: all PR17-related tests pass. Pre-existing Clock/Delay failures (2) are acceptable and unrelated.

### Step 3: Update `packages/rb-logic-core/src/AI_STATE.md`

Prepend a new change log entry for PR17. Follow the exact format of the existing PR16 entry already in the file.

Key info to include:
- PR17 goal: sequential schedule contract
- Root cause of gap: verifyTruthTable was schedule-unaware; sequence-proof/fsm-paths gates were declared but not enforced
- Files changed: list all files modified in Tasks 1–7
- Validation: build passes, new tests pass, existing tests unchanged

### Step 4: Final commit

```bash
git add packages/rb-logic-core/src/AI_STATE.md
git commit -m "$(cat <<'EOF'
docs(state): update AI_STATE.md with PR17 change log

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Acceptance Criteria Checklist

- [ ] `verifyTruthTable.ts` applies 3-tick clocked_macro sequence when `checkpoint.config.schedule === 'clocked_macro'`
- [ ] `verifyTruthTable.ts` backward-compat: no `schedule` field → combinational (single tick, unchanged)
- [ ] `verifyTruthTable.ts` evidence includes `schedule` field
- [ ] `VerifySchedule` type and `CLOCKED_MACRO_SEQUENCE` live in `@redbyte/rb-utils` (shared)
- [ ] `submissionGates.ts` blocks Lab 7 with `sequence_proof_missing` when `recentRuns.sequenceProofRun` is not true
- [ ] `submissionGates.ts` blocks Lab 8 with `fsm_paths_missing` when `recentRuns.fsmPathsRun` is not true
- [ ] Lab 7 starter JSON includes `counter-sequence-proof` checkpoint with 16 clocked_macro rows
- [ ] Lab 8 starter JSON includes `fsm-invalid-path` and `fsm-valid-path` checkpoints
- [ ] `testbenchGenerator.ts` still derives `clocked_macro` from the same source and emits parity comment
- [ ] All JS mirrors updated in sync with TS changes
- [ ] `pnpm build` exit 0
- [ ] `pnpm vitest run` — all previously passing tests still pass + new tests pass

## What NOT to Do

- Do NOT touch `vectorRunner.ts` — it already handles `clocked_macro` correctly
- Do NOT change `testbenchGenerator.ts` core logic — it already calls `deriveVerifySchedule()` for schedule parity
- Do NOT add a new UI surface or mode
- Do NOT add backend/LMS integration
- Do NOT add waveform visualization
- Do NOT implement the logic that sets `sequenceProofRun`/`fsmPathsRun` to `true` in the IDE (that's the IDE orchestration layer calling the gates — it reads the checkpoint `evidence.schedule` and `trace.length` from a completed run; that wiring belongs to the IDE runtime, not to this PR's engine/gate layer)
