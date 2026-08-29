/**
 * verify-deploy.mjs
 *
 * Smoke test for deployed environments.
 * - Fetches /build.json
 * - Checks the public start page at root
 * - Checks /os/ deep links
 * - Verifies the IDE bundle loads
 */
import { chromium } from 'playwright';

const TARGET_URL = process.env.TARGET_URL || 'https://redbyteapps.dev';
const EXPECTED_SHA = process.env.COMMIT_SHA;

console.log(`Verifying deployment at: ${TARGET_URL}`);
if (EXPECTED_SHA) console.log(`Expecting commit: ${EXPECTED_SHA}`);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    let hasError = false;

    try {
        // 1. Check build truth. /os/version.json carries the FULL commit SHA and is
        // the deploy-verification authority; /build.json carries a 7-char short SHA.
        console.log('Testing /os/version.json...');
        const versionResponse = await page.request.get(`${TARGET_URL}/os/version.json`);
        if (!versionResponse.ok()) {
            console.error('/os/version.json missing.');
            hasError = true;
        } else {
            const versionData = await versionResponse.json();
            console.log('Version data:', versionData);

            if (EXPECTED_SHA && versionData.sha !== EXPECTED_SHA) {
                console.error(`Version mismatch. Got ${versionData.sha}, expected ${EXPECTED_SHA}.`);
                hasError = true;
            }
        }

        console.log('Testing /build.json...');
        const response = await page.request.get(`${TARGET_URL}/build.json`);
        if (response.status() === 404) {
            console.error('/build.json missing.');
            hasError = true;
        } else {
            const buildData = await response.json();
            console.log('Build data:', buildData);

            if (EXPECTED_SHA && buildData.sha && !EXPECTED_SHA.startsWith(buildData.sha)) {
                console.error(`Short-SHA mismatch. Got ${buildData.sha}, expected prefix of ${EXPECTED_SHA}.`);
                hasError = true;
            }
        }

        // 2. Public start page check at root
        console.log('Testing public start page at root...');
        await page.goto(`${TARGET_URL}/`);
        const publicStartContent = await page.content();
        if (
            publicStartContent.includes('RedByte is a digital logic and FPGA workbench.') &&
            publicStartContent.includes('Project') &&
            publicStartContent.includes('Simulate') &&
            publicStartContent.includes('href="/os/"')
        ) {
            console.log('Public start page loaded at root.');
        } else {
            console.error('Public start page not found at root.');
            hasError = true;
        }

        // 3. Deep link check, direct IDE at /os/
        console.log('Testing IDE deep link at /os/...');
        await page.goto(`${TARGET_URL}/os/?lab=lab-0`);
        await page.waitForTimeout(3000);

        const content = await page.content();
        const hasIdeShell = content.includes('rb-shell') || content.includes('assets/rb-apps') || content.includes('/os/assets/');

        if (hasIdeShell) {
            console.log('IDE shell loaded at /os/.');
        } else {
            console.error('IDE shell bundle not found at /os/.');
            console.log('Content snippet:', content.slice(0, 500));
            hasError = true;
        }

        // 4. Docs check
        console.log('Testing docs route (/docs/students)...');
        const page2 = await browser.newPage();
        await page2.goto(`${TARGET_URL}/docs/students`);
        const studentsContent = await page2.content();
        if (studentsContent.includes('Install') || studentsContent.includes('Guide')) {
            console.log('Students doc page loaded.');
        } else {
            console.error('Students doc page missing content.');
            hasError = true;
        }
        await page2.close();
    } catch (e) {
        console.error('Exception during deploy verification:', e);
        hasError = true;
    } finally {
        await browser.close();
        if (hasError) process.exit(1);
        console.log('Deployment verification passed.');
    }
})();
