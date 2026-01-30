/**
 * generate-build-json.mjs
 * 
 * Generates a build.json file in the public directory (or dist).
 * Usage: node scripts/generate-build-json.mjs <output-dir> <env-tag>
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const outputDir = process.argv[2] || './public';
const envTag = process.argv[3] || 'dev';

// Ensure output dir exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

let sha = 'unknown';
try {
    sha = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
    console.warn('Could not get git SHA');
}

const buildData = {
    sha,
    timestamp: new Date().toISOString(),
    env: envTag,
    version: process.env.npm_package_version || '1.0.0'
};

const outputPath = path.join(outputDir, 'build.json');
fs.writeFileSync(outputPath, JSON.stringify(buildData, null, 2));

console.log(`✅ Generated build.json at ${outputPath}`);
console.log(buildData);
