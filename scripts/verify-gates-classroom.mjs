import { execSync } from 'node:child_process';

function runGate(name, command, blocking) {
  const label = name.toUpperCase();
  try {
    execSync(command, { stdio: 'pipe', timeout: 60_000, encoding: 'utf8' });
    return { name, label, pass: true, blocking, details: '' };
  } catch (error) {
    const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
    const details = [stdout, stderr].filter(Boolean).join('\n');
    return { name, label, pass: false, blocking, details };
  }
}

function main() {
  console.log('[verify:gates:classroom] Starting classroom gate suite...\n');

  const results = [
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
