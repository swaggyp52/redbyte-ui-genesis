/**
 * copy-build-json.mjs
 * 
 * Usage: node copy-build-json.mjs <target-dist-dir>
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const targetDir = process.argv[2];

if (!targetDir) {
    console.error('❌ Usage: node copy-build-json.mjs <target-dist-dir>');
    process.exit(1);
}

const sha = (() => {
    try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'unknown'; }
})();

const data = JSON.stringify({
    sha,
    timestamp: new Date().toISOString(),
    env: process.env.VITE_APP_ENV || 'dev',
    version: process.env.npm_package_version || '1.0.0'
}, null, 2);

const absoluteTarget = path.resolve(process.cwd(), targetDir);
const outputPath = path.join(absoluteTarget, 'build.json');

if (fs.existsSync(absoluteTarget)) {
    fs.writeFileSync(outputPath, data);
    console.log(`✅ Wrote build.json to ${outputPath}`);
} else {
    console.error(`❌ Target directory not found: ${absoluteTarget}`);
    // Don't fail build if dist missing, just warn? No, explicit failure is better.
    process.exit(1);
}
