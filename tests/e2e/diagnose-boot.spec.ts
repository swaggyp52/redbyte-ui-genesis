import { test, expect } from '@playwright/test';

test('diagnose boot vs desktop visibility', async ({ page }) => {
  const errors: string[] = [];
  const consoleMessages: string[] = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    console.log(`[browser:${msg.type()}] ${text}`);
  });

  page.on('pageerror', err => {
    errors.push(err.message);
    console.log('[pageerror]', err.message);
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000); // Wait 3s for boot to complete

  const bootScreen = page.locator('[data-testid="shell-boot-screen"]');
  const desktop = page.locator('[data-testid="shell-desktop"]');

  const bootVisible = await bootScreen.isVisible().catch(() => false);
  const desktopVisible = await desktop.isVisible().catch(() => false);

  console.log('Boot screen visible:', bootVisible);
  console.log('Desktop visible:', desktopVisible);

  if (!bootVisible && !desktopVisible) {
    console.log('Neither boot nor desktop visible - shell may not be rendering at all');
  }

  console.log('\n=== Page Errors ===');
  errors.forEach(e => console.log(e));

  console.log('\n=== Console Messages (last 10) ===');
  consoleMessages.slice(-10).forEach(m => console.log(m));

  console.log('\n=== DOM Structure ===');
  const bodyHTML = await page.locator('body').innerHTML().catch(() => 'ERROR: Could not read body');
  console.log(bodyHTML.substring(0, 800)); // First 800 chars

  const rootExists = await page.locator('#root').count();
  console.log('\n#root element count:', rootExists);
});
