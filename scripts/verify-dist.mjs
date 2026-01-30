import fs from 'fs';
import path from 'path';

const DIST = path.join(process.cwd(), 'dist');

console.log('🔍 Verifying static dist artifact...');

function check(condition, message) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`✅ ${message}`);
}

// 1. Root Structure
check(fs.existsSync(DIST), 'dist/ exists');
check(fs.existsSync(path.join(DIST, 'index.html')), 'dist/index.html exists');
check(fs.existsSync(path.join(DIST, 'build.json')), 'dist/build.json exists');
check(fs.existsSync(path.join(DIST, 'assets')), 'dist/assets/ exists');

// 2. OS Content Check
const rootIndex = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
check(rootIndex.includes('RedByte Playground'), 'dist/index.html is the OS (Playground)');
check(rootIndex.includes('src="/assets/') || rootIndex.includes('href="/assets/'), 'dist/index.html uses root assets');

// 3. Docs Structure
const DOCS = path.join(DIST, 'docs');
check(fs.existsSync(DOCS), 'dist/docs/ exists');
check(fs.existsSync(path.join(DOCS, 'index.html')), 'dist/docs/index.html exists');
check(fs.existsSync(path.join(DOCS, 'assets')), 'dist/docs/assets/ exists');

// 4. Docs Content Check
const docsIndex = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
check(docsIndex.includes('RedByte OS Genesis'), 'dist/docs/index.html is the Docs');
check(docsIndex.includes('src="/docs/assets/'), 'dist/docs/index.html uses /docs assets');

// 5. Environment Check (if build.json exists)
const buildJson = JSON.parse(fs.readFileSync(path.join(DIST, 'build.json'), 'utf8'));
if (process.env.GITHUB_ACTIONS || process.env.CF_PAGES) {
    check(buildJson.env === 'production', `build.json env is "production" (detected CI)`);
}

console.log('✨ dist/ verification complete. Artifact is valid.');
