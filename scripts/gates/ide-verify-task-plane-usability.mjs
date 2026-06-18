#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const STEPS = [
  ['verify-testbench-usable-layout', ['-s', 'ide:gate:verify-testbench-usable-layout']],
  ['verify-postrun-workbench-usability', ['-s', 'ide:gate:verify-postrun-workbench-usability']],
  ['verify-workbench-layout-reset', ['-s', 'ide:gate:verify-workbench-layout-reset']],
];

for (const [name, args] of STEPS) {
  console.log(`[ide:gate:verify-task-plane-usability] START ${name}`);
  const command = process.platform === 'win32' ? 'cmd.exe' : 'pnpm';
  const commandArgs =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', ['pnpm', ...args].join(' ')]
      : args;
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    env: { ...process.env },
  });
  if ((result.status ?? 1) !== 0) {
    console.error(`[ide:gate:verify-task-plane-usability] FAIL ${name}`);
    process.exit(result.status ?? 1);
  }
  console.log(`[ide:gate:verify-task-plane-usability] PASS ${name}`);
}

console.log('PASS: IDE Verify task-plane usability satisfied.');
