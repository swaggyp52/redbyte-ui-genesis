/**
 * Signal Inventory Contract Tests
 *
 * These tests enforce the invariants for the VerifyPreRunInventory contract:
 *
 * 1. signalInventory is present whenever vectors exist (dev-mode warning contract).
 * 2. Pre-run state carries correct assertion counts (assertedOutputCount, totalAssertionCount).
 * 3. Sequential designs expose clock policy and clockSignalName.
 * 4. Stimulus-only designs (no expected values) still produce a valid inventory.
 * 5. Lane directions are derived from liveSignalRoles — inputs never become asserted.
 * 6. signalInventory is undefined when no vectors are defined.
 *
 * These tests target the pure inventory-computation logic directly.
 * The computation lives in VerifySurface.tsx as a useMemo; here we replicate
 * the same pure function so we can test it without mounting the component.
 */

import { describe, it, expect } from 'vitest';
import type { TestVector } from '@redbyte/rb-utils';
import type { VerifyPreRunInventory, VerifySignalLane } from '../viewmodels/buildVerifySessionViewModel';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import type { VerifyScenario } from '../verifyScenario';

// ---------------------------------------------------------------------------
// Pure replica of the signalInventory computation from VerifySurface useMemo.
// Must stay in sync with the production implementation.
// ---------------------------------------------------------------------------

function computeSignalInventory(
  activeScenario: VerifyScenario | null | undefined,
  liveSignalRoles: Record<string, 'clock' | 'reset' | 'input' | 'output'> | undefined,
  scheduleContract: VerifyScheduleContract | undefined
): VerifyPreRunInventory | undefined {
  const vectors = activeScenario?.vectors ?? [];
  if (vectors.length === 0) return undefined;

  const inputKeys = new Set<string>();
  const outputKeys = new Set<string>();
  const assertedOutputs = new Set<string>();
  let totalAssertionCount = 0;

  for (const v of vectors) {
    for (const key of Object.keys(v.inputs ?? {})) {
      inputKeys.add(key);
    }
    for (const [key, val] of Object.entries(v.expected ?? {})) {
      outputKeys.add(key);
      if (val !== null && val !== undefined) {
        assertedOutputs.add(key);
        totalAssertionCount++;
      }
    }
  }

  const roles = liveSignalRoles ?? {};
  for (const [key, role] of Object.entries(roles)) {
    if (role === 'output' && !outputKeys.has(key) && !inputKeys.has(key)) {
      outputKeys.add(key);
    }
  }

  const lanes: VerifySignalLane[] = [];
  for (const key of Array.from(inputKeys).sort()) {
    const role = roles[key];
    if (role === 'clock' || role === 'reset') continue;
    lanes.push({ name: key, direction: 'input', isAsserted: false });
  }
  for (const key of Array.from(outputKeys).sort()) {
    lanes.push({ name: key, direction: 'output', isAsserted: assertedOutputs.has(key) });
  }

  const isClocked =
    scheduleContract != null
      ? scheduleContract.reason === 'circuit-sequential' || scheduleContract.reason === 'hdl-sequential'
      : Object.values(roles).some((r) => r === 'clock');

  const clockPolicy: VerifyPreRunInventory['clockPolicy'] = isClocked ? 'clocked' : 'combinational';
  const clockSignalName: string | undefined = isClocked
    ? (scheduleContract?.clockSignalName ??
        Object.entries(roles).find(([, r]) => r === 'clock')?.[0])
    : undefined;

  return {
    lanes,
    tickCount: vectors.length,
    assertedOutputCount: assertedOutputs.size,
    totalAssertionCount,
    clockPolicy,
    clockSignalName,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScenario(vectors: TestVector[]): VerifyScenario {
  return {
    id: 'test-scenario',
    name: 'Test',
    vectors,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 1. Inventory is undefined when vectors are empty
// ---------------------------------------------------------------------------

describe('signalInventory absent when no vectors', () => {
  it('returns undefined for null scenario', () => {
    expect(computeSignalInventory(null, {}, undefined)).toBeUndefined();
  });

  it('returns undefined for scenario with empty vector array', () => {
    const scenario = makeScenario([]);
    expect(computeSignalInventory(scenario, {}, undefined)).toBeUndefined();
  });

  it('returns defined inventory when vectors exist', () => {
    const scenario = makeScenario([{ tick: 0, inputs: { sw0: 0 }, expected: {} }]);
    expect(computeSignalInventory(scenario, {}, undefined)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Assertion counts are correct
// ---------------------------------------------------------------------------

describe('assertion count contract', () => {
  it('counts zero assertions for stimulus-only vectors', () => {
    const scenario = makeScenario([
      { tick: 0, inputs: { sw0: 0 }, expected: {} },
      { tick: 1, inputs: { sw0: 1 }, expected: {} },
    ]);
    const inv = computeSignalInventory(scenario, {}, undefined)!;
    expect(inv.assertedOutputCount).toBe(0);
    expect(inv.totalAssertionCount).toBe(0);
  });

  it('counts distinct asserted outputs (not total ticks)', () => {
    const scenario = makeScenario([
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0, ld1: 1 } },
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1, ld1: 0 } },
    ]);
    const inv = computeSignalInventory(scenario, {}, undefined)!;
    // 2 distinct output signals with assertions
    expect(inv.assertedOutputCount).toBe(2);
    // 4 total expected entries (2 outputs × 2 ticks)
    expect(inv.totalAssertionCount).toBe(4);
  });

  it('handles partial assertions — some outputs asserted, some not', () => {
    const scenario = makeScenario([
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ]);
    // ld1 appears in roles as output but has no expected values
    const roles: Record<string, 'output'> = { ld1: 'output' };
    const inv = computeSignalInventory(scenario, roles, undefined)!;
    expect(inv.assertedOutputCount).toBe(1);         // only ld0
    expect(inv.totalAssertionCount).toBe(2);          // 1 output × 2 ticks

    const ld0Lane = inv.lanes.find((l) => l.name === 'ld0');
    const ld1Lane = inv.lanes.find((l) => l.name === 'ld1');
    expect(ld0Lane?.isAsserted).toBe(true);
    expect(ld1Lane?.isAsserted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Lane directions are correct
// ---------------------------------------------------------------------------

describe('lane direction contract', () => {
  it('input signals get direction=input and isAsserted=false', () => {
    const scenario = makeScenario([
      { tick: 0, inputs: { sw0: 0, sw1: 1 }, expected: { ld0: 0 } },
    ]);
    const inv = computeSignalInventory(scenario, {}, undefined)!;
    const inputLanes = inv.lanes.filter((l) => l.direction === 'input');
    expect(inputLanes.map((l) => l.name).sort()).toEqual(['sw0', 'sw1']);
    for (const lane of inputLanes) {
      expect(lane.isAsserted).toBe(false);
    }
  });

  it('output signals in expected get direction=output', () => {
    const scenario = makeScenario([
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0, ld1: 1 } },
    ]);
    const inv = computeSignalInventory(scenario, {}, undefined)!;
    const outputLanes = inv.lanes.filter((l) => l.direction === 'output');
    expect(outputLanes.map((l) => l.name).sort()).toEqual(['ld0', 'ld1']);
  });

  it('clock and reset signals are excluded from lanes', () => {
    const scenario = makeScenario([
      { tick: 0, inputs: { clk: 0, rst: 0, sw0: 0 }, expected: { ld0: 0 } },
    ]);
    const roles: Record<string, 'clock' | 'reset' | 'input'> = {
      clk: 'clock',
      rst: 'reset',
      sw0: 'input',
    };
    const inv = computeSignalInventory(scenario, roles, undefined)!;
    const laneNames = inv.lanes.map((l) => l.name);
    expect(laneNames).not.toContain('clk');
    expect(laneNames).not.toContain('rst');
    expect(laneNames).toContain('sw0');
  });

  it('output signals from liveSignalRoles (not in vectors expected) appear as non-asserted output lanes', () => {
    const scenario = makeScenario([
      { tick: 0, inputs: { sw0: 0 }, expected: {} },
    ]);
    const roles: Record<string, 'output'> = { ld0: 'output', ld1: 'output' };
    const inv = computeSignalInventory(scenario, roles, undefined)!;
    const outputLanes = inv.lanes.filter((l) => l.direction === 'output');
    expect(outputLanes.map((l) => l.name).sort()).toEqual(['ld0', 'ld1']);
    for (const lane of outputLanes) {
      expect(lane.isAsserted).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Clock policy
// ---------------------------------------------------------------------------

describe('clock policy contract', () => {
  it('reports combinational when scheduleContract reason is combinational', () => {
    const scenario = makeScenario([{ tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }]);
    const contract = { reason: 'combinational' } as Pick<VerifyScheduleContract, 'reason'>;
    const inv = computeSignalInventory(scenario, {}, contract as VerifyScheduleContract)!;
    expect(inv.clockPolicy).toBe('combinational');
    expect(inv.clockSignalName).toBeUndefined();
  });

  it('reports clocked when scheduleContract reason is circuit-sequential', () => {
    const scenario = makeScenario([{ tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }]);
    const contract = {
      reason: 'circuit-sequential',
      clockSignalName: 'clk',
    } as Pick<VerifyScheduleContract, 'reason' | 'clockSignalName'>;
    const inv = computeSignalInventory(scenario, {}, contract as VerifyScheduleContract)!;
    expect(inv.clockPolicy).toBe('clocked');
    expect(inv.clockSignalName).toBe('clk');
  });

  it('reports clocked when scheduleContract reason is hdl-sequential', () => {
    const scenario = makeScenario([{ tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }]);
    const contract = {
      reason: 'hdl-sequential',
      clockSignalName: 'sys_clk',
    } as Pick<VerifyScheduleContract, 'reason' | 'clockSignalName'>;
    const inv = computeSignalInventory(scenario, {}, contract as VerifyScheduleContract)!;
    expect(inv.clockPolicy).toBe('clocked');
    expect(inv.clockSignalName).toBe('sys_clk');
  });

  it('infers clocked from liveSignalRoles when no scheduleContract is available', () => {
    const scenario = makeScenario([{ tick: 0, inputs: { clk: 0, sw0: 0 }, expected: {} }]);
    const roles: Record<string, 'clock' | 'input'> = { clk: 'clock', sw0: 'input' };
    const inv = computeSignalInventory(scenario, roles, undefined)!;
    expect(inv.clockPolicy).toBe('clocked');
    expect(inv.clockSignalName).toBe('clk');
  });

  it('combinational when no clock role and no scheduleContract', () => {
    const scenario = makeScenario([{ tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }]);
    const inv = computeSignalInventory(scenario, {}, undefined)!;
    expect(inv.clockPolicy).toBe('combinational');
    expect(inv.clockSignalName).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Tick count
// ---------------------------------------------------------------------------

describe('tick count contract', () => {
  it('tickCount equals the number of vectors in the scenario', () => {
    const vectors: TestVector[] = Array.from({ length: 5 }, (_, i) => ({
      tick: i,
      inputs: { sw0: (i % 2) as 0 | 1 },
      expected: {},
    }));
    const scenario = makeScenario(vectors);
    const inv = computeSignalInventory(scenario, {}, undefined)!;
    expect(inv.tickCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 6. signalInventory presence implies dev-mode contract can be fulfilled
// ---------------------------------------------------------------------------

describe('signalInventory presence contract', () => {
  it('is always defined when scenario has at least one vector', () => {
    const scenario = makeScenario([{ tick: 0, inputs: { sw0: 0 }, expected: {} }]);
    const inv = computeSignalInventory(scenario, {}, undefined);
    expect(inv).toBeDefined();
  });

  it('has at least one lane when vectors contain inputs', () => {
    const scenario = makeScenario([{ tick: 0, inputs: { sw0: 0, sw1: 0 }, expected: {} }]);
    const inv = computeSignalInventory(scenario, {}, undefined)!;
    expect(inv.lanes.length).toBeGreaterThan(0);
  });
});
