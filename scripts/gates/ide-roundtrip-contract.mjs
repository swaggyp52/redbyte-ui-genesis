#!/usr/bin/env node
// Gate: roundtrip guarantee contract
// Tests that import → re-import produces semantically identical projects.
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const testFile = 'src/apps/ide/__tests__/zipImport.roundtrip.test.ts';

console.log('[ide-roundtrip-contract] Running round-trip unit tests...');
try {
  execSync(
    `pnpm --filter @redbyte/rb-apps exec vitest run ${testFile}`,
    { cwd: repoRoot, stdio: 'inherit' }
  );
  console.log('[ide-roundtrip-contract] PASS');
  process.exit(0);
} catch {
  console.error('[ide-roundtrip-contract] FAIL');
  process.exit(1);
}
