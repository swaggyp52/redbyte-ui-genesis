#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const STEPS = [
  ['active-mode-reload-recovery', ['-s', 'ide:gate:active-mode-reload-recovery']],
  ['project-loaded-command-center-final', ['-s', 'ide:gate:project-loaded-command-center-final']],
  ['verify-evidence-clarity-final', ['-s', 'ide:gate:verify-evidence-clarity-final']],
  ['node20-proof-status', ['-s', 'ide:gate:node20-proof-status']],
  ['browser-e0-packaging-readiness', ['-s', 'ide:gate:browser-e0-packaging-readiness']],
];

for (const [name, args] of STEPS) {
  console.log(`[ide:gate:release-candidate-decision] START ${name}`);
  const command = process.platform === 'win32' ? 'cmd.exe' : 'pnpm';
  const commandArgs =
    process.platform === 'win32' ? ['/d', '/s', '/c', ['pnpm', ...args].join(' ')] : args;
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    env: { ...process.env },
  });
  if ((result.status ?? 1) !== 0) {
    console.error(`[ide:gate:release-candidate-decision] FAIL ${name}`);
    process.exit(result.status ?? 1);
  }
  console.log(`[ide:gate:release-candidate-decision] PASS ${name}`);
}

console.log('PASS: IDE release-candidate decision gate satisfied.');
