/**
 * EXAMPLE TRUTH CAPTURE
 * Runs each IDE example through the actual vector runner and prints
 * what the simulation actually produces vs. what the vectors expect.
 * Use this to derive correct expected values for "clean green" examples.
 */
import { describe, it, expect } from 'vitest';
import { IDE_EXAMPLES } from '../../apps/ide/examplesCatalog';
import { runTestVectors } from '../../fpga/boards/basys3/vectorRunner';

describe('IDE example truth capture', () => {
  for (const example of IDE_EXAMPLES) {
    it(`[${example.id}] simulates without crash and prints actual outputs`, async () => {
      const result = await runTestVectors(example.circuit, example.vectors);

      console.log(`\n=== ${example.id} (${example.name}) ===`);
      console.log(`schedule: ${result.schedule}`);
      if (result.warningBanner) console.log(`warning: ${result.warningBanner}`);
      console.log(`pass: ${result.pass}`);
      if (result.failures.length > 0) {
        console.log('FAILURES:');
        for (const f of result.failures) {
          console.log(`  tick=${f.tick} signal=${f.signal} expected=${f.expected} actual=${f.actual}`);
        }
      }
      // Print full trace showing actual OUTPUT node states (not just signals)
      // We re-run the sim to capture getNodeState for OUTPUT nodes
      const { TickEngine } = await import('@redbyte/rb-logic-core');
      const rerunEngine = new TickEngine(JSON.parse(JSON.stringify(example.circuit)), { tickRate: 100 });
      const eng = rerunEngine.getEngine();

      const outputNodeIds = example.ioRows.filter(r => r.direction === 'out').map(r => r.nodeId);

      console.log('ACTUAL OUTPUT VALUES per vector tick:');
      for (const vec of example.vectors) {
        // Drive inputs
        for (const [nodeId, val] of Object.entries(vec.inputs)) {
          const state = eng.getNodeState(nodeId) ?? {};
          eng.setNodeState(nodeId, { ...state, isOn: val, value: val });
        }
        eng.tick();
        const row: Record<string, number> = {};
        for (const outId of outputNodeIds) {
          const st = eng.getNodeState(outId) ?? {};
          row[outId] = (st.isOn ?? 0) as number;
        }
        const expected = vec.expected ?? {};
        const match = outputNodeIds.every(id => row[id] === (expected[id] ?? -1));
        console.log(`  tick=${vec.tick} actual=${JSON.stringify(row)} expected=${JSON.stringify(expected)} ${match ? '✓' : '✗ MISMATCH'}`);
      }

      // Just assert it doesn't crash — pass/fail is what we're capturing
      expect(result.trace.length).toBe(example.vectors.length);
    });
  }
});
