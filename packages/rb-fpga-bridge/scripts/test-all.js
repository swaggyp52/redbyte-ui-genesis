#!/usr/bin/env node
/**
 * test-all.js
 *
 * Runs a small suite of DUT modes to demonstrate breadth and CI readiness.
 * Exit codes: 0 if all pass, 1 if any fail, 2 on tool error.
 */

import { spawnSync } from 'child_process';
import { resolveRepoPath } from '../src/path-utils.js';

const EXIT_PASS = 0;
const EXIT_FAIL = 1;
const EXIT_INVALID = 2;

const repoRoot = resolveRepoPath('.');

const suites = [
  { name: 'passthrough', vector: 'packages/rb-fpga-bridge/examples/test-basic.json', dut: 'passthrough' },
  { name: 'invert', vector: 'packages/rb-fpga-bridge/examples/test-invert.json', dut: 'invert' },
  { name: 'xor', vector: 'packages/rb-fpga-bridge/examples/test-xor.json', dut: 'xor' },
  { name: 'counter', vector: 'packages/rb-fpga-bridge/examples/test-counter.json', dut: 'counter' },
  { name: 'traffic', vector: 'packages/rb-fpga-bridge/examples/test-traffic-light.json', dut: 'traffic_light_fsm' },
  { name: 'traffic_stateful', vector: 'packages/rb-fpga-bridge/examples/test-traffic-light-stateful.json', dut: 'traffic_light_stateful' }
];

let pass = 0;
let fail = 0;

function runSuite(suite) {
  const args = ['--filter', '@redbyte/fpga-bridge', 'test:vectors', '--', '--board', 'basys3', '--vectors', suite.vector, '--dut', suite.dut, '--no-replay'];
  const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(cmd, args, { cwd: repoRoot, stdio: 'inherit', shell: true });

  if (result.error) {
    console.error(`[SUITE] ERROR spawning ${suite.name}: ${result.error.message}`);
    return EXIT_INVALID;
  }

  if (result.status === 0) {
    pass++;
    return EXIT_PASS;
  } else if (typeof result.status === 'number') {
    fail++;
    return EXIT_FAIL;
  }

  return EXIT_INVALID;
}

for (const suite of suites) {
  const code = runSuite(suite);
  if (code === EXIT_INVALID) {
    console.error('[SUITE] Aborting due to tool error');
    process.exit(EXIT_INVALID);
  }
}

console.log(`[SUITE] total=${suites.length} pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? EXIT_PASS : EXIT_FAIL);
