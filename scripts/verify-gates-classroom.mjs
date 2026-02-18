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
