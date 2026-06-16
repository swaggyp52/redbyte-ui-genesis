import { execSync } from 'node:child_process';

const GATE_TIMEOUT_MS = 300_000;

function runGate(name, command, blocking) {
  const label = name.toUpperCase();
  try {
    execSync(command, { stdio: 'pipe', timeout: GATE_TIMEOUT_MS, encoding: 'utf8' });
    return { name, label, pass: true, blocking, details: '' };
  } catch (error) {
    const exitCode = typeof error?.status === 'number' ? `exit=${error.status}` : '';
    const signal = typeof error?.signal === 'string' ? `signal=${error.signal}` : '';
    const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
    const details = [exitCode, signal, stdout, stderr].filter(Boolean).join('\n');
    return { name, label, pass: false, blocking, details };
  }
}

function main() {
  console.log('[verify:gates:classroom] Starting classroom gate suite...\n');
  const screenshotStrict = process.env.SCREENSHOT_STRICT === '1';

  const results = [
    runGate('no-solution:lab1', 'pnpm -s ci:no-solution:lab1', true),
    runGate('no-solution:lab2', 'pnpm -s ci:no-solution:lab2', true),
    runGate('no-solution:lab3', 'pnpm -s ci:no-solution:lab3', true),
    runGate('rehearse:lab4', 'pnpm -s classroom:rehearse:lab4', true),
    runGate('no-solution:lab4', 'pnpm -s ci:no-solution:lab4', true),
    runGate('smoke:labs-5-8', 'pnpm -s classroom:smoke:labs-5-8', true),
    runGate('no-solution:lab5', 'pnpm -s ci:no-solution:lab5', true),
    runGate('no-solution:lab6', 'pnpm -s ci:no-solution:lab6', true),
    runGate('no-solution:lab7', 'pnpm -s ci:no-solution:lab7', true),
    runGate('no-solution:lab8', 'pnpm -s ci:no-solution:lab8', true),
    runGate('golden-basys3-export', 'pnpm -s rc:e1:golden-basys3-export-gate', true),
    runGate('golden-basys3-alu-export', 'pnpm -s rc:e1:golden-basys3-alu-export-gate', true),
    runGate('dev-guards', 'pnpm -s ui:dev-guards-contract-gate', true),
    runGate('ide:boot-shadow-contract', 'pnpm -s gates:ide-boot-shadow-contract', true),
    // PHASE 5: New IDE unification gates
    runGate('ide:route-contract', 'pnpm -s ide:gate:route-contract', true),
    runGate('ide:layout-contract', 'pnpm -s ide:gate:layout-contract', true),
    runGate('ide:workbench-layout-contract', 'pnpm -s ide:gate:workbench-layout-contract', true),
    runGate('ide:design-build-contract', 'pnpm -s ide:gate:design-build-contract', true),
    runGate('ide:design-workbench-contract', 'pnpm -s ide:gate:design-workbench-contract', true),
    runGate('ide:design-fit-contract', 'pnpm -s ide:gate:design-fit-contract', true),
    runGate('ide:design-no-bridge-required', 'pnpm -s ide:gate:design-no-bridge-required', true),
    runGate('ide:design-canvas-zoom-integrity', 'pnpm -s ide:gate:design-canvas-zoom-integrity', true),
    runGate('ide:design-workbench-integrity', 'pnpm -s ide:gate:design-workbench-integrity', true),
    runGate('ide:design-workbench-v1', 'pnpm -s ide:gate:design-workbench-v1', true),
    runGate('ide:design-build-fast-contract', 'pnpm -s ide:gate:design-build-fast-contract', true),
    runGate('ide:design-live-sim-contract', 'pnpm -s ide:gate:design-live-sim-contract', true),
    runGate('ide:live-sim-contract', 'pnpm -s ide:gate:live-sim-contract', true),
    runGate('ide:seq-sim-contract', 'pnpm -s ide:gate:seq-sim-contract', true),
    runGate('ide:design-multiselect-contract', 'pnpm -s ide:gate:design-multiselect-contract', true),
    runGate('ide:design-inspector-contract', 'pnpm -s ide:gate:design-inspector-contract', true),
    runGate('ide:project-overview-contract', 'pnpm -s ide:gate:project-overview-contract', true),
    runGate('ide:project-command-center', 'pnpm -s ide:gate:project-command-center', true),
    runGate('ide:interaction-affordance', 'pnpm -s ide:gate:interaction-affordance', true),
    runGate('ide:project-identity-editing', 'pnpm -s ide:gate:project-identity-editing', true),
    runGate('ide:side-dock-affordance', 'pnpm -s ide:gate:side-dock-affordance', true),
    runGate('ide:open-side-panel-density', 'pnpm -s ide:gate:open-side-panel-density', true),
    runGate('ide:active-mode-reload-recovery', 'pnpm -s ide:gate:active-mode-reload-recovery', true),
    runGate('ide:project-health-live-contract', 'pnpm -s ide:gate:project-health-live-contract', true),
    runGate('ide:project-continue-cta-contract', 'pnpm -s ide:gate:project-continue-cta-contract', true),
    runGate('ide:persistence-contract', 'pnpm -s ide:gate:persistence-contract', true),
    runGate('ide:examples-contract', 'pnpm -s ide:gate:examples-contract', true),
    runGate('ide:design-system-contract', 'pnpm -s ide:gate:design-system-contract', true),
    runGate('ide:shell-chrome-contract', 'pnpm -s ide:gate:shell-chrome-contract', true),
    runGate('ide:shell-density-contract', 'pnpm -s ide:gate:shell-density-contract', true),
    runGate('ide:canvas-legibility-contract', 'pnpm -s ide:gate:canvas-legibility-contract', true),
    runGate('ide:console-autocollapse-contract', 'pnpm -s ide:gate:console-autocollapse-contract', true),
    ...(screenshotStrict
      ? [runGate('ide:screenshot-baselines', 'pnpm -s ide:gate:screenshots', true)]
      : [
          {
            name: 'ide:screenshot-baselines',
            label: 'IDE:SCREENSHOT-BASELINES',
            pass: true,
            blocking: false,
            details: 'Skipped by default (set SCREENSHOT_STRICT=1 to enforce).',
          },
        ]),
    runGate('ide:verify-contract', 'pnpm -s ide:gate:verify-contract', true),
    runGate('ide:verify-saved-checks-default', 'pnpm -s ide:gate:verify-saved-checks-default', true),
    runGate('ide:synth-subset-contract', 'pnpm -s ide:gate:synth-subset-contract', true),
    runGate('ide:vivado-pack-contract', 'pnpm -s ide:gate:vivado-pack-contract', true),
    runGate(
      'ide:export-includes-rbproj-contract',
      'pnpm -s ide:gate:export-includes-rbproj-contract',
      true
    ),
    runGate('ide:zip-import-contract', 'pnpm -s ide:gate:zip-import-contract', true),
    runGate('ide:import-recovery-contract', 'pnpm -s ide:gate:import-recovery-contract', true),
    runGate('ide:bringup-contract', 'pnpm -s ide:gate:bringup-contract', true),
    runGate('ide:verify-evidence-workbench-integrity', 'pnpm -s ide:gate:verify-evidence-workbench-integrity', true),
    runGate('ide:verify-workbench-contract', 'pnpm -s ide:gate:verify-workbench-contract', true),
    runGate('ide:verify-summary-contract', 'pnpm -s ide:gate:verify-summary-contract', true),
    runGate('ide:evidence-capsule-contract', 'pnpm -s ide:gate:evidence-capsule-contract', true),
    runGate('ide:export-artifact-explorer-contract', 'pnpm -s ide:gate:export-artifact-explorer-contract', true),
    runGate('ide:export-handoff-station', 'pnpm -s ide:gate:export-handoff-station', true),
    runGate(
      'ide:export-first-viewport-artifacts',
      'pnpm -s ide:gate:export-first-viewport-artifacts',
      true
    ),
    runGate(
      'ide:export-artifact-direct-preview',
      'pnpm -s ide:gate:export-artifact-direct-preview',
      true
    ),
    runGate('ide:export-blockers-contract', 'pnpm -s ide:gate:export-blockers-contract', true),
    runGate('ide:export-ready-contract', 'pnpm -s ide:gate:export-ready-contract', true),
    runGate('ide:export-download-contract', 'pnpm -s ide:gate:export-download-contract', true),
    runGate('ide:export-trust-integrity', 'pnpm -s ide:gate:export-trust-integrity', true),
    runGate('ide:hardware-basys3-workbench', 'pnpm -s ide:gate:hardware-basys3-workbench', true),
    runGate('ide:hardware-first-viewport', 'pnpm -s ide:gate:hardware-first-viewport', true),
    runGate('ide:hardware-checklist-contract', 'pnpm -s ide:gate:hardware-checklist-contract', true),
    runGate('ide:student-loop-contract', 'pnpm -s ide:gate:student-loop-contract', true),
    runGate('ide:viewport-overflow-contract', 'pnpm -s ide:gate:viewport-overflow-contract', true),
    runGate('ide:shell-layout-integrity', 'pnpm -s ide:gate:shell-layout-integrity', true),
    runGate('ide:shell-workbench-hierarchy', 'pnpm -s ide:gate:shell-workbench-hierarchy', true),
    runGate('ide:workbench-space-utilization', 'pnpm -s ide:gate:workbench-space-utilization', true),
    runGate('ide:workbench-visual-finish', 'pnpm -s ide:gate:workbench-visual-finish', true),
    runGate('ide:primary-cta-contract', 'pnpm -s ide:gate:primary-cta-contract', true),
    runGate('ide:diagnostics-jump-contract', 'pnpm -s ide:gate:diagnostics-jump-contract', true),
    runGate('ide:visual-contract', 'pnpm -s ide:gate:visual-contract', true),
    runGate('ide:shell-structure', 'pnpm -s ide:gate:shell-structure', true),
    runGate('ide:fullscreen-no-chrome', 'pnpm -s ide:gate:fullscreen-no-chrome', true),
    runGate('ide:default-launcher-hidden', 'pnpm -s ide:gate:default-launcher-hidden', true),
    runGate('ide:lab4-load-fast', 'pnpm -s ide:gate:lab4-load-fast', true),
    runGate('ide:export-generates-hdl', 'pnpm -s ide:gate:export-generates-hdl', true),
    runGate('ide:import-renders-schematic', 'pnpm -s ide:gate:import-renders-schematic', true),
  ];

  console.log('\n======= CLASSROOM GATES =======');
  for (const result of results) {
    const status = result.pass ? 'PASS' : 'FAIL';
    console.log(`  ${result.label}: ${status}`);
    if (!result.pass && result.details) {
      console.log(`    ${result.details.split('\n').join('\n    ')}`);
    }
  }

  const blockingFail = results.some((result) => result.blocking && !result.pass);
  const finalVerdict = blockingFail ? 'FAIL' : 'PASS';
  console.log(`  FINAL: ${finalVerdict}`);
  console.log('===============================\n');

  if (blockingFail) {
    process.exit(1);
  }
}

main();
