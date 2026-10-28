// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { elaborateCircuit } from '@redbyte/rb-logic-core';
import { canonicalizeSemanticCircuit } from '../../../circuit/semanticCircuit';
import { IDE_EXAMPLES } from '../examplesCatalog';
import { elaborateProjectHierarchy } from '../projectHierarchy';
import { useProjectRuntime } from '../projectRuntime';
import { BROWSER_ENGINE_VERSION } from '../runDeterminism';

/**
 * Golden identities of the shipped examples under engine v3. A change here is a change to what
 * a shipped design is, or to how RedByte names it: it needs an intentional, versioned reason.
 *
 * Provenance (scratchpad evidence int-014/identity-before|after): against 879473316 (before
 * RB-DEBT-014/016) every RunIdentity design and stimulus digest, output digest and sample count
 * is unchanged; only the engine tag moved v2 -> v3. irHash changed for five examples because
 * RB-DEBT-016 orders the IR by codepoint instead of collation (their ids sort differently); the
 * prior values are noted. lab1..lab7 share one irHash: they are starters whose IR holds no
 * logic yet (their design digests differ).
 */
const GOLDEN = new Map<string, { irHash: string; design: string; stimulus: string; output: string; samples: number }>([
  ['signal-tour', { irHash: '178noli', design: 'f04063d3', stimulus: '1d1acc6f', output: '04d4d993', samples: 8 }],
  ['logic-gates', { irHash: '1p5jnoo', design: 'beff8b7b', stimulus: 'fb60b8b3', output: '7d0a3ac3', samples: 4 }], // irHash was 1udycdk before RB-DEBT-016
  ['two-bit-counter', { irHash: '18v7zsv', design: '2f60265b', stimulus: '41c8c473', output: 'a25ceec1', samples: 8 }], // irHash was yr8wfj before RB-DEBT-016
  ['half-adder', { irHash: '17w4f86', design: 'edbccd86', stimulus: 'eb4e0912', output: '287ee25c', samples: 4 }], // irHash was 15t9ety before RB-DEBT-016
  ['full-adder', { irHash: '1da4kie', design: '55d5934b', stimulus: '0648723d', output: 'd91b0561', samples: 8 }], // irHash was iq60t6 before RB-DEBT-016
  ['four-bit-adder-hierarchical', { irHash: 'xdmrra', design: 'bb4746b2', stimulus: 'a3fbbc7e', output: 'b14017f7', samples: 6 }],
  ['four-bit-adder', { irHash: 'jqo841', design: '792f7941', stimulus: 'f61b1920', output: 'f1851adb', samples: 4 }],
  ['lab1-gates', { irHash: 'enm5oc', design: '23c0cb31', stimulus: 'c3d9440c', output: '741638a5', samples: 0 }],
  ['lab2-combinational', { irHash: 'enm5oc', design: '14798373', stimulus: 'c3d9440c', output: '741638a5', samples: 0 }],
  ['lab3-mux', { irHash: 'enm5oc', design: '1fba85f8', stimulus: 'c3d9440c', output: '741638a5', samples: 0 }],
  ['lab4-decoder', { irHash: 'enm5oc', design: '6425f021', stimulus: 'c3d9440c', output: '741638a5', samples: 0 }],
  ['lab5-adder', { irHash: 'enm5oc', design: 'a589a970', stimulus: '257e4daf', output: '743d1bf7', samples: 4 }],
  ['lab6-full-adder', { irHash: 'enm5oc', design: '6e35c7ac', stimulus: '203d1498', output: 'f4eefc9d', samples: 8 }],
  ['lab7-comparator', { irHash: 'enm5oc', design: '0412dfcc', stimulus: 'd7813896', output: 'dfa35411', samples: 4 }],
  ['23_lab8-fsm-lock-starter-basys3', { irHash: 'i2mb9i', design: 'eec80740', stimulus: '45aff0c8', output: '1e3a407e', samples: 76 }], // irHash was mmkae2 before RB-DEBT-016; stimulus was 3d84bf03 before the tick-74 LOCK expectation was corrected to the edge row (lab8 starter, 2026-10-28)
]);

describe('shipped example identities (engine v3)', () => {
  beforeEach(() => localStorage.clear());

  it('pins every shipped example, and no other', () => {
    expect(IDE_EXAMPLES.map((example) => example.id).sort()).toEqual([...GOLDEN.keys()].sort());
  });

  it.each(IDE_EXAMPLES.map((example) => [example.id] as const))('%s keeps its identities', (exampleId) => {
    useProjectRuntime.getState().loadExample(exampleId);
    const state = useProjectRuntime.getState();
    const circuit = canonicalizeSemanticCircuit(elaborateProjectHierarchy(state.circuit, state.hierarchy));
    const run = state.runVerification({ scenarioId: state.activeScenarioId, scenarioName: 'Identity',
      deterministicHash: 'identity', rows: [], ranAtIso: '2026-10-28T00:00:00.000Z' });
    expect(run.identity?.engine).toBe(BROWSER_ENGINE_VERSION);
    expect({ irHash: elaborateCircuit(circuit).ir.irHash, design: run.identity?.design, stimulus: run.identity?.stimulus,
      output: run.outputDigest, samples: run.waveform.length }).toEqual(GOLDEN.get(exampleId));
  });
});
