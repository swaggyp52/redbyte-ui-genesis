/**
 * verify-deploy.mjs
 * 
 * Smoke test for deployed environments.
 * - Fetches /build.json
 * - Checks deep links
 * - Verifies OS shell loads
 */
import { chromium } from 'playwright';

const TARGET_URL = process.env.TARGET_URL || 'https://redbyteapps.dev';
const EXPECTED_SHA = process.env.COMMIT_SHA;

console.log(`🔍 Verifying deployment at: ${TARGET_URL}`);
if (EXPECTED_SHA) console.log(`🎯 Expecting Commit: ${EXPECTED_SHA}`);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    let hasError = false;

    try {
        // 1. Check Build Truth
        console.log('Testing /build.json...');
        const response = await page.request.get(`${TARGET_URL}/build.json`);
        if (response.status() === 404) {
            console.error('❌ /build.json missing!');
            hasError = true;
        } else {
            const buildData = await response.json();
            console.log('✅ Build Data:', buildData);

            if (EXPECTED_SHA && buildData.sha !== EXPECTED_SHA) {
                console.error(`❌ Version mismatch! Got ${buildData.sha}, expected ${EXPECTED_SHA}`);
                hasError = true;
            }
        }

        // 2. Marketing Site Check (Root)
        console.log('Testing Marketing Site (Root)...');
        await page.goto(`${TARGET_URL}/`);
        const marketingContent = await page.content();
        if (marketingContent.includes('RedByte OS Genesis') || marketingContent.includes('The OS for')) {
            console.log('✅ Marketing site loaded at root.');
        } else {
            console.error('❌ Marketing site NOT found at root.');
            hasError = true;
        }

        // 3. Deep Link Check (Lab 0 - Direct in OS at /os/)
        console.log('Testing Lab 0 Deep Link (OS Direct at /os/)...');
        await page.goto(`${TARGET_URL}/os/?lab=lab-0`);
        await page.waitForTimeout(3000); // Allow OS to boot

        const content = await page.content();
        const hasOSShell = content.includes('rb-shell') || content.includes('assets/rb-apps') || content.includes('/os/assets/');

        if (hasOSShell) {
            console.log('✅ OS Shell loaded at /os/ (bundle verified).');
        } else {
            console.error('❌ OS Shell bundle NOT found at /os/.');
            console.log('Content snippet:', content.slice(0, 500));
            hasError = true;
        }

        // 4. Docs Check (/docs/students)
        console.log('Testing Docs Route (/docs/students)...');
        const page2 = await browser.newPage();
        await page2.goto(`${TARGET_URL}/docs/students`);
        const studentsContent = await page2.content();
        if (studentsContent.includes('Install') || studentsContent.includes('Guide')) {
            console.log('✅ Students doc page loaded.');
        } else {
            console.error('❌ Students doc page missing content.');
            hasError = true;
        }
        await page2.close();
    } catch (e) {
        console.error('❌ Exception during verify:', e);
        hasError = true;
    } finally {
        await browser.close();
        if (hasError) process.exit(1);
        console.log('✨ Deployment Verification Passed');
    }
})();
