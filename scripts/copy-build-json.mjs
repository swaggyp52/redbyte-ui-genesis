/**
 * copy-build-json.mjs
 * 
 * Copies the generated build.json to app dist folders if they exist.
 */
import fs from 'fs';
import path from 'path';

const apps = ['apps/playground/dist', 'apps/manual-site/dist'];
const source = 'public/build.json'; // Assuming generate-build-json writes here or we write directly

// Actually, let's just write directly to dists
import { execSync } from 'child_process';

const sha = (() => {
    try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'unknown'; }
})();

const data = JSON.stringify({
    sha,
    timestamp: new Date().toISOString(),
    env: process.env.VITE_APP_ENV || 'dev',
    version: process.env.npm_package_version || '1.0.0'
}, null, 2);

apps.forEach(dist => {
    const target = path.join(process.cwd(), dist, 'build.json');
    const dir = path.dirname(target);
    if (fs.existsSync(dir)) {
        fs.writeFileSync(target, data);
        console.log(`✅ Wrote build.json to ${dist}`);
    } else {
        console.log(`⚠️  Skipping ${dist} (dir not found)`);
    }
});
