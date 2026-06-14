#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const STEPS = [
  {
    name: 'build',
    cmd: 'pnpm',
    args: ['build'],
  },
  {
    name: 'ide:gate:examples-contract',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:examples-contract'],
  },
  {
    name: 'ide:gate:project-command-center',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:project-command-center'],
  },
  {
    name: 'ide:gate:student-loop-contract',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:student-loop-contract'],
  },
  {
    name: 'ide:gate:design-wire-interaction-contract',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:design-wire-interaction-contract'],
  },
  {
    name: 'ide:gate:design-no-bridge-required',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:design-no-bridge-required'],
  },
  {
    name: 'ide:gate:design-canvas-zoom-integrity',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:design-canvas-zoom-integrity'],
  },
  {
    name: 'ide:gate:design-workbench-integrity',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:design-workbench-integrity'],
  },
  {
    name: 'ide:gate:design-workbench-v1',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:design-workbench-v1'],
  },
  {
    name: 'ide:gate:design-correctness-contract',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:design-correctness-contract'],
  },
  {
    name: 'ide:gate:design-palette-build-contract',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:design-palette-build-contract'],
  },
  {
    name: 'ide:gate:verify-reality-contract',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:verify-reality-contract'],
  },
  {
    name: 'ide:gate:verify-evidence-workbench-integrity',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:verify-evidence-workbench-integrity'],
  },
  {
    name: 'ide:gate:export-download-contract',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:export-download-contract'],
  },
  {
    name: 'ide:gate:export-handoff-station',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:export-handoff-station'],
  },
  {
    name: 'ide:gate:export-e2e-contract',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:export-e2e-contract'],
  },
  {
    name: 'ide:gate:export-trust-integrity',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:export-trust-integrity'],
  },
  {
    name: 'ide:gate:hardware-basys3-workbench',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:hardware-basys3-workbench'],
  },
  {
    name: 'ide:gate:shell-layout-integrity',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:shell-layout-integrity'],
  },
  {
    name: 'ide:gate:shell-workbench-hierarchy',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:shell-workbench-hierarchy'],
  },
  {
    name: 'ide:gate:zip-import-contract',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:zip-import-contract'],
  },
  {
    name: 'ide:gate:import-recovery-contract',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:import-recovery-contract'],
  },
  {
    name: 'determinism-and-parity-suite',
    cmd: 'pnpm',
    args: [
      'exec',
      'vitest',
      'run',
      'packages/rb-lab-engine/src/__tests__/verifyTruthTable.schedule.test.ts',
      'packages/rb-apps/src/export/__tests__/ideSubmissionDeterminism.test.ts',
      'packages/rb-apps/src/__tests__/lab-submission-gates.test.ts',
      'packages/rb-apps/src/__tests__/submission-inspector-submission-bundle.test.tsx',
      'packages/rb-apps/src/import/__tests__/fixture03-sequential-parity.test.ts',
      'packages/rb-apps/src/export/__tests__/parseIdeSubmission.test.ts',
    ],
  },
];

function runStep(step) {
  const started = performance.now();
  const result = spawnSync(step.cmd, step.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      CI_FAST: process.env.CI_FAST ?? '1',
    },
  });
  return {
    ok: (result.status ?? 1) === 0,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function main() {
  const totalStart = performance.now();
  for (const step of STEPS) {
    console.log(`[classroom:gate] START ${step.name}`);
    const result = runStep(step);
    if (!result.ok) {
      console.error(`[classroom:gate] FAIL ${step.name} (${result.elapsedMs}ms)`);
      process.exit(1);
    }
    console.log(`[classroom:gate] PASS ${step.name} (${result.elapsedMs}ms)`);
  }
  console.log(`[classroom:gate] PASS all steps (${Math.round(performance.now() - totalStart)}ms)`);
}

main();
