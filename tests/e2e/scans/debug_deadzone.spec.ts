import { test, expect } from '@playwright/test';

test('Debug DeadZone Scanner', async ({ page }) => {
    // 1. Navigate
    console.log('Navigating to /...');
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 2. Wait a bit
    console.log('Waiting 5s for boot...');
    await page.waitForTimeout(5000);

    // 3. Check for specific elements
    const scanner = page.locator('text=DEAD-ZONE SCANNER');
    const isScannerVisible = await scanner.isVisible();
    console.log(`Scanner Visible: ${isScannerVisible}`);

    const blocker = page.locator('#preact-border-shadow-host');
    const isBlockerGone = await blocker.count() === 0 || await blocker.isHidden();
    console.log(`Old Blocker Gone: ${isBlockerGone}`);

    // Screenshot for visual confirm
    await page.screenshot({ path: 'artifacts/playwright/debug_screenshot.png' });
    console.log('Screenshot saved to artifacts/playwright/debug_screenshot.png');

    // 4. Check window object
    const report = await page.evaluate(() => (window as any).__deadZoneReport);
    console.log('Window Report Present:', !!report);
    if (report) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log('Report is NULL. Dumping invalid report state if any...');
    }
});
