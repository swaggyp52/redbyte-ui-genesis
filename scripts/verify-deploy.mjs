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

        // 2. Deep Link Check (Lab 0)
        console.log('Testing Lab 0 Deep Link...');
        await page.goto(`${TARGET_URL}/?lab=lab-0`);
        await page.waitForTimeout(2000); // Allow OS to boot

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

        // Check for specific text that proves the app loaded (not just index.html)
        const content = await page.content();
        if (content.includes('RedByte OS') || content.includes('Loading')) {
            console.log('✅ OS Shell loaded.');
        } else {
            console.error('❌ OS Shell did not load correctly.');
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
