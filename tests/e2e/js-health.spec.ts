import { test } from '@playwright/test';

test('[JS-HEALTH] Static HTML baseline', async ({ page }) => {
  let errorOccurred = false;
  let errorMessage = '';

  page.on('pageerror', (e: Error) => {
    errorOccurred = true;
    errorMessage = e?.message || String(e);
    console.error('[JS-HEALTH] Page error:', errorMessage);
  });

  try {
    await page.goto('/health.html', { waitUntil: 'load', timeout: 10000 });
  } catch (err: unknown) {
    errorOccurred = true;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  await page.waitForTimeout(500);

  if (errorOccurred) {
    throw new Error(`Static HTML failed: ${errorMessage}`);
  }
});

test('[JS-HEALTH] App boot without errors', async ({ page }) => {
  let errorOccurred = false;
  let errorMessage = '';

  page.on('pageerror', (e: Error) => {
    errorOccurred = true;
    errorMessage = e?.message || String(e);
    console.error('[JS-HEALTH] Page error:', errorMessage);
  });

  try {
    await page.goto('/', { waitUntil: 'load', timeout: 15000 });
  } catch (err: unknown) {
    errorOccurred = true;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  await page.waitForTimeout(1000);

  if (errorOccurred) {
    throw new Error(`App boot failed: ${errorMessage}`);
  }

  console.log('[JS-HEALTH] App boot passed - no JS errors');
});
