import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const FINAL_DIST = path.join(ROOT, 'dist');
const PLAYGROUND_DIST = path.join(ROOT, 'apps/playground/dist');
const MANUAL_DIST = path.join(ROOT, 'apps/manual-site/dist');

async function merge() {
    console.log('🚀 Merging deployments into unified dist/');

    // 1. Clean and create final dist
    if (fs.existsSync(FINAL_DIST)) {
        fs.rmSync(FINAL_DIST, { recursive: true, force: true });
    }
    fs.mkdirSync(FINAL_DIST, { recursive: true });

    // 2. Copy Marketing to root
    if (fs.existsSync(MANUAL_DIST)) {
        console.log(`📦 Copying Marketing site from ${MANUAL_DIST} to root...`);
        fs.cpSync(MANUAL_DIST, FINAL_DIST, { recursive: true });
    } else {
        console.error('❌ Marketing build not found at', MANUAL_DIST);
        process.exit(1);
    }

    // 3. Copy OS to /os subpath
    const osTarget = path.join(FINAL_DIST, 'os');
    if (fs.existsSync(PLAYGROUND_DIST)) {
        console.log(`📦 Copying OS from ${PLAYGROUND_DIST} to /os...`);
        fs.mkdirSync(osTarget, { recursive: true });
        fs.cpSync(PLAYGROUND_DIST, osTarget, { recursive: true });
    } else {
        console.error('❌ OS build not found at', PLAYGROUND_DIST);
        process.exit(1);
    }

    // 4. Force copy unified _redirects from root public
    const rootPublicRedirects = path.join(ROOT, 'public/_redirects');
    const finalRedirects = path.join(FINAL_DIST, '_redirects');
    if (fs.existsSync(rootPublicRedirects)) {
        console.log('📦 Explicitly copying unified _redirects to root dist...');
        fs.copyFileSync(rootPublicRedirects, finalRedirects);
    } else {
        console.warn('⚠️ Warning: public/_redirects not found at', rootPublicRedirects);
    }

    // 5. Verify index.html at root looks like marketing
    const rootIndex = path.join(FINAL_DIST, 'index.html');
    if (fs.existsSync(rootIndex)) {
        const content = fs.readFileSync(rootIndex, 'utf8');
        if (content.includes('RedByte OS Genesis')) {
            console.log('✅ Verified: Marketing index is at root.');
        } else {
            console.warn('⚠️ Warning: root index.html does not look like the RedByte Marketing Site.');
        }
    }

    // 6. Verify /os/index.html
    const osIndex = path.join(FINAL_DIST, 'os/index.html');
    if (fs.existsSync(osIndex)) {
        const content = fs.readFileSync(osIndex, 'utf8');
        if (content.includes('RedByte Playground')) {
            console.log('✅ Verified: OS index is at /os/.');
        } else {
            console.warn('⚠️ Warning: /os/index.html does not look like the RedByte OS.');
        }
    }

    console.log('✨ Merge complete! Deploy the root /dist directory.');
}

merge().catch(err => {
    console.error('❌ Merge failed:', err);
    process.exit(1);
});
