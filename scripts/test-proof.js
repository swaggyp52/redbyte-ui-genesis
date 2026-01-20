#!/usr/bin/env node
/**
 * Deterministic proof suite runner.
 * Runs contract, audit, and site sanity checks with a PASS/FAIL summary.
 */

import { spawnSync } from 'child_process';

const steps = [
  {
    name: 'rb-fpga-proof-core',
    command: 'pnpm',
    args: ['--filter', '@redbyte/rb-fpga-proof-core', 'test'],
  },
  {
    name: 'rb-fpga-signing',
    command: 'pnpm',
    args: ['--filter', '@redbyte/rb-fpga-signing', 'test'],
  },
  {
    name: 'rb-fpga-bridge:sim',
    command: 'pnpm',
    args: ['--filter', '@redbyte/fpga-bridge', 'test:sim'],
  },
  {
    name: 'rb-apps:audit',
    command: 'pnpm',
    args: ['--filter', '@redbyte/rb-apps', 'test:audit'],
  },
  {
    name: 'manual-site:sanity',
    command: 'pnpm',
    args: ['--dir', 'apps/manual-site', 'run', 'sanity'],
  },
];

const results = [];

for (const step of steps) {
  const result = spawnSync(step.command, step.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const ok = result.status === 0;
  results.push({ name: step.name, ok });

  if (!ok) {
    const code = typeof result.status === 'number' ? result.status : 1;
    process.exitCode = code;
  }
}

console.log('');
console.log('=== PROOF SUITE SUMMARY ===');
for (const result of results) {
  const status = result.ok ? 'PASS' : 'FAIL';
  console.log(`- ${result.name}: ${status}`);
}

const allPass = results.every((result) => result.ok);
console.log(allPass ? '=== PROOF SUITE PASS ===' : '=== PROOF SUITE FAIL ===');

if (!allPass && process.exitCode === undefined) {
  process.exitCode = 1;
}
