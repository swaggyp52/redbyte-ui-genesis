import { execSync } from 'child_process';
import fs from 'fs';

/**
 * unified-build.mjs
 * 
 * Orchestrates the full build pipeline:
 * 1. Sets UNIFIED_BUILD_INTERNAL=1 to prevent recursion.
 * 2. Runs the workspace build.
 * 3. Runs the merge script.
 * 4. Runs the static verification script.
 */

console.log('🏗️ Starting Unified Build Pipeline...');

try {
    const env = { ...process.env, UNIFIED_BUILD_INTERNAL: '1' };

    console.log('1. Building manual site...');
    execSync('pnpm --filter @redbyte/manual-site build', { stdio: 'inherit', env });

    console.log('2. Building playground OS...');
    execSync('pnpm --filter @redbyte/playground build', { stdio: 'inherit', env });

    console.log('3. Merging artifacts...');
    execSync('node scripts/merge-dist.mjs', { stdio: 'inherit', env });

    console.log('4. Verifying distribution...');
    execSync('node scripts/verify-dist.mjs', { stdio: 'inherit', env });

    console.log('✨ Unified Build Succeeded!');
} catch (e) {
    console.error('❌ Unified Build Failed');
    process.exit(1);
}
