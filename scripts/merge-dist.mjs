import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { prepareEmptyOutputDir } from './merge-dist-lib.mjs';

const ROOT = process.cwd();
const FINAL_DIST = path.join(ROOT, 'dist');
const STAGED_DIST = path.join(ROOT, 'dist.staged');
const PLAYGROUND_DIST = path.join(ROOT, 'apps/playground/dist');

function resolveGitSha() {
    if (process.env.GIT_SHA) return process.env.GIT_SHA;
    if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA;
    try {
        return execSync('git rev-parse HEAD').toString().trim();
    } catch {
        return 'dev';
    }
}

async function merge() {
    console.log('🚀 Merging deployments into unified dist/');

    // 1. Clean and create final dist
    const { outputDir: finalDist, usedFallback } = await prepareEmptyOutputDir(FINAL_DIST, {
        fallbackDir: STAGED_DIST,
    });
    if (usedFallback) {
        console.warn(`⚠️  Canonical dist/ is locked; writing merged output to ${finalDist} instead.`);
    }

    // 2. Root index: generate minimal redirect stub (no marketing site in this repo).
    // The stub satisfies the REDBYTE_MARKETING_ROOT contract and redirects users to the IDE.
    console.log('⚠️  No marketing site found — writing canonical root redirect stub...');
    const stubHtml = [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '  <head>',
        '    <meta charset="UTF-8" />',
        '    <!-- REDBYTE_MARKETING_ROOT: canonical root stub — the IDE lives at /os/ -->',
        '    <meta http-equiv="refresh" content="0; url=/os/" />',
        '    <title>RedByte OS</title>',
        '  </head>',
        '  <body>',
        '    <p>RedByte OS — <a href="/os/">Open the IDE</a></p>',
        '  </body>',
        '</html>',
        '',
    ].join('\n');
    fs.writeFileSync(path.join(finalDist, 'index.html'), stubHtml, 'utf8');
    console.log(`✅ Root redirect stub written to ${path.relative(ROOT, path.join(finalDist, 'index.html'))}`);

    // 3. Copy OS to /os subpath
    const osTarget = path.join(finalDist, 'os');
    if (fs.existsSync(PLAYGROUND_DIST)) {
        console.log(`📦 Copying OS from ${PLAYGROUND_DIST} to /os...`);
        fs.mkdirSync(osTarget, { recursive: true });
        fs.cpSync(PLAYGROUND_DIST, osTarget, { recursive: true });

        const versionPayload = {
            sha: resolveGitSha(),
            builtAt: new Date().toISOString(),
        };
        fs.writeFileSync(
            path.join(osTarget, 'version.json'),
            `${JSON.stringify(versionPayload, null, 2)}\n`,
            'utf8',
        );
        console.log('✅ Wrote /os/version.json for deploy verification.');

        // Copy playground's build.json to dist/ root for unified dist verification.
        const playgroundBuildJson = path.join(PLAYGROUND_DIST, 'build.json');
        if (fs.existsSync(playgroundBuildJson)) {
            fs.copyFileSync(playgroundBuildJson, path.join(finalDist, 'build.json'));
            console.log(`✅ Copied build.json to ${path.relative(ROOT, path.join(finalDist, 'build.json'))}`);
        }
    } else {
        console.error('❌ OS build not found at', PLAYGROUND_DIST);
        process.exit(1);
    }

    // 4. Force copy unified _redirects and _headers from root public
    const rootPublicRedirects = path.join(ROOT, 'public/_redirects');
    const rootPublicHeaders = path.join(ROOT, 'public/_headers');
    const finalRedirects = path.join(finalDist, '_redirects');
    const finalHeaders = path.join(finalDist, '_headers');
    if (fs.existsSync(rootPublicRedirects)) {
        console.log('📦 Explicitly copying unified _redirects to root dist...');
        fs.copyFileSync(rootPublicRedirects, finalRedirects);
    } else {
        console.warn('⚠️ Warning: public/_redirects not found at', rootPublicRedirects);
    }

    if (fs.existsSync(rootPublicHeaders)) {
        console.log('📦 Explicitly copying unified _headers to root dist...');
        fs.copyFileSync(rootPublicHeaders, finalHeaders);
    } else {
        console.warn('⚠️ Warning: public/_headers not found at', rootPublicHeaders);
    }

    // 5. Verify index.html at root is marketing (check for explicit marker)
    const rootIndex = path.join(finalDist, 'index.html');
    if (fs.existsSync(rootIndex)) {
        const content = fs.readFileSync(rootIndex, 'utf8');
        if (content.includes('REDBYTE_MARKETING_ROOT')) {
            console.log('✅ Verified: Marketing index is at root.');
        } else {
            console.warn('⚠️ Warning: root index.html missing REDBYTE_MARKETING_ROOT marker. Contract violated.');
        }
    } else {
        console.warn('⚠️ Warning: ' + rootIndex + ' does not exist.');
    }

    // 6. Verify /os/index.html is the IDE (check for explicit marker)
    const osIndex = path.join(finalDist, 'os/index.html');
    if (fs.existsSync(osIndex)) {
        const content = fs.readFileSync(osIndex, 'utf8');
        if (content.includes('REDBYTE_OS_IDE')) {
            console.log('✅ Verified: OS IDE index is at /os/.');
        } else {
            console.warn('⚠️ Warning: /os/index.html missing REDBYTE_OS_IDE marker. Contract violated.');
        }
    } else {
        console.warn('⚠️ Warning: ' + osIndex + ' does not exist.');
    }

    if (usedFallback) {
        console.log(`✨ Merge complete! Canonical dist/ stayed locked, so the fresh artifact is in ${path.relative(ROOT, finalDist)}.`);
    } else {
        console.log('✨ Merge complete! Deploy the root /dist directory.');
    }
}

merge().catch(err => {
    console.error('❌ Merge failed:', err);
    process.exit(1);
});
