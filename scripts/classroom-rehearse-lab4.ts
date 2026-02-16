import { execSync } from 'node:child_process';

const STEP_TIMEOUT_MS = 300_000;

interface StepResult {
  name: string;
  label: string;
  pass: boolean;
  unknown: boolean;
  blocking: boolean;
  details?: string;
}

function runStep(name: string, command: string, blocking: boolean): StepResult {
  const label = name.toUpperCase();
  try {
    execSync(command, { stdio: 'pipe', timeout: STEP_TIMEOUT_MS, encoding: 'utf8' });
    return { name, label, pass: true, unknown: false, blocking, details: '' };
  } catch (error) {
    const exitCode = typeof error?.status === 'number' ? `exit=${error.status}` : '';
    const signal = typeof error?.signal === 'string' ? `signal=${error.signal}` : '';
    const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
    const details = [exitCode, signal, stdout, stderr].filter(Boolean).join('\n');
    if (!blocking) {
      return { name, label, pass: false, unknown: true, blocking, details };
    }
    return { name, label, pass: false, unknown: false, blocking, details };
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
    if (!r.pass && r.details) {
      console.log(`    ${r.details.split('\n').join('\n    ')}`);
    }
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
