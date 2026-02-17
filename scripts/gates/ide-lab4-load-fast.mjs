/**
 * IDE Lab 4 Load Fast Gate
 *
 * Verifies that Lab 4 loads and is interactive in under 10 seconds.
 *
 * Success: Lab 4 loads and readiness signal fires within 10 seconds
 * Failure: Lab 4 takes >10 seconds or fails to load
 */

import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.createContext();
  const page = await context.newPage();

  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    const startTime = Date.now();

    // Open with Lab 4 starter instructions
    await page.goto(`${baseUrl}?labId=lab-04`, { waitUntil: 'networkidle' });

    // Wait for Logic Playground readiness signal (fires when UI is fully mounted)
    await page.waitForEvent('request', async (request) => {
      if (request.url().includes('rb:logic-playground-ready')) return true;
    }).catch(() => null);

    // Alternative: wait for the root element to have data-ready attribute
    await page.waitForFunction(
      () => {
        const root = document.querySelector('[data-testid="logic-playground-root"]');
        return root?.getAttribute('data-ready') === 'true';
      },
      { timeout: 10000 }
    ).catch(() => {
      // If data-ready doesn't exist, just verify the root element is present and visible
      return page.waitForSelector('[data-testid="logic-playground-root"]', { timeout: 10000 });
    });

    const loadTime = Date.now() - startTime;
    const loadTimeSeconds = (loadTime / 1000).toFixed(2);

    if (loadTime > 10000) {
      throw new Error(`Lab 4 took ${loadTimeSeconds}s to load (threshold: 10s)`);
    }

    console.log(`✅ IDE Lab 4 Load Fast gate PASS (${loadTimeSeconds}s)`);
    process.exit(0);
  } catch (error) {
    console.error('❌ IDE Lab 4 Load Fast gate FAIL:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
