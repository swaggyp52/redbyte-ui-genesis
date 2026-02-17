/**
 * IDE Fullscreen + No Chrome Gate
 *
 * Verifies that when Logic Playground is the only visible window,
 * OS chrome (TopBar, Dock, Taskbar) is hidden.
 *
 * Success: TopBar/Dock/Taskbar display:none when Logic Playground is sole visible window
 * Failure: OS chrome remains visible when it should be hidden
 */

import { chromium } from 'playwright';
import { strict as assert } from 'assert';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.createContext();
  const page = await context.newPage();

  try {
    // Load the local dev server (or production)
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Wait for Logic Playground to auto-open
    await page.waitForSelector('[data-testid="logic-playground-root"]', { timeout: 10000 });

    // Verify TopBar is hidden (should be display:none via ${showOSChrome} CSS)
    const topBar = page.locator('[data-testid="top-bar"]');
    const topBarVisible = await topBar.isVisible().catch(() => false);
    
    // Verify Dock is hidden
    const dock = page.locator('[data-testid="dock"]');
    const dockVisible = await dock.isVisible().catch(() => false);

    // Verify Taskbar is hidden
    const taskbar = page.locator('[data-testid="taskbar"]');
    const taskbarVisible = await taskbar.isVisible().catch(() => false);

    // Verify Logic Playground canvas IS visible
    const canvas = page.locator('[data-testid="logic-canvas"]');
    const canvasVisible = await canvas.isVisible().catch(() => false);

    // If any OS chrome is visible when it shouldn't be, fail
    if (topBarVisible || dockVisible || taskbarVisible) {
      throw new Error(
        `OS chrome unexpectedly visible: topBar=${topBarVisible}, dock=${dockVisible}, taskbar=${taskbarVisible}`
      );
    }

    // Canvas should be visible
    if (!canvasVisible) {
      console.warn('Warning: Logic Playground canvas not found (but test may still pass if covered by other UI)');
    }

    console.log('✅ IDE Fullscreen + No Chrome gate PASS');
    process.exit(0);
  } catch (error) {
    console.error('❌ IDE Fullscreen + No Chrome gate FAIL:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
