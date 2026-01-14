import { test, expect } from '@playwright/test';

test('[JS-HEALTH-SIMPLE] App boot /?boot=bisect&step=0', async ({ page }) => {
  let errorOccurred = false;
  let errorMessage = '';
  
  // Capture any JavaScript errors
  page.on('pageerror', (err) => {
    errorOccurred = true;
    errorMessage = err.message;
    console.error('[ERROR] Page error:', err.message);
  });

  // Try to load the page with a timeout
  let loadFailed = false;
  try {
    await page.goto('/?boot=bisect&step=0', { timeout: 20000 });
  } catch (err) {
    loadFailed = true;
    errorMessage = String(err);
    console.error('[ERROR] Load failed:', err);
  }

  // Wait a bit for any async errors to surface
  await page.waitForTimeout(500);

  // Check results
  if (loadFailed) {
    throw new Error(`[FAIL] Page load failed: ${errorMessage}`);
  }
  
  if (errorOccurred) {
    throw new Error(`[FAIL] JavaScript error: ${errorMessage}`);
  }

  console.log('[PASS] App boot test passed - no errors detected');
});
