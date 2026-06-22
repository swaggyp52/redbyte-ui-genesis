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
    name: 'verify:truth-integration-gate',
    cmd: 'pnpm',
    args: ['-s', 'verify:truth-integration-gate'],
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
    name: 'ide:gate:project-loaded-paths-first-viewport',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:project-loaded-paths-first-viewport'],
  },
  {
    name: 'ide:gate:project-loaded-command-surface',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:project-loaded-command-surface'],
  },
  {
    name: 'ide:gate:interaction-affordance',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:interaction-affordance'],
  },
  {
    name: 'ide:gate:project-identity-editing',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:project-identity-editing'],
  },
  {
    name: 'ide:gate:v2-student-chrome',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:v2-student-chrome'],
  },
  {
    name: 'ide:gate:active-mode-reload-recovery',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:active-mode-reload-recovery'],
  },
  {
    name: 'ide:gate:student-loop-contract',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:student-loop-contract'],
  },
  {
    name: 'ide:gate:student-task-completion-flow',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:student-task-completion-flow'],
  },
  {
    name: 'ide:gate:authoring-depth-release-safety',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:authoring-depth-release-safety'],
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
    name: 'ide:gate:design-canvas-direct-workbench',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:design-canvas-direct-workbench'],
  },
  {
    name: 'ide:gate:design-workspace-crash-proof',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:design-workspace-crash-proof'],
  },
  {
    name: 'ide:gate:workbench-stability-overhaul',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:workbench-stability-overhaul'],
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
    name: 'ide:gate:verify-saved-checks-default',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:verify-saved-checks-default'],
  },
  {
    name: 'ide:gate:verify-v2-authority-cutover',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:verify-v2-authority-cutover'],
  },
  {
    name: 'ide:gate:verify-authority-phase-3d',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:verify-authority-phase-3d'],
  },
  {
    name: 'ide:gate:verify-sequential-authority-v2',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:verify-sequential-authority-v2'],
  },
  {
    name: 'ide:gate:verify-testbench-usable-layout',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:verify-testbench-usable-layout'],
  },
  {
    name: 'ide:gate:verify-no-circuit-task-first',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:verify-no-circuit-task-first'],
  },
  {
    name: 'ide:gate:verify-workbench-layout-reset',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:verify-workbench-layout-reset'],
  },
  {
    name: 'ide:gate:verify-postrun-workbench-usability',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:verify-postrun-workbench-usability'],
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
    name: 'ide:gate:export-first-viewport-artifacts',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:export-first-viewport-artifacts'],
  },
  {
    name: 'ide:gate:export-package-inspector',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:export-package-inspector'],
  },
  {
    name: 'ide:gate:export-artifact-direct-preview',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:export-artifact-direct-preview'],
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
    name: 'ide:gate:hardware-first-viewport',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:hardware-first-viewport'],
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
    name: 'ide:gate:shell-navigation-overhaul',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:shell-navigation-overhaul'],
  },
  {
    name: 'ide:gate:primary-work-object-dominance',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:primary-work-object-dominance'],
  },
  {
    name: 'ide:gate:nested-scroll-regression',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:nested-scroll-regression'],
  },
  {
    name: 'ide:gate:root-overflow-regression',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:root-overflow-regression'],
  },
  {
    name: 'ide:gate:workbench-reconstruction-v1',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:workbench-reconstruction-v1'],
  },
  {
    name: 'ide:gate:design-dual-tool-windows',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:design-dual-tool-windows'],
  },
  {
    name: 'ide:gate:design-library-not-cropped',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:design-library-not-cropped'],
  },
  {
    name: 'ide:gate:design-tool-window-coexistence',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:design-tool-window-coexistence'],
  },
  {
    name: 'ide:gate:verify-task-plane-usability',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:verify-task-plane-usability'],
  },
  {
    name: 'ide:gate:hardware-board-dominance',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:hardware-board-dominance'],
  },
  {
    name: 'ide:gate:hardware-board-unblocked',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:hardware-board-unblocked'],
  },
  {
    name: 'ide:gate:hardware-resource-catalog-not-obstructing',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:hardware-resource-catalog-not-obstructing'],
  },
  {
    name: 'ide:gate:release-readiness-visual-contract',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:release-readiness-visual-contract'],
  },
  {
    name: 'ide:gate:no-cropped-controls-regression',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:no-cropped-controls-regression'],
  },
  {
    name: 'ide:gate:action-first-entry-surfaces',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:action-first-entry-surfaces'],
  },
  {
    name: 'ide:gate:outer-workflow-action-density',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:outer-workflow-action-density'],
  },
  {
    name: 'ide:gate:card-chrome-regression',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:card-chrome-regression'],
  },
  {
    name: 'ide:gate:release-solidification-v2',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:release-solidification-v2'],
  },
  {
    name: 'ide:gate:browser-e0-packaging-readiness',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:browser-e0-packaging-readiness'],
  },
  {
    name: 'ide:gate:workbench-space-utilization',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:workbench-space-utilization'],
  },
  {
    name: 'ide:gate:workbench-visual-finish',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:workbench-visual-finish'],
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
    name: 'ide:gate:import-guided-recovery-workflow',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:import-guided-recovery-workflow'],
  },
  {
    name: 'ide:gate:import-guided-recovery-wizard',
    cmd: 'pnpm',
    args: ['-s', 'ide:gate:import-guided-recovery-wizard'],
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
  const command = process.platform === 'win32' ? 'cmd.exe' : step.cmd;
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', [step.cmd, ...step.args].join(' ')]
      : step.args;
  const result = spawnSync(command, args, {
    stdio: 'inherit',
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
