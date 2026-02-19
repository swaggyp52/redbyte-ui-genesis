#!/usr/bin/env node

import { execSync } from 'node:child_process';

const TEST_FILE = 'packages/rb-apps/src/__tests__/ide-synth-subset-contract.test.ts';

function fail(message) {
  console.error(`[ide-synth-subset-contract] ${message}`);
  process.exit(1);
}

try {
  execSync(`pnpm exec vitest run ${TEST_FILE} --reporter=verbose`, {
    stdio: 'inherit',
    timeout: 120_000,
  });
  console.log('[ide-synth-subset-contract] PASS');
} catch {
  fail('Synthesis subset contract failed.');
}
