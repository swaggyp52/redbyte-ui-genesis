import fs from 'fs';
import path from 'path';

const DIST = path.join(process.cwd(), 'dist');

console.log('Verifying static dist artifact...');

function check(condition, message) {
    if (!condition) {
        console.error(`FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`OK: ${message}`);
}

// 1. Root structure
check(fs.existsSync(DIST), 'dist/ exists');
check(fs.existsSync(path.join(DIST, 'index.html')), 'dist/index.html exists');
check(fs.existsSync(path.join(DIST, 'start.html')), 'dist/start.html exists');
check(fs.existsSync(path.join(DIST, 'build.json')), 'dist/build.json exists');
// Note: dist/assets/ is not required; root is a public-start fallback with no compiled assets of its own.

// 2. Root public entry checks
const rootIndex = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
check(rootIndex.includes('REDBYTE_PUBLIC_ROOT'), 'dist/index.html has REDBYTE_PUBLIC_ROOT marker');
check(rootIndex.includes('/start.html'), 'dist/index.html fallback targets /start.html');
check(!/url=\/os\/?/i.test(rootIndex), 'dist/index.html does not fallback-redirect root to /os/');

const startHtml = fs.readFileSync(path.join(DIST, 'start.html'), 'utf8').replace(/\s+/g, ' ').trim();
check(startHtml.includes('data-testid="redbyte-start-page"'), 'dist/start.html is the RedByte public start page');
check(startHtml.includes('RedByte is a digital logic and FPGA workbench.'), 'dist/start.html states current product truth');
check(startHtml.includes('href="/os/"'), 'dist/start.html links to the IDE at /os/');
check(
    startHtml.includes('E0') && startHtml.includes('E1') && startHtml.includes('E2') && startHtml.includes('E3'),
    'dist/start.html keeps E0/E1/E2/E3 evidence levels visible',
);

// 3. OS structure
const OS = path.join(DIST, 'os');
check(fs.existsSync(OS), 'dist/os/ exists');
check(fs.existsSync(path.join(OS, 'index.html')), 'dist/os/index.html exists');
check(fs.existsSync(path.join(OS, 'assets')), 'dist/os/assets/ exists');
check(fs.readdirSync(path.join(OS, 'assets')).length > 0, 'dist/os/assets/ contains files');

// 4. OS content check
const osIndex = fs.readFileSync(path.join(OS, 'index.html'), 'utf8');
check(osIndex.includes('RedByte Playground'), 'dist/os/index.html is the OS');
check(osIndex.includes('REDBYTE_OS_IDE'), 'dist/os/index.html has REDBYTE_OS_IDE marker');
check(osIndex.includes('src="/os/assets/'), 'dist/os/index.html uses /os assets');
check(fs.existsSync(path.join(OS, 'version.json')), 'dist/os/version.json exists');
const versionJson = JSON.parse(fs.readFileSync(path.join(OS, 'version.json'), 'utf8'));
check(Boolean(versionJson.sha), 'dist/os/version.json includes sha');
check(Boolean(versionJson.builtAt), 'dist/os/version.json includes builtAt');

// 5. Redirects check
check(fs.existsSync(path.join(DIST, '_redirects')), 'dist/_redirects exists');
const redirects = fs.readFileSync(path.join(DIST, '_redirects'), 'utf8');
check(/^\s*\/\s+\/start\.html\s+302\s*$/m.test(redirects), 'dist/_redirects root redirect sends / to /start.html');
check(!/^\s*\/\s+\/os\/?\s+30[12]\s*$/m.test(redirects), 'dist/_redirects root redirect does not send / to /os/');
check(/^\s*\/os\s+\/os\/\s+302\s*$/m.test(redirects), 'dist/_redirects normalizes /os to /os/');

// 5b. Headers check
check(fs.existsSync(path.join(DIST, '_headers')), 'dist/_headers exists');
const headers = fs.readFileSync(path.join(DIST, '_headers'), 'utf8');
check(headers.includes('/index.html'), 'dist/_headers contains root index cache rule');
check(headers.includes('/start.html'), 'dist/_headers contains public start page cache rule');
check(headers.includes('/os/index.html'), 'dist/_headers contains /os index cache rule');

// 6. Environment check (if build.json exists)
const buildJson = JSON.parse(fs.readFileSync(path.join(DIST, 'build.json'), 'utf8'));
if (process.env.GITHUB_ACTIONS || process.env.CF_PAGES) {
    check(buildJson.env === 'production', `build.json env is "production" (detected CI)`);
}

// 7. Version stamp check - ensure build artifacts contain version info when the shell chunk exists.
const osAssets = fs.readdirSync(path.join(OS, 'assets')).filter(f => f.endsWith('.js'));
const shellChunk = osAssets.find(f => f.includes('rb-shell'));
if (shellChunk) {
    const shellJs = fs.readFileSync(path.join(OS, 'assets', shellChunk), 'utf8');
    check(shellJs.includes('RedByte OS'), 'rb-shell chunk contains "RedByte OS" brand string');
    // Version string should be present (injected via version.ts)
    check(shellJs.includes('1.0.0') || shellJs.includes('v1.'), 'rb-shell chunk contains version stamp');
}

// 8. No source maps leaked in production (if strict mode, only if root assets/ exists)
if (process.env.RB_STRICT_DIST === '1' && fs.existsSync(path.join(DIST, 'assets'))) {
    const allAssets = fs.readdirSync(path.join(DIST, 'assets'));
    const mapFiles = allAssets.filter(f => f.endsWith('.map'));
    check(mapFiles.length === 0, 'No .map files in production dist/assets/');
}

console.log('dist/ verification complete. Artifact is valid.');
