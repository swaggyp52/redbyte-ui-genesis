import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * build-hijack.mjs
 * 
 * This script ensures that when Cloudflare Dashboard builds ONLY the manual-site,
 * we still trigger the ROOT unified build to get the OS at root and Docs at /docs.
 * 
 * It uses UNIFIED_BUILD_INTERNAL to break the recursion loop when pnpm -r build is called.
 */

const isInternal = process.env.UNIFIED_BUILD_INTERNAL === '1';

if (isInternal) {
    console.log('🏗️ [Internal Build] Building manual-site assets...');
    try {
        // Run the original build commands normally
        execSync('npm run prebuild', { stdio: 'inherit' });
        execSync('vite build', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Manual site build failed');
        process.exit(1);
    }
} else {
    console.log('🚀 [Hijack Mode] Triggering ROOT build:unified from manual-site subdirectory...');

    // Clear potential staleness
    if (fs.existsSync('dist')) {
        fs.rmSync('dist', { recursive: true, force: true });
    }

    try {
        // Trigger root build:unified and pass the loop-breaker flag
        execSync('pnpm -w build:unified', {
            stdio: 'inherit',
            env: { ...process.env, UNIFIED_BUILD_INTERNAL: '1' }
        });

        const rootDist = path.resolve('../../dist');
        console.log(`📦 [Sync] Copying unified artifact from ${rootDist} to local dist/`);

        if (fs.existsSync(rootDist)) {
            fs.cpSync(rootDist, './dist', { recursive: true });
            console.log('✅ Sync complete. Cloudflare will now publish the unified artifact.');
        } else {
            console.error('❌ Error: Unified dist artifact not found at', rootDist);
            process.exit(1);
        }
    } catch (e) {
        console.error('❌ Root build:unified failed');
        process.exit(1);
    }
}
