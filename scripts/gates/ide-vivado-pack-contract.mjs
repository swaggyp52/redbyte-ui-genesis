#!/usr/bin/env node

import { execSync } from 'node:child_process';

const TEST_FILE = 'packages/rb-apps/src/__tests__/ide-vivado-pack-contract.test.ts';

function fail(message) {
  console.error(`[ide-vivado-pack-contract] ${message}`);
  process.exit(1);
}

try {
  execSync(`pnpm exec vitest run ${TEST_FILE} --reporter=verbose`, {
    stdio: 'inherit',
    timeout: 180_000,
  });
  console.log('[ide-vivado-pack-contract] PASS');
} catch {
  fail('Vivado export pack contract failed.');
}
