import { execSync } from 'child_process';
import fs from 'fs';

/**
 * unified-build.mjs
 * 
 * Orchestrates the full build pipeline:
 * 0. Pre-build all packages (so apps can resolve them cleanly)
 * 1. Sets UNIFIED_BUILD_INTERNAL=1 to prevent recursion.
 * 2. Builds the apps (manual-site, playground).
 * 3. Merges artifacts.
 * 4. Verifies the distribution.
 */

console.log('🏗️ Starting Unified Build Pipeline...');

try {
    const env = { ...process.env, UNIFIED_BUILD_INTERNAL: '1' };

    // 0. Pre-build all packages so apps can resolve them via node_modules
    console.log('0. Pre-building workspace packages...');
    const packagesToBuild = [
        'rb-apps',
        'rb-theme',
        'rb-icons',
        'rb-utils',
        'rb-primitives',
        'rb-logic-core',
        'rb-instruments',
        'rb-lab-engine',
    ];
    for (const pkg of packagesToBuild) {
        try {
            execSync(`pnpm --filter @redbyte/${pkg} run build`, { stdio: 'pipe', env });
        } catch (err) {
            // Some packages may not have a build script, that's OK
        }
    }

    console.log('1. Building playground OS...');
    execSync('pnpm --filter @redbyte/playground build', { stdio: 'inherit', env });

    console.log('2. Merging artifacts...');
    execSync('node scripts/merge-dist.mjs', { stdio: 'inherit', env });

    console.log('3. Verifying distribution...');
    execSync('node scripts/verify-dist.mjs', { stdio: 'inherit', env });

    console.log('✨ Unified Build Succeeded!');
} catch (e) {
    console.error('❌ Unified Build Failed');
    process.exit(1);
}
