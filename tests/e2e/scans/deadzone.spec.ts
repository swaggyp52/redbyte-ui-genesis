
import { test, expect } from '@playwright/test';

test('DeadZone Scanner Report', async ({ page }) => {
    // Navigate
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for desktop to settle
    await page.waitForTimeout(2000);

    // Activate Scanner (Scan runs automatically on mount via Shell.tsx prop if enabled,
    // but we can press key just in case, or just wait for report)
    // await page.keyboard.press('Control+Shift+K'); 

    // Wait for scan to complete (global var populated)
    await page.waitForFunction(() => (window as any).__deadZoneReport);

    // Get report
    const report = await page.evaluate(() => (window as any).__deadZoneReport);
    console.log('JSON_REPORT_START');
    console.log(JSON.stringify(report, null, 2));
    console.log('JSON_REPORT_END');
});
