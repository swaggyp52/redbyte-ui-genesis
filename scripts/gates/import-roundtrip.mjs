#!/usr/bin/env node
// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// Gate: Import roundtrip validation
//
// Purpose: Verify HDL+XDC import → circuit conversion → IO mapping bindings
// Protocol: Exit 0 if all roundtrip tests pass; exit 1 if any fail.

import { execSync } from 'child_process';
import { join } from 'path';
import { cwd } from 'process';

const repoRoot = cwd();
const testFile = 'packages/rb-apps/src/import/__tests__/importExportRoundtrip.test.ts';

console.log('🔍 Import Roundtrip Validation (PR5)');
console.log(`📍 Test: ${testFile}`);
console.log('—'.repeat(60));

try {
  execSync(`npx vitest run ${testFile} --reporter=verbose`, {
    cwd: repoRoot,
    stdio: 'inherit',
    timeout: 120000,
  });
  console.log('—'.repeat(60));
  console.log('✅ GATE PASS: All fixture imports validated');
  process.exit(0);
} catch (err) {
  console.log('—'.repeat(60));
  console.error('❌ GATE FAIL: Fixture import validation failed');
  process.exit(1);
}
