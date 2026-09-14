#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const STEPS = [
  'verify-testbench-usable-layout',
  'verify-postrun-workbench-usability',
  'verify-workbench-layout-reset',
];

for (const name of STEPS) {
  console.log(`[ide:gate:verify-task-plane-usability] START ${name}`);
  const result = spawnSync(process.execPath, [`scripts/gates/ide-${name}.mjs`], {
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
