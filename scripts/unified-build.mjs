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
        const manifest = JSON.parse(fs.readFileSync(`packages/${pkg}/package.json`, 'utf8'));
        if (!manifest.scripts?.build) {
            console.log(`  ${pkg}: no build script`);
            continue;
        }
        console.log(`  Building ${pkg}...`);
        execSync(`pnpm --filter @redbyte/${pkg} run build`, { stdio: 'inherit', env });
    }

    // A candidate is exactly one build (RB-DEBT-018). On Windows Vite never empties its output
    // (emptyOutDir is off there to survive a locked folder), so files from earlier builds would be
    // merged and packaged. A candidate build starts from an empty playground output or stops.
    if (process.env.RB_CANDIDATE_VERSION) {
        const playgroundDist = 'apps/playground/dist';
        try {
            fs.rmSync(playgroundDist, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        } catch (error) {
            console.error(`A candidate build needs an empty ${playgroundDist}; it could not be removed (${error.code ?? error.message}). Stop any preview serving it and build again.`);
            throw error;
        }
        console.log(`  Candidate ${process.env.RB_CANDIDATE_VERSION}: emptied ${playgroundDist}`);
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
