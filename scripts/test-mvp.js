#!/usr/bin/env node
/**
 * Deterministic MVP test runner.
 * Runs FPGA MVP tests and prints a PASS/FAIL summary.
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
console.log('=== MVP TEST SUMMARY ===');
for (const result of results) {
  const status = result.ok ? 'PASS' : 'FAIL';
  console.log(`- ${result.name}: ${status}`);
}

const allPass = results.every((result) => result.ok);
console.log(allPass ? '=== MVP TEST PASS ===' : '=== MVP TEST FAIL ===');

if (!allPass && process.exitCode === undefined) {
  process.exitCode = 1;
}
