// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Lab 8 FSM E2E Proof Test
 *
 * Phase 2 & 3 of the Lab 8 Student Fairness Audit:
 *   - Builds a complete working FSM solution circuit in CircuitV1 format
 *   - Runs both `fsm-invalid-path` and `fsm-valid-path` checkpoints
 *   - Asserts both pass, proving a complete solution IS achievable in RedByte
 *
 * FSM Design: Detect 4 consecutive non-overlapping valid 3-bit groups (010 or 100)
 * in a 12-bit serial stream clocked by ENTER (SW5).
 *
 * Key design constraint: CircuitEngine evaluates nodes in topological order, and
 * cascaded DFlipFlops that form a DAG share signals within a single tick (not true
 * simultaneous sampling). To work around this, this design:
 *   (a) Uses EN-gated DFlipFlops (dff_b_at_p0, dff_b_at_p1) that only capture
 *       at the correct group position, avoiding the cascade issue.
 *   (b) Places all feedback-cyclic nodes in a deliberate array order so that
 *       combinational logic evaluates using OLD (previousSignals) DFF Q values,
 *       while DFFs evaluate using NEW (signalCache) combinational outputs.
 *
 * Node array ordering (determines appended-cycle evaluation order):
 *   1-5: Switches (sorted normally by topological sort)
 *   6:   led_lock (Lamp — sampled via getNodeState after all sub-ticks)
 *   7:   not_in0 (sorted normally: depends only on sw_in0)
 *   [Appended cycle group — evaluated in array order:]
 *   8:   or_pos         (OR of OLD pos0.Q, OLD pos1.Q)
 *   9:   nor_pos_next   (NOT or_pos → D for pos0)
 *  10:   not_p0         (NOT OLD pos0.Q)
 *  11:   not_p1         (NOT OLD pos1.Q)
 *  12:   and_at_p0      (NOT(pos0) AND NOT(pos1) → EN for b_at_p0)
 *  13:   and_at_p1      (pos0 AND NOT(pos1) → EN for b_at_p1)
 *  14:   and_at_p2      (NOT(pos0) AND pos1 → position-2 gate)
 *  15:   xor_bits       (XOR of OLD b_at_p0.Q, OLD b_at_p1.Q)
 *  16:   and_gv1        (and_at_p2.out AND not_in0.out)
 *  17:   and_gv_final   (and_gv1.out AND xor_bits.out = group_valid)
 *  18:   and_m2d        (OLD m1.Q AND group_valid)
 *  19:   and_m3d        (OLD m2.Q AND group_valid)
 *  20:   and_m4d        (OLD m3.Q AND group_valid)
 *  21:   dff_b_at_p0    (captures sw_in0 when EN=at_pos0; pos counter bits stored)
 *  22:   dff_b_at_p1    (captures sw_in0 when EN=at_pos1)
 *  23:   dff_pos1       (D = OLD pos0.Q via previousSignals fallback)
 *  24:   dff_pos0       (D = nor_pos_next.out from signalCache)
 *  25:   dff_m1         (D = group_valid from cache)
 *  26:   dff_m2         (D = and_m2d.out from cache)
 *  27:   dff_m3         (D = and_m3d.out from cache)
 *  28:   dff_m4         (D = and_m4d.out from cache)
 */

import { describe, expect, it } from 'vitest';
import '@redbyte/rb-logic-core'; // register all node behaviors
import { verifyCheckpoint } from '@redbyte/rb-lab-engine';
import type { LabProjectV1, TruthTableCheckpoint } from '@redbyte/rb-utils';

// ---------------------------------------------------------------------------
// Helper: build a unique connection ID
// ---------------------------------------------------------------------------
let connSeq = 0;
function cid() {
  return `conn_${++connSeq}`;
}

// ---------------------------------------------------------------------------
// The complete FSM circuit in CircuitV1 format
// ---------------------------------------------------------------------------
function buildFsmProject(): LabProjectV1 {
  connSeq = 0; // reset for deterministic IDs

  return {
    schemaVersion: '1.0',
    projectId: 'lab8-fsm-proof',
    name: 'Lab 8 FSM Solution Proof',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',

    circuit: {
      schemaVersion: '1.0',

      // ---------------------------------------------------------------
      // NODES — array order matters for cycle-group evaluation order
      // ---------------------------------------------------------------
      nodes: [
        // 1-5: External I/O (same IDs and labels as the Lab 8 starter)
        { id: 'sw_in2',  type: 'Switch',    x:  80, y:  70, label: 'IN2 (SW8)' },
        { id: 'sw_in1',  type: 'Switch',    x:  80, y: 140, label: 'IN1 (SW7)' },
        { id: 'sw_in0',  type: 'Switch',    x:  80, y: 210, label: 'IN0 (SW6)' },
        { id: 'sw_enter',type: 'Switch',    x:  80, y: 280, label: 'ENTER (SW5)' },
        { id: 'sw_reset',type: 'Switch',    x:  80, y: 350, label: 'RESET (SW4)' },

        // 6: Output lamp – must be early so sub-tick 3 settles via previousSignals.m4.Q
        { id: 'led_lock',type: 'Lamp',      x: 920, y: 220, label: 'LOCK (LED1)' },

        // 7: not_in0 (non-cyclic: depends only on sw_in0)
        { id: 'not_in0', type: 'NOT',       x: 260, y: 210 },

        // 8-17: Cycle group — combinational logic using OLD pos/bit values
        // (These end up in the appended section of the topological sort because
        //  they depend on feedback-cycle DFFs that are never processed normally.)
        { id: 'or_pos',       type: 'OR',  x: 300, y: 470 }, // OR(pos0.Q, pos1.Q)
        { id: 'nor_pos_next', type: 'NOT', x: 380, y: 470 }, // NOR(pos0,pos1) → pos0.D
        { id: 'not_p0',       type: 'NOT', x: 300, y: 510 }, // NOT(pos0.Q)
        { id: 'not_p1',       type: 'NOT', x: 300, y: 550 }, // NOT(pos1.Q)
        { id: 'and_at_p0',    type: 'AND', x: 380, y: 530 }, // NOT(p0) AND NOT(p1) → at_pos0
        { id: 'and_at_p1',    type: 'AND', x: 380, y: 570 }, // p0 AND NOT(p1) → at_pos1
        { id: 'and_at_p2',    type: 'AND', x: 380, y: 590 }, // NOT(p0) AND p1 → at_pos2
        { id: 'xor_bits',     type: 'XOR', x: 420, y: 310 }, // XOR(OLD b_at_p0.Q, OLD b_at_p1.Q)
        { id: 'and_gv1',      type: 'AND', x: 500, y: 380 }, // at_pos2 AND NOT(in0)
        { id: 'and_gv_final', type: 'AND', x: 580, y: 350 }, // group_valid = gv1 AND xor_bits

        // 18-20: Milestone AND gates — must be before their respective DFFs
        //        so they read OLD DFF Q from previousSignals (not new signalCache)
        { id: 'and_m2d', type: 'AND', x: 680, y: 330 }, // OLD m1.Q AND group_valid
        { id: 'and_m3d', type: 'AND', x: 680, y: 380 }, // OLD m2.Q AND group_valid
        { id: 'and_m4d', type: 'AND', x: 680, y: 430 }, // OLD m3.Q AND group_valid

        // 21-22: EN-gated bit registers (in cycle: depend on pos counter for EN)
        { id: 'dff_b_at_p0', type: 'DFlipFlop', x: 480, y: 530 }, // bit captured at pos0
        { id: 'dff_b_at_p1', type: 'DFlipFlop', x: 480, y: 590 }, // bit captured at pos1

        // 23-24: Position counter DFFs
        //   dff_pos1 must come BEFORE dff_pos0 so it reads OLD pos0.Q from previousSignals
        { id: 'dff_pos1', type: 'DFlipFlop', x: 480, y: 490 }, // D = OLD pos0.Q
        { id: 'dff_pos0', type: 'DFlipFlop', x: 560, y: 470 }, // D = nor_pos_next (new)

        // 25-28: Milestone counter DFFs — after their AND gates
        { id: 'dff_m1', type: 'DFlipFlop', x: 760, y: 300 },
        { id: 'dff_m2', type: 'DFlipFlop', x: 760, y: 340 },
        { id: 'dff_m3', type: 'DFlipFlop', x: 760, y: 380 },
        { id: 'dff_m4', type: 'DFlipFlop', x: 760, y: 420 },
      ],

      // ---------------------------------------------------------------
      // CONNECTIONS
      // ---------------------------------------------------------------
      connections: [
        // not_in0 ← sw_in0
        { id: cid(), fromNodeId: 'sw_in0',  fromPin: 'out', toNodeId: 'not_in0',      toPin: 'in' },

        // CLK fan-out: sw_enter → all DFlipFlop CLK inputs
        { id: cid(), fromNodeId: 'sw_enter', fromPin: 'out', toNodeId: 'dff_b_at_p0', toPin: 'CLK' },
        { id: cid(), fromNodeId: 'sw_enter', fromPin: 'out', toNodeId: 'dff_b_at_p1', toPin: 'CLK' },
        { id: cid(), fromNodeId: 'sw_enter', fromPin: 'out', toNodeId: 'dff_pos0',    toPin: 'CLK' },
        { id: cid(), fromNodeId: 'sw_enter', fromPin: 'out', toNodeId: 'dff_pos1',    toPin: 'CLK' },
        { id: cid(), fromNodeId: 'sw_enter', fromPin: 'out', toNodeId: 'dff_m1',      toPin: 'CLK' },
        { id: cid(), fromNodeId: 'sw_enter', fromPin: 'out', toNodeId: 'dff_m2',      toPin: 'CLK' },
        { id: cid(), fromNodeId: 'sw_enter', fromPin: 'out', toNodeId: 'dff_m3',      toPin: 'CLK' },
        { id: cid(), fromNodeId: 'sw_enter', fromPin: 'out', toNodeId: 'dff_m4',      toPin: 'CLK' },

        // RST fan-out: sw_reset → all DFlipFlop RST inputs
        { id: cid(), fromNodeId: 'sw_reset', fromPin: 'out', toNodeId: 'dff_b_at_p0', toPin: 'RST' },
        { id: cid(), fromNodeId: 'sw_reset', fromPin: 'out', toNodeId: 'dff_b_at_p1', toPin: 'RST' },
        { id: cid(), fromNodeId: 'sw_reset', fromPin: 'out', toNodeId: 'dff_pos0',    toPin: 'RST' },
        { id: cid(), fromNodeId: 'sw_reset', fromPin: 'out', toNodeId: 'dff_pos1',    toPin: 'RST' },
        { id: cid(), fromNodeId: 'sw_reset', fromPin: 'out', toNodeId: 'dff_m1',      toPin: 'RST' },
        { id: cid(), fromNodeId: 'sw_reset', fromPin: 'out', toNodeId: 'dff_m2',      toPin: 'RST' },
        { id: cid(), fromNodeId: 'sw_reset', fromPin: 'out', toNodeId: 'dff_m3',      toPin: 'RST' },
        { id: cid(), fromNodeId: 'sw_reset', fromPin: 'out', toNodeId: 'dff_m4',      toPin: 'RST' },

        // Data inputs for b_at_p0 and b_at_p1
        { id: cid(), fromNodeId: 'sw_in0', fromPin: 'out', toNodeId: 'dff_b_at_p0', toPin: 'D' },
        { id: cid(), fromNodeId: 'sw_in0', fromPin: 'out', toNodeId: 'dff_b_at_p1', toPin: 'D' },

        // Position counter feedback loop:
        //   dff_pos0.Q → or_pos.a (creates cycle)
        //   dff_pos1.Q → or_pos.b
        //   or_pos.out → nor_pos_next.in → dff_pos0.D
        //   dff_pos0.Q → dff_pos1.D (pos1 captures OLD pos0 via previousSignals fallback)
        { id: cid(), fromNodeId: 'dff_pos0',     fromPin: 'Q',   toNodeId: 'or_pos',       toPin: 'a' },
        { id: cid(), fromNodeId: 'dff_pos1',     fromPin: 'Q',   toNodeId: 'or_pos',       toPin: 'b' },
        { id: cid(), fromNodeId: 'or_pos',       fromPin: 'out', toNodeId: 'nor_pos_next', toPin: 'in' },
        { id: cid(), fromNodeId: 'nor_pos_next', fromPin: 'out', toNodeId: 'dff_pos0',     toPin: 'D' },
        { id: cid(), fromNodeId: 'dff_pos0',     fromPin: 'Q',   toNodeId: 'dff_pos1',     toPin: 'D' },

        // NOT gates for position decoding
        { id: cid(), fromNodeId: 'dff_pos0', fromPin: 'Q', toNodeId: 'not_p0', toPin: 'in' },
        { id: cid(), fromNodeId: 'dff_pos1', fromPin: 'Q', toNodeId: 'not_p1', toPin: 'in' },

        // and_at_p0 = NOT(pos0) AND NOT(pos1)
        { id: cid(), fromNodeId: 'not_p0', fromPin: 'out', toNodeId: 'and_at_p0', toPin: 'a' },
        { id: cid(), fromNodeId: 'not_p1', fromPin: 'out', toNodeId: 'and_at_p0', toPin: 'b' },

        // and_at_p1 = pos0 AND NOT(pos1)
        { id: cid(), fromNodeId: 'dff_pos0', fromPin: 'Q',   toNodeId: 'and_at_p1', toPin: 'a' },
        { id: cid(), fromNodeId: 'not_p1',   fromPin: 'out', toNodeId: 'and_at_p1', toPin: 'b' },

        // and_at_p2 = NOT(pos0) AND pos1
        { id: cid(), fromNodeId: 'not_p0',   fromPin: 'out', toNodeId: 'and_at_p2', toPin: 'a' },
        { id: cid(), fromNodeId: 'dff_pos1', fromPin: 'Q',   toNodeId: 'and_at_p2', toPin: 'b' },

        // EN connections for EN-gated bit registers
        { id: cid(), fromNodeId: 'and_at_p0', fromPin: 'out', toNodeId: 'dff_b_at_p0', toPin: 'EN' },
        { id: cid(), fromNodeId: 'and_at_p1', fromPin: 'out', toNodeId: 'dff_b_at_p1', toPin: 'EN' },

        // xor_bits = XOR(OLD b_at_p0.Q, OLD b_at_p1.Q)
        // (OLD because xor_bits is in cycle, evaluates before dff_b_at_p0/p1 in array)
        { id: cid(), fromNodeId: 'dff_b_at_p0', fromPin: 'Q', toNodeId: 'xor_bits', toPin: 'a' },
        { id: cid(), fromNodeId: 'dff_b_at_p1', fromPin: 'Q', toNodeId: 'xor_bits', toPin: 'b' },

        // group_valid = at_pos2 AND NOT(in0) AND XOR(b_at_p0, b_at_p1)
        { id: cid(), fromNodeId: 'and_at_p2', fromPin: 'out', toNodeId: 'and_gv1',      toPin: 'a' },
        { id: cid(), fromNodeId: 'not_in0',   fromPin: 'out', toNodeId: 'and_gv1',      toPin: 'b' },
        { id: cid(), fromNodeId: 'and_gv1',   fromPin: 'out', toNodeId: 'and_gv_final', toPin: 'a' },
        { id: cid(), fromNodeId: 'xor_bits',  fromPin: 'out', toNodeId: 'and_gv_final', toPin: 'b' },

        // Milestone AND gates (OLD DFF Qs from previousSignals because DFFs come later in array)
        { id: cid(), fromNodeId: 'dff_m1',      fromPin: 'Q',   toNodeId: 'and_m2d', toPin: 'a' },
        { id: cid(), fromNodeId: 'and_gv_final',fromPin: 'out', toNodeId: 'and_m2d', toPin: 'b' },
        { id: cid(), fromNodeId: 'dff_m2',      fromPin: 'Q',   toNodeId: 'and_m3d', toPin: 'a' },
        { id: cid(), fromNodeId: 'and_gv_final',fromPin: 'out', toNodeId: 'and_m3d', toPin: 'b' },
        { id: cid(), fromNodeId: 'dff_m3',      fromPin: 'Q',   toNodeId: 'and_m4d', toPin: 'a' },
        { id: cid(), fromNodeId: 'and_gv_final',fromPin: 'out', toNodeId: 'and_m4d', toPin: 'b' },

        // Milestone DFlipFlop data inputs
        { id: cid(), fromNodeId: 'and_gv_final', fromPin: 'out', toNodeId: 'dff_m1', toPin: 'D' },
        { id: cid(), fromNodeId: 'and_m2d',      fromPin: 'out', toNodeId: 'dff_m2', toPin: 'D' },
        { id: cid(), fromNodeId: 'and_m3d',      fromPin: 'out', toNodeId: 'dff_m3', toPin: 'D' },
        { id: cid(), fromNodeId: 'and_m4d',      fromPin: 'out', toNodeId: 'dff_m4', toPin: 'D' },

        // EN gate: milestone DFFs only update at position 2 (group boundary)
        // This prevents non-position-2 clock pulses from resetting accumulated milestones
        { id: cid(), fromNodeId: 'and_at_p2', fromPin: 'out', toNodeId: 'dff_m1', toPin: 'EN' },
        { id: cid(), fromNodeId: 'and_at_p2', fromPin: 'out', toNodeId: 'dff_m2', toPin: 'EN' },
        { id: cid(), fromNodeId: 'and_at_p2', fromPin: 'out', toNodeId: 'dff_m3', toPin: 'EN' },
        { id: cid(), fromNodeId: 'and_at_p2', fromPin: 'out', toNodeId: 'dff_m4', toPin: 'EN' },

        // Output: LOCK = m4.Q  (led_lock.isOn settled in CLK=0 sub-tick via previousSignals)
        { id: cid(), fromNodeId: 'dff_m4', fromPin: 'Q', toNodeId: 'led_lock', toPin: 'in' },
      ],
    },

    simulation: { tickRate: 10, currentTick: 0, probes: [] },
    evidence: { actions: [], snapshots: [] },

    // Lab spec checkpoints directly from the Lab 8 starter JSON
    labSpec: {
      schemaVersion: '1.0',
      labId: 'lab-8',
      title: 'Lab 8 - Security Lock FSM',
      description: 'FSM solution proof checkpoints.',
      objectives: ['Prove both invalid and valid serial trajectories with ENTER as the clock pulse.'],
      checkpoints: [
        {
          id: 'fsm-invalid-path',
          type: 'truth-table',
          title: 'Invalid path proof',
          description: 'Bitstream 110010010100 on IN0 with IN2/IN1 held low must never unlock.',
          config: {
            schedule: 'clocked_macro',
            clockSignal: 'sw_enter',
            inputs: ['sw_in0', 'sw_in1', 'sw_in2', 'sw_reset'],
            outputs: ['led_lock'],
            table: [
              { inputs: { sw_in0: true,  sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: true,  sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: true,  sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: true,  sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: true,  sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
            ],
          },
          spec: { inputs: ['sw_in0', 'sw_in1', 'sw_in2', 'sw_reset'], outputs: ['led_lock'], expectedTable: [] },
        } as TruthTableCheckpoint,
        {
          id: 'fsm-valid-path',
          type: 'truth-table',
          title: 'Valid path proof',
          description: 'Bitstream 010100010100 on IN0 with IN2/IN1 held low must unlock at the final step.',
          config: {
            schedule: 'clocked_macro',
            clockSignal: 'sw_enter',
            inputs: ['sw_in0', 'sw_in1', 'sw_in2', 'sw_reset'],
            outputs: ['led_lock'],
            table: [
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: true,  sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: true,  sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: true,  sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: true,  sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: false } },
              { inputs: { sw_in0: false, sw_in1: false, sw_in2: false, sw_reset: false }, outputs: { led_lock: true  } },
            ],
          },
          spec: { inputs: ['sw_in0', 'sw_in1', 'sw_in2', 'sw_reset'], outputs: ['led_lock'], expectedTable: [] },
        } as TruthTableCheckpoint,
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Lab 8 FSM E2E Proof (student fairness audit)', () => {
  it('fsm-invalid-path: bitstream 110010010100 never unlocks LOCK', async () => {
    const project = buildFsmProject();
    const invalidCheckpoint = project.labSpec!.checkpoints[0] as TruthTableCheckpoint;

    const result = await verifyCheckpoint(project, invalidCheckpoint);

    if (!result.passed) {
      console.error('[FSM PROOF] Invalid-path failures:', result.failures);
      console.error('[FSM PROOF] Actual outputs:', result.evidence.actual);
    }

    expect(result.passed).toBe(true);
  });

  it('fsm-valid-path: bitstream 010100010100 unlocks LOCK at clock 12', async () => {
    const project = buildFsmProject();
    const validCheckpoint = project.labSpec!.checkpoints[1] as TruthTableCheckpoint;

    const result = await verifyCheckpoint(project, validCheckpoint);

    if (!result.passed) {
      console.error('[FSM PROOF] Valid-path failures:', result.failures);
      console.error('[FSM PROOF] Actual outputs:', result.evidence.actual);
    }

    expect(result.passed).toBe(true);
  });

  it('fsmPathsRun = true when both checkpoints pass (gate integration)', async () => {
    const project = buildFsmProject();
    const [invalidCheckpoint, validCheckpoint] = project.labSpec!.checkpoints as [TruthTableCheckpoint, TruthTableCheckpoint];

    const [invalidResult, validResult] = await Promise.all([
      verifyCheckpoint(project, invalidCheckpoint),
      verifyCheckpoint(project, validCheckpoint),
    ]);

    const fsmPathsRun = invalidResult.passed && validResult.passed;
    expect(fsmPathsRun).toBe(true);
  });
});
