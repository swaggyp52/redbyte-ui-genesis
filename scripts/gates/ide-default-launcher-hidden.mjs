/**
 * IDE Default Launcher Hidden Gate
 *
 * Verifies that the launcher modal is NOT shown by default on fresh load.
 * The app should go directly to Logic Playground fullscreen.
 *
 * Success: Launcher modal not visible on fresh load
 * Failure: Launcher modal is visible (should only open with ?launcher=1 param)
 */

import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Give UI time to settle
    await page.waitForTimeout(2000);

    // Check that launcher modal/app is NOT visible
    const launcherApp = page.locator('[data-app-id="launcher"]');
    const launcherVisible = await launcherApp.isVisible().catch(() => false);

    // Also check by looking for the common launcher UI elements
    const appGrid = page.locator('[data-testid="app-grid"]');
    const appGridVisible = await appGrid.isVisible().catch(() => false);

    if (launcherVisible || appGridVisible) {
      throw new Error('Launcher unexpectedly visible on default load');
    }

    console.log('✅ IDE Default Launcher Hidden gate PASS');
    process.exit(0);
  } catch (error) {
    console.error('❌ IDE Default Launcher Hidden gate FAIL:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
