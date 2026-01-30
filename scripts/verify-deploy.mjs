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

        // 2. Deep Link Check (Lab 0) + Redirect
        console.log('Testing Lab 0 Deep Link (should redirect)...');
        await page.goto(`${TARGET_URL}/?lab=lab-0`);
        await page.waitForTimeout(2000); // Allow redirect && OS boot

        if (page.url().includes('/os/')) {
            console.log('✅ Redirect to /os/ working.');
        } else {
            console.warn('⚠️ Redirect to /os/ NOT detected (might be SPA routing). Current URL:', page.url());
        }

        // 3. Students Page Check
        console.log('Testing /students route...');
        const page2 = await browser.newPage();
        await page2.goto(`${TARGET_URL}/students`);
        const studentsContent = await page2.content();
        if (studentsContent.includes('Install') || studentsContent.includes('Guide')) {
            console.log('✅ Students page loaded.');
        } else {
            console.error('❌ Students page missing content.');
            hasError = true;
        }
        await page2.close();

        // 4. OS Route Check (/os/)
        console.log('Testing OS Deep Link (/os/)...');
        await page.goto(`${TARGET_URL}/os/`);
        await page.waitForTimeout(3000); // Allow OS to boot

        // Check for specific text that proves the app loaded (not just index.html)
        const content = await page.content();
        const hasOSShell = content.includes('rb-shell') || content.includes('assets/rb-apps');

        if (hasOSShell) {
            console.log('✅ OS Shell loaded (bundle verified).');
        } else {
            console.error('❌ OS Shell bundle NOT found on /os/ route.');
            // Dump partial content for debugging
            console.log('Content snippet:', content.slice(0, 500));
            hasError = true;
        }
    } catch (e) {
        console.error('❌ Exception during verify:', e);
        hasError = true;
    } finally {
        await browser.close();
        if (hasError) process.exit(1);
        console.log('✨ Deployment Verification Passed');
    }
})();
