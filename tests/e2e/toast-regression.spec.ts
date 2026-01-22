import { test, expect } from '@playwright/test';

test.describe('Toast Dead-Zone Regression', () => {
    test('should not leave dead zones after toast is dismissed', async ({ page }) => {
        await page.goto('http://localhost:5173/');

        // Wait for OS to load
        await expect(page.locator('[data-testid="shell-desktop"]')).toBeVisible();

        // Close welcome modal if present
        const welcomeClose = page.locator('button:has-text("Close"), button:has-text("Get Started")');
        if (await welcomeClose.isVisible()) {
            await welcomeClose.click();
        }

        // 1. Run baseline scan
        console.log('Running baseline scan...');
        const baselineReport = await runScanner(page);
        console.log(`Baseline Success Rate: ${baselineReport.successRate}`);

        // 2. Trigger a toast (assuming Ctrl+S or similar in Logic Playground or just use a known trigger)
        // Let's use a logic playground trigger if possible, or just mock it via window.toast
        await page.evaluate(() => {
            // @ts-ignore
            window.dispatchEvent(new CustomEvent('rb-toast', { detail: { message: 'Test Toast', kind: 'info' } }));
        });

        // 3. Scan while toast is likely active
        console.log('Scanning while toast is active...');
        const activeToastReport = await runScanner(page);
        console.log(`Active Toast Success Rate: ${activeToastReport.successRate}`);

        // 4. Wait for toast to disappear (default 4s)
        await page.waitForTimeout(5000);

        // 5. Run post-dismissal scan
        console.log('Running post-dismissal scan...');
        const finalReport = await runScanner(page);
        console.log(`Post-dismissal Success Rate: ${finalReport.successRate}`);

        // Regression check: Post-dismissal should match baseline (no persistent dead zone)
        expect(parseFloat(finalReport.successRate)).toBeGreaterThanOrEqual(parseFloat(baselineReport.successRate));
    });
});

async function runScanner(page: any) {
    // Enable scanner via hotkey
    await page.keyboard.press('Control+Shift+KeyK');

    // Wait for "Scan complete." log
    const reportPromise = new Promise<any>((resolve) => {
        page.on('console', (msg: any) => {
            const text = msg.text();
            if (text.includes('JSON_REPORT_START')) {
                // The next log should be the JSON
            }
            if (msg.text().startsWith('{') && msg.text().includes('successRate')) {
                try {
                    resolve(JSON.parse(msg.text()));
                } catch (e) { }
            }
        });
    });

    // Wait a bit for scan to finish
    const report = await reportPromise;

    // Toggle scanner off
    await page.keyboard.press('Control+Shift+KeyK');

    return report;
}
