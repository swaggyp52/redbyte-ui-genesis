import { execSync } from 'node:child_process';

interface GateResult {
  name: string;
  label: string;
  pass: boolean;
  blocking: boolean;
}

function runGate(name: string, command: string, blocking: boolean): GateResult {
  const label = name.toUpperCase();
  try {
    execSync(command, { stdio: 'pipe', timeout: 60_000 });
    return { name, label, pass: true, blocking };
  } catch {
    return { name, label, pass: false, blocking };
  }
}

function main() {
  console.log('[verify:gates:classroom] Starting classroom gate suite...\n');

  const results: GateResult[] = [
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
  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL';
    console.log(`  ${r.label}: ${status}`);
  }

  const blockingFail = results.some((r) => r.blocking && !r.pass);
  const finalVerdict = blockingFail ? 'FAIL' : 'PASS';
  console.log(`  FINAL: ${finalVerdict}`);
  console.log('===============================\n');

  if (blockingFail) {
    process.exit(1);
  }
}

main();
