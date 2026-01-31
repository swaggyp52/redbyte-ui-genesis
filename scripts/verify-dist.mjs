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

// 2. Marketing Content Check
const rootIndex = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
check(rootIndex.includes('RedByte OS Genesis'), 'dist/index.html is the Marketing site');
check(rootIndex.includes('src="/assets/') || rootIndex.includes('href="/assets/'), 'dist/index.html uses root assets');

// 3. OS Structure
const OS = path.join(DIST, 'os');
check(fs.existsSync(OS), 'dist/os/ exists');
check(fs.existsSync(path.join(OS, 'index.html')), 'dist/os/index.html exists');
check(fs.existsSync(path.join(OS, 'assets')), 'dist/os/assets/ exists');

// 4. OS Content Check
const osIndex = fs.readFileSync(path.join(OS, 'index.html'), 'utf8');
check(osIndex.includes('RedByte Playground'), 'dist/os/index.html is the OS');
check(osIndex.includes('src="/os/assets/'), 'dist/os/index.html uses /os assets');

// 5. Redirects check
check(fs.existsSync(path.join(DIST, '_redirects')), 'dist/_redirects exists');
const redirects = fs.readFileSync(path.join(DIST, '_redirects'), 'utf8');
check(redirects.includes('/os/*'), 'dist/_redirects contains /os/* fallback');
check(redirects.includes('/* /index.html 200'), 'dist/_redirects contains root fallback');

// 6. Environment Check (if build.json exists)
const buildJson = JSON.parse(fs.readFileSync(path.join(DIST, 'build.json'), 'utf8'));
if (process.env.GITHUB_ACTIONS || process.env.CF_PAGES) {
    check(buildJson.env === 'production', `build.json env is "production" (detected CI)`);
}

// 7. Version Stamp Check — ensure build artifacts contain version info
const osAssets = fs.readdirSync(path.join(OS, 'assets')).filter(f => f.endsWith('.js'));
const shellChunk = osAssets.find(f => f.includes('rb-shell'));
if (shellChunk) {
    const shellJs = fs.readFileSync(path.join(OS, 'assets', shellChunk), 'utf8');
    check(shellJs.includes('RedByte OS'), 'rb-shell chunk contains "RedByte OS" brand string');
    // Version string should be present (injected via version.ts)
    check(shellJs.includes('1.0.0') || shellJs.includes('v1.'), 'rb-shell chunk contains version stamp');
}

// 8. No source maps leaked in production (if strict mode)
if (process.env.RB_STRICT_DIST === '1') {
    const allAssets = fs.readdirSync(path.join(DIST, 'assets'));
    const mapFiles = allAssets.filter(f => f.endsWith('.map'));
    check(mapFiles.length === 0, 'No .map files in production dist/assets/');
}

console.log('✨ dist/ verification complete. Artifact is valid.');
