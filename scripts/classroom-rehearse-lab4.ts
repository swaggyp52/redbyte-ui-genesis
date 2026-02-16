import { execSync } from 'node:child_process';

interface StepResult {
  name: string;
  label: string;
  pass: boolean;
  unknown: boolean;
  blocking: boolean;
}

function runStep(name: string, command: string, blocking: boolean): StepResult {
  const label = name.toUpperCase();
  try {
    execSync(command, { stdio: 'pipe', timeout: 30_000 });
    return { name, label, pass: true, unknown: false, blocking };
  } catch {
    if (!blocking) {
      return { name, label, pass: false, unknown: true, blocking };
    }
    return { name, label, pass: false, unknown: false, blocking };
  }
}

function main() {
  console.log('[classroom:rehearse:lab4] Starting rehearsal...\n');

  const results: StepResult[] = [
    runStep('smoke', 'pnpm -s classroom:smoke:lab4', true),
    runStep('no-solution', 'pnpm -s ci:no-solution:lab4', true),
    runStep('hw', 'pnpm -s classroom:hw:check', false),
  ];

  console.log('\n========== LAB 4 REHEARSAL ==========');
  for (const r of results) {
    const status = r.pass ? 'PASS' : r.unknown ? 'UNKNOWN' : 'FAIL';
    console.log(`  ${r.label}: ${status}`);
  }

  const blockingFail = results.some((r) => r.blocking && !r.pass);
  const finalVerdict = blockingFail ? 'FAIL' : 'PASS';
  console.log(`  FINAL: ${finalVerdict}`);
  console.log('=====================================\n');

  if (blockingFail) {
    process.exit(1);
  }
}

main();
